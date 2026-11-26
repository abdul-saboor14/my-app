import "server-only";

import type { AccountRole } from "@/lib/account-paths";
import { getDatabase } from "@/lib/db";

export async function replacePassword(
  role: AccountRole,
  userId: string,
  version: string,
  passwordHash: string,
  resetHash: string | null = null,
) {
  const sql = getDatabase();
  // The version comparison serializes competing updates. Changing it also
  // invalidates sessions or reset tokens inserted from an older snapshot.
  const rows = await sql`
    WITH changed AS (
      UPDATE credentials c
      SET password_hash = ${passwordHash}, version = gen_random_uuid(),
          password_updated_at = NOW(), failed_attempts = 0, locked_until = NULL
      WHERE c.user_id = ${userId} AND c.version = ${version}
        AND EXISTS (SELECT 1 FROM users u WHERE u.id = c.user_id AND u.is_active AND u.primary_role = ${role})
        AND (${resetHash}::text IS NULL OR EXISTS (
          SELECT 1 FROM password_reset_tokens t
          WHERE t.token_hash = ${resetHash} AND t.user_id = c.user_id
            AND t.credential_version = c.version AND t.used_at IS NULL
            AND t.expires_at > clock_timestamp()
        ))
      RETURNING c.user_id
    ), revoked AS (
      UPDATE auth_sessions s SET revoked_at = NOW()
      FROM changed WHERE s.user_id = changed.user_id AND s.revoked_at IS NULL
    ), consumed AS (
      UPDATE password_reset_tokens t SET used_at = NOW()
      FROM changed WHERE t.user_id = changed.user_id AND t.used_at IS NULL
    )
    SELECT user_id FROM changed
  `;
  return rows.length > 0;
}
