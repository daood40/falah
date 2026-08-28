/**
 * SOURCE LOCK — the most important rule in FALAH.
 *
 * Religious text (Quran, hadith, adhkar, tafsir, narrator names, hadith grades)
 * may ONLY enter the system attached to verifiable source metadata. Nothing —
 * including the AI assistant — may author, alter, or attribute religious text.
 */
export type ReviewStatus = 'verified' | 'pending_review' | 'blocked';

export interface SourceMetadata {
  /** Stable identifier of the source (e.g. 'tanzil-uthmani-1.1', 'bukhari'). */
  source_id: string;
  source_name: string;
  source_url: string;
  source_version: string;
  /** ISO timestamp when the text was last verified against the source. */
  verified_at: string | null;
  review_status: ReviewStatus;
}

/** A piece of religious text that the system is allowed to display/export. */
export interface LockedText {
  /** The immutable canonical text as fetched from the source. */
  text: string;
  /** SHA-256 (hex) of `text`, computed at verification time. */
  checksum: string;
  source: SourceMetadata;
}

export type SacredKind = 'quran' | 'hadith' | 'tafsir' | 'adhkar' | 'translation';
