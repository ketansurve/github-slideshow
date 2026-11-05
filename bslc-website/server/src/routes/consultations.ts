/* /consultations — Public Consultation.

   Who may submit a suggestion:
   - users on the consultation's participant allowlist, while it is open;
     their suggestions are published at once;
   - only if the consultation has allowPublic switched on (it is OFF by
     default): anyone else, signed in or not. Those suggestions are held as
     PENDING until an editor approves them, and are rate limited per address.

   Who may read suggestions:
   - visibility PARTICIPANTS: every participant sees all published ones;
   - visibility PRIVATE: each person sees only their own;
   - in both cases everyone sees their own (with its status and any reply),
     and ADMIN/EDITOR see everything, including e-mail addresses given by
     submitters without an account, which nobody else ever sees.

   ADMIN/EDITOR manage consultations and participants, moderate and reply,
   and can export all suggestions as CSV. Every action is audited. */
import { Router, type Request } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import type { Consultation, ConsultationComment, User } from "@prisma/client";
import { config } from "../config";
import { prisma } from "../prisma";
import { ah, HttpError } from "../http";
import { audit } from "../audit";
import { requireAuth, requireRole } from "../auth";
import { isManager } from "../policy";

export const consultationsRouter = Router();

const isoDateTime = z.string().datetime({ offset: true }).transform((s) => new Date(s));

const consultationSchema = z.object({
  title: z.string().trim().min(3).max(300),
  summary: z.string().trim().min(3).max(5000),
  opensAt: isoDateTime,
  closesAt: isoDateTime,
  status: z.enum(["DRAFT", "OPEN", "CLOSED"]).default("DRAFT"),
  visibility: z.enum(["PARTICIPANTS", "PRIVATE"]).default("PARTICIPANTS"),
  allowPublic: z.boolean().default(false),
  documentId: z.string().uuid().nullable().optional(),
}).strict();

const publicLimiter = rateLimit({
  windowMs: 60 * 60_000,
  limit: config.PUBLIC_SUBMIT_LIMIT,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many suggestions from this address. Please try again later." },
});

export const isOpen = (c: Consultation, now = new Date()) => c.status === "OPEN" && c.opensAt <= now && now < c.closesAt;

async function isParticipant(consultationId: string, userId?: string) {
  if (!userId) return false;
  return !!(await prisma.consultationParticipant.findUnique({
    where: { consultationId_userId: { consultationId, userId } },
  }));
}

function present(c: Consultation, participant: boolean) {
  const open = isOpen(c);
  return {
    id: c.id, title: c.title, summary: c.summary, status: c.status, documentId: c.documentId,
    opensAt: c.opensAt.toISOString(), closesAt: c.closesAt.toISOString(),
    visibility: c.visibility, allowPublic: c.allowPublic,
    isOpen: open, isParticipant: participant,
    canComment: participant && open,
    canSubmitPublic: !participant && c.allowPublic && open,
  };
}

type CommentRow = ConsultationComment & { user: Pick<User, "name" | "userId"> | null };

function presentComment(m: CommentRow, viewerId: string | undefined, manager: boolean) {
  const mine = !!viewerId && m.userId === viewerId;
  return {
    id: m.id,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
    author: m.user ? m.user.name : (m.publicName || "Member of the public"),
    status: m.status,
    mine,
    // The reply is private to the author and the Commission.
    ...(mine || manager ? { reply: m.reply, repliedAt: m.repliedAt ? m.repliedAt.toISOString() : null } : {}),
    ...(manager ? { authorId: m.user ? m.user.userId : null, publicEmail: m.publicEmail, viaAccount: !!m.userId } : {}),
  };
}

/* Consultations in DRAFT are visible to managers only. */
async function loadConsultation(req: Request) {
  const c = await prisma.consultation.findUnique({ where: { id: req.params.id } });
  if (!c || (c.status === "DRAFT" && !isManager(req.user))) throw new HttpError(404, "Not found");
  return c;
}

consultationsRouter.get("/", ah(async (req, res) => {
  const rows = await prisma.consultation.findMany({
    where: isManager(req.user) ? {} : { status: { in: ["OPEN", "CLOSED"] } },
    orderBy: { opensAt: "desc" },
    take: 200,
  });
  const mine = req.user
    ? new Set((await prisma.consultationParticipant.findMany({ where: { userId: req.user.id }, select: { consultationId: true } })).map((p) => p.consultationId))
    : new Set<string>();
  res.json(rows.map((c) => present(c, mine.has(c.id))));
}));

consultationsRouter.get("/:id", ah(async (req, res) => {
  const c = await loadConsultation(req);
  res.json(present(c, await isParticipant(c.id, req.user?.id)));
}));

consultationsRouter.get("/:id/comments", requireAuth, ah(async (req, res) => {
  const c = await loadConsultation(req);
  const me = req.user!;
  const manager = isManager(me);
  const participant = await isParticipant(c.id, me.id);
  if (!manager && !participant && !c.allowPublic) {
    throw new HttpError(403, "Only authorised participants can read the comments");
  }
  const where = manager
    ? { consultationId: c.id }
    : participant && c.visibility === "PARTICIPANTS"
      ? { consultationId: c.id, OR: [{ status: "PUBLISHED" as const }, { userId: me.id }] }
      : { consultationId: c.id, userId: me.id };
  const comments = await prisma.consultationComment.findMany({
    where,
    orderBy: { createdAt: "asc" },
    include: { user: { select: { name: true, userId: true } } },
  });
  res.json(comments.map((m) => presentComment(m, me.id, manager)));
}));

const anonSubmission = z.object({
  body: z.string().trim().min(2).max(5000),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  consent: z.literal(true, { errorMap: () => ({ message: "Please agree to the privacy notice" }) }),
}).strict();

consultationsRouter.post("/:id/comments", publicLimiterIfNeeded, ah(async (req, res) => {
  const c = await loadConsultation(req);
  const me = req.user;
  const participant = await isParticipant(c.id, me?.id);

  if (!participant && !c.allowPublic) {
    if (!me) throw new HttpError(401, "Sign-in required");
    throw new HttpError(403, "Only authorised participants can take part in this consultation");
  }
  if (!isOpen(c)) throw new HttpError(409, "This consultation is not open for comments");

  let data: { userId?: string; publicName?: string; publicEmail?: string; body: string; status: "PUBLISHED" | "PENDING" };
  if (me) {
    const { body } = z.object({ body: z.string().trim().min(2).max(5000) }).strict().parse(req.body);
    data = { userId: me.id, body, status: participant ? "PUBLISHED" : "PENDING" };
  } else {
    const b = anonSubmission.parse(req.body);
    data = { publicName: b.name, publicEmail: b.email.toLowerCase(), body: b.body, status: "PENDING" };
  }
  const m = await prisma.consultationComment.create({
    data: { consultationId: c.id, ...data },
    include: { user: { select: { name: true, userId: true } } },
  });
  await audit(req, "CONSULTATION_COMMENT", "Consultation", c.id, {
    commentId: m.id, length: m.body.length, status: m.status, viaAccount: !!me,
  });
  res.status(201).json(presentComment(m, me?.id, false));
}));

/* Rate-limit only submissions that are not from a signed-in participant. */
function publicLimiterIfNeeded(req: Request, res: import("express").Response, next: import("express").NextFunction) {
  isParticipant(req.params.id, req.user?.id).then((p) => (p ? next() : publicLimiter(req, res, next))).catch(next);
}

/* ---------------- management (ADMIN / EDITOR) ---------------- */

consultationsRouter.post("/", requireRole("ADMIN", "EDITOR"), ah(async (req, res) => {
  const body = consultationSchema.parse(req.body);
  if (body.closesAt <= body.opensAt) throw new HttpError(400, "closesAt must be after opensAt");
  const c = await prisma.consultation.create({ data: { ...body, createdById: req.user!.id } });
  await audit(req, "CONSULTATION_CREATE", "Consultation", c.id, {
    title: c.title, status: c.status, visibility: c.visibility, allowPublic: c.allowPublic,
  });
  res.status(201).json(present(c, false));
}));

consultationsRouter.patch("/:id", requireRole("ADMIN", "EDITOR"), ah(async (req, res) => {
  const body = consultationSchema.partial().parse(req.body);
  const before = await prisma.consultation.findUnique({ where: { id: req.params.id } });
  if (!before) throw new HttpError(404, "Not found");
  const opensAt = body.opensAt ?? before.opensAt;
  const closesAt = body.closesAt ?? before.closesAt;
  if (closesAt <= opensAt) throw new HttpError(400, "closesAt must be after opensAt");
  const c = await prisma.consultation.update({ where: { id: before.id }, data: body });
  await audit(req, "CONSULTATION_UPDATE", "Consultation", c.id, {
    changes: body, before: { status: before.status, visibility: before.visibility, allowPublic: before.allowPublic },
  });
  res.json(present(c, false));
}));

/* Moderate (publish / reject) and/or reply to one suggestion. */
consultationsRouter.patch("/:id/comments/:commentId", requireRole("ADMIN", "EDITOR"), ah(async (req, res) => {
  const body = z.object({
    status: z.enum(["PUBLISHED", "REJECTED"]).optional(),
    reply: z.string().trim().min(2).max(5000).nullable().optional(),
  }).strict().refine((b) => b.status !== undefined || b.reply !== undefined, "Give status and/or reply").parse(req.body);
  const before = await prisma.consultationComment.findFirst({ where: { id: req.params.commentId, consultationId: req.params.id } });
  if (!before) throw new HttpError(404, "Not found");
  const m = await prisma.consultationComment.update({
    where: { id: before.id },
    data: {
      ...(body.status ? { status: body.status, moderatedById: req.user!.id } : {}),
      ...(body.reply !== undefined ? { reply: body.reply, repliedAt: body.reply ? new Date() : null, repliedById: body.reply ? req.user!.id : null } : {}),
    },
    include: { user: { select: { name: true, userId: true } } },
  });
  if (body.status) {
    await audit(req, "CONSULTATION_COMMENT_MODERATE", "Consultation", req.params.id, { commentId: m.id, from: before.status, to: m.status });
  }
  if (body.reply !== undefined) {
    await audit(req, "CONSULTATION_COMMENT_REPLY", "Consultation", req.params.id, { commentId: m.id, length: body.reply ? body.reply.length : 0 });
  }
  res.json(presentComment(m, req.user!.id, true));
}));

/* CSV export of every suggestion, for the Commission's records and report.
   Cells that a spreadsheet would treat as a formula are prefixed with an
   apostrophe (CSV/formula injection). A UTF-8 BOM keeps Hindi readable in Excel. */
function csvCell(v: unknown) {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

consultationsRouter.get("/:id/export.csv", requireRole("ADMIN", "EDITOR"), ah(async (req, res) => {
  const c = await prisma.consultation.findUnique({ where: { id: req.params.id } });
  if (!c) throw new HttpError(404, "Not found");
  const rows = await prisma.consultationComment.findMany({
    where: { consultationId: c.id },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { name: true, userId: true } } },
  });
  const head = ["Received (UTC)", "Status", "Author", "Sign-in ID", "E-mail (no account)", "Suggestion", "Reply", "Replied (UTC)"];
  const lines = [head, ...rows.map((m) => [
    m.createdAt.toISOString(), m.status, m.user ? m.user.name : m.publicName, m.user ? m.user.userId : "",
    m.publicEmail || "", m.body, m.reply || "", m.repliedAt ? m.repliedAt.toISOString() : "",
  ])].map((r) => r.map(csvCell).join(","));
  await audit(req, "CONSULTATION_EXPORT", "Consultation", c.id, { rows: rows.length });
  const safeTitle = c.title.replace(/[^A-Za-z0-9 _-]+/g, "").trim().slice(0, 60).replace(/\s+/g, "-") || "consultation";
  res.set({
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="suggestions-${safeTitle}.csv"`,
  });
  res.send("﻿" + lines.join("\r\n") + "\r\n");
}));

consultationsRouter.get("/:id/participants", requireRole("ADMIN", "EDITOR"), ah(async (req, res) => {
  const rows = await prisma.consultationParticipant.findMany({
    where: { consultationId: req.params.id },
    include: { user: { select: { id: true, userId: true, name: true, role: true } } },
  });
  res.json(rows.map((r) => r.user));
}));

consultationsRouter.post("/:id/participants", requireRole("ADMIN", "EDITOR"), ah(async (req, res) => {
  const body = z.object({ userId: z.string().uuid() }).parse(req.body);
  const c = await prisma.consultation.findUnique({ where: { id: req.params.id } });
  if (!c) throw new HttpError(404, "Not found");
  const u = await prisma.user.findUnique({ where: { id: body.userId } });
  if (!u || u.status !== "ACTIVE") throw new HttpError(400, "Participants must be active users");
  await prisma.consultationParticipant.upsert({
    where: { consultationId_userId: { consultationId: c.id, userId: u.id } },
    create: { consultationId: c.id, userId: u.id, addedBy: req.user!.id },
    update: {},
  });
  await audit(req, "CONSULTATION_PARTICIPANT_ADD", "Consultation", c.id, { userId: u.userId });
  res.status(201).json({ id: u.id, userId: u.userId, name: u.name, role: u.role });
}));

consultationsRouter.delete("/:id/participants/:userId", requireRole("ADMIN", "EDITOR"), ah(async (req, res) => {
  await prisma.consultationParticipant.deleteMany({ where: { consultationId: req.params.id, userId: req.params.userId } });
  await audit(req, "CONSULTATION_PARTICIPANT_REMOVE", "Consultation", req.params.id, { userId: req.params.userId });
  res.status(204).end();
}));
