import { describe, expect, it } from 'vitest';
import { collapseWhitespace, contentHash } from '../src/core/hash.ts';
import { normalizeDigits, normalizeForSearch } from '../src/core/arabic.ts';
import { parsePagination, parsePositiveInt } from '../src/core/pagination.ts';
import { ApiError } from '../src/core/errors.ts';
import { errorBody, successBody } from '../src/core/response.ts';
import { Router } from '../src/http/router.ts';
import { RateLimiter } from '../src/http/middleware.ts';
import { signSupabaseJwt, verifySupabaseJwt } from '../src/auth/jwt.ts';

const BASMALA = 'بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ';

describe('hashing (SOURCE_LOCK)', () => {
  it('is stable and sensitive to any character change', () => {
    expect(contentHash(BASMALA)).toBe(contentHash(BASMALA));
    expect(contentHash(BASMALA)).toHaveLength(64);
    expect(contentHash(BASMALA)).not.toBe(contentHash(BASMALA.replace('ِ', '')));
  });

  it('collapses whitespace only — never letters or diacritics', () => {
    expect(contentHash(`  ${BASMALA}  `)).toBe(contentHash(BASMALA));
    expect(collapseWhitespace(`a\n\tb`)).toBe('a b');
  });
});

describe('Arabic normalisation (search only)', () => {
  it('strips diacritics for matching without touching the source string', () => {
    const normalized = normalizeForSearch(BASMALA);
    expect(normalized).toBe('بسم الله الرحمن الرحيم');
    expect(BASMALA).toContain('ۡ');
  });

  it('unifies hamza forms and converts Arabic-Indic digits', () => {
    expect(normalizeForSearch('أإآا')).toBe('اااا');
    expect(normalizeDigits('١٢٣٤٥')).toBe('12345');
  });
});

describe('pagination', () => {
  const opts = { defaultLimit: 20, maxLimit: 100 };

  it('applies defaults and offsets', () => {
    expect(parsePagination(new URLSearchParams(''), opts)).toEqual({ page: 1, limit: 20, offset: 0 });
    expect(parsePagination(new URLSearchParams('page=3&limit=10'), opts).offset).toBe(20);
  });

  it('rejects oversized and malformed limits', () => {
    expect(() => parsePagination(new URLSearchParams('limit=1000000'), opts)).toThrow(ApiError);
    expect(() => parsePagination(new URLSearchParams('limit=abc'), opts)).toThrow(ApiError);
    expect(() => parsePositiveInt('0', 1, 'page')).toThrow(ApiError);
    expect(() => parsePositiveInt('-4', 1, 'page')).toThrow(ApiError);
  });
});

describe('response envelope', () => {
  it('uses the documented success/error shapes', () => {
    expect(successBody({ a: 1 })).toEqual({ success: true, data: { a: 1 }, meta: {} });
    expect(errorBody('NOT_FOUND', 'Resource not found')).toEqual({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Resource not found' },
    });
  });
});

describe('router', () => {
  const router = new Router()
    .add({ method: 'GET', path: '/api/v1/surahs/:id', handler: async () => ({ data: null }) })
    .add({ method: 'POST', path: '/api/v1/me/bookmarks', handler: async () => ({ data: null }) });

  it('extracts params and decodes them', () => {
    expect(router.match('GET', '/api/v1/surahs/18').params).toEqual({ id: '18' });
  });

  it('distinguishes 404 from 405', () => {
    expect(() => router.match('GET', '/api/v1/nope')).toThrow(/not found/i);
    expect(() => router.match('DELETE', '/api/v1/me/bookmarks')).toThrow(/method not allowed/i);
  });
});

describe('rate limiter', () => {
  it('throws once the window budget is spent', () => {
    const limiter = new RateLimiter(1000, 2);
    limiter.check('ip');
    limiter.check('ip');
    expect(() => limiter.check('ip')).toThrow(ApiError);
    expect(() => limiter.check('other-ip')).not.toThrow();
  });
});

describe('Supabase JWT verification', () => {
  const secret = 'unit-secret';

  it('accepts a correctly signed token', () => {
    const token = signSupabaseJwt({ sub: 'user-1', role: 'authenticated' }, secret);
    expect(verifySupabaseJwt(token, secret).sub).toBe('user-1');
  });

  it('rejects tampering, wrong secrets, alg:none and expiry', () => {
    const token = signSupabaseJwt({ sub: 'user-1' }, secret);
    expect(() => verifySupabaseJwt(token, 'other-secret')).toThrow(ApiError);
    expect(() => verifySupabaseJwt(`${token}x`, secret)).toThrow(ApiError);
    const [, payload, signature] = token.split('.');
    const noneToken = `${Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')}.${payload}.${signature}`;
    expect(() => verifySupabaseJwt(noneToken, secret)).toThrow(/algorithm/i);
    const expired = signSupabaseJwt({ sub: 'user-1', exp: Math.floor(Date.now() / 1000) - 10 }, secret);
    expect(() => verifySupabaseJwt(expired, secret)).toThrow(/expired/i);
    expect(() => verifySupabaseJwt('not-a-token', secret)).toThrow(ApiError);
  });
});
