import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AnamneseRouteGuard from "@/components/AnamneseRouteGuard";

const mockUseAuth = vi.fn();
const mockIsDevAdminBypassActive = vi.fn();

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/lib/devAdminBypass", () => ({
  isDevAdminBypassActive: () => mockIsDevAdminBypassActive(),
}));

beforeEach(() => {
  mockIsDevAdminBypassActive.mockReturnValue(false);
  mockUseAuth.mockReturnValue({
    user: null,
    loading: false,
  });
});

function AuthRouteStateProbe() {
  const location = useLocation();
  const from = location.state?.from;

  return (
    <main aria-label="Authentifizierung">
      <h1>Login erforderlich</h1>
      <p data-testid="redirect-from-pathname">{from?.pathname ?? ""}</p>
      <p data-testid="redirect-from-search">{from?.search ?? ""}</p>
    </main>
  );
}

function renderGuard(initialPath = "/anamnesebogen?schritt=kontakt") {
  return render(
    <MemoryRouter
      initialEntries={[initialPath]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route
          path="/anamnesebogen"
          element={
            <AnamneseRouteGuard>
              <main aria-label="Anamnesebogen">
                <h1>Anamnesebogen Testinhalt</h1>
              </main>
            </AnamneseRouteGuard>
          }
        />
        <Route path="/auth" element={<AuthRouteStateProbe />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("AnamneseRouteGuard smoke test", () => {
  it("shows an accessible loading status while authentication is loading", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: true,
      twoFactorVerified: false,
      twoFactorChecked: true,
    });

    renderGuard();

    expect(
      screen.getByRole("status", { name: /Authentifizierung wird geprüft/i })
    ).toBeInTheDocument();
    expect(screen.queryByText(/Anamnesebogen Testinhalt/i)).not.toBeInTheDocument();
  });

  it("still blocks anonymous visitors even if an old public setting exists", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      twoFactorVerified: false,
      twoFactorChecked: true,
    });

    renderGuard();

    expect(
      screen.getByRole("main", { name: /Authentifizierung/i })
    ).toBeInTheDocument();
    expect(screen.queryByText(/Anamnesebogen Testinhalt/i)).not.toBeInTheDocument();
  });

  it("falls back to auth redirect and preserves the intended route when public access is disabled", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      twoFactorVerified: false,
      twoFactorChecked: true,
    });

    renderGuard();

    expect(
      screen.getByRole("main", { name: /Authentifizierung/i })
    ).toBeInTheDocument();
    expect(screen.queryByText(/Anamnesebogen Testinhalt/i)).not.toBeInTheDocument();
    expect(screen.getByTestId("redirect-from-pathname")).toHaveTextContent(
      "/anamnesebogen"
    );
    expect(screen.getByTestId("redirect-from-search")).toHaveTextContent(
      "?schritt=kontakt"
    );
  });
});
