/**
 * Data access layer for the front-end.
 *
 * Every page in app.js reads data only through the functions below - never
 * through window.SAMPLE_DATA directly. Each function tries the REST API
 * first (server/, configured via APP_CONFIG.apiBaseUrl) and transparently
 * falls back to the bundled sample-data.js if that fetch fails, so the
 * site is workable both against a real backend and as static files with
 * no backend at all.
 *
 * A future backend swap (a real database behind server/db.js) needs no
 * change here: the shapes returned by the API already match
 * sample-data.js exactly.
 */
const API = (() => {
  const BASE = (window.APP_CONFIG && window.APP_CONFIG.apiBaseUrl) || "";
  const STATE_CODE = (window.APP_CONFIG && window.APP_CONFIG.stateCode) || "";
  const SAMPLE = window.SAMPLE_DATA || {};
  const FETCH_TIMEOUT_MS = 2500;

  async function fetchJson(path) {
    if (!BASE) throw new Error("no API base configured");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(BASE + path, {
        headers: { "x-state-code": STATE_CODE },
        signal: controller.signal
      });
      if (!res.ok) throw new Error(`API ${path} responded ${res.status}`);
      const body = await res.json();
      if (!body.ok) throw new Error(`API ${path} returned an error`);
      return body.data;
    } finally {
      clearTimeout(timer);
    }
  }

  // Tries the live API, logs a quiet notice and falls back to the sample
  // dataset on any failure (offline, no backend deployed, CORS, timeout).
  async function withFallback(path, fallbackValue) {
    try {
      return await fetchJson(path);
    } catch (err) {
      console.info(`[API] falling back to sample data for ${path}: ${err.message}`);
      return fallbackValue;
    }
  }

  function filterCases(cases, filters) {
    return cases.filter(c =>
      (!filters.district || filters.district === "Select All" || c.district === filters.district) &&
      (!filters.station || filters.station === "Select All" || c.station === filters.station)
    );
  }

  return {
    getDistricts: () => withFallback("/districts", SAMPLE.districts || []),

    getStations: (districtCode) => withFallback(
      "/stations" + (districtCode ? `?district=${encodeURIComponent(districtCode)}` : ""),
      districtCode ? (SAMPLE.stations || []).filter(s => s.districtCode === districtCode) : (SAMPLE.stations || [])
    ),

    getCases: async (filters = {}) => {
      const qs = new URLSearchParams();
      if (filters.district && filters.district !== "Select All") qs.set("district", filters.district);
      if (filters.station && filters.station !== "Select All") qs.set("station", filters.station);
      const query = qs.toString() ? `?${qs.toString()}` : "";
      const data = await withFallback(`/cases${query}`, filterCases(SAMPLE.cases || [], filters));
      return data;
    },

    getIifForms: () => withFallback("/iif-forms", SAMPLE.iifForms || []),
    getOfficers: () => withFallback("/officers", SAMPLE.officers || []),
    getIcjsPillars: () => withFallback("/icjs-pillars", SAMPLE.icjsPillars || []),
    getCctvFeeds: () => withFallback("/cctv-feeds", SAMPLE.cctvFeeds || []),
    getDashboard: () => withFallback("/dashboard", SAMPLE.dashboard || {}),
    getAnalytics: () => withFallback("/analytics", SAMPLE.analytics || {}),
    getNcl: () => withFallback("/ncl", SAMPLE.ncl || {}),
    getQuality: () => withFallback("/quality", SAMPLE.quality || {}),
    getProjects: () => withFallback("/projects", SAMPLE.projects || {})
  };
})();
