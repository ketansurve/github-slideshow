/* Audit trail. Every sign-in attempt, document view/download and every
   change made through the API is recorded. AuditLog rows cannot be updated
   or deleted (database trigger in the init migration). */
import type { Request } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export async function audit(
  req: Request,
  action: string,
  entity?: string | null,
  entityId?: string | null,
  detail?: Record<string, unknown> | null,
  actorOverride?: { id: string; userId: string } | null,
) {
  const actor = actorOverride !== undefined ? actorOverride : req.user ?? null;
  await prisma.auditLog.create({
    data: {
      action,
      entity: entity ?? null,
      entityId: entityId ?? null,
      actorId: actor?.id ?? null,
      actorUser: actor?.userId ?? null,
      ip: req.ip ?? null,
      userAgent: (req.get("user-agent") || "").slice(0, 300) || null,
      detail: detail ? (detail as Prisma.InputJsonValue) : Prisma.JsonNull,
    },
  });
}
