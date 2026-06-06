import type React from "react";
import { screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAppSmokeConsoleSpies,
  expectNoAppSmokeConsoleWarnings,
  renderAppAtRoute,
} from "./appSmokeTestUtils";

const mockUseAnamnesePublic = vi.fn();
const mockUseAnamneseEnabled = vi.fn();
const mockUseAuth = vi.fn();

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
});

afterEach(() => {
  clearAppSmokeConsoleSpies();
  window.history.pushState({}, "", "/");
});

describe("/anamnesebogen public route characterization", () => {
  it("renders the online anamnesis form route for anonymous visitors when public access is enabled", async () => {
    renderAppAtRoute("/anamnesebogen");

    expect(window.location.pathname).toBe("/anamnesebogen");
    expect(
      screen.getByRole("heading", { level: 1, name: /^Anamnesebogen$/i })
    ).toBeInTheDocument();

    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: /Wie möchten Sie das Formular ausfüllen\?/i,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: /Hinweis zur öffentlichen Online-Übermittlung/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Beim Absenden werden Ihre Angaben an die Naturheilpraxis übermittelt/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Danach erhalten Sie einen E-Mail-Code zur Verifizierung/i)
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText(/^Wird geladen\.\.\.$/i)).not.toBeInTheDocument();
    });
    expect(screen.queryByRole("status", { name: /Anamnese-Zugriff wird geprüft/i })).not.toBeInTheDocument();
    expect(window.location.pathname).toBe("/anamnesebogen");

    await expectNoAppSmokeConsoleWarnings();
  });
});
