import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Header } from "@/components/layout/Header";

const mockUseAuth = vi.fn();
const mockUseAnamneseEnabled = vi.fn();
const mockUseAnamnesePublic = vi.fn();
const mockToast = vi.fn();
const mockIsDevHost = vi.fn();
const mockIsDevAdminBypassActive = vi.fn();
const mockWithDevParam = vi.fn((path: string) => path);

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    language: "de",
    setLanguage: vi.fn(),
    t: (de: string, _en: string) => de,
  }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/hooks/useAnamneseEnabled", () => ({
  useAnamneseEnabled: () => mockUseAnamneseEnabled(),
}));

vi.mock("@/hooks/useAnamnesePublic", () => ({
  useAnamnesePublic: () => mockUseAnamnesePublic(),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock("@/lib/devAdminBypass", () => ({
  activateDevAdminBypass: vi.fn(),
  clearDevAdminBypass: vi.fn(),
  isDevAdminBypassActive: () => mockIsDevAdminBypassActive(),
  isDevHost: () => mockIsDevHost(),
  withDevParam: (path: string) => mockWithDevParam(path),
}));

vi.mock("@/components/LanguageSwitcher", () => ({
  LanguageSwitcher: ({ className }: { className?: string }) => (
    <div data-testid="language-switcher" className={className} />
  ),
}));

vi.mock("@/components/layout/InfothekDropdown", () => ({
  InfothekDropdown: ({ isMobile }: { isMobile?: boolean }) => (
    <div data-testid={isMobile ? "infothek-mobile" : "infothek-desktop"} />
  ),
}));

function renderHeader() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Header />
    </MemoryRouter>
  );
}

beforeEach(() => {
  mockToast.mockClear();
  mockIsDevHost.mockReturnValue(false);
  mockIsDevAdminBypassActive.mockReturnValue(false);
  mockWithDevParam.mockImplementation((path: string) => path);
  mockUseAnamneseEnabled.mockReturnValue({
    enabled: true,
    loading: false,
    refresh: vi.fn(),
  });
  mockUseAnamnesePublic.mockReturnValue({
    enabled: false,
    loading: false,
    refresh: vi.fn(),
  });
  mockUseAuth.mockReturnValue({
    user: null,
    loading: false,
    signOut: vi.fn(),
    isAdmin: false,
  });
});

describe("Header Anamnese navigation smoke test", () => {
  it("shows the blank anamnesis PDF download for anonymous visitors when anamnesis is enabled and public access is disabled", () => {
    renderHeader();

    const pdfDownload = screen.getByRole("link", { name: /Anamnesebogen \(PDF\)/i });

    expect(pdfDownload).toHaveAttribute("href", "/anamnesebogen-blanko.pdf");
    expect(pdfDownload).toHaveAttribute("download");
    expect(
      screen.queryByRole("link", { name: /^Anamnesebogen$/i })
    ).not.toBeInTheDocument();
  });

  it("shows the online anamnesis link for anonymous visitors when public access is enabled", () => {
    mockUseAnamnesePublic.mockReturnValue({
      enabled: true,
      loading: false,
      refresh: vi.fn(),
    });

    renderHeader();

    const onlineLink = screen.getByRole("link", { name: /^Anamnesebogen$/i });

    expect(onlineLink).toHaveAttribute("href", "/anamnesebogen");
    expect(onlineLink).not.toHaveAttribute("download");
    expect(
      screen.queryByRole("link", { name: /Anamnesebogen \(PDF\)/i })
    ).not.toBeInTheDocument();
  });

  it("shows the online anamnesis link for authenticated patients when anamnesis is enabled", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "test-user" },
      loading: false,
      signOut: vi.fn(),
      isAdmin: false,
    });

    renderHeader();

    const onlineLink = screen.getByRole("link", { name: /^Anamnesebogen$/i });

    expect(onlineLink).toHaveAttribute("href", "/anamnesebogen");
    expect(
      screen.queryByRole("link", { name: /Anamnesebogen \(PDF\)/i })
    ).not.toBeInTheDocument();
  });

  it("shows the online anamnesis link with locked marker for admins when anamnesis is disabled", () => {
    mockUseAnamneseEnabled.mockReturnValue({
      enabled: false,
      loading: false,
      refresh: vi.fn(),
    });
    mockUseAuth.mockReturnValue({
      user: { id: "admin-user" },
      loading: false,
      signOut: vi.fn(),
      isAdmin: true,
    });

    renderHeader();

    const lockedOnlineLink = screen.getByRole("link", {
      name: /Anamnesebogen\s+gesperrt/i,
    });

    expect(lockedOnlineLink).toHaveAttribute("href", "/anamnesebogen");
    expect(screen.getByText("gesperrt")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Anamnesebogen \(PDF\)/i })
    ).not.toBeInTheDocument();
  });
});
