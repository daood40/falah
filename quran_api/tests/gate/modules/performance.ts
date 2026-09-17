/**
 * Category: performance — measured, not claimed. Every case is one timed real
 * request against the running server and the local database; the percentiles
 * in the report are computed from these samples only.
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import type { GateContext } from '../context.ts';

const CATEGORY = 'performance';
const V1 = '/api/v1';

/** Budgets are generous on purpose: they catch collapse, not micro-jitter. */
const BUDGET_MS = 1500;

function percentile(samples: number[], fraction: number): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(fraction * sorted.length) - 1));
  return Math.round(sorted[index]! * 100) / 100;
}

export async function run(ctx: GateContext): Promise<void> {
  const { gate, request } = ctx;

  const scenarios: { name: string; paths: string[] }[] = [
    { name: 'ayah-by-key', paths: Array.from({ length: 120 }, (_, index) => `${V1}/ayahs/by-key/${(index % 114) + 1}:1`) },
    { name: 'surah-detail', paths: Array.from({ length: 114 }, (_, index) => `${V1}/surahs/${index + 1}`) },
    { name: 'surah-ayahs', paths: Array.from({ length: 60 }, (_, index) => `${V1}/surahs/${index + 1}/ayahs?limit=100`) },
    { name: 'page-ayahs', paths: Array.from({ length: 120 }, (_, index) => `${V1}/pages/${index + 1}/ayahs?limit=100`) },
    { name: 'search', paths: Array.from({ length: 60 }, (_, index) => `${V1}/search?q=%D8%A7%D9%84%D9%84%D9%87&limit=20&page=${(index % 5) + 1}`) },
    { name: 'metadata', paths: Array.from({ length: 60 }, (_, index) => [`${V1}/version`, `${V1}/stats`, `${V1}/sources`, `${V1}/editions`, `${V1}/schemes`, `${V1}/health`][index % 6]!) },
  ];

  const samplesByScenario = new Map<string, number[]>();
  for (const scenario of scenarios) {
    const samples: number[] = [];
    for (const [index, target] of scenario.paths.entries()) {
      const response = await request(target);
      samples.push(response.ms);
      gate.check(
        `PERF-${scenario.name.toUpperCase()}-${String(index + 1).padStart(3, '0')}`,
        CATEGORY,
        `${scenario.name}: GET ${target} answers within the ${BUDGET_MS}ms budget`,
        { path: target, budget_ms: BUDGET_MS },
        response.status === 200 && response.ms <= BUDGET_MS,
        `200 within ${BUDGET_MS}ms`,
        `status ${response.status}, ${Math.round(response.ms * 100) / 100}ms`,
        'MEDIUM',
        2,
      );
    }
    samplesByScenario.set(scenario.name, samples);
  }

  const all = [...samplesByScenario.values()].flat();
  const summary: Record<string, unknown> = {
    measured_at: new Date().toISOString(),
    environment: 'gate runner, local Postgres 16 over a unix socket, single Node process',
    total_requests: all.length,
    overall: {
      p50_ms: percentile(all, 0.5),
      p95_ms: percentile(all, 0.95),
      p99_ms: percentile(all, 0.99),
      min_ms: Math.round(Math.min(...all) * 100) / 100,
      max_ms: Math.round(Math.max(...all) * 100) / 100,
    },
    scenarios: Object.fromEntries(
      [...samplesByScenario.entries()].map(([name, samples]) => [
        name,
        {
          requests: samples.length,
          p50_ms: percentile(samples, 0.5),
          p95_ms: percentile(samples, 0.95),
          p99_ms: percentile(samples, 0.99),
        },
      ]),
    ),
  };
  writeFileSync(
    path.join(import.meta.dirname, '..', '..', '..', 'reports', 'performance-samples.json'),
    `${JSON.stringify(summary, null, 2)}\n`,
  );

  for (const [name, samples] of samplesByScenario) {
    gate.check(
      `PERF-P95-${name.toUpperCase()}`,
      CATEGORY,
      `${name} p95 latency measured over ${samples.length} real requests`,
      { scenario: name, samples: samples.length },
      percentile(samples, 0.95) <= BUDGET_MS,
      `p95 <= ${BUDGET_MS}ms`,
      `p50 ${percentile(samples, 0.5)}ms, p95 ${percentile(samples, 0.95)}ms, p99 ${percentile(samples, 0.99)}ms`,
      'MEDIUM',
      1,
    );
  }
  gate.check(
    'PERF-OVERALL',
    CATEGORY,
    `overall latency across all ${all.length} measured requests`,
    { requests: all.length },
    percentile(all, 0.99) <= BUDGET_MS,
    `p99 <= ${BUDGET_MS}ms`,
    `p50 ${percentile(all, 0.5)}ms, p95 ${percentile(all, 0.95)}ms, p99 ${percentile(all, 0.99)}ms`,
    'MEDIUM',
    1,
  );
}
