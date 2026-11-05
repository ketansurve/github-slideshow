/* Environment configuration, validated at start-up. The server refuses to
   start with an unsafe production configuration rather than running with
   weak defaults. See .env.example for every variable. */
import "dotenv/config";
import { z } from "zod";

const csv = (v: string) => v.split(",").map((s) => s.trim()).filter(Boolean);

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8080),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  CORS_ORIGINS: z.string().default("http://localhost:4173").transform(csv),
  // How the sign-in OTP is delivered:
  //   console  — printed in the server log (development only)
  //   response — returned in the API response (automated tests only)
  //   sms      — the state SMS gateway; NOT IMPLEMENTED, needs NIC/CDAC onboarding
  OTP_DELIVERY: z.enum(["console", "response", "sms"]).default("console"),
  OTP_TTL_SECONDS: z.coerce.number().int().min(60).max(900).default(300),
  MAX_FAILED_ATTEMPTS: z.coerce.number().int().min(1).default(5),
  LOCKOUT_MINUTES: z.coerce.number().int().min(1).default(30),
  AUTH_RATE_LIMIT: z.coerce.number().int().min(1).default(20), // per IP per 15 minutes
  STORAGE_DIR: z.string().default("./.data/uploads"),
  MAX_UPLOAD_MB: z.coerce.number().positive().max(200).default(25),
  CLAMAV_HOST: z.string().optional(),
  CLAMAV_PORT: z.coerce.number().int().default(3310),
  TRUST_PROXY: z.string().optional(), // e.g. "1" behind one reverse proxy
});

export type Config = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid configuration: ${msg}`);
  }
  const c = parsed.data;
  if (c.NODE_ENV === "production") {
    if (c.OTP_DELIVERY !== "sms") {
      throw new Error("Invalid configuration: OTP_DELIVERY must be 'sms' in production");
    }
    if (c.CORS_ORIGINS.some((o) => !o.startsWith("https://"))) {
      throw new Error("Invalid configuration: CORS_ORIGINS must all be https:// in production");
    }
    if (!c.CLAMAV_HOST) {
      console.warn("WARNING: CLAMAV_HOST is not set; uploads stay PENDING until an admin releases them.");
    }
  }
  if (c.OTP_DELIVERY === "response" && c.NODE_ENV !== "test") {
    throw new Error("Invalid configuration: OTP_DELIVERY=response is only allowed when NODE_ENV=test");
  }
  return c;
}

export const config: Config = loadConfig();
