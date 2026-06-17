import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AnamnesePublicToggle } from "@/components/admin/AnamnesePublicToggle";

const mockUseAnamnesePublic = vi.fn();

vi.mock("@/hooks/useAnamnesePublic", () => ({
  useAnamnesePublic: () => mockUseAnamnesePublic(),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: "synthetic-admin-id" } } })),
    },
    from: vi.fn(() => ({
      upsert: vi.fn(async () => ({ error: null })),
    })),
  },
}));

beforeEach(() => {
  mockUseAnamnesePublic.mockReturnValue({
    enabled: false,
    loading: false,
    refresh: vi.fn(),
  });
});

describe("AnamnesePublicToggle admin copy", () => {
  it("makes clear that public online anamnesis access is disabled", () => {
    render(<AnamnesePublicToggle />);

    expect(
      screen.getByText(/Online-Anamnesebogen – öffentlicher Zugriff deaktiviert/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText((_, element) =>
        element?.textContent ===
        "/anamnesebogen bleibt aus Datenschutz- und Sicherheitsgründen immer login-geschützt."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(/eine öffentliche Online-Übermittlung wird hier nicht mehr angeboten/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Login erforderlich/i)
    ).toBeInTheDocument();

    expect(screen.queryByText(/Jeder mit dem Link kann die Form öffnen/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Test-Modus/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/nur zum Ausprobieren/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Absenden\/Speichern funktioniert ohne Login NICHT/i)).not.toBeInTheDocument();
  });
});
