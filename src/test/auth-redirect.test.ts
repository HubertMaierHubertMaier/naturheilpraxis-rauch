import { describe, it, expect } from 'vitest';
import { resolveAuthRedirectTarget } from '@/lib/authRedirect';

describe('resolveAuthRedirectTarget', () => {
  it('prefers location.state.from including search and hash', () => {
    const result = resolveAuthRedirectTarget({
      from: { pathname: '/patienten-bibliothek', search: '?tab=audio', hash: '#top' },
      redirectParam: '/dashboard',
      fallback: '/',
    });
    expect(result).toBe('/patienten-bibliothek?tab=audio#top');
  });

  it('falls back to ?redirect=... when no state.from is present', () => {
    const result = resolveAuthRedirectTarget({
      from: null,
      redirectParam: '/patienten-bibliothek',
      fallback: '/',
    });
    expect(result).toBe('/patienten-bibliothek');
  });

  it('accepts redirect param with search/hash preserved', () => {
    const result = resolveAuthRedirectTarget({
      from: null,
      redirectParam: '/dashboard?x=1#y',
      fallback: '/',
    });
    expect(result).toBe('/dashboard?x=1#y');
  });

  it('blocks external absolute URLs in state.from and falls back', () => {
    const result = resolveAuthRedirectTarget({
      from: { pathname: 'https://evil.example.com/steal' },
      redirectParam: null,
      fallback: '/erstanmeldung',
    });
    expect(result).toBe('/erstanmeldung');
  });

  it('blocks protocol-relative URLs in redirect param', () => {
    const result = resolveAuthRedirectTarget({
      from: null,
      redirectParam: '//evil.example.com/steal',
      fallback: '/dashboard',
    });
    expect(result).toBe('/dashboard');
  });

  it('blocks javascript: scheme in redirect param', () => {
    const result = resolveAuthRedirectTarget({
      from: null,
      redirectParam: 'javascript:alert(1)',
      fallback: '/dashboard',
    });
    expect(result).toBe('/dashboard');
  });

  it('blocks /auth loop target and falls back', () => {
    const result = resolveAuthRedirectTarget({
      from: { pathname: '/auth', search: '?type=login' },
      redirectParam: '/auth#foo',
      fallback: '/dashboard',
    });
    expect(result).toBe('/dashboard');
  });

  it('blocks /auth/subpath as loop target', () => {
    const result = resolveAuthRedirectTarget({
      from: null,
      redirectParam: '/auth/callback',
      fallback: '/erstanmeldung',
    });
    expect(result).toBe('/erstanmeldung');
  });

  it('uses fallback when nothing else is valid', () => {
    const result = resolveAuthRedirectTarget({
      from: null,
      redirectParam: null,
      fallback: '/dashboard',
    });
    expect(result).toBe('/dashboard');
  });

  it('returns "/" when even the fallback is unsafe', () => {
    const result = resolveAuthRedirectTarget({
      from: null,
      redirectParam: null,
      fallback: 'https://evil.example.com',
    });
    expect(result).toBe('/');
  });
});
