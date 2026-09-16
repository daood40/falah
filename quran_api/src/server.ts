import { createServer } from 'node:http';
import { loadEnv } from './config/env.ts';
import { getPool, closePool } from './db/pool.ts';
import { createApp } from './app.ts';

const env = loadEnv();
const db = getPool(env.databaseUrl);
const app = createApp(env, db);

const server = createServer((req, res) => {
  void app.handler(req, res);
});

server.listen(env.port, env.host, () => {
  // Never log secrets, connection strings or content — only the posture.
  console.log(
    `[api] FALAH Quran API on ${env.host}:${env.port} ` +
      `(env=${env.environment}, private_mode=${env.privateMode}, ` +
      `public_data=${env.flags.publicDataEnabled}, public_api=${env.flags.publicApiEnabled})`,
  );
  if (env.privateMode) {
    console.log('[api] PRIVATE MODE — internal access only, no public data, no public API');
  }
});

const shutdown = (): void => {
  server.close(() => {
    void closePool().finally(() => process.exit(0));
  });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
