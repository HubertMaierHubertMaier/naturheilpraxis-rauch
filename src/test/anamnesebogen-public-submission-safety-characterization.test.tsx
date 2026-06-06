import type React from "react";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
} = vi.hoisted(() => ({
  mockUseAnamnesePublic: vi.fn(),
  mockUseAnamneseEnabled: vi.fn(),
  mockUseAuth: vi.fn(),
  mockSupabaseInvoke: vi.fn(),
  mockToastError: vi.fn(),
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
    success: vi.fn(),
    warning: vi.fn(),
  },
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
  mockToastError.mockReset();
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
});
