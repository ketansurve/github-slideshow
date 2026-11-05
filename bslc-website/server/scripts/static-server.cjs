/* Minimal static file server for local testing of the bslc-website folder.
   It serves the site from a sub-path (/github-slideshow/bslc-website/) so
   relative links are exercised the same way they are on GitHub Pages.
   Usage: node scripts/static-server.cjs [port]   (default 4173) */
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");          // bslc-website/
const PREFIX = "/github-slideshow/bslc-website/";
const PORT = Number(process.argv[2] || process.env.STATIC_PORT || 4173);
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon" };

http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/" || url.pathname === "/github-slideshow/bslc-website") {
    res.writeHead(302, { Location: PREFIX }); return res.end();
  }
  if (!url.pathname.startsWith(PREFIX)) { res.writeHead(404); return res.end("Not found"); }
  let rel = decodeURIComponent(url.pathname.slice(PREFIX.length)) || "index.html";
  if (rel.endsWith("/")) rel += "index.html";
  const file = path.resolve(ROOT, rel);
  // Never serve the backend source tree or anything outside the site folder.
  if (!file.startsWith(ROOT + path.sep) || file.startsWith(path.join(ROOT, "server") + path.sep)) {
    res.writeHead(404); return res.end("Not found");
  }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end("Not found"); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream" });
    res.end(buf);
  });
}).listen(PORT, () => console.log(`bslc-website on http://localhost:${PORT}${PREFIX}`));
