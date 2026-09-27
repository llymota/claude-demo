import { checkout, polar, portal, webhooks } from "@polar-sh/better-auth";
import { Polar } from "@polar-sh/sdk";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { applyCustomerState } from "./billing/sync";
import { db, schema } from "./db";
import { sendEmail, templates } from "./email";
import { env, features, trustedOrigins } from "./env";
import { log } from "./log";

let polarClient: Polar | undefined;
export function polarSdk() {
  if (!features.polar()) return undefined;
  polarClient ??= new Polar({ accessToken: env().POLAR_ACCESS_TOKEN, server: env().POLAR_SERVER });
  return polarClient;
}

function billingPlugins() {
  const client = polarSdk();
  if (!client) return [];
  const e = env();
  return [
    polar({
      client,
      createCustomerOnSignUp: true,
      use: [
        checkout({
          products: [
            { productId: e.POLAR_PRODUCT_GROWER!, slug: "grower" },
            { productId: e.POLAR_PRODUCT_STUDIO!, slug: "studio" },
          ],
          successUrl: "/app/settings/billing?checkout_id={CHECKOUT_ID}",
          returnUrl: `${e.APP_URL}/app/settings/billing`,
          authenticatedUsersOnly: true,
        }),
        portal({ returnUrl: `${e.APP_URL}/app/settings/billing` }),
        ...(e.POLAR_WEBHOOK_SECRET
          ? [
              webhooks({
                secret: e.POLAR_WEBHOOK_SECRET,
                onCustomerStateChanged: async (payload) => applyCustomerState(payload.data),
              }),
            ]
          : []),
      ],
    }),
  ];
}

function build() {
  const e = env();
  const options = {
    appName: "Tendril",
    baseURL: e.APP_URL,
    secret: e.BETTER_AUTH_SECRET,
    trustedOrigins: trustedOrigins(),
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
        rateLimit: schema.rateLimit,
      },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      maxPasswordLength: 128,
      requireEmailVerification: features.email(),
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await sendEmail({ to: user.email, ...templates.reset(url) });
      },
    },
    emailVerification: {
      sendOnSignUp: features.email(),
      // Signing in before confirming sends a fresh link, so a lost or failed email isn't a dead end.
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      expiresIn: 60 * 60 * 24,
      sendVerificationEmail: async ({ user, url }) => {
        await sendEmail({ to: user.email, ...templates.verify(url) });
      },
    },
    socialProviders: {
      ...(features.google() ? { google: { clientId: e.GOOGLE_CLIENT_ID!, clientSecret: e.GOOGLE_CLIENT_SECRET! } } : {}),
      ...(features.github() ? { github: { clientId: e.GITHUB_CLIENT_ID!, clientSecret: e.GITHUB_CLIENT_SECRET! } } : {}),
    },
    account: { accountLinking: { enabled: true, trustedProviders: ["google", "github"] } },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      freshAge: 60 * 10,
      cookieCache: { enabled: true, maxAge: 60 * 5 },
    },
    rateLimit: {
      enabled: e.NODE_ENV === "production",
      storage: "database",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 60, max: 3 },
        "/request-password-reset": { window: 300, max: 3 },
      },
    },
    advanced: { useSecureCookies: e.APP_URL.startsWith("https://") },
    databaseHooks: {
      user: {
        create: {
          after: async (u) => {
            await db.insert(schema.workspace).values({ userId: u.id }).onConflictDoNothing();
            await db.insert(schema.subscription).values({ userId: u.id }).onConflictDoNothing();
            log.info("user.created", { userId: u.id });
          },
        },
      },
    },
    plugins: [...billingPlugins(), nextCookies()],
  } satisfies BetterAuthOptions;
  return betterAuth(options);
}

type Auth = ReturnType<typeof build>;
const g = globalThis as unknown as { __tendrilAuth?: Auth };

/** Built on first use so importing this module never requires env at build time. */
export function auth(): Auth {
  return (g.__tendrilAuth ??= build());
}
