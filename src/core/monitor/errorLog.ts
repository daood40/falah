/** Client-side monitoring for a local-first app: capture uncaught errors and
 * unhandled rejections into a small persisted ring buffer so problems on real
 * devices can be inspected from Settings. Nothing ever leaves the device. */
import { kvGet, kvSet } from '@core/db/localdb';

export interface CapturedError {
  at: string; // ISO timestamp
  message: string;
  source?: string;
}

const KEY = 'monitor.errors';
const LIMIT = 50;

let queue: Promise<void> = Promise.resolve();

function record(message: string, source?: string) {
  // Serialize writes so two near-simultaneous errors don't lose entries.
  queue = queue.then(async () => {
    const list = (await kvGet<CapturedError[]>(KEY)) ?? [];
    list.unshift({ at: new Date().toISOString(), message: message.slice(0, 300), source });
    await kvSet(KEY, list.slice(0, LIMIT));
  });
}

export function installErrorLog(): void {
  window.addEventListener('error', (event) => {
    record(event.message || String(event.error ?? 'unknown error'), event.filename);
  });
  window.addEventListener('unhandledrejection', (event) => {
    record(`unhandled rejection: ${String(event.reason).slice(0, 260)}`);
  });
}

export async function listCapturedErrors(): Promise<CapturedError[]> {
  return (await kvGet<CapturedError[]>(KEY)) ?? [];
}

export async function clearCapturedErrors(): Promise<void> {
  await kvSet(KEY, []);
}
