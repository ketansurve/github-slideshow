/* Simulated SMS for local review (OTP_DELIVERY=mock-sms).

   Messages are kept in memory only (latest 50, lost on restart) and shown on
   the API's /dev/sms page, which behaves like the recipient's phone inbox.
   This route exists only when OTP_DELIVERY=mock-sms, and the server refuses
   that setting in production (see config.ts), so a live deployment can
   never expose OTPs this way. The text follows the usual DLT-registered OTP
   template so reviewers see what the real SMS would say. */
import type { Express, Request, Response } from "express";

export type SmsMessage = { to: string; text: string; at: Date };

const outbox: SmsMessage[] = [];
const MAX = 50;

export function otpSmsText(code: string, minutes: number) {
  return `${code} is your OTP to sign in to the Bihar State Law Commission website. ` +
    `It is valid for ${minutes} minutes. Do not share it with anyone. -BSLC`;
}

export function sendMockSms(to: string, text: string) {
  outbox.unshift({ to, text, at: new Date() });
  if (outbox.length > MAX) outbox.length = MAX;
}

export function mockOutbox(): readonly SmsMessage[] {
  return outbox;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

function page(_req: Request, res: Response) {
  const rows = outbox.map((m) => `
    <div class="sms">
      <div class="meta"><b>To ${esc(m.to)}</b><span>${esc(m.at.toLocaleString("en-IN"))}</span></div>
      <div class="from">BSLC (VM-BSLCGV)</div>
      <p>${esc(m.text)}</p>
    </div>`).join("") || `<p class="empty">No messages yet. Request an OTP on the login page; it will appear here within a few seconds.</p>`;
  res.set({
    "Content-Type": "text/html; charset=utf-8",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
    "Cache-Control": "no-store",
  });
  res.send(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="3">
<title>SMS inbox (local review)</title>
<style>
  body{margin:0;font-family:system-ui,Arial,sans-serif;background:#DDE5EC;color:#22262B}
  .phone{max-width:420px;margin:16px auto;background:#fff;border-radius:18px;box-shadow:0 4px 24px rgba(0,0,0,.18);overflow:hidden}
  header{background:#123A67;color:#fff;padding:12px 16px}
  header h1{font-size:1rem;margin:0}
  header p{font-size:.78rem;margin:4px 0 0;color:#CBDDF0}
  .warn{background:#FFF7E6;border-bottom:1px solid #E8CE94;font-size:.8rem;padding:8px 16px}
  .list{padding:10px 12px}
  .sms{background:#E8F0F8;border-radius:12px;padding:10px 12px;margin:0 0 10px}
  .meta{display:flex;justify-content:space-between;gap:8px;font-size:.78rem;color:#5C6672}
  .from{font-size:.78rem;color:#1B4F8A;font-weight:700;margin-top:2px}
  .sms p{margin:6px 0 0;font-size:.95rem;line-height:1.4}
  .empty{color:#5C6672;font-size:.9rem;padding:8px 4px}
</style></head><body>
<div class="phone">
  <header><h1>SMS inbox (simulated)</h1><p>Refreshes every 3 seconds &middot; latest first</p></header>
  <div class="warn">Local review only. A real deployment sends this text through the state SMS gateway; this page does not exist there.</div>
  <div class="list">${rows}</div>
</div></body></html>`);
}

export function mountMockSms(app: Express) {
  app.get("/dev/sms", page);
}
