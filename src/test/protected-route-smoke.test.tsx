import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
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
});
