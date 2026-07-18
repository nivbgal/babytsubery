# Baby Tsubery

A private, mobile-first daily photo journal for `babytsubery.com`.

The public application shell is a static React site deployed through GitHub Pages. Private journal data lives behind a Cloudflare Worker: D1 stores metadata, sessions, albums, and guest invitations; R2 stores photographs in a non-public bucket.

## What is included

- Parent-only daily photo upload with optional caption
- Browser-side WebP resizing and EXIF metadata removal
- Private, revocable family invitation links
- Latest-memory, calendar, and album views
- Print/PDF album layout
- Responsive, keyboard-accessible interface
- GitHub Pages deployment workflow
- Cloudflare Worker API, D1 migration, and R2 integration

## Local preview

```bash
npm install
npm run dev
```

Without an API URL, the entry screen offers a demo preview. To run the private API locally as well:

```bash
cp .env.example .env.local
npm run db:local
npm run dev:api
```

Run `npm run dev` in another terminal.

## Validate

```bash
npm test
```

## Cloudflare setup

Authenticate and create the free resources. The production D1 database is already created and configured; the D1 creation command is only needed if you intentionally replace it:

```bash
npx wrangler login
npx wrangler r2 bucket create baby-tsubery-photos
```

If you create a replacement D1 database, copy its returned ID into `worker/wrangler.jsonc`. Initialize a new remote database with:

```bash
npm run db:remote
```

Set the shared parent password without placing it in shell history or copying its hash manually:

```bash
npm run --silent password:hash | npx wrangler secret put PARENT_PASSWORD_HASH --config worker/wrangler.jsonc
```

Deploy the API:

```bash
npm run deploy:api
```

The Worker configuration deploys directly to the `api.babytsubery.com` custom domain and keeps its `workers.dev` route disabled. Cloudflare creates the API DNS record and certificate automatically. Keep the R2 bucket private.

## GitHub Pages setup

1. Open repository **Settings → Pages**.
2. Set the publishing source to **GitHub Actions**.
3. Set the custom domain to `babytsubery.com`.
4. Push to `main`; `.github/workflows/deploy-pages.yml` builds and publishes the site.
5. Enable **Enforce HTTPS** when GitHub makes the option available.

The production build calls `https://api.babytsubery.com`.

## DNS layout

For reliable same-site private cookies, manage the zone on Cloudflare's free DNS plan. After adding `babytsubery.com` to Cloudflare, replace the domain's Spaceship nameservers with the two assigned by Cloudflare.

Create these Cloudflare DNS records with proxying set to **DNS only**:

| Type | Name | Value |
| --- | --- | --- |
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| CNAME | `www` | `nivbgal.github.io` |

Cloudflare creates the `api` DNS record when the Worker custom domain is attached.

## Secrets and privacy

- Never commit `.env.local`, passwords, invitation tokens, D1 IDs from private environments, or generated secret hashes.
- Photographs are not stored in GitHub and the R2 bucket is not public.
- Guest and parent sessions are opaque, hashed in D1, and delivered in secure HTTP-only cookies.
- `robots.txt` and page metadata discourage indexing, but authentication is the actual privacy boundary.
