
BEGIN;

-- Add normalized usernames to existing users.
ALTER TABLE users
ADD COLUMN IF NOT EXISTS username VARCHAR(30);

CREATE UNIQUE INDEX IF NOT EXISTS ux_users_username
ON users (LOWER(username));

ALTER TABLE users
DROP CONSTRAINT IF EXISTS users_username_format;

ALTER TABLE users
ADD CONSTRAINT users_username_format
CHECK (
  username IS NULL OR (
    username = LOWER(username)
    AND username ~ '^[a-z][a-z0-9_]{2,29}$'
  )
);

-- Temporary nullable usernames allow existing
-- accounts to be migrated safely.
-- New registrations will require a username.

-- One-time password reset tokens.
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  user_id BIGINT NOT NULL
    REFERENCES users(id) ON DELETE CASCADE,

  token_hash TEXT NOT NULL UNIQUE,

  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT reset_expiry_valid
    CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS idx_password_reset_user
ON password_reset_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_password_reset_expiry
ON password_reset_tokens(expires_at);

-- Login and recovery attempt tracking.
CREATE TABLE IF NOT EXISTS auth_attempts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  identifier_hash TEXT NOT NULL,

  action VARCHAR(30) NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT auth_attempt_action_valid
    CHECK (action IN ('login', 'password_reset'))
);

CREATE INDEX IF NOT EXISTS idx_auth_attempts_lookup
ON auth_attempts(
  identifier_hash,
  action,
  created_at DESC
);

-- Existing auth tables remain intact.
-- Ensure default roles exist.
INSERT INTO roles (name, description)
VALUES
  ('user', 'Restaurant customer'),
  ('admin', 'Restaurant administrator')
ON CONFLICT (name) DO NOTHING;

COMMIT;
