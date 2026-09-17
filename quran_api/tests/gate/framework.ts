/**
 * Quality-gate framework.
 *
 * Every check produces one TestRecord with a real input, a real expected value
 * and the value actually observed. A record is only PASS when its assertions
 * ran and held; nothing is marked PASS by hand, and a check that cannot run in
 * this environment is BLOCKED, never PASS.
 */
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export type Status = 'PASS' | 'FAIL' | 'BLOCKED' | 'SKIPPED';
export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type TestRecord = {
  test_id: string;
  category: string;
  description: string;
  input: unknown;
  expected: unknown;
  actual: unknown;
  assertions: number;
  status: Status;
  severity: Severity;
  timestamp: string;
  build: string;
  dataset_version: string;
  message?: string;
};

export type GateContext = {
  build: string;
  datasetVersion: string;
  evidencePath: string;
  samplePath: string;
};

export class Gate {
  readonly records: TestRecord[] = [];
  readonly counts = new Map<string, { total: number; pass: number; fail: number; blocked: number; skipped: number }>();
  private readonly seenIds = new Set<string>();
  private readonly sampleCap: number;
  private readonly sampleCounts = new Map<string, number>();
  private duplicateIds = 0;
  private emptyAssertions = 0;

  private readonly context: GateContext;

  constructor(context: GateContext, sampleCap = 25) {
    this.context = context;
    this.sampleCap = sampleCap;
    mkdirSync(path.dirname(context.evidencePath), { recursive: true });
    writeFileSync(context.evidencePath, '');
    writeFileSync(context.samplePath, '');
  }

  /**
   * Records one check. `assertions` must be > 0 — a record without a real
   * assertion is itself counted as a quality defect.
   */
  record(entry: Omit<TestRecord, 'timestamp' | 'build' | 'dataset_version'>): void {
    if (this.seenIds.has(entry.test_id)) this.duplicateIds += 1;
    this.seenIds.add(entry.test_id);
    if (entry.assertions <= 0) this.emptyAssertions += 1;

    const record: TestRecord = {
      ...entry,
      timestamp: new Date().toISOString(),
      build: this.context.build,
      dataset_version: this.context.datasetVersion,
    };

    const bucket = this.counts.get(entry.category) ?? {
      total: 0, pass: 0, fail: 0, blocked: 0, skipped: 0,
    };
    bucket.total += 1;
    if (entry.status === 'PASS') bucket.pass += 1;
    else if (entry.status === 'FAIL') bucket.fail += 1;
    else if (entry.status === 'BLOCKED') bucket.blocked += 1;
    else bucket.skipped += 1;
    this.counts.set(entry.category, bucket);

    // Full evidence goes to JSONL; a capped, readable sample plus EVERY failure
    // is kept for the committed report.
    appendFileSync(this.context.evidencePath, `${JSON.stringify(record)}\n`);
    const sampled = this.sampleCounts.get(entry.category) ?? 0;
    if (entry.status !== 'PASS' || sampled < this.sampleCap) {
      appendFileSync(this.context.samplePath, `${JSON.stringify(record)}\n`);
      this.sampleCounts.set(entry.category, sampled + 1);
    }
    if (entry.status === 'FAIL' || entry.status === 'BLOCKED') this.records.push(record);
  }

  /** Convenience: assert a strict equality and record the outcome. */
  equals(
    id: string,
    category: string,
    description: string,
    input: unknown,
    expected: unknown,
    actual: unknown,
    severity: Severity = 'MEDIUM',
  ): boolean {
    const ok = Object.is(expected, actual);
    this.record({
      test_id: id,
      category,
      description,
      input,
      expected,
      actual,
      assertions: 1,
      status: ok ? 'PASS' : 'FAIL',
      severity,
      message: ok ? undefined : 'expected !== actual',
    });
    return ok;
  }

  /** Convenience: assert a boolean predicate that was actually evaluated. */
  check(
    id: string,
    category: string,
    description: string,
    input: unknown,
    ok: boolean,
    expected: unknown,
    actual: unknown,
    severity: Severity = 'MEDIUM',
    assertions = 1,
  ): boolean {
    this.record({
      test_id: id,
      category,
      description,
      input,
      expected,
      actual,
      assertions,
      status: ok ? 'PASS' : 'FAIL',
      severity,
    });
    return ok;
  }

  /**
   * Ingests a record produced by another runner (a CI job with the Android,
   * Docker or Flutter toolchain). The record keeps its own timestamp, build and
   * dataset version — this gate does not rewrite someone else's evidence — and
   * is counted exactly like a local one.
   */
  ingest(record: TestRecord): void {
    if (this.seenIds.has(record.test_id)) this.duplicateIds += 1;
    this.seenIds.add(record.test_id);
    if (record.assertions <= 0) this.emptyAssertions += 1;

    const bucket = this.counts.get(record.category) ?? {
      total: 0, pass: 0, fail: 0, blocked: 0, skipped: 0,
    };
    bucket.total += 1;
    if (record.status === 'PASS') bucket.pass += 1;
    else if (record.status === 'FAIL') bucket.fail += 1;
    else if (record.status === 'BLOCKED') bucket.blocked += 1;
    else bucket.skipped += 1;
    this.counts.set(record.category, bucket);

    appendFileSync(this.context.evidencePath, `${JSON.stringify(record)}\n`);
    const sampled = this.sampleCounts.get(record.category) ?? 0;
    if (record.status !== 'PASS' || sampled < this.sampleCap) {
      appendFileSync(this.context.samplePath, `${JSON.stringify(record)}\n`);
      this.sampleCounts.set(record.category, sampled + 1);
    }
    if (record.status === 'FAIL' || record.status === 'BLOCKED') this.records.push(record);
  }

  blocked(id: string, category: string, description: string, reason: string): void {
    this.record({
      test_id: id,
      category,
      description,
      input: null,
      expected: 'executed',
      actual: 'not executable in this environment',
      assertions: 0,
      status: 'BLOCKED',
      severity: 'LOW',
      message: reason,
    });
  }

  get totals(): { total: number; pass: number; fail: number; blocked: number; skipped: number } {
    const totals = { total: 0, pass: 0, fail: 0, blocked: 0, skipped: 0 };
    for (const bucket of this.counts.values()) {
      totals.total += bucket.total;
      totals.pass += bucket.pass;
      totals.fail += bucket.fail;
      totals.blocked += bucket.blocked;
      totals.skipped += bucket.skipped;
    }
    return totals;
  }

  get quality(): { duplicateIds: number; emptyAssertions: number; uniqueIds: number } {
    return {
      duplicateIds: this.duplicateIds,
      emptyAssertions: this.emptyAssertions,
      uniqueIds: this.seenIds.size,
    };
  }

  failuresBySeverity(): Record<Severity, number> {
    const bySeverity: Record<Severity, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    for (const record of this.records) {
      if (record.status === 'FAIL') bySeverity[record.severity] += 1;
    }
    return bySeverity;
  }
}
