import "server-only";

import { after } from "next/server";
import { Resend } from "resend";
import { accountPaths, type AccountRole } from "@/lib/account-paths";
import { clearSessionCookie, createSession, getCurrentUser, revokeCurrentSession } from "@/lib/auth";
import { isUniqueViolation, post, rateLimited, reply, unavailable } from "@/lib/auth-http";
import { passwordHelp } from "@/lib/auth-policy";
import {
  emailRegex, generateToken, getAppUrl, hashPassword, hashToken, normalizeEmail,
  normalizeUsername, readString, tokenRegex, usernameRegex, validatePassword, verifyPassword,
} from "@/lib/auth-security";
import { getDatabase } from "@/lib/db";
import { replacePassword } from "@/lib/password-store";

export function login(role: AccountRole) {
  return post(async (request, body) => {
    const identifier = normalizeEmail(readString(body, "identifier"));
    const password = readString(body, "password");
    if (!password || password.length > 128 || identifier.length > 255 ||
        (!usernameRegex.test(identifier) && !emailRegex.test(identifier))) {
      return reply({ error: "Enter a valid username or email and password." }, 400);
    }

    const limited = await rateLimited(request, "login", identifier, role);
    if (limited) return limited;

    const sql = getDatabase();
    const [account] = await sql`
      SELECT u.id::text AS id, c.password_hash, c.version,
             (c.locked_until > NOW()) AS locked
      FROM users u JOIN credentials c ON c.user_id = u.id
      WHERE u.is_active AND u.primary_role = ${role} AND CASE WHEN ${identifier.includes("@")}
        THEN LOWER(u.email) = ${identifier} ELSE LOWER(u.username) = ${identifier} END
    `;

    const verified = await verifyPassword(account?.password_hash, password);
    if (!account || !verified || account.locked || !await createSession(role, account.id, account.version)) {
      return reply({ error: "Invalid username, email, or password." }, 401);
    }
    return reply({ message: "Signed in." });
  });
}

export function logout(role: AccountRole) {
  return post(async () => {
    await revokeCurrentSession(role);
    return reply({ message: "Signed out." });
  });
}

export function updateProfile(role: AccountRole) {
  return post(async (_request, body) => {
    const user = await getCurrentUser(role);
    if (!user) return reply({ error: "Please sign in." }, 401);
    const username = normalizeUsername(readString(body, "username"));
    const fullName = readString(body, "fullName").trim();
    if (!usernameRegex.test(username) || !fullName || fullName.length > 150 || /\p{C}/u.test(fullName)) {
      return reply({ error: "Enter a name and a username starting with a letter and containing 3–30 letters, digits, or underscores." }, 400);
    }

    const sql = getDatabase();
    try {
      await sql`UPDATE users SET full_name = ${fullName}, username = ${username}, updated_at = NOW()
                WHERE id = ${user.id} AND is_active AND primary_role = ${role}`;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      return reply({ error: "That username is unavailable." }, 409);
    }
    return reply({ message: "Profile updated." });
  });
}

export function changePassword(role: AccountRole) {
  return post(async (request, body) => {
    const user = await getCurrentUser(role);
    if (!user) return reply({ error: "Please sign in." }, 401);
    const current = readString(body, "currentPassword");
    const password = readString(body, "password");
    if (!current || current.length > 128) return reply({ error: "Enter your current password." }, 400);
    if (!validatePassword(password)) return reply({ error: passwordHelp }, 400);

    const limited = await rateLimited(request, "password", user.id, role);
    if (limited) return limited;
    const sql = getDatabase();
    const [credential] = await sql`SELECT password_hash, version FROM credentials WHERE user_id = ${user.id}`;
    if (!credential || !await verifyPassword(credential.password_hash, current)) {
      return reply({ error: "Your current password is incorrect." }, 400);
    }
    if (!await replacePassword(role, user.id, credential.version, await hashPassword(password))) {
      return reply({ error: "Your credentials changed. Please sign in again." }, 409);
    }
    await clearSessionCookie(role);
    return reply({ message: "Password changed. Please sign in again." });
  });
}

export function requestPasswordReset(role: AccountRole) {
  return post(async (request, body) => {
    const email = normalizeEmail(readString(body, "email"));
    if (email.length > 255 || !emailRegex.test(email)) {
      return reply({ error: "Enter a valid email address." }, 400);
    }

    const limited = await rateLimited(request, "recovery", email, role);
    if (limited) return limited;
    const appUrl = getAppUrl();
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;
    if (!appUrl || !apiKey || !from) return unavailable();

    after(async () => {
      try {
        const token = generateToken();
        const tokenHash = hashToken(token);
        const sql = getDatabase();
        const [recipient] = await sql`
          WITH issued AS (
            INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, credential_version)
            SELECT u.id, ${tokenHash}, NOW() + INTERVAL '30 minutes', c.version
            FROM users u JOIN credentials c ON c.user_id = u.id
            WHERE LOWER(u.email) = ${email} AND u.is_active AND u.primary_role = ${role}
            RETURNING user_id
          )
          SELECT u.email FROM issued JOIN users u ON u.id = issued.user_id
        `;
        if (!recipient) return;

        const link = new URL(accountPaths[role].resetPassword, appUrl);
        link.hash = new URLSearchParams({ token }).toString();
        const { error } = await new Resend(apiKey).emails.send({
          from,
          to: recipient.email,
          subject: role === "admin" ? "Reset your Savoria admin password" : "Reset your Savoria password",
          text: `Open this link within 30 minutes to reset your Savoria password:\n\n${link}\n\nIf you did not request this, you can ignore this email.`,
        });
        if (error) {
          await sql`UPDATE password_reset_tokens SET used_at = NOW() WHERE token_hash = ${tokenHash}`;
          console.error("Password recovery delivery failed.");
        }
      } catch {
        console.error("Password recovery processing failed.");
      }
    });

    return reply({ message: "If an eligible account exists, we’ll send a password reset link." }, 202);
  });
}

export function resetPassword(role: AccountRole) {
  return post(async (request, body) => {
    const token = readString(body, "token");
    const password = readString(body, "password");
    const invalidLink = "This reset link is invalid or expired. Request a new link.";
    if (!tokenRegex.test(token)) return reply({ error: invalidLink }, 400);
    if (!validatePassword(password)) return reply({ error: passwordHelp }, 400);

    const hash = hashToken(token);
    const limited = await rateLimited(request, "reset", hash, role);
    if (limited) return limited;
    const sql = getDatabase();
    const [reset] = await sql`
      SELECT t.user_id::text AS user_id, c.version
      FROM password_reset_tokens t
      JOIN users u ON u.id = t.user_id
      JOIN credentials c ON c.user_id = u.id AND c.version = t.credential_version
      WHERE t.token_hash = ${hash} AND t.used_at IS NULL AND t.expires_at > NOW()
        AND u.is_active AND u.primary_role = ${role}
    `;
    if (!reset || !await replacePassword(role, reset.user_id, reset.version, await hashPassword(password), hash)) {
      return reply({ error: invalidLink }, 400);
    }
    return reply({ message: "Password reset. You can now sign in." });
  });
}
