import { defineConfig } from 'drizzle-kit';

const fallbackDatabaseUrl = 'postgres://postgres:postgres@localhost:5432/dabrowskiego';

export default defineConfig({
  out: './migrations',
  schema: './src/schema/index.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? fallbackDatabaseUrl,
  },
  strict: true,
  verbose: true,
});
