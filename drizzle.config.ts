import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
  },
  dialect: 'postgresql',
  out: './supabase/migrations',
  schema: './src/platform/database/schema.ts',
  strict: true,
  verbose: true,
});
