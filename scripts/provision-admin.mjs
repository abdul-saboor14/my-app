import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { pathToFileURL } from "node:url";
import { neon } from "@neondatabase/serverless";
import argon2 from "argon2";
import { emailRegex, normalizeEmail, normalizeUsername, usernameRegex } from "../src/lib/auth-policy.ts";

export async function createAdministrator(sql, { fullName, username, email }) {
  // Only the verified mailbox owner can set the first usable password.
  const passwordHash = await argon2.hash(randomBytes(48), {
    type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1,
  });
  const [account] = await sql`
    WITH created AS (
      INSERT INTO public.users (username, full_name, email, primary_role, email_verified_at)
      VALUES (${username}, ${fullName}, ${email}, 'admin', NOW())
      RETURNING id
    ), credential AS (
      INSERT INTO public.credentials (user_id, password_hash)
      SELECT id, ${passwordHash} FROM created
    )
    INSERT INTO public.user_roles (user_id, role_id)
    SELECT created.id, (SELECT id FROM public.roles WHERE name = 'admin') FROM created
    RETURNING user_id::text
  `;
  return account.user_id;
}

async function provision() {
  const connection = process.env.ADMIN_DATABASE_URL;
  if (!connection || !stdin.isTTY || !stdout.isTTY) {
    throw new Error("Use an interactive terminal with the operator-only ADMIN_DATABASE_URL configured.");
  }
  const input = createInterface({ input: stdin, output: stdout });
  try {
    const fullName = (await input.question("Administrator name: ")).trim();
    const username = normalizeUsername(await input.question("New administrator username: "));
    const email = normalizeEmail(await input.question("Dedicated administrator email: "));
    if (!fullName || fullName.length > 150 || /\p{C}/u.test(fullName)
      || !usernameRegex.test(username) || email.length > 255 || !emailRegex.test(email)) {
      throw new Error("Check the name, username and email format.");
    }

    const confirmation = await input.question(
      "After independently verifying ownership and the target Neon branch, retype the verified email: ",
    );
    if (normalizeEmail(confirmation) !== email) throw new Error("Email confirmation did not match.");

    try {
      const id = await createAdministrator(neon(connection), { fullName, username, email });
      console.log(`Created administrator account ${id}. Have the owner set a password at /admin/forgot-password.`);
    } catch (error) {
      if (error?.code === "23505") throw new Error("That username or email is already assigned to an account.");
      throw new Error("Provisioning failed. Check the operator connection, permissions, and migration status.");
    }
  } finally {
    input.close();
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  provision().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
