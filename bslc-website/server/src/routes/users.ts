/* /users — account management, ADMIN only. Accounts are never deleted
   (records must remain attributable in the audit log); they are DISABLED. */
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { ah, HttpError } from "../http";
import { audit } from "../audit";
import { PASSWORD_RULE, hashPassword, requireRole } from "../auth";

export const usersRouter = Router();

/* Exact-match lookup by sign-in ID, so an EDITOR can name a user as a
   consultation participant or a confidential-document reader without
   being able to list or browse accounts. Active accounts only. */
usersRouter.get("/lookup", requireRole("ADMIN", "EDITOR"), ah(async (req, res) => {
  const { userId } = z.object({ userId: z.string().trim().min(3).max(120) }).parse(req.query);
  const u = await prisma.user.findFirst({
    where: { userId, status: "ACTIVE" },
    select: { id: true, userId: true, name: true, role: true },
  });
  if (!u) throw new HttpError(404, "No active user with that ID");
  res.json(u);
}));

usersRouter.use(requireRole("ADMIN"));

const ROLES = ["ADMIN", "EDITOR", "OFFICIAL", "PUBLIC"] as const;
const STATUSES = ["PENDING", "ACTIVE", "LOCKED", "DISABLED"] as const;

const publicFields = {
  id: true, userId: true, name: true, email: true, mobile: true, role: true, status: true,
  failedAttempts: true, lockedUntil: true, createdAt: true, updatedAt: true,
} as const;

usersRouter.get("/", ah(async (req, res) => {
  const q = z.object({
    status: z.enum(STATUSES).optional(),
    role: z.enum(ROLES).optional(),
    q: z.string().max(100).optional(),
  }).parse(req.query);
  const users = await prisma.user.findMany({
    where: {
      status: q.status, role: q.role,
      ...(q.q ? { OR: [{ userId: { contains: q.q, mode: "insensitive" } }, { name: { contains: q.q, mode: "insensitive" } }] } : {}),
    },
    select: publicFields,
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  res.json(users);
}));

usersRouter.post("/", ah(async (req, res) => {
  const body = z.object({
    userId: z.string().trim().min(3).max(120),
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(200).optional(),
    mobile: z.string().trim().regex(/^\+?\d{10,13}$/).optional(),
    role: z.enum(ROLES),
    password: z.string().regex(PASSWORD_RULE, "Password must be 10+ characters with a letter and a digit"),
  }).parse(req.body);
  const { password, ...fields } = body;
  const user = await prisma.user.create({
    data: { ...fields, passwordHash: await hashPassword(password), status: "ACTIVE" },
    select: publicFields,
  });
  await audit(req, "USER_CREATE", "User", user.id, { userId: user.userId, role: user.role });
  res.status(201).json(user);
}));

usersRouter.patch("/:id", ah(async (req, res) => {
  const body = z.object({
    name: z.string().trim().min(2).max(120).optional(),
    email: z.string().trim().email().max(200).nullable().optional(),
    mobile: z.string().trim().regex(/^\+?\d{10,13}$/).nullable().optional(),
    role: z.enum(ROLES).optional(),
    status: z.enum(STATUSES).optional(),
  }).strict().parse(req.body);
  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) throw new HttpError(404, "Not found");
  if (target.id === req.user!.id && ((body.role && body.role !== "ADMIN") || (body.status && body.status !== "ACTIVE"))) {
    throw new HttpError(409, "You cannot remove your own admin access");
  }
  const data: Record<string, unknown> = { ...body };
  if (body.status === "ACTIVE") { data.failedAttempts = 0; data.lockedUntil = null; }
  const user = await prisma.user.update({ where: { id: target.id }, data, select: publicFields });
  if (body.status && body.status !== "ACTIVE") {
    // Disabling / locking ends every open session immediately.
    await prisma.session.updateMany({ where: { userId: target.id, revokedAt: null }, data: { revokedAt: new Date() } });
  }
  await audit(req, "USER_UPDATE", "User", user.id, {
    changes: body, before: { role: target.role, status: target.status },
  });
  res.json(user);
}));

usersRouter.post("/:id/password", ah(async (req, res) => {
  const body = z.object({
    password: z.string().regex(PASSWORD_RULE, "Password must be 10+ characters with a letter and a digit"),
  }).parse(req.body);
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { passwordHash: await hashPassword(body.password), failedAttempts: 0 },
    select: publicFields,
  });
  await prisma.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
  await audit(req, "USER_PASSWORD_RESET", "User", user.id);
  res.json(user);
}));
