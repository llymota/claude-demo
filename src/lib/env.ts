import { z } from "zod";

/**
 * Server environment, validated once at startup. Optional groups turn features on:
 * a platform shows up in "Connect accounts" only when its credentials are present.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),

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
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment:\n${issues}`);
  }
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
};
