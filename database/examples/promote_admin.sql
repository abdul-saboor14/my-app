-- Retired. Provision a dedicated admin with npm run provision:admin.
-- See database/AUTHENTICATION.md for email verification and provisioning.
DO $$
BEGIN
  RAISE EXCEPTION 'Customer account promotion has been retired';
END
$$;
