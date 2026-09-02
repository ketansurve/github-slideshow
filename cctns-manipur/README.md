# Police Monitoring System — CCTNS 2.0 / ICJS 2.0 (Manipur sample)

A workable prototype of a CCTNS-style Police Monitoring System dashboard,
seeded with sample data for **Manipur** (16 districts, sample police
stations, FIRs, IIF form health, officer performance, ICJS pillar exchange,
CCTV feeds). It ships with:

- a static front-end (`index.html` + `assets/`) that runs standalone, and
- a small reusable REST API backend (`server/`) it can optionally talk to.

No real case data or real officials are used — names, FIR numbers and
figures are illustrative, as stated on the login screen.

## Quick start

**Front-end only (no backend, works offline):**

```bash
# from this directory
python3 -m http.server 8080
# open http://localhost:8080/index.html
```

Sign in with any role from the dropdown (password field is pre-filled for
the demo). Every page will load — data comes from
`assets/js/sample-data.js`, the bundled offline dataset.

**Front-end + backend (closer to production shape):**

```bash
cd server
npm install
npm start          # REST API on http://localhost:4000
```

Then serve `index.html` as above. The front-end automatically prefers the
live API and only falls back to the bundled sample data if the API can't be
reached (see "How data fetching works" below).

## Structure

```
index.html                    Single-page app shell
assets/
  css/style.css                All styling (unchanged from the design)
  js/
    config.js                  ★ Per-state identity/branding — the file to edit per state
    api.js                     Data access layer: tries the REST API, falls back to sample data
    sample-data.js              Offline fallback dataset (mirrors server/data/*.json)
    app.js                      App logic / rendering / routing — has no state-specific data in it
    vendor/chart.umd.js         Vendored Chart.js (no external CDN dependency)
server/
  server.js                    Express REST API (routes only — no data logic)
  db.js                        ★ Data access layer the routes call — swap this for a real DB
  schema.sql                   Suggested PostgreSQL schema mirroring server/data/*.json
  data/*.json                  Seed data ("the database" for the demo)
  package.json, .env.example
```

## How data fetching works

Nothing in `app.js` reads `sample-data.js` or knows about districts,
officers, or any other record directly. Every page calls into `window.API`
(`assets/js/api.js`), which:

1. Tries `fetch(apiBaseUrl + path)` against the backend in `server/`.
2. On any failure (no backend running, network error, timeout) it falls
   back to the matching key in `assets/js/sample-data.js`.

The Case Monitoring and IIF Forms pages also demonstrate this end-to-end:
picking a district/police station and clicking **Search** re-fetches
filtered records through `API.getCases({ district, station })`, which hits
`GET /api/cases?district=...&station=...` on the backend (or filters the
sample dataset the same way, offline).

This is the seam meant to be reused — connect a real database by editing
**`server/db.js` only** (see the comment block at the top of that file). Its
function signatures (`getDistricts`, `getCases`, `getDashboard`, etc.)
already match what `server.js` and `assets/js/api.js` expect; swap the JSON
file reads for real queries (an example PostgreSQL query and a suggested
schema are in `server/schema.sql`) and nothing else in the app needs to
change.

## Reusing this for another state

This app is deliberately state-agnostic outside of two places:

1. **`assets/js/config.js`** — state name, emblem text, app title, API
   base URL, and the four demo role-holders (DGP/Range/SP/SHO) shown after
   sign-in. Edit this file's values for the new state.
2. **The data itself** — either:
   - point `config.js`'s `apiBaseUrl` at a `server/` deployment reseeded
     with the new state's `server/data/*.json` (or, in production, backed
     by a real database via `db.js`), or
   - replace `assets/js/sample-data.js` with the new state's sample
     dataset (keep the same top-level keys) if running without a backend.

No other file (`app.js`, `api.js`, `index.html`, `style.css`) needs to
change — none of them hardcode a state name, district, or figure.

`server/server.js` also reads an `x-state-code` header (defaulting to the
`STATE_CODE` env var) on every request, so one backend deployment can, once
`db.js` is backed by a real multi-tenant database, serve more than one
state by filtering on that code.

## Notes

- This is a design/demo prototype, not connected to any live CCTNS
  system. Production deployment would authenticate through the CCTNS
  identity service and follow GIGW 3.0 / MHA data-sharing norms, as noted
  on the login screen.
- Chart.js is vendored locally (`assets/js/vendor/chart.umd.js`) rather
  than loaded from a CDN, so the site also works on isolated/offline
  networks typical of government deployments.
