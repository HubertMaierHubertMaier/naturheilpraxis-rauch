import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AnamnesePublicToggle } from "@/components/admin/AnamnesePublicToggle";

const mockUseAnamneseOnlineEnabled = vi.fn();

vi.mock("@/hooks/useAnamneseOnlineEnabled", () => ({
  useAnamneseOnlineEnabled: () => mockUseAnamneseOnlineEnabled(),
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
  mockUseAnamneseOnlineEnabled.mockReturnValue({
    enabled: false,
    loading: false,
    refresh: vi.fn(),
  });
});

describe("AnamnesePublicToggle admin copy", () => {
  it("makes clear that the online anamnesis is blocked by the privacy kill switch", () => {
    render(<AnamnesePublicToggle />);

    expect(
      screen.getByText(/Online-Anamnesebogen – Datenschutz-Sperre/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText((_, element) =>
        element?.textContent ===
        "Steuert /anamnesebogen (Online-Formular) und die Edge-Function submit-anamnesis. Unabhängig vom PDF-Download."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText((_, element) =>
        element?.tagName === "P" &&
        (element.textContent ?? "").includes("Online-Eingabe ist für Patienten blockiert")
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Patienten sehen eine Hinweisseite mit Link zum PDF-Download/i)
    ).toBeInTheDocument();

    expect(screen.queryByText(/öffentlicher Zugriff deaktiviert/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/eine öffentliche Online-Übermittlung wird hier nicht mehr angeboten/i)).not.toBeInTheDocument();
  });
});
