import type { IncomingMessage } from 'node:http';
import { requireAdmin } from '../http/auth.ts';

/** True only for a valid admin credential; never throws on anonymous calls. */
export function isAdminRequest(req: IncomingMessage): boolean {
  if (!req.headers.authorization) return false;
  try {
    requireAdmin(req);
    return true;
  } catch {
    return false;
  }
}

/** Explicit column list — never `select *` (§21). */
export const HADITH_SELECT = `
  h.id, h.hadith_number, h.volume_number, h.page_number,
  h.raw_text, h.matn, h.isnad, h.takhrij, h.grading,
  h.original_reference, h.original_hadith_number, h.source_locator,
  h.source_locked, h.verified, h.verification_status,
  h.content_hash, h.dataset_version, d.dataset_hash,
  h.book_id, b.name as book_name,
  h.chapter_id, c.name as chapter_name,
  h.narrator_id, n.name as narrator_name,
  e.id as edition_id, s.id as source_id, s.name as source_name,
  e.title as edition_title, e.publisher as edition_publisher,
  h.created_at, h.updated_at`;

export const HADITH_FROM = `
  from corpus.hadiths h
  join corpus.editions e on e.id = h.edition_id
  join corpus.sources s on s.id = e.source_id
  left join corpus.dataset_versions d on d.version = h.dataset_version
  left join corpus.books b on b.id = h.book_id
  left join corpus.chapters c on c.id = h.chapter_id
  left join corpus.narrators n on n.id = h.narrator_id`;

/** Reading order for an edition that prints no hadith numbers. */
export const HADITH_ORDER = `h.hadith_number_int nulls last, h.volume_number nulls last,
  h.page_number nulls last, h.source_ordinal nulls last, h.created_at`;

export class SqlFilters {
  private readonly clauses: string[] = [];
  readonly params: unknown[] = [];

  add(sqlTemplate: (placeholder: string) => string, value: unknown): void {
    if (value === null || value === undefined) return;
    this.params.push(value);
    this.clauses.push(sqlTemplate(`$${this.params.length}`));
  }

  raw(clause: string): void {
    this.clauses.push(clause);
  }

  push(value: unknown): string {
    this.params.push(value);
    return `$${this.params.length}`;
  }

  where(): string {
    return this.clauses.length ? `where ${this.clauses.join(' and ')}` : '';
  }
}
