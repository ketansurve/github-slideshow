/* Site configuration.

   BSLC_API_BASE is the URL of the departmental API (bslc-website/server),
   e.g. "https://api.lawcommission.bihar.gov.in". Leave it empty to run the
   original front-end demo: the login page then accepts any credentials and
   the archive shows sample data — NOT SECURE, for demonstration only.

   A value set before this script runs (local test servers do this) is kept. */
window.BSLC_API_BASE = window.BSLC_API_BASE || "";
