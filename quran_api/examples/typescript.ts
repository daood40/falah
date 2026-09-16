// FALAH Quran API — TypeScript client (Node 22+: `node typescript.ts`).
// Usage: FALAH_API_BASE_URL=https://api.example.com node typescript.ts
type Envelope<T> = { success: true; data: T; meta: Record<string, unknown> };
type ApiErrorBody = { success: false; error: { code: string; message: string } };

export type Surah = {
  id: string;
  surah_number: number;
  name_ar: string;
  name_en: string | null;
  ayah_count: number;
  verified: boolean;
};

export type Ayah = {
  id: string;
  surah: { number: number; name_ar: string };
  ayah_number: number;
  ayah_key: string;
  text: string;
  content_hash: string;
  source: { id: string; name: string | null; version: string | null };
  verification: { verified: boolean; status: string };
  translation?: { language: string | null; text: string };
};

export class QuranApiError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'QuranApiError';
    this.code = code;
  }
}

export class QuranApi {
  private readonly baseUrl: string;
  private readonly token: string | undefined;

  constructor(baseUrl: string, token?: string) {
    this.baseUrl = baseUrl;
    this.token = token;
  }

  private async get<T>(path: string): Promise<Envelope<T>> {
    const response = await fetch(`${this.baseUrl}/api/v1${path}`, {
      headers: {
        accept: 'application/json',
        ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
      },
    });
    const body = (await response.json()) as Envelope<T> | ApiErrorBody;
    if (!body.success) throw new QuranApiError(body.error.code, body.error.message);
    return body;
  }

  listSurahs = async (): Promise<Surah[]> => (await this.get<Surah[]>('/surahs?limit=114')).data;

  getAyah = async (surah: number, ayah: number, translation?: string): Promise<Ayah> =>
    (await this.get<Ayah>(
      `/ayahs/by-key/${surah}:${ayah}${translation ? `?translation=${translation}` : ''}`,
    )).data;

  search = async (query: string, limit = 20): Promise<Ayah[]> =>
    (await this.get<Ayah[]>(`/search?q=${encodeURIComponent(query)}&limit=${limit}`)).data;
}

const base = process.env.FALAH_API_BASE_URL;
if (!base) throw new Error('set FALAH_API_BASE_URL');
const api = new QuranApi(base);
console.log('surahs:', (await api.listSurahs()).length);
const ayah = await api.getAyah(112, 1);
console.log(ayah.ayah_key, ayah.text, ayah.content_hash);
console.log('hits:', (await api.search('الرحمن', 5)).length);
