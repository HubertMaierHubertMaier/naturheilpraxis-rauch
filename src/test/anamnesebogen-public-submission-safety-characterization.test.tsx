import type React from "react";
import { screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAppSmokeConsoleSpies,
  expectNoAppSmokeConsoleWarnings,
  renderAppAtRoute,
} from "./appSmokeTestUtils";

const {
  mockUseAnamnesePublic,
  mockUseAnamneseEnabled,
  mockUseAuth,
  mockSupabaseInvoke,
  mockToastError,
  mockToastSuccess,
} = vi.hoisted(() => ({
  mockUseAnamnesePublic: vi.fn(),
  mockUseAnamneseEnabled: vi.fn(),
  mockUseAuth: vi.fn(),
  mockSupabaseInvoke: vi.fn(),
  mockToastError: vi.fn(),
  mockToastSuccess: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/hooks/useAnamnesePublic", () => ({
  useAnamnesePublic: () => mockUseAnamnesePublic(),
}));

vi.mock("@/hooks/useAnamneseEnabled", () => ({
  useAnamneseEnabled: () => mockUseAnamneseEnabled(),
}));

vi.mock("@/hooks/useContentProtection", () => ({
  useContentProtection: vi.fn(),
}));

vi.mock("@/hooks/usePatientLoginEnabled", () => ({
  usePatientLoginEnabled: () => ({
    enabled: true,
    loading: false,
    refresh: vi.fn(),
  }),
}));

vi.mock("sonner", () => ({
  Toaster: () => null,
  toast: {
    error: mockToastError,
    success: mockToastSuccess,
    warning: vi.fn(),
  },
}));

vi.mock("@/components/anamnese/PatientDataSection", () => ({
  default: ({ updateFormData }: { updateFormData: (field: string, value: unknown) => void }) => (
    <button
      type="button"
      onClick={() => {
        updateFormData("nachname", "Testperson");
        updateFormData("vorname", "Synthetisch");
        updateFormData("geburtsdatum", "1980-01-01");
        updateFormData("strasse", "Testweg 1");
        updateFormData("plz", "00000");
        updateFormData("wohnort", "Teststadt");
        updateFormData("mobil", "+490000000000");
        updateFormData("email", "synthetic-anamnese@example.invalid");
      }}
    >
      Synthetische Pflichtfelder setzen
    </button>
  ),
}));

vi.mock("@/components/anamnese/SignatureSection", () => ({
  default: ({ updateFormData }: { updateFormData: (field: string, value: unknown) => void }) => (
    <button
      type="button"
      onClick={() => {
        updateFormData("unterschrift", {
          bestaetigung: true,
          datenschutzEinwilligung: true,
          patientenaufklaerungAkzeptiert: true,
          nameInDruckbuchstaben: "SYNTHETISCH TESTPERSON",
          datum: "2026-06-06",
          ort: "Teststadt",
        });
      }}
    >
      Synthetische Signaturfreigaben setzen
    </button>
  ),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: mockSupabaseInvoke,
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(async () => ({ data: [], count: 0, error: null })),
            })),
          })),
        })),
      })),
      insert: vi.fn(async () => ({ data: null, error: null })),
    })),
  },
}));

beforeAll(() => {
  if (!("ResizeObserver" in window)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  if (!("elementFromPoint" in document)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (document as any).elementFromPoint = () => null;
  }
});

beforeEach(() => {
  mockUseAuth.mockReturnValue({
    user: null,
    loading: false,
    signOut: vi.fn(),
    isAdmin: false,
    twoFactorVerified: false,
    twoFactorChecked: true,
  });
  mockUseAnamnesePublic.mockReturnValue({
    enabled: true,
    loading: false,
  });
  mockUseAnamneseEnabled.mockReturnValue({
    enabled: true,
    loading: false,
    refresh: vi.fn(),
  });
  mockSupabaseInvoke.mockReset();
  mockSupabaseInvoke.mockResolvedValue({
    data: {
      success: true,
      submissionId: "synthetic-submission-id",
      tempUserId: "synthetic-temp-user-id",
    },
    error: null,
  });
  mockToastError.mockReset();
  mockToastSuccess.mockReset();
});

afterEach(() => {
  clearAppSmokeConsoleSpies();
  window.history.pushState({}, "", "/");
  localStorage.clear();
});

describe("/anamnesebogen public submission safety characterization", () => {
  it("does not render the form or invoke submission for anonymous visitors", async () => {
    renderAppAtRoute("/anamnesebogen");

    await waitFor(() => {
      expect(window.location.pathname).toBe("/auth");
    });
    expect(screen.queryByRole("button", { name: /Anamnesebogen absenden/i })).not.toBeInTheDocument();
    expect(mockSupabaseInvoke).not.toHaveBeenCalled();

    await expectNoAppSmokeConsoleWarnings();
  });

  it("does not start the public online submission verification path for anonymous visitors", async () => {
    renderAppAtRoute("/anamnesebogen");

    await waitFor(() => expect(window.location.pathname).toBe("/auth"));

    expect(mockSupabaseInvoke).not.toHaveBeenCalled();
    expect(mockToastError).not.toHaveBeenCalled();
    expect(mockToastSuccess).not.toHaveBeenCalled();

    await expectNoAppSmokeConsoleWarnings();
  });
});
