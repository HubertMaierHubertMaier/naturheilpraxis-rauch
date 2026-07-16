export const ANAMNESIS_DRAFT_TTL_MS = 8 * 60 * 60 * 1000;

type StoredDraft<T> = {
  data: T;
  expiresAt: number;
};

export const removeAnamnesisSessionDraft = (storage: Storage, key: string) => {
  try {
    storage.removeItem(key);
  } catch {
    // Storage may be unavailable in hardened browser contexts.
  }
};

export const purgeLegacyAnamnesisStorage = (storage: Storage) => {
  for (let index = storage.length - 1; index >= 0; index -= 1) {
    const key = storage.key(index);
    if (key?.startsWith("anamnesebogen:draft:") || key?.startsWith("anamnesebogen:email-cache:")) {
      storage.removeItem(key);
    }
  }
};

export const readAnamnesisSessionDraft = <T>(storage: Storage, key: string, now = Date.now()): StoredDraft<T> | null => {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredDraft<T>>;
    if (!("data" in parsed) || typeof parsed.expiresAt !== "number" || !Number.isFinite(parsed.expiresAt) || parsed.expiresAt <= now) {
      removeAnamnesisSessionDraft(storage, key);
      return null;
    }
    return parsed as StoredDraft<T>;
  } catch {
    removeAnamnesisSessionDraft(storage, key);
    return null;
  }
};

export const writeAnamnesisSessionDraft = <T>(
  storage: Storage,
  key: string,
  data: T,
  expiresAt: number,
  now = Date.now(),
) => {
  if (!Number.isFinite(expiresAt) || expiresAt <= now) {
    removeAnamnesisSessionDraft(storage, key);
    return false;
  }
  try {
    storage.setItem(key, JSON.stringify({ data, expiresAt } satisfies StoredDraft<T>));
    return true;
  } catch {
    return false;
  }
};
