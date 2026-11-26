-- Apply independently of 001/002. This migration only touches authentication data.
BEGIN;
SET LOCAL search_path TO public, pg_catalog;


CREATE TABLE IF NOT EXISTS users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL,

    phone VARCHAR(30),

    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    email_verified_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT users_name_not_empty
        CHECK (LENGTH(BTRIM(full_name)) > 0),

    CONSTRAINT users_email_not_empty
        CHECK (
            LENGTH(BTRIM(email)) > 3
            AND email = BTRIM(email)
        )
);

-- Emails must be unique regardless of capitalization.
CREATE UNIQUE INDEX IF NOT EXISTS ux_users_email
ON users (LOWER(email));

-- ====================================================
-- 2. ROLES
-- ====================================================

CREATE TABLE IF NOT EXISTS roles (
    id SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    name VARCHAR(30) NOT NULL UNIQUE,

    description TEXT,

    CONSTRAINT roles_allowed_names
        CHECK (name IN ('user', 'admin'))
);

-- ====================================================
-- 3. USER ROLE ASSIGNMENTS
-- ====================================================

CREATE TABLE IF NOT EXISTS user_roles (
    user_id BIGINT NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    role_id SMALLINT NOT NULL
        REFERENCES roles(id) ON DELETE RESTRICT,

    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_role
ON user_roles(role_id);

-- ====================================================
-- 4. PASSWORD CREDENTIALS
-- ====================================================

CREATE TABLE IF NOT EXISTS credentials (
    user_id BIGINT PRIMARY KEY
        REFERENCES users(id) ON DELETE CASCADE,

    password_hash TEXT NOT NULL,

    password_updated_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    failed_attempts INTEGER NOT NULL DEFAULT 0,

    locked_until TIMESTAMPTZ,

    CONSTRAINT password_hash_not_empty
        CHECK (LENGTH(password_hash) > 0),

    CONSTRAINT failed_attempts_nonnegative
        CHECK (failed_attempts >= 0)
);

-- Passwords must be hashed by the application
-- using Argon2id or a similarly secure method.
-- NEVER store plaintext passwords.

-- ====================================================
-- 5. AUTHENTICATION SESSIONS
-- ====================================================

CREATE TABLE IF NOT EXISTS auth_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id BIGINT NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    token_hash TEXT NOT NULL UNIQUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,

    CONSTRAINT session_expiry_valid
        CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS idx_sessions_user
ON auth_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_sessions_expiry
ON auth_sessions(expires_at);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS username VARCHAR(30),
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS ux_users_username ON users (LOWER(username));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM users WHERE email <> btrim(email)) THEN
    RAISE EXCEPTION 'Review legacy emails with surrounding whitespace before migrating';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'users'::regclass AND conname = 'users_username_format'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_username_format CHECK (
      username IS NULL OR (username = LOWER(username) AND username ~ '^[a-z][a-z0-9_]{2,29}$')
    );
  END IF;
END
$$;


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

ALTER TABLE credentials
  ADD COLUMN IF NOT EXISTS version UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS password_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS failed_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

ALTER TABLE auth_sessions
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS credential_version UUID;

ALTER TABLE password_reset_tokens
  ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS credential_version UUID;

CREATE TABLE IF NOT EXISTS auth_rate_limits (
  bucket_key TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  hits INTEGER NOT NULL CHECK (hits > 0),
  PRIMARY KEY (bucket_key, window_start)
);

CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_window ON auth_rate_limits (window_start);

INSERT INTO roles (name, description)
VALUES ('user', 'Restaurant customer'), ('admin', 'Restaurant administrator')
ON CONFLICT (name) DO NOTHING;

COMMIT;
