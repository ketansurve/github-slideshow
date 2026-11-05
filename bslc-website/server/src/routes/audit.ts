/* /audit — read-only view of the audit trail, ADMIN only. There is no
   route that changes or removes audit rows. */
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { ah } from "../http";
import { requireRole } from "../auth";

export const auditRouter = Router();
auditRouter.use(requireRole("ADMIN"));

auditRouter.get("/", ah(async (req, res) => {
  const q = z.object({
    action: z.string().max(60).optional(),
    entity: z.string().max(60).optional(),
    entityId: z.string().max(60).optional(),
    actorId: z.string().max(60).optional(),
    limit: z.coerce.number().int().min(1).max(500).default(100),
  }).parse(req.query);
  const rows = await prisma.auditLog.findMany({
    where: { action: q.action, entity: q.entity, entityId: q.entityId, actorId: q.actorId },
    orderBy: { id: "desc" },
    take: q.limit,
  });
  res.json(rows.map((r) => ({ ...r, id: r.id.toString() })));
}));
