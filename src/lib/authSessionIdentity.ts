type SessionIdentity = { access_token?: string; user?: { id?: string } } | null | undefined;

function sessionId(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const encoded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "=")));
    return typeof payload.session_id === "string" && payload.session_id.trim() ? payload.session_id : null;
  } catch { return null; }
}

/** Identity comparison only; never an authorization check. Role and 2FA RPCs still run. */
export function sameAuthenticatedSession(previous: SessionIdentity, next: SessionIdentity): boolean {
  if (!previous?.user?.id || previous.user.id !== next?.user?.id || !previous.access_token || !next.access_token) return false;
  if (previous.access_token === next.access_token) return true;
  const before = sessionId(previous.access_token);
  return before !== null && before === sessionId(next.access_token);
}
