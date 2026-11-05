/* Upload validation. A file is accepted only when its extension, the MIME
   type the browser declared and the file's actual content (magic bytes)
   all agree on an allowed type. Executables, macro-enabled Office files,
   and PDFs carrying JavaScript/launch actions/embedded files are refused. */
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import multer from "multer";
import { fromFile } from "file-type";
import { config } from "./config";
import { HttpError } from "./http";

type Rule = { mimes: string[]; detected: string | null; canonicalMime: string };

/* detected = the extension file-type reports for this content (null = no
   binary signature, e.g. plain text). */
export const ALLOWED: Record<string, Rule> = {
  pdf:  { mimes: ["application/pdf"], detected: "pdf", canonicalMime: "application/pdf" },
  docx: { mimes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"], detected: "docx",
          canonicalMime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  xlsx: { mimes: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"], detected: "xlsx",
          canonicalMime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  odt:  { mimes: ["application/vnd.oasis.opendocument.text"], detected: "odt", canonicalMime: "application/vnd.oasis.opendocument.text" },
  ods:  { mimes: ["application/vnd.oasis.opendocument.spreadsheet"], detected: "ods", canonicalMime: "application/vnd.oasis.opendocument.spreadsheet" },
  png:  { mimes: ["image/png"], detected: "png", canonicalMime: "image/png" },
  jpg:  { mimes: ["image/jpeg"], detected: "jpg", canonicalMime: "image/jpeg" },
  jpeg: { mimes: ["image/jpeg"], detected: "jpg", canonicalMime: "image/jpeg" },
  txt:  { mimes: ["text/plain"], detected: null, canonicalMime: "text/plain; charset=utf-8" },
  csv:  { mimes: ["text/csv", "application/vnd.ms-excel"], detected: null, canonicalMime: "text/csv; charset=utf-8" },
};

export const ALLOWED_EXTENSIONS = Object.keys(ALLOWED);

export const uploadMiddleware = multer({
  dest: path.join(os.tmpdir(), "bslc-uploads"),
  limits: { fileSize: Math.floor(config.MAX_UPLOAD_MB * 1024 * 1024), files: 1, fields: 20, fieldSize: 10_000 },
}).single("file");

/* Wraps multer so its errors become proper HTTP statuses. */
export function receiveUpload(req: import("express").Request, res: import("express").Response): Promise<void> {
  return new Promise((resolve, reject) => {
    uploadMiddleware(req, res, (err: unknown) => {
      if (!err) return resolve();
      const e = err as { code?: string };
      if (e.code === "LIMIT_FILE_SIZE") return reject(new HttpError(413, `File is larger than ${config.MAX_UPLOAD_MB} MB`));
      if (e.code && e.code.startsWith("LIMIT_")) return reject(new HttpError(400, "Upload limits exceeded"));
      reject(new HttpError(400, "Malformed upload"));
    });
  });
}

export function safeOriginalName(name: string) {
  const base = path.basename(name.replace(/\\/g, "/"));
  const cleaned = base.replace(/[\u0000-\u001f\u007f"<>:|?*/]+/g, "_").replace(/^\.+/, "").trim();
  return (cleaned || "file").slice(0, 200);
}

const PDF_ACTIVE = [/\/JavaScript\b/, /\/JS\b/, /\/Launch\b/, /\/EmbeddedFiles?\b/, /\/RichMedia\b/];

/* PDF name objects may hide characters as #xx escapes (/J#61vaScript). */
function normalisePdfNames(s: string) {
  return s.replace(/\/[^\s/<>[\]()]+/g, (n) => n.replace(/#([0-9a-fA-F]{2})/g, (_m, h) => String.fromCharCode(parseInt(h, 16))));
}

export type Validated = { ext: string; mime: string; sha256: string; sizeBytes: number; originalName: string };

export async function validateUpload(file: Express.Multer.File): Promise<Validated> {
  const originalName = safeOriginalName(file.originalname || "");
  const ext = path.extname(originalName).slice(1).toLowerCase();
  const rule = ALLOWED[ext];
  if (!rule) throw new HttpError(415, `File type .${ext || "?"} is not allowed. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`);
  if (!rule.mimes.includes((file.mimetype || "").toLowerCase())) {
    throw new HttpError(415, "The file's declared type does not match its extension");
  }
  if (file.size === 0) throw new HttpError(400, "The file is empty");

  const detected = await fromFile(file.path);
  if ((detected?.ext ?? null) !== rule.detected) {
    throw new HttpError(415, "The file's content does not match its extension");
  }

  const buf = await fs.promises.readFile(file.path);
  if (rule.detected === null) {
    if (buf.includes(0)) throw new HttpError(415, "Text files must not contain binary data");
    try { new TextDecoder("utf-8", { fatal: true }).decode(buf); }
    catch { throw new HttpError(415, "Text files must be UTF-8 encoded"); }
  }
  if (ext === "pdf") {
    const text = normalisePdfNames(buf.toString("latin1"));
    if (PDF_ACTIVE.some((re) => re.test(text))) {
      throw new HttpError(415, "PDFs with scripts, launch actions or embedded files are not accepted");
    }
  }
  if (["docx", "xlsx"].includes(ext) && buf.includes(Buffer.from("vbaProject.bin"))) {
    throw new HttpError(415, "Macro-enabled Office files are not accepted");
  }

  return {
    ext: ext === "jpeg" ? "jpg" : ext,
    mime: rule.canonicalMime,
    sha256: crypto.createHash("sha256").update(buf).digest("hex"),
    sizeBytes: buf.length,
    originalName,
  };
}
