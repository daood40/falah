/**
 * Audit harness (§ "20,000 checks"). Every recorded result is ONE independent
 * assertion about a distinct object: a distinct record, endpoint, role, payload
 * or file. The harness deliberately has no "repeat N times" helper — a count is
 * only allowed to grow by checking something that was not checked before, and
 * duplicate check ids are themselves reported as a failure.
 */
export type Status = 'PASS' | 'FAIL' | 'BLOCKED' | 'SKIPPED';
export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

export interface CheckResult {
  id: string;
  category: string;
  status: Status;
  severity: Severity;
  /** What must hold. */
  assertion: string;
  /** Why it failed / what was observed. Empty on PASS. */
  detail: string;
  /** Where the code under test lives (file or endpoint). */
  where: string;
  /** How to reproduce this single check. */
  repro: string;
}

export class Auditor {
  readonly results: CheckResult[] = [];
  private readonly seen = new Set<string>();
  readonly categories = new Map<string, { pass: number; fail: number; blocked: number; skipped: number }>();
  private readonly startedAt = Date.now();

  private bump(category: string, status: Status): void {
    let c = this.categories.get(category);
    if (!c) {
      c = { pass: 0, fail: 0, blocked: 0, skipped: 0 };
      this.categories.set(category, c);
    }
    if (status === 'PASS') c.pass++;
    else if (status === 'FAIL') c.fail++;
    else if (status === 'BLOCKED') c.blocked++;
    else c.skipped++;
  }

  record(r: Omit<CheckResult, 'severity'> & { severity?: Severity }): void {
    const severity = r.status === 'FAIL' ? (r.severity ?? 'MEDIUM') : 'NONE';
    if (this.seen.has(r.id)) {
      // A duplicate id would mean the same thing was counted twice.
      const dup: CheckResult = {
        id: `harness.duplicate_id:${r.id}:${this.results.length}`,
        category: 'harness.integrity',
        status: 'FAIL',
        severity: 'HIGH',
        assertion: 'every check id is unique (no check is counted twice)',
        detail: `duplicate check id: ${r.id}`,
        where: 'src/audit/core.ts',
        repro: 'npm run audit',
      };
      this.results.push(dup);
      this.bump(dup.category, 'FAIL');
      return;
    }
    this.seen.add(r.id);
    const full: CheckResult = { ...r, severity } as CheckResult;
    this.results.push(full);
    this.bump(r.category, r.status);
  }

  /** Records PASS when `ok`, otherwise FAIL with the given severity/detail. */
  check(
    id: string,
    category: string,
    assertion: string,
    ok: boolean,
    opts: { severity?: Severity; detail?: string; where: string; repro: string },
  ): boolean {
    this.record({
      id,
      category,
      status: ok ? 'PASS' : 'FAIL',
      severity: opts.severity ?? 'MEDIUM',
      assertion,
      detail: ok ? '' : (opts.detail ?? 'assertion did not hold'),
      where: opts.where,
      repro: opts.repro,
    });
    return ok;
  }

  blocked(id: string, category: string, assertion: string, reason: string, where: string, repro: string): void {
    this.record({ id, category, status: 'BLOCKED', assertion, detail: reason, where, repro });
  }

  skipped(id: string, category: string, assertion: string, reason: string, where: string, repro: string): void {
    this.record({ id, category, status: 'SKIPPED', assertion, detail: reason, where, repro });
  }

  get total(): number { return this.results.length; }
  get passed(): number { return this.results.filter((r) => r.status === 'PASS').length; }
  get failures(): CheckResult[] { return this.results.filter((r) => r.status === 'FAIL'); }
  get blockedCount(): number { return this.results.filter((r) => r.status === 'BLOCKED').length; }
  get skippedCount(): number { return this.results.filter((r) => r.status === 'SKIPPED').length; }
  get elapsedMs(): number { return Date.now() - this.startedAt; }

  severityCount(s: Severity): number {
    return this.results.filter((r) => r.status === 'FAIL' && r.severity === s).length;
  }
}

/** Deterministic PRNG: a fuzz run must be reproducible from its seed. */
export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 0x1_0000_0000;
  };
}

export function pick<T>(rand: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length) % arr.length] as T;
}
