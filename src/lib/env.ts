import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";

/**
 * Server environment, validated once at startup. Optional groups turn features on:
 * a platform shows up in "Connect accounts" only when its credentials are present.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.url().default("http://127.0.0.1:3000"),
  /** Optional in development: without it Tendril runs an embedded Postgres (PGlite) in ./.data. */
  DATABASE_URL: z.string().min(1).optional(),

  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
  /** 32-byte key, base64. Encrypts platform tokens at rest. `openssl rand -base64 32` */
  TOKEN_ENCRYPTION_KEY: z.string().refine((v) => Buffer.from(v, "base64").length === 32, "TOKEN_ENCRYPTION_KEY must be 32 bytes, base64-encoded"),
  CRON_SECRET: z.string().min(16),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),

  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Tendril <hello@tendril.app>"),

  POLAR_ACCESS_TOKEN: z.string().optional(),
  POLAR_WEBHOOK_SECRET: z.string().optional(),
  POLAR_SERVER: z.enum(["sandbox", "production"]).default("sandbox"),
  POLAR_PRODUCT_GROWER: z.string().optional(),
  POLAR_PRODUCT_STUDIO: z.string().optional(),

  /** Private JWK (JSON) used to sign Bluesky OAuth client assertions. See scripts/generate-bluesky-key.ts */
  BLUESKY_PRIVATE_JWK: z.string().optional(),

  X_CLIENT_ID: z.string().optional(),
  X_CLIENT_SECRET: z.string().optional(),

  THREADS_APP_ID: z.string().optional(),
  THREADS_APP_SECRET: z.string().optional(),

  LINKEDIN_CLIENT_ID: z.string().optional(),
  LINKEDIN_CLIENT_SECRET: z.string().optional(),

  /** Turns on the assistant and Autopilot. */
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default("claude-opus-5"),
  /** Jev by TypeSafe AI: fast typed classification (topics, triage, reply grading). */
  TYPESAFE_API_KEY: z.string().optional(),
  JEV_MODEL: z.string().default("jev-1.13.0"),
  SUPPORT_EMAIL: z.string().default("support@tendril.app"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

const DEV_SECRETS = ".data/dev-secrets.json";

/**
 * `npm run dev` should work with no configuration, so outside production the three
 * required secrets are generated once and kept in .data (gitignored).
 */
function devDefaults(): Record<string, string> {
  if (process.env.NODE_ENV === "production") return {};
  let saved: Record<string, string> = {};
  try {
    if (existsSync(DEV_SECRETS)) saved = JSON.parse(readFileSync(DEV_SECRETS, "utf8"));
  } catch {}
  const next = {
    BETTER_AUTH_SECRET: saved.BETTER_AUTH_SECRET ?? randomBytes(48).toString("base64"),
    TOKEN_ENCRYPTION_KEY: saved.TOKEN_ENCRYPTION_KEY ?? randomBytes(32).toString("base64"),
    CRON_SECRET: saved.CRON_SECRET ?? randomBytes(24).toString("hex"),
  };
  if (JSON.stringify(next) !== JSON.stringify(saved)) {
    try {
      mkdirSync(".data", { recursive: true });
      writeFileSync(DEV_SECRETS, JSON.stringify(next, null, 2));
    } catch {}
  }
  return next;
}

export function env(): Env {
  if (cached) return cached;
  // Blank lines in .env files count as unset.
  const source = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== "")) as Record<string, string>;
  const needs = ["BETTER_AUTH_SECRET", "TOKEN_ENCRYPTION_KEY", "CRON_SECRET"].some((k) => !source[k]);
  if (needs) for (const [k, v] of Object.entries(devDefaults())) source[k] ||= v;
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment:\n${issues}`);
  }
  if (parsed.data.NODE_ENV === "production" && !parsed.data.DATABASE_URL) throw new Error("Invalid environment:\n  DATABASE_URL: required in production");
  cached = parsed.data;
  return cached;
}

export const features = {
  polar: () => Boolean(env().POLAR_ACCESS_TOKEN && env().POLAR_PRODUCT_GROWER && env().POLAR_PRODUCT_STUDIO),
  email: () => Boolean(env().RESEND_API_KEY),
  google: () => Boolean(env().GOOGLE_CLIENT_ID && env().GOOGLE_CLIENT_SECRET),
  github: () => Boolean(env().GITHUB_CLIENT_ID && env().GITHUB_CLIENT_SECRET),
  bluesky: () => true, // Local development uses a loopback client; production needs BLUESKY_PRIVATE_JWK.
  x: () => Boolean(env().X_CLIENT_ID && env().X_CLIENT_SECRET),
  threads: () => Boolean(env().THREADS_APP_ID && env().THREADS_APP_SECRET),
  linkedin: () => Boolean(env().LINKEDIN_CLIENT_ID && env().LINKEDIN_CLIENT_SECRET),
  ai: () => Boolean(env().ANTHROPIC_API_KEY),
  jev: () => Boolean(env().TYPESAFE_API_KEY),
};
