-- Run in the target branch before 003_savoria_auth.sql.
-- Compare any pre-existing auth tables with the migration definitions.
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name IN
  ('users', 'roles', 'user_roles', 'credentials', 'auth_sessions',
   'password_reset_tokens', 'auth_rate_limits')
ORDER BY table_name, ordinal_position;

SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename IN
  ('users', 'roles', 'user_roles', 'credentials', 'auth_sessions', 'password_reset_tokens')
ORDER BY tablename, indexname;

DO $$
DECLARE
  conflicts boolean;
BEGIN
  IF to_regclass('public.users') IS NULL THEN RETURN; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.users GROUP BY lower(email) HAVING count(*) > 1
  ) INTO conflicts;
  IF conflicts THEN RAISE EXCEPTION 'Resolve case-insensitive email collisions before migrating'; END IF;

  IF EXISTS (SELECT 1 FROM public.users WHERE email <> btrim(email)) THEN
    RAISE EXCEPTION 'Review legacy emails with surrounding whitespace before migrating';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'username') THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.users WHERE username IS NOT NULL
      GROUP BY lower(username) HAVING count(*) > 1)' INTO conflicts;
    IF conflicts THEN RAISE EXCEPTION 'Resolve case-insensitive username collisions before migrating'; END IF;

    EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.users WHERE username IS NOT NULL
      AND (username <> lower(username) OR username !~ ''^[a-z][a-z0-9_]{2,29}$''))'
      INTO conflicts;
    IF conflicts THEN RAISE EXCEPTION 'Review legacy usernames that fail the normalized format'; END IF;
  END IF;
END
$$;
