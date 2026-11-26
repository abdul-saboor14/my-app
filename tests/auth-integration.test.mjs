import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import next from "next";
import { neon } from "@neondatabase/serverless";
import argon2 from "argon2";
import { createAdministrator } from "../scripts/provision-admin.mjs";

test("customer and admin sessions, settings, recovery, and menu access stay separate", { timeout: 60000 }, async () => {
  const db = new PGlite();
  const server = createServer();
  const originalFetch = globalThis.fetch;
  const email = "guest@example.invalid";
  const password = "TestPassword1!";
  const newPassword = "TestPassword2!";
  const resetPassword = "TestPassword3!";
  const adminEmail = "staff@example.invalid";
  const adminPassword = "AdminPassword1!";
  const nextAdminPassword = "AdminPassword2!";
  const sentLinks = new Map();

  for (const file of ["003_savoria_auth.sql", "004_separate_account_roles.sql"]) {
    await db.exec(await readFile(new URL(`../database/migrations/${file}`, import.meta.url), "utf8"));
  }
  await db.exec(`
    CREATE TABLE menu_items (
      id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY, name text, description text, price numeric
    );
    INSERT INTO menu_items (name, description, price) VALUES ('Fixture dish', 'Fixture', 1200);
  `);

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  Object.assign(process.env, {
    APP_URL: base,
    AUTH_ALLOWED_ORIGINS: "",
    AUTH_CLIENT_IP_HEADER: "",
    AUTH_PEPPER: randomBytes(32).toString("hex"),
    DATABASE_URL: "postgresql://test:test@database.example.invalid/test",
    RESEND_API_KEY: "test-key",
    RESEND_FROM_EMAIL: "test@example.invalid",
    RESEND_BASE_URL: "https://mail.example.invalid",
  });

  globalThis.fetch = async (input, init) => {
    const headers = new Headers(init?.headers);
    const connection = headers.get("Neon-Connection-String");
    if (connection) {
      assert.equal(new URL(connection).hostname, "database.example.invalid");
      const { query, params } = JSON.parse(init.body);
      try {
        const result = await db.query(query, params, { rowMode: "array" });
        const rows = result.rows.map((row) => row.map((value) => {
          if (value === null) return null;
          if (Array.isArray(value)) return `{${value.join(",")}}`;
          return String(value);
        }));
        return Response.json({ fields: result.fields, rows, rowCount: rows.length });
      } catch (error) {
        return Response.json({ code: error.code, message: error.message }, { status: 400 });
      }
    }
    const url = new URL(input instanceof Request ? input.url : input);
    if (url.hostname === "mail.example.invalid") {
      const { text } = JSON.parse(init.body);
      const link = new URL(text.match(/http[^\s]+/u)[0]);
      sentLinks.set(link.pathname, link);
      return Response.json({ id: "test-email" });
    }
    assert.equal(url.hostname, "127.0.0.1");
    return originalFetch(input, init);
  };

  const app = next({ dev: false, hostname: "127.0.0.1", port, httpServer: server });
  const request = (path, init) => originalFetch(new URL(path, base), init);
  const post = (path, data, cookie) => request(path, {
    method: "POST",
    headers: { Origin: base, "Content-Type": "application/json", ...(cookie && { Cookie: cookie }) },
    body: JSON.stringify(data),
  });
  async function login(prefix, identifier, secret, previousCookie) {
    const response = await post(`${prefix}/login`, { identifier, password: secret }, previousCookie);
    assert.equal(response.status, 200);
    const cookie = response.headers.get("set-cookie");
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Lax/i);
    return cookie.split(";")[0];
  }

  const customer = "/api/auth";
  const admin = "/api/admin/auth";
  const page = (path, cookie) => request(path, {
    redirect: "manual", ...(cookie && { headers: { Cookie: cookie } }),
  });
  async function redirected(path, loginPath, cookie) {
    const response = await page(path, cookie);
    assert.equal(response.status, 307, path);
    assert.equal(new URL(response.headers.get("location"), base).pathname, loginPath);
  }
  async function recover(prefix, identity, path) {
    const response = await post(`${prefix}/forgot-password`, { email: identity });
    assert.equal(response.status, 202);
    const result = await response.json();
    for (let attempt = 0; attempt < 50 && !sentLinks.has(path); attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    const url = sentLinks.get(path);
    assert.ok(url, path);
    sentLinks.delete(path);
    const token = new URLSearchParams(url.hash.slice(1)).get("token");
    assert.ok(token && !JSON.stringify(result).includes(token));
    return token;
  }

  try {
    await app.prepare();
    server.on("request", app.getRequestHandler());

    const menu = await request("/api/menu");
    assert.equal(menu.status, 200);
    assert.equal((await menu.json()).items[0].name, "Fixture dish");
    assert.doesNotMatch(await (await request("/")).text(), /Add Menu Item|Add a new dish/);
    assert.match(await (await page("/admin/login")).text(), /Administrator sign-in/);

    for (const path of ["/account", "/account/settings"]) await redirected(path, "/login");
    for (const path of ["/admin", "/admin/menu", "/admin/settings"]) await redirected(path, "/admin/login");
    for (const [path, method] of [["/api/menu", "POST"], ["/api/menu/1", "DELETE"]]) {
      assert.equal((await request(path, { method })).status, 403);
      assert.equal((await request(path, { method, headers: { Origin: "https://example.invalid" } })).status, 403);
      assert.equal((await request(path, { method, headers: { Origin: base } })).status, 401);
    }

    assert.equal((await post(`${customer}/register`, {
      username: " Test_Guest ", email: email.toUpperCase(), fullName: "Guest", password, role: "admin",
    })).status, 201);
    assert.equal((await post(`${admin}/register`, {})).status, 404);
    const records = await db.query(`
      SELECT primary_role, email_verified_at, password_hash
      FROM users u JOIN credentials c ON c.user_id = u.id
    `);
    assert.equal(records.rows[0].primary_role, "user");
    assert.equal(records.rows[0].email_verified_at, null);
    assert.match(records.rows[0].password_hash, /^\$argon2id\$/);
    assert.ok(await argon2.verify(records.rows[0].password_hash, password));

    const operatorSql = neon(process.env.DATABASE_URL);
    await assert.rejects(
      createAdministrator(operatorSql, { username: "new_staff", email, fullName: "Staff" }),
      { code: "23505" },
    );
    const adminId = await createAdministrator(operatorSql, {
      username: "test_staff", email: adminEmail, fullName: "Staff",
    });
    const accounts = (await db.query("SELECT id::text, primary_role, email_verified_at FROM users ORDER BY id")).rows;
    assert.notEqual(accounts[0].id, adminId);
    assert.equal(accounts[1].id, adminId);
    assert.equal(accounts[1].primary_role, "admin");
    assert.ok(accounts[1].email_verified_at);

    const firstAdminToken = await recover(admin, adminEmail, "/admin/reset-password");
    assert.equal((await post(`${customer}/reset-password`, { token: firstAdminToken, password: adminPassword })).status, 400);
    assert.equal((await post(`${admin}/reset-password`, { token: firstAdminToken, password: adminPassword })).status, 200);

    assert.equal((await post(`${admin}/login`, { identifier: email, password })).status, 401);
    assert.equal((await post(`${customer}/login`, { identifier: adminEmail, password: adminPassword })).status, 401);
    const customerCookie = await login(customer, "TEST_GUEST", password);
    const secondCustomerCookie = await login(customer, email.toUpperCase(), password);
    const adminCookie = await login(admin, adminEmail, adminPassword, customerCookie);
    const secondAdminCookie = await login(admin, "test_staff", adminPassword);
    assert.match(customerCookie, /^savoria_session=/);
    assert.match(adminCookie, /^savoria_admin_session=/);

    const spoofedAdmin = customerCookie.replace("savoria_session=", "savoria_admin_session=");
    const spoofedCustomer = adminCookie.replace("savoria_admin_session=", "savoria_session=");
    const dish = { name: "Test dish", description: "Placeholder", price: 950 };
    for (const cookie of [customerCookie, spoofedAdmin]) {
      await redirected("/admin/menu", "/admin/login", cookie);
      assert.equal((await post("/api/menu", dish, cookie)).status, 401);
      assert.equal((await post(`${admin}/profile`, {}, cookie)).status, 401);
    }
    for (const cookie of [adminCookie, spoofedCustomer]) {
      await redirected("/account", "/login", cookie);
      assert.equal((await post(`${customer}/profile`, {}, cookie)).status, 401);
    }
    assert.equal((await post(`${admin}/logout`, {}, spoofedAdmin)).status, 200);
    assert.equal((await post(`${customer}/logout`, {}, spoofedCustomer)).status, 200);

    const both = `${customerCookie}; ${adminCookie}`;
    assert.equal((await page("/account", both)).status, 200);
    assert.equal((await page("/admin/settings", both)).status, 200);
    const adminPage = await page("/admin/menu", both);
    assert.equal(adminPage.status, 200);
    assert.match(await adminPage.text(), /Add Menu Item/);
    const added = await post("/api/menu", dish, both);
    assert.equal(added.status, 201);
    const { item } = await added.json();
    assert.equal((await request(`/api/menu/${item.id}`, {
      method: "DELETE", headers: { Origin: base, Cookie: both },
    })).status, 200);

    const customerLogout = await post(`${customer}/logout`, {}, both);
    assert.match(customerLogout.headers.get("set-cookie"), /^savoria_session=;/);
    await redirected("/account", "/login", both);
    assert.equal((await page("/admin", both)).status, 200);
    const adminLogout = await post(`${admin}/logout`, {}, `${secondCustomerCookie}; ${adminCookie}`);
    assert.match(adminLogout.headers.get("set-cookie"), /^savoria_admin_session=;/);
    assert.equal((await page("/account", secondCustomerCookie)).status, 200);
    await redirected("/admin", "/admin/login", adminCookie);

    const adminBeforeChange = await login(admin, "test_staff", adminPassword);
    const beforeChange = `${secondCustomerCookie}; ${adminBeforeChange}`;
    assert.equal((await post(`${admin}/profile`, { fullName: "Updated Staff", username: " Renamed_Staff " }, beforeChange)).status, 200);
    assert.equal((await post(`${admin}/password`, {
      currentPassword: adminPassword, password: nextAdminPassword,
    }, beforeChange)).status, 200);
    await redirected("/admin", "/admin/login", adminBeforeChange);
    await redirected("/admin", "/admin/login", secondAdminCookie);
    assert.equal((await page("/account", secondCustomerCookie)).status, 200);
    const currentAdminCookie = await login(admin, "renamed_staff", nextAdminPassword);

    const expired = randomBytes(32).toString("hex");
    await db.query(`
      INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, created_at, credential_version)
      SELECT user_id, $1, NOW() - INTERVAL '1 minute', NOW() - INTERVAL '1 hour', version
      FROM credentials WHERE user_id = $2
    `, [createHash("sha256").update(expired).digest("hex"), accounts[0].id]);
    assert.equal((await post(`${customer}/reset-password`, { token: expired, password: resetPassword })).status, 400);

    const customerToken = await recover(customer, email, "/reset-password");
    const reset = { token: customerToken, password: resetPassword };
    assert.equal((await post(`${admin}/reset-password`, reset)).status, 400);
    const outcomes = await Promise.all([
      post(`${customer}/reset-password`, reset),
      post(`${customer}/reset-password`, reset),
    ]);
    assert.deepEqual(outcomes.map(({ status }) => status).sort(), [200, 400]);
    await redirected("/account", "/login", secondCustomerCookie);
    assert.equal((await page("/admin", currentAdminCookie)).status, 200);
    const currentCustomerCookie = await login(customer, email, resetPassword);

    const adminResetToken = await recover(admin, adminEmail, "/admin/reset-password");
    assert.equal((await post(`${admin}/reset-password`, { token: adminResetToken, password: newPassword })).status, 200);
    await redirected("/admin", "/admin/login", currentAdminCookie);
    assert.equal((await page("/account", currentCustomerCookie)).status, 200);

    const wrongCustomer = await post(`${customer}/forgot-password`, { email: adminEmail });
    const wrongAdmin = await post(`${admin}/forgot-password`, { email });
    assert.equal(wrongCustomer.status, 202);
    assert.equal(wrongAdmin.status, 202);
    assert.deepEqual(await wrongCustomer.json(), await wrongAdmin.json());
    for (let attempt = 0; attempt < 4; attempt++) {
      assert.equal((await post(`${customer}/forgot-password`, { email: "missing@example.invalid" })).status, 202);
    }
    assert.equal((await post(`${customer}/forgot-password`, { email: "missing@example.invalid" })).status, 429);
    assert.equal(sentLinks.size, 0);
  } finally {
    globalThis.fetch = originalFetch;
    server.closeAllConnections();
    server.close();
    await app.close();
    await db.close();
  }
});
