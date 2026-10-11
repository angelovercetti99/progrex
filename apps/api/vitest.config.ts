import path from 'node:path';

import { defineWorkersConfig, readD1Migrations } from '@cloudflare/vitest-pool-workers/config';

/**
 * Tests run inside a real (local) Worker runtime with a local D1 database,
 * so they exercise the same code Cloudflare runs. No account needed.
 */
export default defineWorkersConfig(async () => {
  const migrations = await readD1Migrations(path.join(__dirname, 'migrations'));
  return {
    test: {
      setupFiles: ['./test/apply-migrations.ts'],
      poolOptions: {
        workers: {
          singleWorker: true,
          wrangler: { configPath: './wrangler.jsonc' },
          miniflare: { bindings: { APP_TOKEN: 'test-key', TEST_MIGRATIONS: migrations } },
        },
      },
    },
  };
});
