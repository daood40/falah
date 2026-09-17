import { createServer } from './app.ts';
import { config } from '../config.ts';
import { closePool, query } from '../db.ts';

const server = createServer();

server.listen(config.port, () => {
  console.log(
    `FALAH Hadith API listening on http://127.0.0.1:${config.port}/api/v1 ` +
      `[env=${config.environment} license_confirmed=${config.contentLicenseConfirmed}]`,
  );
  void query('select 1').catch(() => console.warn('warning: database is not reachable yet'));
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => {
      void closePool().then(() => process.exit(0));
    });
  });
}
