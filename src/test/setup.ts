process.env.DATABASE_URL ??= "postgres://tendril:tendril@localhost:5432/tendril_test";
process.env.BETTER_AUTH_SECRET ??= "test-secret-test-secret-test-secret-0000";
process.env.TOKEN_ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString("base64");
process.env.CRON_SECRET ??= "test-cron-secret-000";
