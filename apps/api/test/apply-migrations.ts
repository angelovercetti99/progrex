import { applyD1Migrations, env } from 'cloudflare:test';

// Every test starts with the tables created (and an empty database).
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
