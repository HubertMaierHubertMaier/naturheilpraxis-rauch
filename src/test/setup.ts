import "@testing-library/jest-dom";
import { vi } from "vitest";

vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "test-publishable-key");

function createSupabaseQueryChain() {
  const manyResult = { data: [], error: null };
  const singleResult = { data: null, error: null };

  const chain: {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    or: ReturnType<typeof vi.fn>;
    then: PromiseLike<typeof manyResult>["then"];
  } = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => singleResult),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    single: vi.fn(async () => singleResult),
    upsert: vi.fn(async () => ({ error: null })),
    insert: vi.fn(async () => ({ error: null })),
    update: vi.fn(async () => ({ error: null })),
    delete: vi.fn(async () => ({ error: null })),
    or: vi.fn(() => chain),
    then: (resolve, reject) => Promise.resolve(manyResult).then(resolve, reject),
  };

  return chain;
}

const supabaseDefaultMock = {
  auth: {
    getSession: vi.fn(async () => ({ data: { session: null } })),
    onAuthStateChange: vi.fn(() => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    })),
    signOut: vi.fn(async () => ({ error: null })),
    getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
    verifyOtp: vi.fn(async () => ({ data: null, error: null })),
    signInWithPassword: vi.fn(async () => ({ data: { user: null }, error: null })),
  },
  rpc: vi.fn(async (name: string) => {
    if (name === "get_public_app_setting") return { data: { enabled: false }, error: null };
    if (name === "has_role") return { data: false, error: null };
    if (name === "get_my_patient_access") return { data: null, error: null };
    return { data: null, error: null };
  }),
  from: vi.fn(() => createSupabaseQueryChain()),
  functions: {
    invoke: vi.fn(async () => ({ data: {}, error: null })),
  },
  storage: {
    from: vi.fn(() => ({
      createSignedUrl: vi.fn(async () => ({
        data: { signedUrl: "https://example.com/signed.pdf" },
        error: null,
      })),
    })),
  },
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: supabaseDefaultMock,
}));

window.localStorage.setItem("cookie-consent", "accepted");

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
