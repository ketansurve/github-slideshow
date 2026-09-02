# Bihar State Law Commission — Citizen Website

A working front-end build of the approved BSLC UI mockup (`BSLCUIMockup_1.html`):
a real multi-page static site instead of the single-file tab-switcher demo,
with the interactive pieces actually wired up.

## Run it

No build step — it's plain HTML/CSS/JS. Either open `index.html` directly in a
browser, or serve the folder so relative script/CSS paths and the client-side
routing behave exactly as they will once deployed:

```
cd bslc-website
python3 -m http.server 8000   # or: npx http-server -p 8000
```

Then visit `http://localhost:8000/`.

## What's here

- **29 pages** covering every link in the top nav, the department left menu,
  and the footer (About Us, Who's Who, Acts & Rules, Reports, Notification /
  Circular, Public Consultation, RTI, Tender, Downloads, Document Archive,
  Contact Us, the GIGW policy pages, Site Map, Feedback, FAQ, etc.) so
  navigating the site never dead-ends on `#`.
- **`assets/css/site.css`** — shared styles (ported from the mockup's palette
  and components) plus a working high-contrast theme.
- **`assets/js/chrome.js`** — injects the identical header, top nav, left
  "Department Menu", and footer on every page from one source, so they can
  never drift out of sync; also drives the A-/A/A+ text size and high
  contrast toggles (persisted in `localStorage`).
- **`assets/js/i18n.js`** — the English/Hindi switch. Elements opt in with
  `data-i18n="key"`; each page supplies its own extra keys via
  `window.BSLC_I18N_EXTRA` before the script loads.
- **`assets/js/site.js`** — the two functional flows:
  - **Login** (`login.html`): captcha + simulated OTP sign-in (the OTP is
    shown on screen instead of sent by SMS, since this is a front-end-only
    build). Locks after 5 failed attempts, per the mockup's stated rule.
  - **Document Archive** (`document-archive.html`): gated behind the login
    above (redirects with `?redirect=`), with a real client-side dataset
    filtered live by year, document type, and full-text search.

## What's still a placeholder

This is a demo, not a production system — there is no backend. Before a real
launch:

- Wire the login form to the actual Jan Parichay / Bihar SSO identity
  provider, and the archive to the real document repository and audit log.
- Replace placeholder names, photographs, statistics, and document contents
  with content approved by the Commission.
- Source the exact NIC Bihar template assets (emblem artwork, exact logo
  files, any CSS the department's template kit specifies) referenced in the
  original mockup's note.
- Wire the Feedback form to a real mailbox/ticketing endpoint.
