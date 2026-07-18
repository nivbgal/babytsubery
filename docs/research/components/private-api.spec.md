# Private API specification

## Target files

- `worker/index.ts`
- `worker/tsconfig.json`
- `worker/wrangler.jsonc`
- `worker/migrations/0001_initial.sql`
- `scripts/hash-password.mjs`

## Runtime

Cloudflare Worker with D1 binding `DB` and private R2 binding `PHOTOS`. No public bucket access. Allowed browser origins are `https://babytsubery.com`, `https://www.babytsubery.com`, and local development.

## Authentication

- Shared parent password verified against PBKDF2 hash stored in `PARENT_PASSWORD_HASH` secret.
- Random opaque sessions stored hashed in D1 and sent in Secure, HttpOnly, SameSite=Lax cookie.
- Guest invitation tokens stored hashed; `/v1/auth/guest` exchanges a valid token for a guest session.
- Parent-only authorization for writes, deletes, album creation, and invite rotation.
- `/v1/session`, parent login, guest login, and logout routes.

## Data routes

- `GET /v1/journal`: authorized parent or guest; returns entries and albums.
- `POST /v1/entries`: parent multipart upload, date, caption, alt text; validate image type and 12MB maximum; store bytes in R2 and metadata in D1.
- `DELETE /v1/entries/:id`: parent; remove R2 object and related metadata.
- `GET /v1/media/:key`: authorized; stream private R2 object with cache-safe headers.
- `POST /v1/albums`: parent; title, description, ordered entry IDs.
- `POST /v1/invites/rotate`: parent; revoke prior guest tokens and return a new one exactly once.

## Security

- Constant-time secret comparisons.
- SHA-256 hashes for session and invitation tokens.
- Prepared D1 statements only.
- Strict CORS allowlist, credentials enabled, OPTIONS support.
- Security headers on every response; no secret values in errors or logs.
