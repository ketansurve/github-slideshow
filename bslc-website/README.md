# Bihar State Law Commission — Citizen Website

A multi-page static site (GitHub Pages) built from the approved BSLC UI mockup,
plus a separate backend API (`server/`) for content, documents, users, public
consultation and the audit log.

The site runs in one of two modes, set by `assets/js/config.js`:

| `BSLC_API_BASE` | Mode | Security |
|---|---|---|
| `""` (default, what GitHub Pages serves today) | **Demo.** Login accepts any credentials (OTP shown on screen), and the archive shows sample data. | **None.** The "sign-in" is a `sessionStorage` flag. Do not put real records behind it. |
| `"https://<api-host>"` | **Live.** Pages call the API. | Enforced **on the server**: sign-in, lockout, roles, access levels, upload checks, audit log. |

Nothing in the browser is a security control. The page scripts only decide
what to *show*. The API decides what each user may *see or do*, on every request.

## Login and `?redirect=`

`login.html?redirect=<page>` sends the user to `<page>` after sign-in. Pages
behind sign-in link to it as `login.html?redirect=document-archive.html`,
`login.html?redirect=admin.html` and `login.html?redirect=public-consultation.html`.
The target must be a page of this site: a relative path ending in `.html`,
optionally with `?query` or `#hash`. Anything else (`javascript:`, other hosts,
`//host`, absolute `/paths`, backslashes, percent-encoded tricks) falls back to
`document-archive.html`. See `safeRedirect()` in `assets/js/api.js`.

## What's here

- **30 pages.** The 29 citizen pages, plus `admin.html` (Site
  Administration: notices and circulars, document upload, consultations, users,
  audit log; ADMIN/EDITOR only, enforced by the API).
- **`assets/js/config.js`**: the API address (empty = demo).
- **`assets/js/api.js`**: `safeRedirect()`, HTML escaping and the API client.
- **`assets/js/site.js`**: login, Document Archive, the Notification / Circular
  list and Public Consultation. Each has the original demo path and an API path.
- **`assets/js/admin.js`**: the Site Administration page.
- **`assets/js/chrome.js`, `assets/js/i18n.js`, `assets/css/site.css`**: shared
  header/nav/footer, English/Hindi switch and styles (unchanged behaviour).
- **`server/`**: the API (Node.js + Express + TypeScript + PostgreSQL via
  Prisma). It is excluded from the Pages build in `_config.yml` and is never
  published to GitHub Pages.

### Roles and access (server-side)

| | Anonymous | PUBLIC (registered visitor) | OFFICIAL | EDITOR | ADMIN |
|---|---|---|---|---|---|
| Public (PUB) documents and published content | ✓ | ✓ | ✓ | ✓ | ✓ |
| Restricted (RES) documents and content | | ✓ | ✓ | ✓ | ✓ |
| Confidential (CONF) documents, view only | | named only | named only | uploader or named | ✓ |
| Comment on a consultation | | if on its participant list | if on its list | if on its list | if on its list |
| Publish content, upload documents, run consultations | | | | ✓ | ✓ |
| Manage users, read audit log, release unscanned files | | | | | ✓ |

Self-registered visitors start as PENDING and cannot sign in until an ADMIN
approves them. Five failed password/OTP attempts lock the account for 30 minutes.

## Run and test locally

Requirements: Node.js 20+ and pnpm or npm. No Docker or PostgreSQL install is
needed for development: `embedded-postgres` downloads PostgreSQL binaries from npm.
Microsoft Edge (installed on Windows) is used for browser tests.

```
cd bslc-website/server
pnpm install                 # or: npm install
```

**Demo mode** (exactly what GitHub Pages serves):

```
node scripts/static-server.cjs 4173
# open http://localhost:4173/github-slideshow/bslc-website/
```

The server mounts the site under `/github-slideshow/bslc-website/`, as GitHub
Pages does, so relative links are tested the same way.

**Live mode** (site + API + database), in three terminals:

```
npm run db:dev                                     # 1. PostgreSQL on :54328, applies migrations
cp .env.example .env && npm run dev                # 2. API on :8080 (OTP is printed in this log)
SEED_ADMIN_USER=you@bihar.gov.in SEED_ADMIN_PASSWORD='Choose-a-pass-1' SEED_ADMIN_MOBILE=9800000000 npm run seed
BSLC_API_BASE=http://localhost:8080 node scripts/static-server.cjs 4174   # 3. site in API mode
# open http://localhost:4174/github-slideshow/bslc-website/admin.html
```

**Tests:**

```
npm test            # Jest + supertest: auth, lockout, RBAC matrix, uploads, content, consultations, audit
npm run test:e2e    # Playwright: redirect flow in demo mode AND in API mode, role limits, uploads, consultation
```

Both suites start their own throw-away PostgreSQL. Set `TEST_DATABASE_URL` to
use an existing server instead. On CI, run `npx playwright install chromium`
and set `PW_CHANNEL=chromium`.

## Publish the site (GitHub Pages)

The site is published from the `master` branch by `.github/workflows/pages.yml`.
Pull requests only build. A push or merge to `master` deploys to
`https://ketansurve.github.io/github-slideshow/bslc-website/`.

```
git add <files> && git commit -m "..."
git push origin <branch>          # open a PR into master; merging it publishes
```

Until a backend is deployed, keep `BSLC_API_BASE` empty, so the published site stays in demo mode.

## Deploy the backend (separate from Pages)

GitHub Pages cannot run the API. Deploy `server/` to a government-approved host,
for example NIC / MeitY-empanelled cloud, with:

1. **PostgreSQL** (managed, encrypted at rest, automated backups), created with
   `ENCODING 'UTF8'`. Set `DATABASE_URL`, then run `npm ci && npm run build && npm run migrate`.
2. **Configuration** from `.env.example`, using `NODE_ENV=production` and a strong
   `JWT_SECRET`. `CORS_ORIGINS` must be exactly the site origin, e.g.
   `https://ketansurve.github.io`. `OTP_DELIVERY=sms` is required in production,
   and the server refuses to start with console OTPs.
3. **HTTPS** termination (reverse proxy), with `TRUST_PROXY` set so the audit log
   records real client IPs.
4. **ClamAV** (`clamd`), reachable via `CLAMAV_HOST`/`CLAMAV_PORT`.
5. **File storage**: persistent, backed-up disk for `STORAGE_DIR`, or an
   object-storage driver implementing `StorageDriver` in `src/storage.ts`.
6. `npm run seed` once (with `SEED_ADMIN_*` set) to create the first administrator.
7. `npm start` under a process manager (systemd / PM2), with health check `GET /health`.
8. Finally, set `BSLC_API_BASE` in `assets/js/config.js` to the API's HTTPS URL
   and publish the site.

## Gaps and decisions still needed

These are **not** implemented, and each needs a decision or an external service:

- **SMS OTP gateway.** NIC/CDAC SMS with a DLT-registered template. `OTP_DELIVERY=sms`
  currently answers 503 until it is wired in `deliverOtp()` (`src/auth.ts`).
- **Jan Parichay / Bihar SSO.** Needs OIDC onboarding. The button is still a stub.
- **CAPTCHA.** The captcha on `login.html` runs in the browser and is not a
  control. Server-side rate limiting and lockout are the real protection. A
  GIGW-compliant server captcha should be chosen.
- **Malware scanning.** Without ClamAV, uploads stay PENDING until an ADMIN
  releases them; each release is audited.
- **Watermarking, PDF/A, digital signatures.** The archive page states these,
  but they are not implemented. "View only" for confidential files prevents the
  download link, not screenshots or saving from the viewer.
- **Full-text (OCR) search.** Search currently matches titles only.
- **Hosting and data protection.** Hosting location and data residency; backup
  and retention periods for records and audit logs; a DPDP Act 2023 privacy
  notice and consent wording for registered visitors.
- **Security headers on Pages.** GitHub Pages cannot send CSP/HSTS headers.
  A custom domain behind a proxy (or NIC hosting) would allow them. The session
  token is kept in `sessionStorage`, so any script injection on the site could
  read it. All data rendered from the API is HTML-escaped to prevent that.
- **Content.** Placeholder names, photographs, statistics and documents still
  need Commission-approved replacements, and the exact NIC Bihar template
  assets are still to be sourced.
- **Feedback form.** Still to be wired to a real mailbox or ticketing endpoint.
