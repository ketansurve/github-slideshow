/* /auth — sign-in (password → OTP → token), sign-out, self-registration. */
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { config } from "../config";
import { prisma } from "../prisma";
import { ah, HttpError } from "../http";
import { audit } from "../audit";
import {
  PASSWORD_RULE, burnPasswordCheck, deliverOtp, hashOtp, hashPassword, issueToken, maskMobile,
  newOtp, otpMatches, registerFailure, releaseExpiredLock, requireAuth, verifyPassword,
} from "../auth";

export const authRouter = Router();

const limiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: config.AUTH_RATE_LIMIT,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many attempts from this address. Try again later." },
});

const userIdSchema = z.string().trim().min(3).max(120);

authRouter.post("/login", limiter, ah(async (req, res) => {
  const body = z.object({ userId: userIdSchema, password: z.string().min(1).max(200) }).parse(req.body);
  let user = await prisma.user.findUnique({ where: { userId: body.userId } });
  if (!user) {
    await burnPasswordCheck(body.password);
    await audit(req, "LOGIN_FAILED", "User", null, { userId: body.userId, reason: "unknown user" }, null);
    throw new HttpError(401, "Invalid user ID or password");
  }
  user = await releaseExpiredLock(user);
  const actor = { id: user.id, userId: user.userId };
  if (user.status === "LOCKED") {
    await audit(req, "LOGIN_BLOCKED", "User", user.id, { reason: "locked" }, actor);
    throw new HttpError(423, "This account is locked after repeated failed attempts. Contact the Records Officer.", "LOCKED");
  }
  if (!(await verifyPassword(user.passwordHash, body.password))) {
    const r = await registerFailure(user);
    await audit(req, "LOGIN_FAILED", "User", user.id, { reason: "bad password", failed: r.failed, locked: r.locked }, actor);
    if (r.locked) throw new HttpError(423, "This account is now locked after repeated failed attempts.", "LOCKED");
    throw new HttpError(401, "Invalid user ID or password");
  }
  if (user.status === "PENDING") {
    await audit(req, "LOGIN_BLOCKED", "User", user.id, { reason: "pending approval" }, actor);
    throw new HttpError(403, "Your registration is awaiting approval by the Commission.", "PENDING");
  }
  if (user.status !== "ACTIVE") {
    await audit(req, "LOGIN_BLOCKED", "User", user.id, { reason: user.status }, actor);
    throw new HttpError(403, "This account is not active.", "DISABLED");
  }

  const code = newOtp();
  const challenge = await prisma.otpChallenge.create({
    data: { userId: user.id, codeHash: "pending", expiresAt: new Date(Date.now() + config.OTP_TTL_SECONDS * 1000) },
  });
  await prisma.otpChallenge.update({ where: { id: challenge.id }, data: { codeHash: hashOtp(challenge.id, code) } });
  await deliverOtp(user, code);
  await audit(req, "OTP_SENT", "User", user.id, { challengeId: challenge.id }, actor);
  res.json({
    challengeId: challenge.id,
    sentTo: maskMobile(user.mobile),
    expiresInSeconds: config.OTP_TTL_SECONDS,
    ...(config.OTP_DELIVERY === "response" ? { testOtp: code } : {}),
  });
}));

authRouter.post("/otp/verify", limiter, ah(async (req, res) => {
  const body = z.object({ challengeId: z.string().uuid(), otp: z.string().regex(/^\d{6}$/) }).parse(req.body);
  const ch = await prisma.otpChallenge.findUnique({ where: { id: body.challengeId }, include: { user: true } });
  if (!ch || ch.consumedAt || ch.expiresAt < new Date() || ch.attempts >= config.MAX_FAILED_ATTEMPTS) {
    throw new HttpError(401, "This OTP has expired. Sign in again to get a new one.", "OTP_EXPIRED");
  }
  const user = ch.user;
  const actor = { id: user.id, userId: user.userId };
  if (user.status !== "ACTIVE") throw new HttpError(423, "This account is locked or not active.", "LOCKED");
  if (!otpMatches(ch.id, body.otp, ch.codeHash)) {
    await prisma.otpChallenge.update({ where: { id: ch.id }, data: { attempts: { increment: 1 } } });
    const r = await registerFailure(user);
    await audit(req, "OTP_FAILED", "User", user.id, { failed: r.failed, locked: r.locked }, actor);
    if (r.locked) throw new HttpError(423, "This account is now locked after repeated failed attempts.", "LOCKED");
    throw new HttpError(401, "Incorrect OTP.");
  }
  await prisma.otpChallenge.update({ where: { id: ch.id }, data: { consumedAt: new Date() } });
  await prisma.user.update({ where: { id: user.id }, data: { failedAttempts: 0, lockedUntil: null } });
  const { token, expiresAt } = await issueToken(user, req);
  await audit(req, "LOGIN_SUCCESS", "User", user.id, null, actor);
  res.json({
    token,
    expiresAt: expiresAt.toISOString(),
    user: { userId: user.userId, name: user.name, role: user.role },
  });
}));

authRouter.post("/logout", requireAuth, ah(async (req, res) => {
  await prisma.session.update({ where: { jti: req.user!.jti }, data: { revokedAt: new Date() } });
  await audit(req, "LOGOUT", "User", req.user!.id);
  res.status(204).end();
}));

authRouter.get("/me", requireAuth, (req, res) => {
  const u = req.user!;
  res.json({ id: u.id, userId: u.userId, name: u.name, role: u.role });
});

/* Self-registration for advocates / researchers / citizens. Creates a
   PUBLIC account in PENDING state; an ADMIN must approve it before the
   first sign-in (as stated on login.html). */
authRouter.post("/register", limiter, ah(async (req, res) => {
  const body = z.object({
    userId: userIdSchema,
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(200),
    mobile: z.string().trim().regex(/^\+?\d{10,13}$/, "Enter a 10–13 digit mobile number"),
    password: z.string().regex(PASSWORD_RULE, "Password must be 10+ characters with a letter and a digit"),
  }).parse(req.body);
  const exists = await prisma.user.findUnique({ where: { userId: body.userId } });
  if (exists) throw new HttpError(409, "That user ID is already registered");
  const user = await prisma.user.create({
    data: {
      userId: body.userId, name: body.name, email: body.email, mobile: body.mobile,
      passwordHash: await hashPassword(body.password), role: "PUBLIC", status: "PENDING",
    },
  });
  await audit(req, "USER_REGISTER", "User", user.id, null, { id: user.id, userId: user.userId });
  res.status(201).json({ userId: user.userId, status: user.status });
}));
