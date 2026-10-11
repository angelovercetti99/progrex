import { defineConfig } from 'drizzle-kit';

// `npm run db:generate` turns changes in src/db/schema.ts into SQL files in migrations/.
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './migrations',
});
