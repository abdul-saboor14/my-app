-- Optional integration check for a disposable Neon branch after migration.
-- Uses a rolled-back synthetic account and the same credential version and
-- expiry predicates as the application.
BEGIN;
DO $$
DECLARE
  account_id bigint;
  original_version uuid;
  eligible_count integer;
BEGIN
  INSERT INTO users (full_name, username, email)
  VALUES ('Authentication migration check', 'check_' || substr(gen_random_uuid()::text, 1, 8),
          gen_random_uuid()::text || '@example.invalid')
  RETURNING id INTO account_id;

  INSERT INTO credentials (user_id, password_hash)
  VALUES (account_id, 'fixture-only') RETURNING version INTO original_version;

  INSERT INTO password_reset_tokens (user_id, token_hash, credential_version, created_at, expires_at)
  VALUES
    (account_id, gen_random_uuid()::text, original_version, now() - interval '2 hours', now() - interval '1 hour'),
    (account_id, gen_random_uuid()::text, original_version, now(), now() + interval '30 minutes');

  SELECT count(*) INTO eligible_count
  FROM password_reset_tokens t
  JOIN credentials c ON c.user_id = t.user_id AND c.version = t.credential_version
  WHERE t.user_id = account_id AND t.used_at IS NULL AND t.expires_at > now();
  IF eligible_count <> 1 THEN RAISE EXCEPTION 'Only the unexpired token should qualify'; END IF;

  UPDATE credentials SET version = gen_random_uuid() WHERE user_id = account_id;
  IF EXISTS (
    SELECT 1 FROM password_reset_tokens t
    JOIN credentials c ON c.user_id = t.user_id AND c.version = t.credential_version
    WHERE t.user_id = account_id AND t.used_at IS NULL AND t.expires_at > now()
  ) THEN RAISE EXCEPTION 'Old credentials still have a usable reset token'; END IF;
END
$$;
ROLLBACK;
