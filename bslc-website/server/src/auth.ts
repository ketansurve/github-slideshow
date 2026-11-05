/* Authentication: password (argon2id) + one-time password, short-lived
   signed tokens backed by a revocable Session row, server-side lockout. */
import crypto from "crypto";
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import type { Role, User } from "@prisma/client";
import { config } from "./config";
import { prisma } from "./prisma";
import { HttpError } from "./http";
import { otpSmsText, sendMockSms } from "./sms";

/* ---------------- passwords ---------------- */
export const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{10,128}$/;

export function hashPassword(pw: string) {
  return argon2.hash(pw, { type: argon2.argon2id });
}
export async function verifyPassword(hash: string, pw: string) {
  try { return await argon2.verify(hash, pw); } catch { return false; }
}
/* Used when the user does not exist, so response timing does not reveal
   which user IDs are registered. */
let dummyHash: Promise<string> | null = null;
export async function burnPasswordCheck(pw: string) {
  dummyHash = dummyHash || hashPassword("not-a-real-password-0");
  await verifyPassword(await dummyHash, pw);
}

/* ---------------- OTP ---------------- */
export function newOtp(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}
export function hashOtp(challengeId: string, code: string) {
  return crypto.createHmac("sha256", config.JWT_SECRET).update(challengeId + ":" + code).digest("hex");
}
export function otpMatches(challengeId: string, code: string, storedHash: string) {
  const a = Buffer.from(hashOtp(challengeId, code), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/* Delivery. "sms" needs the state SMS gateway (DLT-registered template);
   until that is provided the server refuses to send. */
export async function deliverOtp(user: User, code: string): Promise<void> {
  if (config.OTP_DELIVERY === "console") {
    console.log(`[DEV ONLY] OTP for ${user.userId}: ${code}`);
    return;
  }
  if (config.OTP_DELIVERY === "mock-sms") {
    if (!user.mobile) throw new HttpError(400, "No mobile number is registered for this account", "NO_MOBILE");
    sendMockSms(user.mobile, otpSmsText(code, Math.round(config.OTP_TTL_SECONDS / 60)));
    return;
  }
  if (config.OTP_DELIVERY === "sms") {
    throw new HttpError(503, "SMS gateway is not configured on this server", "SMS_NOT_CONFIGURED");
  }
  // "response": returned to the caller by the route (tests only).
}

export function maskMobile(m?: string | null) {
  if (!m) return "your registered mobile number";
  const d = m.replace(/\D/g, "");
  return d.length >= 4 ? "XXXXXX" + d.slice(-4) : "your registered mobile number";
}

/* ---------------- lockout ---------------- */
export async function registerFailure(user: User) {
  const failed = user.failedAttempts + 1;
  const lock = failed >= config.MAX_FAILED_ATTEMPTS;
  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedAttempts: failed,
      ...(lock ? { status: "LOCKED", lockedUntil: new Date(Date.now() + config.LOCKOUT_MINUTES * 60_000) } : {}),
    },
  });
  return { failed, locked: lock };
}

/* A LOCKED account whose lock period has passed becomes ACTIVE again. */
export async function releaseExpiredLock(user: User): Promise<User> {
  if (user.status === "LOCKED" && user.lockedUntil && user.lockedUntil < new Date()) {
    return prisma.user.update({
      where: { id: user.id },
      data: { status: "ACTIVE", failedAttempts: 0, lockedUntil: null },
    });
  }
  return user;
}

/* ---------------- sessions / tokens ---------------- */
export async function issueToken(user: User, req: Request) {
  const jti = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + config.JWT_TTL_SECONDS * 1000);
  await prisma.session.create({
    data: { jti, userId: user.id, expiresAt, ip: req.ip, userAgent: (req.get("user-agent") || "").slice(0, 300) },
  });
  const token = jwt.sign({ sub: user.id, jti }, config.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: config.JWT_TTL_SECONDS,
    issuer: "bslc-api",
  });
  return { token, expiresAt };
}

/* Attaches req.user when a valid bearer token is present. Never rejects:
   use requireAuth / requireRole for that. A present-but-invalid token is
   treated as anonymous. */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const h = req.get("authorization") || "";
    const m = /^Bearer ([A-Za-z0-9._-]+)$/.exec(h);
    if (!m) return next();
    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(m[1], config.JWT_SECRET, { algorithms: ["HS256"], issuer: "bslc-api" }) as jwt.JwtPayload;
    } catch {
      return next();
    }
    if (!payload.jti || !payload.sub) return next();
    const session = await prisma.session.findUnique({ where: { jti: String(payload.jti) }, include: { user: true } });
    if (!session || session.revokedAt || session.expiresAt < new Date()) return next();
    if (session.userId !== payload.sub || session.user.status !== "ACTIVE") return next();
    req.user = {
      id: session.user.id,
      userId: session.user.userId,
      name: session.user.name,
      role: session.user.role,
      jti: session.jti,
    };
    next();
  } catch (e) {
    next(e);
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(new HttpError(401, "Sign-in required"));
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new HttpError(401, "Sign-in required"));
    if (!roles.includes(req.user.role)) return next(new HttpError(403, "Not permitted for your role"));
    next();
  };
}
