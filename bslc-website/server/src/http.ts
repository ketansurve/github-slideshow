/* Small HTTP helpers shared by all routes. */
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ZodError, ZodTypeAny, z } from "zod";

export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

/* Wraps an async route so rejected promises reach the error handler. */
export function ah(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => { fn(req, res, next).catch(next); };
}

export function parse<T extends ZodTypeAny>(schema: T, value: unknown): z.infer<T> {
  return schema.parse(value);
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, code: err.code });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "Invalid request",
      issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }
  const e = err as { code?: string; status?: number; type?: string };
  if (e && e.type === "entity.parse.failed") return res.status(400).json({ error: "Malformed JSON" });
  if (e && e.code === "P2025") return res.status(404).json({ error: "Not found" });
  if (e && e.code === "P2002") return res.status(409).json({ error: "Already exists" });
  console.error(err);
  return res.status(500).json({ error: "Internal server error" });
}
