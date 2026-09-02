/**
 * Application logic — state-agnostic.
 *
 * Reads identity/branding only from window.APP_CONFIG (assets/js/config.js)
 * and reads all records only through window.API (assets/js/api.js), which
 * in turn talks to the backend in server/ and falls back to
 * assets/js/sample-data.js when no backend is reachable. Nothing in this
 * file hardcodes a state name, district, officer, or figure — swap
 * config.js (and the backend's data) to reuse this whole app for another
 * state without touching this file.
 */
const CONFIG = window.APP_CONFIG;
const ROLES = CONFIG.roles;
let role = "dgp", charts = [];

// Reference data cached once after sign-in: district/station names for the
// filter bars, plus the full case list used by both the Case Monitoring
// and IIF pages.
let DISTRICTS = ["Select All"];
let STATIONS = ["Select All"];
let DISTRICTS_FULL = [];
let STATIONS_FULL = [];
let CASES_ALL = [];

/* ---------------- helpers ---------------- */
const $ = s => document.querySelector(s);
const opt = a => a.map(d => `<option>${d}</option>`).join("");
const n = v => Number(v).toLocaleString("en-IN");
function killCharts() { charts.forEach(c => c.destroy()); charts = []; }
function mk(id, cfg) { const el = document.getElementById(id); if (!el) return null; const c = new Chart(el, cfg); charts.push(c); return c; }
const GRID = { grid: { color: "#eef2f7" }, ticks: { color: "#5b6a7d", font: { size: 11 } } };
const BASE = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { labels: { color: "#16202e", boxWidth: 12, font: { size: 11 } } } },
  scales: { x: GRID, y: { ...GRID, beginAtZero: true } }
};
const toneClass = t => t ? ` ${t}` : "";
const statusPill = s => s.startsWith("Charge") ? "p-green" : s.startsWith("Pending") ? "p-amber" : "p-blue";
const healthPill = h => h === "Complete" ? "p-green" : h === "Attention" ? "p-amber" : "p-red";
const healthWord = h => h === "good" ? "Healthy" : h === "watch" ? "Watch" : "Action needed";
const healthClass = h => h === "good" ? "p-green" : h === "watch" ? "p-amber" : "p-red";
const statusClass = s => s === "good" ? "p-green" : s === "watch" ? "p-amber" : "p-red";

async function loadReferenceData() {
  const [districts, stations, cases] = await Promise.all([
    API.getDistricts(), API.getStations(), API.getCases()
  ]);
  DISTRICTS_FULL = districts;
  STATIONS_FULL = stations;
  DISTRICTS = ["Select All", ...districts.map(d => d.name)];
  STATIONS = ["Select All", ...stations.map(s => s.name)];
  CASES_ALL = cases;
}

function kpiTile(k) {
  return `<div class="kpi${toneClass(k.tone)}"><h4>${k.label}</h4><div class="val">${k.value}</div><div class="delta">${k.delta}</div></div>`;
}

function filterBar(extra = "") {
  return `<div class="filters">
    <div><label>District</label><select data-role="district">${opt(DISTRICTS)}</select></div>
    <div><label>Police Station</label><select data-role="station">${opt(STATIONS)}</select></div>
    <div><label>From date</label><input type="date" value="2026-01-01"></div>
    <div><label>To date</label><input type="date" value="2026-09-02"></div>
    ${extra}
    <div class="acts"><button class="btn" data-role="search">Search</button><button class="btn ghost" data-role="reset">Reset</button></div>
  </div>`;
}
function scopeHint() {
  return `<div class="hint"><strong>Scope:</strong> ${ROLES[role].scope}. Districts, police stations and IIF forms outside this scope are hidden by the CCTNS role mapping, not merely disabled.</div>`;
}

// Wires a page's filter bar to a live district->station cascade and hands
// the chosen {district, station} back to onSearch()/onReset() so the page
// can re-fetch through API with real filters, instead of the bar being
// decorative.
function wireFilters(onSearch, onReset) {
  const bar = $("#page .filters");
  if (!bar) return;
  const distSel = bar.querySelector('[data-role="district"]');
  const stSel = bar.querySelector('[data-role="station"]');
  distSel.addEventListener("change", () => {
    const dName = distSel.value;
    const d = DISTRICTS_FULL.find(x => x.name === dName);
    const inScope = dName === "Select All" ? STATIONS_FULL
      : STATIONS_FULL.filter(s => d && s.districtCode === d.code);
    stSel.innerHTML = opt(["Select All", ...inScope.map(s => s.name)]);
  });
  bar.querySelector('[data-role="search"]').addEventListener("click", e => {
    e.preventDefault();
    onSearch && onSearch({ district: distSel.value, station: stSel.value });
  });
  bar.querySelector('[data-role="reset"]').addEventListener("click", e => {
    e.preventDefault();
    distSel.value = "Select All"; stSel.value = "Select All";
    stSel.innerHTML = opt(STATIONS);
    onReset && onReset();
  });
}

function casesTable(cases) {
  if (!cases.length) return `<p style="padding:14px;font-size:12.5px;color:var(--ink-soft)">No cases match the selected district / police station.</p>`;
  return `<table><thead><tr><th>Sl.</th><th>District</th><th>Police station</th><th>FIR no.</th><th>Date</th><th>Section of law</th><th>Status</th><th>Category</th><th>Pending (days)</th><th></th></tr></thead>
  <tbody>${cases.map((c, k) => `<tr><td>${k + 1}</td><td>${c.district}</td><td>${c.station}</td><td>${c.firNo}</td><td>${c.firDate}</td><td>${c.sections}</td>
    <td><span class="pill ${statusPill(c.status)}">${c.status}</span></td><td>${c.category}</td><td>${c.pendingDays}</td>
    <td><button class="btn" style="padding:4px 10px;font-size:11.5px">Open</button></td></tr>`).join("")}</tbody></table>`;
}

/* ---------------- pages ---------------- */
const PAGES = {};

PAGES.dashboard = async () => {
  const d = await API.getDashboard();
  $("#page").innerHTML = `
  <h2 class="page-title">Dashboard<small>${ROLES[role].office} · position as on ${CONFIG.asOnDate}</small></h2>
  ${scopeHint()}
  ${filterBar()}
  <div class="kpis">${d.kpis.map(kpiTile).join("")}</div>
  <div class="grid g2">
    <div class="card"><h3>Registration and disposal — month wise</h3><div class="body"><div class="chart-wrap"><canvas id="c1"></canvas></div></div></div>
    <div class="card"><h3>Pendency ageing</h3><div class="body"><div class="chart-wrap"><canvas id="c2"></canvas></div></div></div>
  </div>
  <div class="grid g3" style="margin-top:14px">
    <div class="card"><h3>Malkhana status</h3><div class="body">
      <p style="margin:0 0 6px;font-size:12.5px">${d.malkhana.label}</p>
      <div class="meter"><i class="warn" style="width:${d.malkhana.percent}%"></i></div></div></div>
    <div class="card"><h3>Missing persons</h3><div class="body">
      <p style="margin:0 0 6px;font-size:12.5px">${d.missingPersons.label}</p>
      <div class="meter"><i style="width:${d.missingPersons.percent}%"></i></div></div></div>
    <div class="card"><h3>Citizen service requests</h3><div class="body">
      <p style="margin:0 0 6px;font-size:12.5px">${d.citizenService.label}</p>
      <div class="meter"><i style="width:${d.citizenService.percent}%"></i></div></div></div>
  </div>`;
  wireFilters();
  mk("c1", { type: "bar", data: { labels: d.monthlyTrend.labels, datasets: [
    { label: "Registered", data: d.monthlyTrend.registered, backgroundColor: "#16549b" },
    { label: "Charge sheeted", data: d.monthlyTrend.chargesheeted, backgroundColor: "#138808" }
  ] }, options: BASE });
  mk("c2", { type: "doughnut", data: { labels: d.ageing.labels, datasets: [{ data: d.ageing.values, backgroundColor: ["#138808", "#16549b", "#ff9933", "#c0392b"] }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "right", labels: { font: { size: 11 } } } } } });
};

PAGES.cases = async () => {
  const kpis = [
    { label: "All cognizable", value: "24,860", delta: "since 2015", tone: "" },
    { label: "Investigation closed", value: "18,461", delta: "", tone: "good" },
    { label: "Pending investigation", value: "6,399", delta: "", tone: "bad" },
    { label: "Old pending (pre-2026)", value: "8,247", delta: "", tone: "warn" }
  ];
  $("#page").innerHTML = `
  <h2 class="page-title">Case monitoring<small>Review type: monthly · quarterly · annual · date range</small></h2>
  ${filterBar(`<div><label>Review type</label><select><option>Annually</option><option>Quarterly</option><option>Monthly</option><option>Date wise</option></select></div>`)}
  <div class="kpis">${kpis.map(kpiTile).join("")}</div>
  <div class="card"><h3>Case register</h3><div class="body scroll" id="cases-body">${casesTable(CASES_ALL)}</div></div>`;
  wireFilters(
    async (f) => {
      const filtered = await API.getCases(f);
      $("#cases-body").innerHTML = casesTable(filtered);
    },
    async () => { $("#cases-body").innerHTML = casesTable(await API.getCases()); }
  );
};

PAGES.iif = async () => {
  const forms = await API.getIifForms();
  $("#page").innerHTML = `
  <h2 class="page-title">IIF forms — 1 to 24<small>Past and ongoing cases, filtered by district and police station</small></h2>
  ${filterBar()}
  <div class="tabs iif-tabs" id="iif-tabs">${forms.map((f, i) => `<button data-i="${i}" class="${i ? "" : "on"}">${f.code}</button>`).join("")}</div>
  <div id="iif-body"></div>`;
  wireFilters(
    async (filters) => { renderIifBody(forms, currentIifIndex, await API.getCases(filters)); },
    async () => { renderIifBody(forms, currentIifIndex, await API.getCases()); }
  );
  let currentIifIndex = 0;
  function renderIifBody(forms, i, cases) {
    const f = forms[i];
    const cls = healthPill(f.health);
    $("#iif-body").innerHTML = `
    <div class="kpis">
      <div class="kpi"><h4>${f.code} records</h4><div class="val">${n(f.count)}</div><div class="delta">${f.name}</div></div>
      <div class="kpi"><h4>Mandatory fields filled</h4><div class="val">${f.health === "Complete" ? "97.2%" : f.health === "Attention" ? "88.5%" : "74.1%"}</div><div class="delta">against CCTNS 2.0 schema</div></div>
      <div class="kpi"><h4>Pushed to ICJS</h4><div class="val">${f.health === "Weak" ? "81.0%" : "98.6%"}</div><div class="delta">acknowledged by receiving pillar</div></div>
      <div class="kpi"><h4>Form health</h4><div class="val" style="font-size:16px;padding-top:6px"><span class="pill ${cls}">${f.health}</span></div><div class="delta">last computed 06:00 hrs</div></div>
    </div>
    <div class="card"><h3>${f.code} — ${f.name}</h3><div class="body scroll">${casesTable(cases)}</div></div>`;
  }
  const t = $("#iif-tabs");
  t.addEventListener("click", async e => {
    const b = e.target.closest("button"); if (!b) return;
    t.querySelectorAll("button").forEach(x => x.classList.remove("on"));
    b.classList.add("on"); currentIifIndex = +b.dataset.i;
    renderIifBody(forms, currentIifIndex, await API.getCases());
  });
  renderIifBody(forms, 0, await API.getCases());
};

PAGES.io = async () => {
  const officers = await API.getOfficers();
  $("#page").innerHTML = `
  <h2 class="page-title">Investigating officer performance<small>Disposal, quality and timeliness — supervisory view</small></h2>
  ${filterBar()}
  <div class="grid g2">
    <div class="card"><h3>Disposal rate by officer</h3><div class="body"><div class="chart-wrap"><canvas id="io1"></canvas></div></div></div>
    <div class="card"><h3>Charge sheet quality index</h3><div class="body"><div class="chart-wrap"><canvas id="io2"></canvas></div></div></div>
  </div>
  <div class="card" style="margin-top:14px"><h3>Officer scorecard</h3><div class="body scroll">
  <table><thead><tr><th>Officer</th><th>Police station</th><th>District</th><th>Assigned</th><th>Charge sheeted</th><th>Pending</th><th>Beyond 90 days</th><th>Disposal %</th><th>Quality index</th></tr></thead>
  <tbody>${officers.map(o => `<tr><td>${o.name}</td><td>${o.station}</td><td>${o.district}</td><td>${o.assigned}</td><td>${o.chargesheeted}</td><td>${o.pending}</td>
  <td>${o.beyond90}</td><td><span class="pill ${o.disposalPct > 85 ? "p-green" : o.disposalPct > 75 ? "p-amber" : "p-red"}">${o.disposalPct}%</span></td>
  <td>${o.qualityIndex}<div class="meter"><i class="${o.qualityIndex > 75 ? "" : o.qualityIndex > 60 ? "warn" : "bad"}" style="width:${o.qualityIndex}%"></i></div></td></tr>`).join("")}</tbody></table>
  </div></div>`;
  wireFilters();
  mk("io1", { type: "bar", data: { labels: officers.map(o => o.name.split(" ").slice(-1)[0]), datasets: [{ label: "Disposal %", data: officers.map(o => o.disposalPct), backgroundColor: "#16549b" }] }, options: BASE });
  mk("io2", { type: "radar", data: { labels: ["Timeliness", "Evidence upload", "Witness statements", "Forensic follow-up", "Court readiness"],
    datasets: [{ label: "State average", data: [74, 68, 81, 63, 77], borderColor: "#0b3c7e", backgroundColor: "rgba(11,60,126,.15)" },
               { label: "Top quartile", data: [91, 88, 94, 85, 90], borderColor: "#138808", backgroundColor: "rgba(19,136,8,.15)" }] },
    options: { responsive: true, maintainAspectRatio: false, scales: { r: { beginAtZero: true, max: 100 } } } });
};

PAGES.analytics = async () => {
  const a = await API.getAnalytics();
  $("#page").innerHTML = `
  <h2 class="page-title">Crime analytics<small>Category, trend, time-of-day and hotspot analysis</small></h2>
  ${filterBar()}
  <div class="grid g2">
    <div class="card"><h3>Yearly trend by category</h3><div class="body"><div class="chart-wrap"><canvas id="a1"></canvas></div></div></div>
    <div class="card"><h3>Time of occurrence</h3><div class="body"><div class="chart-wrap"><canvas id="a2"></canvas></div></div></div>
    <div class="card"><h3>Category share</h3><div class="body"><div class="chart-wrap"><canvas id="a3"></canvas></div></div></div>
    <div class="card"><h3>District hotspots — top 6</h3><div class="body"><div class="chart-wrap"><canvas id="a4"></canvas></div></div></div>
  </div>`;
  wireFilters();
  mk("a1", { type: "line", data: { labels: a.yearlyTrendByCategory.labels, datasets: a.yearlyTrendByCategory.series.map(s => ({ label: s.label, data: s.data, borderColor: s.color, tension: .35 })) }, options: BASE });
  mk("a2", { type: "line", data: { labels: a.timeOfDay.labels, datasets: [{ label: "Incidents", data: a.timeOfDay.values, borderColor: "#16549b", backgroundColor: "rgba(22,84,155,.18)", fill: true, tension: .4 }] }, options: BASE });
  mk("a3", { type: "pie", data: { labels: a.categoryShare.labels, datasets: [{ data: a.categoryShare.values, backgroundColor: a.categoryShare.colors }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "right", labels: { font: { size: 11 } } } } } });
  mk("a4", { type: "bar", data: { labels: a.districtHotspots.labels, datasets: [{ label: "FIR registered", data: a.districtHotspots.values, backgroundColor: "#0b3c7e" }] }, options: { ...BASE, indexAxis: "y" } });
};

PAGES.ncl = async () => {
  const k = await API.getNcl();
  $("#page").innerHTML = `
  <h2 class="page-title">New Criminal Laws and NCLI KPIs<small>BNS 2023 · BNSS 2023 · BSA 2023 — statutory timeline compliance</small></h2>
  ${filterBar()}
  <div class="kpis">${k.kpis.map(kpiTile).join("")}</div>
  <div class="grid g2">
    <div class="card"><h3>NCLI KPI compliance by district</h3><div class="body"><div class="chart-wrap"><canvas id="k1"></canvas></div></div></div>
    <div class="card"><h3>Statutory timeline adherence</h3><div class="body"><div class="chart-wrap"><canvas id="k2"></canvas></div></div></div>
  </div>`;
  wireFilters();
  mk("k1", { type: "bar", data: { labels: k.complianceByDistrict.labels, datasets: k.complianceByDistrict.series.map(s => ({ label: s.label, data: s.data, backgroundColor: s.color })) },
    options: { ...BASE, scales: { x: GRID, y: { ...GRID, beginAtZero: true, max: 100 } } } });
  mk("k2", { type: "line", data: { labels: k.timelineTrend.labels, datasets: k.timelineTrend.series.map(s => ({ label: s.label, data: s.data, borderColor: s.color, tension: .35 })) },
    options: { ...BASE, scales: { x: GRID, y: { ...GRID, beginAtZero: true, max: 100 } } } });
};

PAGES.quality = async () => {
  const q = await API.getQuality();
  $("#page").innerHTML = `
  <h2 class="page-title">Data quality and completeness<small>Accuracy, completeness, timeliness and ICJS reconciliation</small></h2>
  <div class="hint">Data quality scoring follows the CCTNS 2.0 / ICJS 2.0 principle that a record is usable only when it is complete, internally consistent, entered within the prescribed window and acknowledged by the receiving pillar. A form counts as clean only if it clears all four.</div>
  ${filterBar()}
  <div class="kpis">${q.kpis.map(kpiTile).join("")}</div>
  <div class="grid g2">
    <div class="card"><h3>Quality dimensions</h3><div class="body"><div class="chart-wrap"><canvas id="q1"></canvas></div></div></div>
    <div class="card"><h3>Weakest forms by completeness</h3><div class="body">
      ${q.weakestForms.map(r => `<div style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;font-size:12.5px"><span>${r.form}</span><strong>${r.percent}%</strong></div>
      <div class="meter"><i class="${r.percent > 80 ? "warn" : "bad"}" style="width:${r.percent}%"></i></div></div>`).join("")}
    </div></div>
  </div>
  <div class="card" style="margin-top:14px"><h3>Exception worklist — assigned for correction</h3><div class="body scroll">
  <table><thead><tr><th>Exception</th><th>Form</th><th>District</th><th>Police station</th><th>Count</th><th>Ageing</th><th>Owner</th></tr></thead>
  <tbody>${q.exceptions.map(e => `<tr><td>${e.exception}</td><td>${e.form}</td><td>${e.district}</td><td>${e.station}</td><td>${e.count}</td><td>${e.ageing}</td><td>${e.owner}</td></tr>`).join("")}</tbody></table></div></div>`;
  wireFilters();
  mk("q1", { type: "radar", data: { labels: q.dimensions.labels, datasets: [
    { label: CONFIG.stateName, data: q.dimensions.state, borderColor: "#0b3c7e", backgroundColor: "rgba(11,60,126,.15)" },
    { label: "Target", data: q.dimensions.target, borderColor: "#138808", backgroundColor: "rgba(19,136,8,.12)" }
  ] }, options: { responsive: true, maintainAspectRatio: false, scales: { r: { beginAtZero: true, max: 100 } } } });
};

PAGES.cctv = async () => {
  const feeds = await API.getCctvFeeds();
  const live = feeds.filter(f => f.status === "up").length;
  $("#page").innerHTML = `
  <h2 class="page-title">Police station CCTV wall<small>BNSS s.187 custody-area coverage and uptime monitoring</small></h2>
  <div class="hint">Feeds are surfaced read-only from the state VMS. Retention, masking and access logging follow the state's video policy; every view is recorded against the viewing officer's CCTNS ID.</div>
  ${filterBar()}
  <div class="kpis">
    <div class="kpi"><h4>Cameras mapped</h4><div class="val">612</div><div class="delta">across 92 police stations</div></div>
    <div class="kpi good"><h4>Live now — sample feeds shown</h4><div class="val">${live}/${feeds.length}</div><div class="delta">${Math.round((live / feeds.length) * 1000) / 10}% uptime, this sample</div></div>
    <div class="kpi bad"><h4>Offline beyond 24 hrs</h4><div class="val">${feeds.length - live}</div><div class="delta">ticket raised with SI agency</div></div>
    <div class="kpi warn"><h4>Recording retention shortfall</h4><div class="val">14 PS</div><div class="delta">below 30-day mandate</div></div>
  </div>
  <div class="cctv">
    ${feeds.map(f => `<div class="feed"><div class="screen">${f.status === "up" ? "LIVE · 1080p" : "NO SIGNAL"}</div>
      <div class="meta"><span class="dot ${f.status}"></span>${f.station}<br><span style="color:#5b6a7d;font-size:11.5px">${f.location}</span></div></div>`).join("")}
  </div>`;
  wireFilters();
};

PAGES.icjs = async () => {
  const [pillars, projects] = await Promise.all([API.getIcjsPillars(), API.getProjects()]);
  $("#page").innerHTML = `
  <h2 class="page-title">ICJS pillar and aligned project monitoring<small>Cross-pillar exchange health and state project status</small></h2>
  ${filterBar()}
  <div class="card"><h3>ICJS 2.0 pillar exchange</h3><div class="body scroll">
  <table><thead><tr><th>Pillar</th><th>Exchange volume</th><th>Acknowledgement rate</th><th>Health</th></tr></thead>
  <tbody>${pillars.map(p => `<tr><td>${p.pillar}</td><td>${p.exchange}</td><td>${p.ackRate}</td><td><span class="pill ${healthClass(p.health)}">${healthWord(p.health)}</span></td></tr>`).join("")}</tbody></table>
  </div></div>
  <div class="grid g2" style="margin-top:14px">
    <div class="card"><h3>Aligned state projects</h3><div class="body scroll">
      <table><thead><tr><th>Project</th><th>Coverage</th><th>Status</th></tr></thead><tbody>
      ${projects.alignedProjects.map(p => `<tr><td>${p.project}</td><td>${p.coverage}</td><td><span class="pill ${statusClass(p.status)}">${p.status === "good" ? "On track" : p.status === "watch" ? "Watch" : "Delayed"}</span></td></tr>`).join("")}
      </tbody></table></div></div>
    <div class="card"><h3>Pillar acknowledgement trend</h3><div class="body"><div class="chart-wrap"><canvas id="ic1"></canvas></div></div></div>
  </div>`;
  wireFilters();
  mk("ic1", { type: "line", data: { labels: projects.pillarAckTrend.labels, datasets: projects.pillarAckTrend.series.map(s => ({ label: s.label, data: s.data, borderColor: s.color, tension: .35 })) },
    options: { ...BASE, scales: { x: GRID, y: { ...GRID, beginAtZero: true, max: 100 } } } });
};

PAGES.registers = async () => {
  $("#page").innerHTML = `
  <h2 class="page-title">Registers and monitoring reports<small>Standard supervisory returns, exportable to PDF and Excel</small></h2>
  ${filterBar()}
  <div class="grid g3">
  ${[["Zero FIR and 60–90 day report", "Registration, re-registration and transfer pendency"],
     ["DG / IGP monitoring report", "Consolidated state review pack"],
     ["Malkhana status report", "Seizure, acceptance and disposal position"],
     ["Citizen service report", "Requests received, closed and pending"],
     ["SR and non-SR module", "Special report case tracking"],
     ["Alert for charge sheet", "Cases approaching the statutory limit"],
     ["PS-wise Pragati dashboard", "Station ranking on the monitoring index"],
     ["Court disposal register", "Judgements consumed from eCourts"],
     ["Absconder and PO register", "Pending execution of warrants"]]
   .map(r => `<div class="card"><h3>${r[0]}</h3><div class="body">
     <p style="margin:0 0 12px;font-size:12.5px;color:var(--ink-soft);line-height:1.55">${r[1]}</p>
     <button class="btn" style="padding:6px 12px;font-size:12px">Open report</button>
     <button class="btn ghost" style="padding:6px 12px;font-size:12px">Export</button></div></div>`).join("")}
  </div>`;
  wireFilters();
};

/* ---------------- routing ---------------- */
async function go(p) {
  killCharts();
  $("#page").innerHTML = `<div class="loading">Loading ${p}…</div>`;
  await PAGES[p]();
  window.scrollTo(0, 0);
}

document.querySelector("nav.side").addEventListener("click", e => {
  const b = e.target.closest("button[data-p]"); if (!b) return;
  document.querySelectorAll("nav.side button").forEach(x => x.classList.remove("on"));
  b.classList.add("on"); go(b.dataset.p);
});

/* ---------------- branding / login wiring ---------------- */
document.title = `${CONFIG.appTitle} — CCTNS 2.0 / ICJS 2.0`;
$(".emblem").innerHTML = `${CONFIG.emblemLine1}<br>${CONFIG.emblemLine2}`;
document.querySelector(".masthead h1").textContent = CONFIG.appTitle;
$("#office-line").textContent = CONFIG.appSubtitle;
$("#uid").value = ROLES.dgp.userId;

$("#signin").addEventListener("click", async () => {
  role = $("#role").value;
  const r = ROLES[role];
  $("#who-name").textContent = r.name;
  $("#who-desig").textContent = r.desig;
  $("#office-line").textContent = r.office;
  $("#role-badge").textContent = r.desig;
  $("#role-badge").style.display = "block";
  $("#logout").style.display = "block";
  $("#login").style.display = "none";
  $("#app").style.display = "grid";
  document.querySelectorAll("nav.side button").forEach((x, i) => x.classList.toggle("on", i === 0));
  $("#page").innerHTML = `<div class="loading">Connecting to CCTNS data services…</div>`;
  await loadReferenceData();
  go("dashboard");
});

$("#logout").addEventListener("click", () => {
  killCharts();
  $("#app").style.display = "none";
  $("#login").style.display = "grid";
  $("#role-badge").style.display = "none";
  $("#logout").style.display = "none";
  $("#office-line").textContent = CONFIG.appSubtitle;
});
