import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
    // CI can override any of these; locally they point at the scratch test db.
    env: {
      DATABASE_URL:
        process.env['DATABASE_URL'] ?? 'postgresql://falah:falah@127.0.0.1:5432/falah_corpus_test',
      ADMIN_API_KEY: 'test-admin-key-not-a-real-secret',
      SUPABASE_JWT_SECRET: 'test-jwt-secret-not-a-real-secret',
      ENVIRONMENT: 'test',
      CONTENT_LICENSE_CONFIRMED: 'false',
      MAX_PAGE_LIMIT: '100',
      RATE_LIMIT_MAX: '100000',
    },
  },
});
