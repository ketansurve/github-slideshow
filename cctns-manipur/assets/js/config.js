/**
 * Per-state configuration.
 *
 * This is the ONE file to edit to reuse this website for a different
 * state: identity/branding here, plus the API base URL the front-end
 * talks to. Everything else (assets/js/app.js, assets/js/api.js,
 * index.html, assets/css/style.css) is state-agnostic and reads from
 * this object plus whatever the API (or the offline fallback in
 * sample-data.js) returns - no other file should need district names,
 * officer names, or a state title hardcoded into it.
 *
 * To onboard a new state:
 *   1. Duplicate this file's values for the new state (code, name,
 *      emblem text, role holders).
 *   2. Point apiBaseUrl at that state's backend deployment (server/),
 *      seeded from that state's own server/data/*.json.
 *   3. If running the front-end without a backend, also replace
 *      assets/js/sample-data.js with that state's sample dataset.
 */
window.APP_CONFIG = {
  stateCode: "MN",
  stateName: "Manipur",
  policeName: "Manipur Police",
  emblemLine1: "MANIPUR",
  emblemLine2: "POLICE",
  appTitle: "Police Monitoring System",
  appSubtitle: "Crime & Criminal Tracking Network and Systems — Manipur Police",

  // Base URL of the REST API in server/. Leave as-is to try a locally
  // running backend first; if it can't be reached (e.g. this page is
  // opened as a static file, or no backend is deployed yet) the app
  // transparently falls back to assets/js/sample-data.js so the site
  // still works standalone.
  apiBaseUrl: "http://localhost:4000/api",

  asOnDate: "02 September 2026",

  roles: {
    dgp: {
      userId: "MN-DGP-0101",
      name: "L. Kailun",
      desig: "DGP, Manipur Police",
      scope: "All districts and police stations",
      office: "Office of the Director General of Police, Manipur"
    },
    range: {
      userId: "MN-IG-0212",
      name: "H. Ibochou Singh",
      desig: "IG, Imphal Range",
      scope: "Range districts",
      office: "Office of the Inspector General, Imphal Range"
    },
    sp: {
      userId: "MN-SP-0305",
      name: "N. Herojit Singh",
      desig: "SP, Imphal West",
      scope: "District Imphal West",
      office: "Office of the Superintendent of Police, Imphal West"
    },
    sho: {
      userId: "MN-SHO-0418",
      name: "K. Somorjit Singh",
      desig: "Inspector-in-Charge, Lamphel PS",
      scope: "Lamphel Police Station",
      office: "Lamphel Police Station"
    }
  }
};
