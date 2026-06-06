import type React from "react";
import { fireEvent, screen, waitFor } from "@testing-library/react";
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
    (window as any).ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  if (!("elementFromPoint" in document)) {
    (document as any).elementFromPoint = () => null;
  }
});

beforeEach(() => {
  mockUseAuth.mockReturnValue({
    user: null,
    loading: false,
    signOut: vi.fn(),
    isAdmin: false,
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
  it("does not invoke the anamnesis submission function for an anonymous visitor before required fields are valid", async () => {
    renderAppAtRoute("/anamnesebogen");

    expect(window.location.pathname).toBe("/anamnesebogen");
    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: /Wie möchten Sie das Formular ausfüllen\?/i,
      })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText("Alle Bereiche sichtbar"));

    expect(
      await screen.findByRole("button", { name: /Anamnesebogen absenden/i })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Anamnesebogen absenden/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        "Bitte füllen Sie alle Pflichtfelder aus (Name, Adresse, E-Mail)"
      );
    });
    expect(mockSupabaseInvoke).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe("/anamnesebogen");

    await expectNoAppSmokeConsoleWarnings();
  });

  it("starts the public online submission verification path for an anonymous visitor with synthetic valid form data", async () => {
    renderAppAtRoute("/anamnesebogen");

    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: /Wie möchten Sie das Formular ausfüllen\?/i,
      })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText("Alle Bereiche sichtbar"));
    fireEvent.click(await screen.findByRole("button", { name: /I\. Patientendaten/i }));
    fireEvent.click(await screen.findByRole("button", { name: /XXV\. Unterschrift/i }));
    fireEvent.click(await screen.findByRole("button", { name: "Synthetische Pflichtfelder setzen" }));
    fireEvent.click(screen.getByRole("button", { name: "Synthetische Signaturfreigaben setzen" }));
    fireEvent.click(screen.getByRole("button", { name: /Anamnesebogen absenden/i }));

    await waitFor(() => {
      expect(mockSupabaseInvoke).toHaveBeenCalledWith("submit-anamnesis", {
        body: expect.objectContaining({
          action: "submit",
          email: "synthetic-anamnese@example.invalid",
          tempUserId: undefined,
          formData: expect.objectContaining({
            nachname: "Testperson",
            vorname: "Synthetisch",
            email: "synthetic-anamnese@example.invalid",
            unterschrift: expect.objectContaining({
              bestaetigung: true,
              datenschutzEinwilligung: true,
              patientenaufklaerungAkzeptiert: true,
            }),
          }),
        }),
      });
    });

    expect(mockToastError).not.toHaveBeenCalled();
    expect(mockToastSuccess).toHaveBeenCalledWith(
      "Bestätigungscode gesendet!",
      expect.objectContaining({
        description: "Ein 6-stelliger Code wurde an synthetic-anamnese@example.invalid gesendet.",
      })
    );
    expect(window.location.pathname).toBe("/anamnesebogen");

    await expectNoAppSmokeConsoleWarnings();
  });
});
