import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { accountPaths, type AccountRole } from "@/lib/account-paths";
import { getDatabase } from "@/lib/db";
import { generateToken, getAppUrl, hashToken } from "@/lib/auth-security";

export type CurrentUser = {
  id: string;
  username: string | null;
  email: string;
  fullName: string;
};

function sessionCookie(role: AccountRole) {
  const secure = getAppUrl()?.protocol === "https:";
  const baseName = role === "admin" ? "savoria_admin_session" : "savoria_session";
  return {
    name: secure ? `__Host-${baseName}` : baseName,
    options: { httpOnly: true, secure, sameSite: "lax" as const, path: "/" },
  };
}

export async function createSession(role: AccountRole, userId: string, version: string) {
  const previous = await getSessionToken(role);
  const previousHash = previous ? hashToken(previous) : null;
  const token = generateToken();
  const sql = getDatabase();
  const rows = await sql`
    WITH issued AS (
      INSERT INTO auth_sessions (user_id, token_hash, expires_at, credential_version)
      SELECT u.id, ${hashToken(token)}, NOW() + INTERVAL '7 days', c.version
      FROM users u JOIN credentials c ON c.user_id = u.id
      WHERE u.id = ${userId} AND u.is_active AND c.version = ${version} AND u.primary_role = ${role}
      RETURNING id
    ), revoked AS (
      UPDATE auth_sessions SET revoked_at = NOW()
      WHERE token_hash = ${previousHash} AND revoked_at IS NULL
        AND EXISTS (SELECT 1 FROM issued)
        AND EXISTS (SELECT 1 FROM users u WHERE u.id = auth_sessions.user_id AND u.primary_role = ${role})
    )
    SELECT id FROM issued
  `;
  if (!rows.length) return false;

  const { name, options } = sessionCookie(role);
  (await cookies()).set(name, token, { ...options, maxAge: 7 * 86400 });
  return true;
}

async function getSessionToken(role: AccountRole) {
  const token = (await cookies()).get(sessionCookie(role).name)?.value;
  return token && /^[0-9a-f]{64}$/.test(token) ? token : null;
}

export async function getCurrentUser(role: AccountRole): Promise<CurrentUser | null> {
  const token = await getSessionToken(role);
  if (!token) return null;

  try {
    const sql = getDatabase();
    const [user] = await sql`
      SELECT u.id::text AS id, u.username, u.email, u.full_name
      FROM auth_sessions s
      JOIN users u ON u.id = s.user_id
      JOIN credentials c ON c.user_id = u.id AND c.version = s.credential_version
      WHERE s.token_hash = ${hashToken(token)}
        AND u.primary_role = ${role}
        AND s.expires_at > NOW() AND s.revoked_at IS NULL AND u.is_active
    `;
    return user ? {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.full_name,
    } : null;
  } catch {
    throw new Error("Unable to load your account. Please try again later.");
  }
}

export async function revokeCurrentSession(role: AccountRole) {
  const token = await getSessionToken(role);
  if (token) {
    const sql = getDatabase();
    await sql`
      UPDATE auth_sessions SET revoked_at = NOW()
      WHERE token_hash = ${hashToken(token)} AND revoked_at IS NULL
        AND EXISTS (SELECT 1 FROM users u WHERE u.id = auth_sessions.user_id AND u.primary_role = ${role})
    `;
  }

  await clearSessionCookie(role);
}

export async function clearSessionCookie(role: AccountRole) {
  const { name, options } = sessionCookie(role);
  (await cookies()).set(name, "", { ...options, maxAge: 0 });
}

async function requireAccount(role: AccountRole) {
  const user = await getCurrentUser(role);
  if (!user) redirect(accountPaths[role].login);
  return user;
}

export function requireUser() {
  return requireAccount("user");
}

export function requireAdmin() {
  return requireAccount("admin");
}
