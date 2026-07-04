import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import AdminDashboard from "@/pages/AdminDashboard";
import PatientenManagerPage from "@/pages/PatientenManager";
import Wissensdatenbank from "@/pages/Wissensdatenbank";
import PatientDashboard from "@/pages/PatientDashboard";
import PatientenBibliothek from "@/pages/PatientenBibliothek";

const mockUseAuth = vi.fn();
const mockUseAdminCheck = vi.fn();
const mockIsDevAdminBypassActive = vi.fn();
const mockSupabaseFrom = vi.fn();

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/hooks/useAdminCheck", () => ({
  useAdminCheck: () => mockUseAdminCheck(),
}));

vi.mock("@/lib/devAdminBypass", () => ({
  isDevAdminBypassActive: () => mockIsDevAdminBypassActive(),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    language: "de",
    t: (de: string) => de,
  }),
}));

vi.mock("@/components/layout/Layout", () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));

vi.mock("@/components/seo/SEOHead", () => ({
  default: () => null,
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@/lib/pdfExportEnhanced", () => ({
  generateEnhancedAnamnesePdf: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mockSupabaseFrom(...args),
    storage: {
      from: () => ({
        createSignedUrl: vi.fn(),
      }),
    },
  },
}));

vi.mock("@/components/admin/FAQManager", () => ({ FAQManager: () => <div>FAQ manager</div> }));
vi.mock("@/components/admin/PracticeInfoManager", () => ({ PracticeInfoManager: () => <div>Practice info manager</div> }));
vi.mock("@/components/admin/PricingManager", () => ({ default: () => <div>Pricing manager</div> }));
vi.mock("@/components/admin/AuditLogManager", () => ({ AuditLogManager: () => <div>Audit log manager</div> }));
vi.mock("@/components/admin/ICD10Generator", () => ({ default: () => <div>ICD-10 generator</div> }));
vi.mock("@/components/admin/PatientManager", () => ({ PatientManager: () => <div>Patient manager</div> }));
vi.mock("@/components/admin/MannayanPriceManager", () => ({ default: () => <div>Mannayan manager</div> }));
vi.mock("@/components/admin/AIModelInfo", () => ({ AIModelInfo: () => <div>AI model info</div> }));
vi.mock("@/components/admin/PatientLibraryManager", () => ({ PatientLibraryManager: () => <div>Patient library manager</div> }));
vi.mock("@/components/admin/PatientLoginToggle", () => ({ PatientLoginToggle: () => <div>Patient login toggle</div> }));
vi.mock("@/components/admin/AnamneseToggle", () => ({ AnamneseToggle: () => <div>Anamnese toggle</div> }));
vi.mock("@/components/admin/AnamnesePublicToggle", () => ({ AnamnesePublicToggle: () => <div>Anamnese public toggle</div> }));
vi.mock("@/components/admin/KnowledgeBaseManager", () => ({ KnowledgeBaseManager: () => <div>Knowledge base manager</div> }));
vi.mock("@/components/admin/PathogenIndex", () => ({ PathogenIndex: () => <div>Pathogen index</div> }));
vi.mock("@/components/admin/TherapyRecommendation", () => ({ TherapyRecommendation: () => <div>Therapy recommendation</div> }));
vi.mock("@/components/admin/therapy/TherapyPatientOverview", () => ({ TherapyPatientOverview: () => <div>Therapy patient overview</div> }));
vi.mock("@/components/ErrorBoundary", () => ({ ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

function AuthProbe() {
  const location = useLocation();
  return (
    <main aria-label="Auth Ziel">
      <h1>Auth Ziel</h1>
      <p data-testid="auth-path">{location.pathname}</p>
    </main>
  );
}

function HomeProbe() {
  const location = useLocation();
  return (
    <main aria-label="Startseite Ziel">
      <h1>Startseite Ziel</h1>
      <p data-testid="home-path">{location.pathname}</p>
    </main>
  );
}

const anonymousAuthState = {
  user: null,
  loading: false,
  isAdmin: false,
  twoFactorVerified: false,
  twoFactorChecked: true,
  roleChecked: true,
};

const patientUser = {
  id: "synthetic-user-id",
  email: "patient@example.invalid",
};

function renderSensitiveRoute(path: string, element: React.ReactElement) {
  return render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path={path} element={element} />
        <Route path="/auth" element={<AuthProbe />} />
        <Route path="/" element={<HomeProbe />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  mockUseAuth.mockReturnValue(anonymousAuthState);
  mockUseAdminCheck.mockReturnValue({ isAdmin: false, isLoading: false });
  mockIsDevAdminBypassActive.mockReturnValue(false);
  mockSupabaseFrom.mockImplementation(() => ({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({ data: null, error: null }),
      }),
      order: () => ({
        order: () => ({
          order: async () => ({ data: [], error: null }),
        }),
      }),
    }),
  }));
});

describe("sensitive admin and patient route guard smoke tests", () => {
  it("redirects anonymous visitors from /admin to auth without rendering admin content", () => {
    renderSensitiveRoute("/admin", <AdminDashboard />);

    expect(screen.getByRole("heading", { name: /Auth Ziel/i })).toBeInTheDocument();
    expect(screen.getByTestId("auth-path")).toHaveTextContent("/auth");
    expect(screen.queryByRole("heading", { name: /Admin-Dashboard/i })).not.toBeInTheDocument();
  });

  it("denies non-admin authenticated users on /patienten without rendering patient manager content", () => {
    mockUseAuth.mockReturnValue({
      user: patientUser,
      loading: false,
      isAdmin: false,
      twoFactorVerified: false,
      twoFactorChecked: true,
      roleChecked: true,
    });

    renderSensitiveRoute("/patienten", <PatientenManagerPage />);

    expect(screen.getByRole("heading", { name: /Zugriff verweigert/i })).toBeInTheDocument();
    expect(screen.queryByText(/Patient manager/i)).not.toBeInTheDocument();
  });

  it("redirects non-admin authenticated users from /wissensdatenbank to the start page", () => {
    mockUseAuth.mockReturnValue({
      user: patientUser,
      loading: false,
      isAdmin: false,
      twoFactorVerified: false,
      twoFactorChecked: true,
      roleChecked: true,
    });

    renderSensitiveRoute("/wissensdatenbank", <Wissensdatenbank />);

    expect(screen.getByRole("heading", { name: /Startseite Ziel/i })).toBeInTheDocument();
    expect(screen.getByTestId("home-path")).toHaveTextContent("/");
    expect(screen.queryByText(/Knowledge base manager/i)).not.toBeInTheDocument();
  });

  it("redirects anonymous visitors from /dashboard to auth without rendering patient dashboard content", async () => {
    renderSensitiveRoute("/dashboard", <PatientDashboard />);

    expect(await screen.findByRole("heading", { name: /Auth Ziel/i })).toBeInTheDocument();
    expect(screen.getByTestId("auth-path")).toHaveTextContent("/auth");
    expect(screen.queryByRole("heading", { name: /Willkommen zurück/i })).not.toBeInTheDocument();
  });

  it("redirects anonymous visitors from /patienten-bibliothek to auth without rendering library content", () => {
    renderSensitiveRoute("/patienten-bibliothek", <PatientenBibliothek />);

    expect(screen.getByRole("heading", { name: /Auth Ziel/i })).toBeInTheDocument();
    expect(screen.getByTestId("auth-path")).toHaveTextContent("/auth");
    expect(screen.queryByRole("heading", { name: /Patienten-Bibliothek/i })).not.toBeInTheDocument();
  });
});
