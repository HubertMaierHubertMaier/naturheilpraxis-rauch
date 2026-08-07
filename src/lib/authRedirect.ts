export interface RedirectLocationLike {
  pathname?: string | null;
  search?: string | null;
  hash?: string | null;
}

function normalizeInternalRedirectTarget(rawTarget: string | null | undefined): string | null {
  if (!rawTarget) {
    return null;
  }

  const trimmedTarget = rawTarget.trim();
  if (!trimmedTarget.startsWith("/") || trimmedTarget.startsWith("//")) {
    return null;
  }

  try {
    const url = new URL(trimmedTarget, "https://naturheilpraxis-rauch.local");
    const normalizedTarget = `${url.pathname}${url.search}${url.hash}`;

    if (
      normalizedTarget === "/auth" ||
      normalizedTarget.startsWith("/auth?") ||
      normalizedTarget.startsWith("/auth#")
    ) {
      return null;
    }

    return normalizedTarget;
  } catch {
    return null;
  }
}

function buildLocationRedirectTarget(location: RedirectLocationLike | null | undefined): string | null {
  if (!location?.pathname) {
    return null;
  }

  return normalizeInternalRedirectTarget(
    `${location.pathname}${location.search ?? ""}${location.hash ?? ""}`,
  );
}

export function resolveAuthRedirectTarget({
  stateFrom,
  redirectParam,
  fallbackPath,
}: {
  stateFrom?: RedirectLocationLike | null;
  redirectParam?: string | null;
  fallbackPath: string;
}): string {
  return (
    buildLocationRedirectTarget(stateFrom) ??
    normalizeInternalRedirectTarget(redirectParam) ??
    normalizeInternalRedirectTarget(fallbackPath) ??
    "/"
  );
}
