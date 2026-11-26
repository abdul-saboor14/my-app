import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const read = (path) => readFile(new URL(`../database/${path}`, import.meta.url), "utf8");

test("auth migration reruns, preserves legacy records, and enforces recovery expiry", async () => {
  const db = new PGlite();
  try {
    const migrate = await read("migrations/003_savoria_auth.sql");
    const preflight = await read("checks/003_authentication_preflight.sql");
    await db.exec(preflight);
    await db.exec(migrate);
    await db.exec(`
      CREATE TABLE menu_items (id integer PRIMARY KEY, name text);
      INSERT INTO menu_items VALUES (1, 'Menu fixture');
      INSERT INTO users (full_name, email) VALUES ('Legacy fixture', 'Legacy@example.invalid');
    `);
    await db.exec(preflight);
    await db.exec(migrate);

    const menu = await db.query("SELECT name FROM menu_items WHERE id = 1");
    assert.equal(menu.rows[0].name, "Menu fixture");
    const legacy = await db.query("SELECT username FROM users WHERE email = 'Legacy@example.invalid'");
    assert.equal(legacy.rows[0].username, null);

    await assert.rejects(
      db.query("INSERT INTO users (full_name, email) VALUES ('Duplicate', 'legacy@example.invalid')"),
      { code: "23505" },
    );
    await assert.rejects(
      db.query("INSERT INTO users (full_name, email, username) VALUES ('Invalid', 'other@example.invalid', 'Upper')"),
      { code: "23514" },
    );
    await db.exec(await read("checks/004_authentication_smoke.sql"));
    const count = await db.query("SELECT count(*)::integer AS count FROM users");
    assert.equal(count.rows[0].count, 1);
  } finally {
    await db.close();
  }
});

test("role separation stops on conflicts and preserves compatible legacy auth rows", async () => {
  const db = new PGlite();
  try {
    await db.exec(await read("migrations/003_savoria_auth.sql"));
    const migration = await read("migrations/004_separate_account_roles.sql");
    const preflight = await read("checks/005_account_separation_preflight.sql");
    await db.exec(`
      CREATE TABLE menu_items (id integer PRIMARY KEY, name text);
      INSERT INTO menu_items VALUES (1, 'Fixture dish');
      INSERT INTO users (full_name, username, email)
      VALUES ('Legacy customer', 'legacy_user', 'user@example.invalid'),
             ('Legacy administrator', 'legacy_admin', 'admin@example.invalid');
      INSERT INTO user_roles (user_id, role_id)
      SELECT u.id, r.id FROM users u CROSS JOIN roles r
      WHERE u.username = 'legacy_user' OR r.name = 'admin';
      INSERT INTO credentials (user_id, password_hash)
      SELECT id, 'fixture-' || username FROM users;
      INSERT INTO auth_sessions (user_id, token_hash, expires_at, credential_version)
      SELECT c.user_id, 'session-' || c.user_id, now() + interval '1 day', c.version FROM credentials c;
      INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, credential_version)
      SELECT c.user_id, 'reset-' || c.user_id, now() + interval '30 minutes', c.version FROM credentials c;
    `);

    const [issues] = await db.exec(preflight);
    assert.deepEqual(issues.rows.map(({ issue }) => issue), [
      "Multiple roles assigned", "Administrator email verification missing",
    ]);
    await assert.rejects(db.exec(migration), /Account roles need review/);
    await db.exec("ROLLBACK");

    // An operator resolves the customer overlap without changing the account.
    await db.exec(`
      DELETE FROM user_roles ur USING users u, roles r
      WHERE ur.user_id = u.id AND ur.role_id = r.id
        AND u.username = 'legacy_user' AND r.name = 'admin';
    `);
    await assert.rejects(db.exec(migration), /need verified email/);
    await db.exec("ROLLBACK");
    await db.exec("UPDATE users SET email_verified_at = now() WHERE username = 'legacy_admin'");
    assert.deepEqual((await db.exec(preflight))[0].rows, []);

    const credentials = (await db.query("SELECT * FROM credentials ORDER BY user_id")).rows;
    await db.exec(migration);
    const accounts = await db.query("SELECT primary_role FROM users ORDER BY id");
    assert.deepEqual(accounts.rows, [{ primary_role: "user" }, { primary_role: "admin" }]);
    assert.deepEqual((await db.query("SELECT * FROM credentials ORDER BY user_id")).rows, credentials);
    assert.deepEqual((await db.query("SELECT name FROM menu_items")).rows, [{ name: "Fixture dish" }]);
    assert.deepEqual((await db.query(`
      SELECT (revoked_at IS NULL) AS usable FROM auth_sessions ORDER BY user_id
    `)).rows, [{ usable: true }, { usable: false }]);
    assert.deepEqual((await db.query(`
      SELECT (used_at IS NULL) AS usable FROM password_reset_tokens ORDER BY user_id
    `)).rows, [{ usable: true }, { usable: false }]);

    await assert.rejects(db.exec("UPDATE users SET primary_role = 'admin' WHERE username = 'legacy_user'"), { code: "23514" });
    await assert.rejects(db.exec("UPDATE users SET email_verified_at = NULL WHERE username = 'legacy_admin'"), { code: "23514" });
    await assert.rejects(db.exec(`
      UPDATE user_roles SET role_id = (SELECT id FROM roles WHERE name = 'admin')
      WHERE user_id = (SELECT id FROM users WHERE username = 'legacy_user')
    `), { code: "23514" });
    await assert.rejects(db.exec(`
      INSERT INTO user_roles (user_id, role_id)
      SELECT u.id, r.id FROM users u CROSS JOIN roles r
      WHERE u.username = 'legacy_user' AND r.name = 'admin'
    `), { code: "23505" });

    await db.exec(`
      INSERT INTO auth_sessions (user_id, token_hash, expires_at, credential_version)
      SELECT u.id, 'post-migration-admin', now() + interval '1 day', c.version
      FROM users u JOIN credentials c ON c.user_id = u.id WHERE u.primary_role = 'admin'
    `);
    await db.exec(migration);
    assert.equal((await db.query(`
      SELECT revoked_at FROM auth_sessions WHERE token_hash = 'post-migration-admin'
    `)).rows[0].revoked_at, null);
  } finally {
    await db.close();
  }
});
