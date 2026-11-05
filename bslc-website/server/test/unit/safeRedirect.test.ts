/* Unit tests for the login page's redirect validation (assets/js/api.js). */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const BSLC = require("../../../assets/js/api.js");

describe("safeRedirect", () => {
  const ok = [
    "document-archive.html",
    "reports.html",
    "admin.html",
    "public-consultation.html?paper=12",
    "notification-circular.html#latest",
    "document-archive.html?year=2026&type=Report#top",
    "sub/page.html",
  ];
  test.each(ok)("allows site page %s", (v) => {
    expect(BSLC.safeRedirect(v)).toBe(v);
  });

  const bad = [
    "javascript:alert(1)",
    "JavaScript:alert(document.cookie)",
    " javascript:alert(1)",
    "java\tscript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "https://evil.example/document-archive.html",
    "http://evil.example",
    "//evil.example/document-archive.html",
    "/\\evil.example",
    "\\\\evil.example\\x.html",
    "/github-slideshow/bslc-website/document-archive.html",
    "../document-archive.html",
    "./document-archive.html",
    "a/../../x.html",
    "%2F%2Fevil.example/x.html",
    "javascript%3Aalert(1).html",
    "document-archive.htm",
    "document-archive",
    "",
    "   ",
    "x".repeat(600) + ".html",
  ];
  test.each(bad)("rejects %p and falls back to document-archive.html", (v) => {
    expect(BSLC.safeRedirect(v)).toBe("document-archive.html");
  });

  test("null / missing parameter falls back to the archive", () => {
    expect(BSLC.safeRedirect(null)).toBe("document-archive.html");
    expect(BSLC.safeRedirect(undefined)).toBe("document-archive.html");
  });

  test("custom fallback is used when given", () => {
    expect(BSLC.safeRedirect("javascript:x", "index.html")).toBe("index.html");
  });
});

describe("escapeHtml", () => {
  test("escapes markup characters", () => {
    expect(BSLC.escapeHtml(`<img src=x onerror="a('b')">&`)).toBe(
      "&lt;img src=x onerror=&quot;a(&#39;b&#39;)&quot;&gt;&amp;"
    );
  });
});
