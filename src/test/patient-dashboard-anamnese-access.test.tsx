import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import PatientDashboard from "@/pages/PatientDashboard";

const mockUseAuth = vi.fn();
const mockUseLanguage = vi.fn();
const mockUsePatientAccess = vi.fn();
const mockSupabaseFrom = vi.fn();

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => mockUseLanguage(),
}));

vi.mock("@/hooks/usePatientAccess", () => ({
  usePatientAccess: () => mockUsePatientAccess(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mockSupabaseFrom(...args),
  },
}));

vi.mock("@/components/layout/Layout", () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));

vi.mock("@/components/seo/SEOHead", () => ({
  default: () => null,
}));

vi.mock("@/lib/pdfExportEnhanced", () => ({
  generateEnhancedAnamnesePdf: vi.fn(),
}));

beforeEach(() => {
  mockUseLanguage.mockReturnValue({
    language: "de",
    t: (de: string) => de,
  });
  mockUseAuth.mockReturnValue({
    user: { id: "user-1", email: "redshift-three@gmx.com" },
    loading: false,
    twoFactorVerified: true,
    twoFactorChecked: true,
  });
  mockUsePatientAccess.mockReturnValue({
    canDownloadAnamnese: false,
    loading: false,
  });
  mockSupabaseFrom.mockImplementation(() => ({
    select: () => ({
      order: () => ({
        data: [
          {
            id: "submission-1",
            status: "verified",
            submitted_at: "2026-03-18T10:50:00.000Z",
            updated_at: "2026-03-18T10:51:00.000Z",
            form_data: {
              vorname: "Reinhardt",
              nachname: "Maier",
              geburtsdatum: "1975-03-09",
            },
          },
        ],
        error: null,
      }),
    }),
  }));
});

describe("PatientDashboard anamnesis access gating", () => {
  it("hides the anamnesis action tile and PDF download button when no anamnesis access is granted", async () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <PatientDashboard />
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: /Willkommen zurück/i })).toBeInTheDocument();
    expect(screen.queryByText(/Anamnesebogen ergänzen/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /PDF herunterladen/i })).not.toBeInTheDocument();
  });
});
