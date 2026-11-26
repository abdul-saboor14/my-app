# Savoria authentication setup

## Apply the Neon migration

1. In Neon, select or create a **disposable branch** from the database you intend to use. In SQL Editor, select that branch and database. Run [003_authentication_preflight.sql](checks/003_authentication_preflight.sql).
2. Compare any existing auth tables, keys, and indexes with [003_savoria_auth.sql](migrations/003_savoria_auth.sql). Resolve legacy username or email conflicts deliberately before proceeding. If an existing table uses different primary keys, column types, or required columns without defaults, reconcile that schema before running the migration. Keep nullable legacy usernames until the owners choose one in Account settings.
3. Run the entire **003_savoria_auth.sql** file in SQL Editor. It runs in one transaction and is independent of 001 and 002. It adds the auth tables or missing auth fields in the expected schema and preserves menu and account data. It requires PostgreSQL 14 or later. Legacy session and recovery rows without a credential version cease to be usable, so affected users must sign in again and request fresh reset links. Existing Argon2id credentials continue to work. Accounts with unsupported password hashes can use recovery to set an Argon2id password.
4. Run [005_account_separation_preflight.sql](checks/005_account_separation_preflight.sql). It reports IDs with both roles, missing or unsupported roles, or an admin role without email verification. The next migration stops if any of these issues remain. Review each exact ID with the account owner. For an overlap that represents a customer account, have the operator explicitly remove only that account's legacy admin assignment from `user_roles`, retaining its customer assignment, and provision a new administrator after the migration. For an unassigned account, add only its confirmed role. For an existing admin-only account, independently verify mailbox ownership before recording `email_verified_at`. Leave the migration paused if the intended role or verification is unclear.
5. When the review query returns zero rows, run all of [004_separate_account_roles.sql](migrations/004_separate_account_roles.sql). It enforces one immutable primary role and a verified email for administrators. It retains the existing account IDs, password hashes, and menu records. Compatible customer cookies, sessions, and reset links continue to work. Existing administrators sign in again through the admin portal and request fresh admin reset links.
6. Run [004_authentication_smoke.sql](checks/004_authentication_smoke.sql) on the disposable branch. Test both portals, simultaneous browser sessions, logout and recovery in each portal, and public menu reads. Before applying 004 on the intended branch, stop old app instances during the cutover. Point the updated app at the migrated database before serving traffic. The older shared-login build does not enforce the new portal separation.

Migration 003 assumes the restaurant's existing `menu_items` table for the menu itself. On a completely empty database that also needs the restaurant schema, apply 001, then 003, then 004. An existing installation with 003 applied starts at the role preflight.

## Server environment

Copy `.env.example` to `.env.local` for local development. Configure the same variables using deployment secrets in production.

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | The Neon connection string for the migrated database and application database role |
| `APP_URL` | Canonical origin, such as `http://localhost:3000` locally or the actual HTTPS origin in production |
| `AUTH_PEPPER` | At least 32 characters of random secret material. Generate with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Use the same value across instances. It keys the rate-limit buckets |
| `RESEND_API_KEY` | Server-side Resend API key with sending permission |
| `RESEND_FROM_EMAIL` | Sender address on a verified Resend domain |
| `AUTH_ALLOWED_ORIGINS` | Optional comma-separated additional trusted origins, using the same scheme as `APP_URL` |
| `AUTH_CLIENT_IP_HEADER` | Optional name of a header containing exactly one client IP. Set only if the trusted ingress overwrites it, removes client-supplied copies, and is the only path to the app |

Configure HTTPS on the deployed origin. Keep auth routes on the Node.js runtime and use a deployment platform that supports [Next.js `after()` callbacks](https://nextjs.org/docs/app/api-reference/functions/after). Verify the actual sender domain and test delivery with a real mailbox on the disposable environment. [Resend Node.js setup](https://resend.com/docs/send-with-nodejs). Keep email link tracking disabled for reset messages to avoid sending recovery credentials through an additional redirect service. Missing sender configuration returns a generic service error for every otherwise valid recovery request. Delivery outcomes stay out of the public response.

## Provision a dedicated administrator

1. Choose a dedicated administrator username and email. Both must be unused across all accounts. Verify the administrator's identity and their control of the exact mailbox through a trusted out-of-band check. The operator's confirmation records that verification in PostgreSQL.
2. From a trusted operator terminal in `my-app`, supply the intended branch's operator connection as `ADMIN_DATABASE_URL` using your private shell environment or secret manager. Keep this credential out of the hosted app's configuration.
3. Run `npm run provision:admin`. Enter the operator-approved name, username, email, and verification confirmation. The command creates a new user ID and stores only an Argon2id hash of an undisclosed random value. It rejects an existing username or email.
4. Send the administrator to `/admin/forgot-password` to set their first password through the verified mailbox, then to `/admin/login`. Admin profile and password changes are at `/admin/settings`. The customer's `/login` and `/forgot-password` handle customer accounts.

The old promotion SQL is retired. The database fixes the administrator's email to the verified mailbox. To replace that identity, provision another account with a verified mailbox and disable the obsolete account. Restrict operator access and avoid giving the hosted application database role table ownership, DDL privileges, or permission to write `users.primary_role` and `users.email_verified_at`. App registration inserts only the customer profile columns and uses the database's customer default.

## Operational limits

- Customer registration checks email format and uniqueness. Admin provisioning requires a verified, dedicated mailbox. MFA is outside this implementation.
- The database applies fixed 15-minute global and per-identifier limits, with additional per-IP limits when a trusted header is configured. Shared limits can deny legitimate requests during bursts, and an attacker can try a username and an email separately. Enforce per-IP request and concurrency limits at the trusted edge before deploying publicly.
- Schedule cleanup for expired/used password reset rows, expired/revoked sessions, and old rate-limit windows using your retention policy. For example, delete rate-limit rows where `window_start < now() - interval '1 day'`. Reset emails run after the response and have no durable retry queue.
- Authorization changes apply on the next request. Authenticated requests already in flight can finish. Avoid logging request bodies or cookies at the ingress and when collecting application telemetry.

## Local checks

Use Node.js 22.18 or later for the provisioning command and TypeScript policy tests. Run `npm run lint`, `npm run build`, and `npm test`. After building, run `npm run test:integration` against the production bundle with disposable PostgreSQL and simulated Resend delivery.
