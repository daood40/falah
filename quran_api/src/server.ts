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

server.listen(env.port, () => {
  console.log(
    `[api] FALAH Quran API listening on :${env.port} (env=${env.environment}, public_data=${env.flags.publicDataEnabled})`,
  );
});

const shutdown = (): void => {
  server.close(() => {
    void closePool().finally(() => process.exit(0));
  });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
