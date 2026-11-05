/* Malware scanning through a ClamAV daemon (clamd) using the INSTREAM
   command. Enabled when CLAMAV_HOST is set. If clamd is configured but
   unreachable the upload is refused (fail closed). */
import fs from "fs";
import net from "net";
import { config } from "./config";

export type ScanResult = { status: "CLEAN" } | { status: "INFECTED"; signature: string } | { status: "NOT_CONFIGURED" };

export function scanFile(filePath: string, host = config.CLAMAV_HOST, port = config.CLAMAV_PORT): Promise<ScanResult> {
  if (!host) return Promise.resolve({ status: "NOT_CONFIGURED" });
  return new Promise((resolve, reject) => {
    const sock = net.createConnection({ host, port });
    let reply = "";
    let settled = false;
    const fail = (e: Error) => { if (!settled) { settled = true; sock.destroy(); reject(e); } };
    sock.setTimeout(60_000, () => fail(new Error("ClamAV scan timed out")));
    sock.on("error", fail);
    sock.on("data", (d) => { reply += d.toString("utf8"); });
    sock.on("end", () => {
      if (settled) return;
      settled = true;
      const text = reply.replace(/\0/g, "").trim();             // e.g. "stream: OK"
      if (/:\s*OK$/.test(text)) return resolve({ status: "CLEAN" });
      const m = /:\s*(.+)\s+FOUND$/.exec(text);
      if (m) return resolve({ status: "INFECTED", signature: m[1] });
      reject(new Error("Unexpected ClamAV reply: " + text));
    });
    sock.on("connect", () => {
      sock.write("zINSTREAM\0");
      const rs = fs.createReadStream(filePath, { highWaterMark: 64 * 1024 });
      rs.on("data", (chunk) => {
        const buf = chunk as Buffer;
        const len = Buffer.alloc(4);
        len.writeUInt32BE(buf.length, 0);
        sock.write(len);
        sock.write(buf);
      });
      rs.on("end", () => sock.write(Buffer.alloc(4)));       // zero-length chunk ends the stream
      rs.on("error", fail);
    });
  });
}
