/* Bihar State Law Commission — shared helpers for talking to the backend.

   - safeRedirect(): validates the login page's ?redirect= value so it can only
     point at a page of this site (relative path ending in .html). Anything
     else — javascript: URLs, other hosts, protocol-relative //host, absolute
     /paths, backslashes, encoded tricks — falls back to document-archive.html.
   - BSLC.api(): fetch wrapper for the API at window.BSLC_API_BASE (set in
     assets/js/config.js). When BSLC_API_BASE is empty the site runs in the
     original front-end demo mode and no request is ever made.

   SECURITY NOTE: nothing in this file is a security control. The token kept
   in sessionStorage only identifies the user to the API; every access
   decision (who may see a restricted document, who may comment on a
   consultation, who may manage users) is made by the server. */
(function(root, factory){
  if(typeof module === "object" && module.exports){ module.exports = factory(root); }
  else { root.BSLC = factory(root); }
})(typeof window !== "undefined" ? window : this, function(win){
  "use strict";

  var DEFAULT_TARGET = "document-archive.html";
  /* one or more path segments; each starts with a letter, digit, _ or -
     (so "." and ".." are impossible) and the last one ends in .html */
  var SAFE_PATH = /^(?:[A-Za-z0-9_-][A-Za-z0-9._-]*\/)*[A-Za-z0-9_-][A-Za-z0-9._-]*\.html$/;

  function safeRedirect(raw, fallback){
    fallback = fallback || DEFAULT_TARGET;
    if(typeof raw !== "string") return fallback;
    var s = raw.trim();
    if(!s || s.length > 512) return fallback;
    if(/[\\\s\u0000-\u001F\u007F]/.test(s)) return fallback;
    var cut = s.search(/[?#]/);
    var path = cut === -1 ? s : s.slice(0, cut);
    var decoded;
    try { decoded = decodeURIComponent(path); } catch(e){ return fallback; }
    if(decoded !== path) return fallback;          // no percent-encoding in the path part
    if(!SAFE_PATH.test(path)) return fallback;
    return s;
  }

  function escapeHtml(v){
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /* ---------- API client (only active when BSLC_API_BASE is set) ---------- */
  function store(){ try { return win.sessionStorage; } catch(e){ return null; } }

  function apiBase(){
    var b = (win && win.BSLC_API_BASE) || "";
    return String(b).replace(/\/+$/, "");
  }
  function apiEnabled(){ return apiBase() !== ""; }

  function getToken(){ var s = store(); return s ? s.getItem("bslc_token") : null; }
  function setSession(token, user){
    var s = store(); if(!s) return;
    s.setItem("bslc_token", token);
    s.setItem("bslc_auth", "1");
    s.setItem("bslc_user", user.userId);
    s.setItem("bslc_role", user.role);
  }
  function clearSession(){
    var s = store(); if(!s) return;
    ["bslc_token","bslc_auth","bslc_user","bslc_role"].forEach(function(k){ s.removeItem(k); });
  }

  /* api("GET", "/documents") -> Promise<{status, ok, data}>. body may be a
     plain object (sent as JSON) or a FormData (sent as multipart). */
  function api(method, path, body){
    var headers = {};
    var token = getToken();
    if(token) headers["Authorization"] = "Bearer " + token;
    var init = { method: method, headers: headers, credentials: "omit" };
    if(body instanceof (win.FormData || function(){})){ init.body = body; }
    else if(body !== undefined){ headers["Content-Type"] = "application/json"; init.body = JSON.stringify(body); }
    return win.fetch(apiBase() + path, init).then(function(res){
      if(res.status === 401) clearSession();
      var ct = res.headers.get("Content-Type") || "";
      var p = ct.indexOf("application/json") !== -1 ? res.json() : res.text();
      return p.then(function(data){ return { status: res.status, ok: res.ok, data: data }; });
    });
  }

  return {
    DEFAULT_TARGET: DEFAULT_TARGET,
    safeRedirect: safeRedirect,
    escapeHtml: escapeHtml,
    apiBase: apiBase,
    apiEnabled: apiEnabled,
    getToken: getToken,
    setSession: setSession,
    clearSession: clearSession,
    api: api
  };
});
