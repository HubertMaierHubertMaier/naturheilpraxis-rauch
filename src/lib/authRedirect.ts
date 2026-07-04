/**
 * Safe post-auth redirect resolver.
 *
 * Priority:
 *   1. location.state.from  (Location-like object from ProtectedRoute)
 *   2. ?redirect=... query parameter
 *   3. fallback path
 *
 * Only internal paths are allowed. External URLs, protocol-relative URLs
 * and any /auth target are blocked to prevent auth loops.
 */

export interface LocationLike {
  pathname?: string;
  search?: string;
  hash?: string;
}

export interface ResolveAuthRedirectInput {
  from?: LocationLike | string | null;
  redirectParam?: string | null;
  fallback: string;
}

function isSafeInternalPath(path: string): boolean {
  if (!path || typeof path !== 'string') return false;
  // Must start with a single slash, must not be protocol-relative "//..."
  if (!path.startsWith('/')) return false;
  if (path.startsWith('//')) return false;
  if (path.startsWith('/\\')) return false;
  // Block absolute URLs sneaked in
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return false;
  return true;
}

function isAuthLoop(pathname: string): boolean {
  return pathname === '/auth' || pathname.startsWith('/auth/') || pathname.startsWith('/auth?') || pathname.startsWith('/auth#');
}

function fromLocationLike(loc: LocationLike): string | null {
  const pathname = loc.pathname ?? '';
  if (!isSafeInternalPath(pathname)) return null;
  if (isAuthLoop(pathname)) return null;
  return `${pathname}${loc.search ?? ''}${loc.hash ?? ''}`;
}

function fromString(raw: string): string | null {
  if (!isSafeInternalPath(raw)) return null;
  // Split pathname vs search/hash for auth-loop check
  const pathOnly = raw.split(/[?#]/)[0];
  if (isAuthLoop(pathOnly)) return null;
  return raw;
}

export function resolveAuthRedirectTarget({
  from,
  redirectParam,
  fallback,
}: ResolveAuthRedirectInput): string {
  if (from) {
    if (typeof from === 'string') {
      const resolved = fromString(from);
      if (resolved) return resolved;
    } else {
      const resolved = fromLocationLike(from);
      if (resolved) return resolved;
    }
  }

  if (redirectParam) {
    const resolved = fromString(redirectParam);
    if (resolved) return resolved;
  }

  if (isSafeInternalPath(fallback) && !isAuthLoop(fallback.split(/[?#]/)[0])) {
    return fallback;
  }

  return '/';
}
