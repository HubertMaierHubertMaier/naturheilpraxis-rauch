import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProtectedRoute from "@/components/ProtectedRoute";

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
    loading: true,
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
      <p data-testid="redirect-from-hash">{from?.hash ?? ""}</p>
    </main>
  );
}

describe("ProtectedRoute smoke test", () => {
  it("shows an accessible authentication status while auth state is loading", () => {
    render(
      <MemoryRouter
        initialEntries={["/erstanmeldung"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <ProtectedRoute>
          <div>Geschützter Inhalt</div>
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(
      screen.getByRole("status", { name: /Authentifizierung wird geprüft/i })
    ).toBeInTheDocument();
    expect(screen.queryByText(/Geschützter Inhalt/i)).not.toBeInTheDocument();
  });

  it("redirects unauthenticated visitors to auth and preserves the intended route", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
    });

    render(
      <MemoryRouter
        initialEntries={["/erstanmeldung?termin=erstgespraech#formular"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route
            path="/erstanmeldung"
            element={
              <ProtectedRoute>
                <div>Geschützter Inhalt</div>
              </ProtectedRoute>
            }
          />
          <Route path="/auth" element={<AuthRouteStateProbe />} />
        </Routes>
      </MemoryRouter>
    );

    expect(
      screen.getByRole("main", { name: /Authentifizierung/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Login erforderlich/i })).toBeInTheDocument();
    expect(screen.queryByText(/Geschützter Inhalt/i)).not.toBeInTheDocument();
    expect(screen.getByTestId("redirect-from-pathname")).toHaveTextContent(
      "/erstanmeldung"
    );
    expect(screen.getByTestId("redirect-from-search")).toHaveTextContent(
      "?termin=erstgespraech"
    );
    expect(screen.getByTestId("redirect-from-hash")).toHaveTextContent("#formular");
  });
});
