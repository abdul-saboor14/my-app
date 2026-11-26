-- Apply after 003. Stop old application instances during the cutover.
BEGIN;
SET LOCAL search_path TO public, pg_catalog;

LOCK TABLE users, user_roles, roles IN SHARE ROW EXCLUSIVE MODE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'users'::regclass AND conname = 'users_primary_role_valid'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r ON r.id = ur.role_id
      GROUP BY u.id
      HAVING COUNT(r.id) <> 1 OR bool_or(r.name NOT IN ('user', 'admin'))
    ) THEN
      RAISE EXCEPTION 'Account roles need review. Run 005_account_separation_preflight.sql';
    END IF;

    IF EXISTS (
      SELECT 1 FROM users u JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id
      WHERE r.name = 'admin' AND u.email_verified_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Existing administrators need verified email. Run 005_account_separation_preflight.sql';
    END IF;

    ALTER TABLE users ADD COLUMN primary_role VARCHAR(30) NOT NULL DEFAULT 'user';
    UPDATE users u SET primary_role = 'admin'
    FROM user_roles ur JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = u.id AND r.name = 'admin';

    ALTER TABLE users
      ADD CONSTRAINT users_primary_role_fk FOREIGN KEY (primary_role) REFERENCES roles(name),
      ADD CONSTRAINT users_primary_role_valid CHECK (primary_role IN ('user', 'admin')),
      ADD CONSTRAINT users_admin_email_verified CHECK (
        primary_role <> 'admin' OR email_verified_at IS NOT NULL
      );

    -- Old cookies and reset links were issued through a shared sign-in surface.
    -- Customer tokens stay valid. Existing admins must use the new admin flow.
    UPDATE auth_sessions s SET revoked_at = NOW()
    FROM users u WHERE s.user_id = u.id AND u.primary_role = 'admin'
      AND s.revoked_at IS NULL;
    UPDATE password_reset_tokens t SET used_at = NOW()
    FROM users u WHERE t.user_id = u.id AND u.primary_role = 'admin'
      AND t.used_at IS NULL;
  END IF;
END
$$;

-- Keep user_roles as a compatible representation of the primary role for
-- existing reporting and data tooling. It cannot grant additional privileges.
CREATE UNIQUE INDEX IF NOT EXISTS ux_user_roles_one_role ON user_roles (user_id);

CREATE OR REPLACE FUNCTION enforce_primary_role_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO public, pg_catalog
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM users u JOIN roles r ON r.name = u.primary_role
    WHERE u.id = NEW.user_id AND r.id = NEW.role_id
  ) THEN
    RAISE EXCEPTION 'Assignment must match the account primary role' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION protect_account_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.primary_role IS DISTINCT FROM OLD.primary_role THEN
    RAISE EXCEPTION 'An account primary role cannot change' USING ERRCODE = '23514';
  END IF;
  IF OLD.primary_role = 'admin' AND NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'Administrator email is fixed to the verified mailbox' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgrelid = 'user_roles'::regclass
      AND tgname = 'user_roles_match_primary_role'
  ) THEN
    CREATE CONSTRAINT TRIGGER user_roles_match_primary_role AFTER INSERT OR UPDATE ON user_roles
    FOR EACH ROW EXECUTE FUNCTION enforce_primary_role_assignment();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgrelid = 'users'::regclass
      AND tgname = 'users_protect_account_identity'
  ) THEN
    CREATE TRIGGER users_protect_account_identity BEFORE UPDATE OF primary_role, email ON users
    FOR EACH ROW EXECUTE FUNCTION protect_account_identity();
  END IF;
END
$$;

COMMIT;
