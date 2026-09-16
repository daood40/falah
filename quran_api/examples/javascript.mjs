// FALAH Quran API — plain JavaScript (Node 18+ or any modern browser).
// Usage: FALAH_API_BASE_URL=https://api.example.com node javascript.mjs
const BASE = process.env.FALAH_API_BASE_URL;
if (!BASE) throw new Error('set FALAH_API_BASE_URL');

const api = async (path, { token, ...init } = {}) => {
  const response = await fetch(`${BASE}/api/v1${path}`, {
    ...init,
    headers: {
      accept: 'application/json',
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  const body = await response.json();
  if (!body.success) {
    throw new Error(`${body.error.code}: ${body.error.message}`);
  }
  return body; // { success, data, meta }
};

const health = await api('/health');
console.log('status:', health.data.status, '| dataset:', health.data.checks.dataset?.version);

const { data: surahs } = await api('/surahs?limit=114');
console.log('surahs:', surahs.length, '| first:', surahs[0].name_ar);

const { data: ayah } = await api('/ayahs/by-key/2:255?translation=en-saheeh');
console.log('2:255:', ayah.text);
console.log('hash :', ayah.content_hash, '| source:', ayah.source.id);

const { data: hits, meta } = await api(`/search?q=${encodeURIComponent('الحمد لله')}&limit=3`);
console.log(`search: ${meta.total} hits, first = ${hits[0]?.ayah_key}`);

// Paginating a long surah:
let page = 1;
const all = [];
for (;;) {
  const { data, meta: m } = await api(`/surahs/2/ayahs?page=${page}&limit=100`);
  all.push(...data);
  if (page >= m.total_pages) break;
  page += 1;
}
console.log('al-Baqarah ayahs:', all.length);
