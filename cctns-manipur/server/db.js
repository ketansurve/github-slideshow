/**
 * Data access layer for the Police Monitoring System backend.
 *
 * Every function here returns a Promise, and every route in server.js only
 * ever calls through this module - never touches storage directly. That is
 * the seam meant to be reused: this file currently reads the seed JSON
 * files in ./data as a stand-in "database", but the same function
 * signatures work unchanged against a real database.
 *
 * To connect a real database (e.g. PostgreSQL):
 *   1. npm install pg
 *   2. Replace the body of each function below with a query against your
 *      tables (see schema.sql for a suggested Postgres schema that mirrors
 *      these JSON shapes 1:1).
 *   3. Leave the function names, parameters and return shapes unchanged -
 *      server.js and the front-end api.js never need to change.
 *
 * Example swap for getDistricts():
 *   const { Pool } = require("pg");
 *   const pool = new Pool({ connectionString: process.env.DATABASE_URL });
 *   async function getDistricts(stateCode) {
 *     const { rows } = await pool.query(
 *       "SELECT code, name FROM districts WHERE state_code = $1 ORDER BY name",
 *       [stateCode]
 *     );
 *     return rows;
 *   }
 */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "data");

function readJson(file) {
  const raw = fs.readFileSync(path.join(DATA_DIR, file), "utf8");
  return JSON.parse(raw);
}

// state code is accepted on every function so a future multi-state deployment
// (one backend, many states) only needs a WHERE state_code = ? clause added
// to the real queries - the JSON seed here represents a single state's data.
async function getDistricts(_stateCode) {
  return readJson("districts.json");
}

async function getStations(_stateCode, districtCode) {
  const stations = readJson("stations.json");
  return districtCode ? stations.filter(s => s.districtCode === districtCode) : stations;
}

async function getCases(_stateCode, filters = {}) {
  let cases = readJson("cases.json");
  if (filters.district) cases = cases.filter(c => c.district === filters.district);
  if (filters.station) cases = cases.filter(c => c.station === filters.station);
  return cases;
}

async function getIifForms(_stateCode) {
  return readJson("iif-forms.json");
}

async function getOfficers(_stateCode) {
  return readJson("officers.json");
}

async function getIcjsPillars(_stateCode) {
  return readJson("icjs-pillars.json");
}

async function getCctvFeeds(_stateCode) {
  return readJson("cctv-feeds.json");
}

async function getDashboard(_stateCode) {
  return readJson("dashboard.json");
}

async function getAnalytics(_stateCode) {
  return readJson("analytics.json");
}

async function getNcl(_stateCode) {
  return readJson("ncl.json");
}

async function getQuality(_stateCode) {
  return readJson("quality.json");
}

async function getProjects(_stateCode) {
  return readJson("projects.json");
}

module.exports = {
  getDistricts,
  getStations,
  getCases,
  getIifForms,
  getOfficers,
  getIcjsPillars,
  getCctvFeeds,
  getDashboard,
  getAnalytics,
  getNcl,
  getQuality,
  getProjects
};
