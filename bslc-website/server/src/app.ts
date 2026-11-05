/* Express application. Routes are mounted under the API root; the static
   site on GitHub Pages calls them cross-origin with a Bearer token. */
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { config } from "./config";
import { authenticate } from "./auth";
import { errorHandler } from "./http";
import { authRouter } from "./routes/auth";
import { usersRouter } from "./routes/users";
import { auditRouter } from "./routes/audit";

export function createApp() {
  const app = express();
  if (config.TRUST_PROXY) app.set("trust proxy", /^\d+$/.test(config.TRUST_PROXY) ? Number(config.TRUST_PROXY) : config.TRUST_PROXY);
  app.disable("x-powered-by");

  app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
  }));
  app.use(cors({
    origin: (origin, cb) => cb(null, !origin || config.CORS_ORIGINS.includes(origin)),
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
    allowedHeaders: ["Authorization", "Content-Type"],
    exposedHeaders: ["Content-Disposition"],
    credentials: false,
    maxAge: 600,
  }));
  app.use(express.json({ limit: "200kb" }));
  app.use((_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
  app.use(authenticate);

  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use("/auth", authRouter);
  app.use("/users", usersRouter);
  app.use("/audit", auditRouter);

  app.use((_req, res) => res.status(404).json({ error: "Not found" }));
  app.use(errorHandler);
  return app;
}
