import type React from "react";
import { screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
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

beforeAll(() => {
  if (!("ResizeObserver" in window)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
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
});

afterEach(() => {
  clearAppSmokeConsoleSpies();
  window.history.pushState({}, "", "/");
});

describe("/anamnesebogen public route characterization", () => {
  it("redirects anonymous visitors to auth even if an old public access setting is enabled", async () => {
    renderAppAtRoute("/anamnesebogen");

    await waitFor(() => {
      expect(window.location.pathname).toBe("/auth");
    });
    expect(screen.queryByRole("heading", { level: 1, name: /^Anamnesebogen$/i })).not.toBeInTheDocument();

    await expectNoAppSmokeConsoleWarnings();
  });

  it("does not surface the anonymous public submission flow", async () => {
    renderAppAtRoute("/anamnesebogen");

    await waitFor(() => expect(window.location.pathname).toBe("/auth"));
    expect(screen.queryByText(/Alle Bereiche sichtbar/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Anamnesebogen absenden/i })).not.toBeInTheDocument();
    await expectNoAppSmokeConsoleWarnings();
  });
});
