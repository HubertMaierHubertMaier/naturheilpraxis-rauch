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
    enabled: true,
    loading: false,
    refresh: vi.fn(),
  });
});

describe("AnamnesePublicToggle admin copy", () => {
  it("describes enabled public access as a real online submission path with verification instead of a test-only mode", () => {
    render(<AnamnesePublicToggle />);

    expect(
      screen.getByText(/Online-Anamnesebogen – Öffentliche Online-Übermittlung/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText((_, element) =>
        element?.textContent ===
        "Öffnet /anamnesebogen ohne Login und ermöglicht die Online-Übermittlung mit E-Mail-Code-Verifizierung."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Jeder mit dem Link kann die Form öffnen und den Übermittlungspfad starten/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Nur nach fachlicher Freigabe und DSGVO-\/Rechtsprüfung aktiviert lassen/i)
    ).toBeInTheDocument();

    expect(screen.queryByText(/Test-Modus/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/nur zum Ausprobieren/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Absenden\/Speichern funktioniert ohne Login NICHT/i)).not.toBeInTheDocument();
  });
});
