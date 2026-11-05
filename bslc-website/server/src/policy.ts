/* Access policy — the single place that decides who may see what.

   Documents (matches the Access Legend on document-archive.html):
     PUB  — anyone, including anonymous visitors
     RES  — "approved logged-in users": any ACTIVE signed-in account
     CONF — "named users, view only, no download": ADMIN, the uploader, or a
            user named in DocumentGrant. Never downloadable as an attachment.
   In addition, a file that has not passed malware scanning (scanStatus
   PENDING) can be opened by ADMIN only, and withdrawn documents by
   ADMIN/EDITOR only. */
import type { AccessLevel, Document, Role } from "@prisma/client";

export type Viewer = { id: string; role: Role } | null | undefined;

export const MANAGERS: Role[] = ["ADMIN", "EDITOR"];
export const isManager = (v: Viewer) => !!v && MANAGERS.includes(v.role);

/* Access levels whose metadata a viewer may list (CONF is filtered per row). */
export function listableLevels(v: Viewer): AccessLevel[] {
  if (!v) return ["PUB"];
  return ["PUB", "RES", "CONF"];
}

export function canSeeDocument(v: Viewer, doc: Pick<Document, "accessLevel" | "uploadedById" | "withdrawn">, granted: boolean) {
  if (doc.withdrawn && !isManager(v)) return false;
  switch (doc.accessLevel) {
    case "PUB": return true;
    case "RES": return !!v;
    case "CONF": return !!v && (v.role === "ADMIN" || v.id === doc.uploadedById || granted);
    default: return false;
  }
}

export function canOpenFile(
  v: Viewer,
  doc: Pick<Document, "accessLevel" | "uploadedById" | "withdrawn" | "scanStatus">,
  granted: boolean,
) {
  if (!canSeeDocument(v, doc, granted)) return false;
  if (doc.scanStatus === "INFECTED") return false;
  if (doc.scanStatus === "PENDING") return !!v && v.role === "ADMIN";
  return true;
}

export const canDownload = (doc: Pick<Document, "accessLevel">) => doc.accessLevel !== "CONF";

/* Content items: published PUB items are public; published RES items need
   a signed-in user; drafts/archived only for managers. */
export function contentVisibleLevels(v: Viewer): AccessLevel[] {
  return v ? ["PUB", "RES"] : ["PUB"];
}
