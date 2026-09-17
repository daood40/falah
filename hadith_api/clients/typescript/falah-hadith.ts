/**
 * FALAH Hadith API — TypeScript/JavaScript client.
 *
 * Zero dependencies: it uses `fetch`, which Node 18+, Deno, Bun and every
 * browser already have. Copy this one file into any project.
 *
 *   const api = new HadithApi('https://your-host');
 *   const page = await api.hadiths({ limit: 20 });
 *   const hit  = await api.search('إنما الأعمال بالنيات');
 *
 * Text fields come back null while the server's content licence is
 * unconfirmed; `text_available` says which case you are in. The client never
 * invents a fallback — that is the whole point of the flag.
 */

export interface Envelope<T> {
  success: true;
  data: T;
  meta?: PageMeta & Record<string, unknown>;
}

export interface PageMeta {
  page?: number;
  limit?: number;
  total?: number;
  total_pages?: number;
}

export interface Page<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface Ref {
  id: string;
  name: string;
}

export interface Hadith {
  id: string;
  hadith_number: string | null;
  book: Ref | null;
  chapter: Ref | null;
  narrator: Ref | null;
  isnad: string | null;
  matn: string | null;
  raw_text: string | null;
  takhrij: string | null;
  grading: string | null;
  volume: number | null;
  page: number | null;
  source: { name: string | null; edition: string | null; publisher: string | null };
  verification: { verified: boolean; status: string };
  source_locked: boolean;
  content_hash: string;
  dataset_version: string;
  text_available: boolean;
}

export interface CrossCheck {
  reference: string;
  reference_name: string;
  reference_collection: string | null;
  reference_number: string | null;
  similarity: number;
  verdict: 'corroborated' | 'partial' | 'not_found';
  takhrij_agrees: boolean | null;
  takhrij_collections: string[];
}

export class HadithApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'HadithApiError';
  }

  get isNotFound(): boolean {
    return this.code === 'NOT_FOUND';
  }
}

export interface HadithApiOptions {
  /** Only needed for /admin routes. Never ship it in a browser bundle. */
  adminKey?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export class HadithApi {
  private readonly base: string;
  private readonly options: HadithApiOptions;

  constructor(baseUrl: string, options: HadithApiOptions = {}) {
    this.base = baseUrl.replace(/\/$/, '');
    this.options = options;
  }

  private async request<T>(path: string, params: Record<string, unknown> = {}): Promise<Envelope<T>> {
    const url = new URL(this.base + path);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 15_000);
    let response: Response;
    try {
      response = await (this.options.fetch ?? fetch)(url, {
        headers: {
          accept: 'application/json',
          ...(this.options.adminKey ? { authorization: `Bearer ${this.options.adminKey}` } : {}),
        },
        signal: controller.signal,
      });
    } catch (err) {
      throw new HadithApiError('NETWORK_ERROR', (err as Error).message);
    } finally {
      clearTimeout(timer);
    }

    const body = (await response.json().catch(() => null)) as
      | { success: boolean; data?: unknown; meta?: PageMeta; error?: { code: string; message: string } }
      | null;
    if (!body) throw new HadithApiError('INVALID_RESPONSE', 'Response was not JSON', response.status);
    if (!body.success) {
      throw new HadithApiError(body.error?.code ?? 'INTERNAL_ERROR', body.error?.message ?? 'Request failed', response.status);
    }
    return body as Envelope<T>;
  }

  private static toPage<T>(envelope: Envelope<T[]>): Page<T> {
    const meta = envelope.meta ?? {};
    const limit = meta.limit ?? envelope.data.length;
    const total = meta.total ?? envelope.data.length;
    const page = meta.page ?? 1;
    return {
      items: envelope.data,
      page,
      limit,
      total,
      totalPages: meta.total_pages ?? (limit ? Math.ceil(total / limit) : 0),
      hasMore: page * limit < total,
    };
  }

  // ---- system ----
  health = () => this.request<Record<string, unknown>>('/api/v1/health').then((e) => e.data);
  stats = () => this.request<Record<string, unknown>>('/api/v1/stats').then((e) => e.data);
  version = () => this.request<Record<string, unknown>>('/api/v1/version').then((e) => e.data);
  /** The dataset versions this service serves, with their sealed fingerprints. */
  datasets = () =>
    this.request<Record<string, unknown>[]>('/api/v1/datasets').then((e) => e.data);

  // ---- hadiths ----
  async hadiths(params: {
    page?: number; limit?: number; book_id?: string; chapter_id?: string;
    narrator_id?: string; volume?: number; verification_status?: string;
  } = {}): Promise<Page<Hadith>> {
    return HadithApi.toPage(await this.request<Hadith[]>('/api/v1/hadiths', params));
  }

  hadith = (id: string) => this.request<Hadith>(`/api/v1/hadiths/${id}`).then((e) => e.data);

  async search(q: string, params: { page?: number; limit?: number; type?: string; grading?: string;
    source?: string; volume?: number; book_id?: string; chapter_id?: string } = {}): Promise<Page<Hadith>> {
    return HadithApi.toPage(await this.request<Hadith[]>('/api/v1/search', { q, ...params }));
  }

  // ---- browsing ----
  catalog = (params: { edition_id?: string; chapters?: boolean } = {}) =>
    this.request<Record<string, unknown>[]>('/api/v1/catalog', {
      edition_id: params.edition_id,
      chapters: params.chapters ? 'true' : undefined,
    }).then((e) => e.data);

  async books(params: { edition_id?: string; page?: number; limit?: number } = {}) {
    return HadithApi.toPage(await this.request<Record<string, unknown>[]>('/api/v1/books', params));
  }

  async chapters(params: { book_id?: string; page?: number; limit?: number } = {}) {
    return HadithApi.toPage(await this.request<Record<string, unknown>[]>('/api/v1/chapters', params));
  }

  async narrators(params: { name?: string; page?: number; limit?: number } = {}) {
    return HadithApi.toPage(await this.request<Record<string, unknown>[]>('/api/v1/narrators', params));
  }

  collections = () => this.request<Record<string, unknown>[]>('/api/v1/collections', { limit: 100 }).then((e) => e.data);
  gradings = () => this.request<Record<string, unknown>[]>('/api/v1/gradings').then((e) => e.data);
  volumes = () => this.request<Record<string, unknown>[]>('/api/v1/volumes').then((e) => e.data);
  editions = () => this.request<Record<string, unknown>[]>('/api/v1/editions', { limit: 100 }).then((e) => e.data);
  sources = () => this.request<Record<string, unknown>[]>('/api/v1/sources').then((e) => e.data);

  // ---- verification ----
  crossChecks = (hadithId: string) =>
    this.request<CrossCheck[]>(`/api/v1/hadiths/${hadithId}/cross-checks`).then((e) => e.data);
  crossCheckSummary = () =>
    this.request<Record<string, unknown>[]>('/api/v1/cross-checks/summary').then((e) => e.data);
  references = () => this.request<Record<string, unknown>[]>('/api/v1/references').then((e) => e.data);
}

export default HadithApi;
