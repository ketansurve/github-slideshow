/**
 * REST API for the Police Monitoring System.
 *
 * State-agnostic on purpose: every route reads the state code from the
 * `x-state-code` header (default STATE_CODE env var, falling back to "MN"
 * for this Manipur sample deployment) and passes it into db.js. Pointing
 * this same server at another state only means re-seeding server/data
 * (or, once db.js is backed by a real database, filtering by state_code)
 * - no route changes needed.
 */

const express = require("express");
const cors = require("cors");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 4000;
const DEFAULT_STATE = process.env.STATE_CODE || "MN";

app.use(cors());
app.use(express.json());

app.use((req, _res, next) => {
  req.stateCode = req.header("x-state-code") || DEFAULT_STATE;
  next();
});

function ok(res, data) {
  res.json({ ok: true, data });
}

function fail(res, err) {
  console.error(err);
  res.status(500).json({ ok: false, error: "Internal server error" });
}

app.get("/api/health", (_req, res) => ok(res, { status: "up", time: new Date().toISOString() }));

app.get("/api/districts", async (req, res) => {
  try { ok(res, await db.getDistricts(req.stateCode)); } catch (e) { fail(res, e); }
});

app.get("/api/stations", async (req, res) => {
  try { ok(res, await db.getStations(req.stateCode, req.query.district)); } catch (e) { fail(res, e); }
});

app.get("/api/cases", async (req, res) => {
  try {
    ok(res, await db.getCases(req.stateCode, {
      district: req.query.district,
      station: req.query.station
    }));
  } catch (e) { fail(res, e); }
});

app.get("/api/iif-forms", async (req, res) => {
  try { ok(res, await db.getIifForms(req.stateCode)); } catch (e) { fail(res, e); }
});

app.get("/api/officers", async (req, res) => {
  try { ok(res, await db.getOfficers(req.stateCode)); } catch (e) { fail(res, e); }
});

app.get("/api/icjs-pillars", async (req, res) => {
  try { ok(res, await db.getIcjsPillars(req.stateCode)); } catch (e) { fail(res, e); }
});

app.get("/api/cctv-feeds", async (req, res) => {
  try { ok(res, await db.getCctvFeeds(req.stateCode)); } catch (e) { fail(res, e); }
});

app.get("/api/dashboard", async (req, res) => {
  try { ok(res, await db.getDashboard(req.stateCode)); } catch (e) { fail(res, e); }
});

app.get("/api/analytics", async (req, res) => {
  try { ok(res, await db.getAnalytics(req.stateCode)); } catch (e) { fail(res, e); }
});

app.get("/api/ncl", async (req, res) => {
  try { ok(res, await db.getNcl(req.stateCode)); } catch (e) { fail(res, e); }
});

app.get("/api/quality", async (req, res) => {
  try { ok(res, await db.getQuality(req.stateCode)); } catch (e) { fail(res, e); }
});

app.get("/api/projects", async (req, res) => {
  try { ok(res, await db.getProjects(req.stateCode)); } catch (e) { fail(res, e); }
});

app.listen(PORT, () => {
  console.log(`Police Monitoring System API listening on http://localhost:${PORT}`);
  console.log(`Default state code: ${DEFAULT_STATE}`);
});
