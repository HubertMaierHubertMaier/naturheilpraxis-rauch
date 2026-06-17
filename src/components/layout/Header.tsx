import { useState, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, Leaf, LogIn, LogOut, User, Shield, BookOpen, ShieldCheck, Library, LayoutGrid, ChevronDown, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { translations } from "@/lib/translations";
import { useToast } from "@/hooks/use-toast";
import { InfothekDropdown } from "./InfothekDropdown";
import { activateDevAdminBypass, clearDevAdminBypass, isDevAdminBypassActive, isDevHost, withDevParam } from "@/lib/devAdminBypass";
import { useAnamneseEnabled } from "@/hooks/useAnamneseEnabled";
import { useAnamnesePublic } from "@/hooks/useAnamnesePublic";
import { usePatientAccess } from "@/hooks/usePatientAccess";

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user, loading, signOut, isAdmin } = useAuth();
  const { toast } = useToast();
  const nav = translations.nav;
  const header = translations.header;
  const { enabled: anamnesePublic } = useAnamnesePublic();
  const { canDownloadAnamnese } = usePatientAccess();
  // Anamnese im Header sichtbar, wenn: globaler Public-Modus ODER Admin ODER individuelle E-Mail-Freigabe
  const showAnamnese = anamnesePublic || isAdmin || canDownloadAnamnese;
  const showOnlineAnamnese = isAdmin || anamnesePublic || canDownloadAnamnese;

  const allowDevMode = isDevHost();
  const devActive = isDevAdminBypassActive();
  const showDevButton = allowDevMode && !isAdmin && !devActive;
  // Show dev logout whenever dev bypass is active (independent of Supabase user)
  const showDevLogout = allowDevMode && devActive;
  
  const activateDevMode = useCallback(() => {
    activateDevAdminBypass();
    window.location.search = '?dev=true';
  }, []);

  const deactivateDevMode = useCallback(() => {
    clearDevAdminBypass();
    // Strip ?dev=true from URL and reload
    window.location.href = window.location.pathname;
  }, []);

  const navItems = [
    { label: "✨ Neupatient", href: "/neupatient" },
    // Patienten-Verwaltung in Admin-Bereich verschoben (siehe Quick-Access / Admin-Dropdown)
  ];

  const quickAccessItems = isAdmin
    ? [
        { label: "Admin", href: withDevParam("/admin"), icon: Shield },
        { label: "Wiki", href: withDevParam("/wissensdatenbank"), icon: BookOpen },
        { label: "Bibliothek", href: withDevParam("/patienten-bibliothek"), icon: Library },
      ]
    : user
      ? [
          { label: "Dashboard", href: "/dashboard", icon: User },
          { label: "Bibliothek", href: "/patienten-bibliothek", icon: Library },
        ]
      : [];

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: t("Abgemeldet", "Signed Out"),
      description: t("Sie wurden erfolgreich abgemeldet.", "You have been successfully signed out."),
    });
    navigate("/");
    setIsMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container flex h-16 items-center justify-between md:h-20">
        <Link to="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary">
            <Leaf className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="font-serif text-lg font-semibold leading-tight text-foreground">
              {t(header.practice.de, header.practice.en)}
            </span>
            <span className="text-xs text-muted-foreground">{header.owner.de}</span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-1 lg:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-sage-100 hover:text-primary",
                location.pathname === item.href
                  ? "bg-sage-100 text-primary"
                  : "text-muted-foreground"
              )}
            >
              {item.label}
            </Link>
          ))}
          
          {/* Infothek Dropdown */}
          <InfothekDropdown />

          {/* Anamnesebogen – eingeloggte Patienten/Admins oder public-enabled: Online-Form; sonst: PDF-Download */}
          {showAnamnese && (showOnlineAnamnese ? (
            <Link
              to="/anamnesebogen"
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-sage-100 hover:text-primary",
                location.pathname === "/anamnesebogen"
                  ? "bg-sage-100 text-primary"
                  : "text-muted-foreground"
              )}
            >
              <ClipboardList className="h-4 w-4" />
              {t("Anamnesebogen", "Anamnesis Form")}
              {!anamneseEnabled && isAdmin && (
                <span className="ml-1 rounded bg-red-100 px-1 text-[10px] text-red-700">gesperrt</span>
              )}
            </Link>
          ) : (
            <a
              href="/anamnesebogen-blanko.pdf"
              download
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-sage-100 hover:text-primary"
              title={t("Vollständigen Blanko-Anamnesebogen als PDF herunterladen", "Download complete blank anamnesis form as PDF")}
            >
              <ClipboardList className="h-4 w-4" />
              {t("Anamnesebogen (PDF)", "Anamnesis Form (PDF)")}
            </a>
          ))}

          
          <LanguageSwitcher className="ml-2" />

          {/* Dev Mode Activate Button - only in non-production when not yet active */}
          {showDevButton && (
            <Button
              variant="outline"
              size="sm"
              onClick={activateDevMode}
              className="ml-2 gap-1 border-amber-400 text-amber-600 hover:bg-amber-50 hover:text-amber-700"
            >
              <Shield className="h-3.5 w-3.5" />
              Admin
            </Button>
          )}

          {/* Dev Mode Deactivate Button - shows when dev bypass active without real user */}
          {showDevLogout && (
            <Button
              variant="outline"
              size="sm"
              onClick={deactivateDevMode}
              className="ml-2 gap-1 border-amber-400 text-amber-700 hover:bg-amber-50"
            >
              <LogOut className="h-3.5 w-3.5" />
              Dev-Modus beenden
            </Button>
          )}
          
          {/* Auth Button Desktop */}
          {user ? (
            <div className="ml-2 flex items-center gap-2">
              {isAdmin && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800"
                    >
                      <span className="h-2 w-2 rounded-full bg-red-500" aria-hidden />
                      <Shield className="h-4 w-4" />
                      Admin
                      <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 bg-background">
                    <DropdownMenuLabel>Admin-Bereich</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to={withDevParam("/dashboard")} className="flex items-center gap-2 cursor-pointer">
                        <span className="h-2 w-2 rounded-full bg-blue-500" aria-hidden />
                        <User className="h-4 w-4" />
                        Dashboard
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to={withDevParam("/patienten")} className="flex items-center gap-2 cursor-pointer">
                        <span className="h-2 w-2 rounded-full bg-red-500" aria-hidden />
                        <User className="h-4 w-4" />
                        Verifizierte Anfangs-Versuch-Patienten
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to={withDevParam("/admin")} className="flex items-center gap-2 cursor-pointer">
                        <span className="h-2 w-2 rounded-full bg-red-500" aria-hidden />
                        <Shield className="h-4 w-4" />
                        Admin-Dashboard
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to={withDevParam("/wissensdatenbank")} className="flex items-center gap-2 cursor-pointer">
                        <span className="h-2 w-2 rounded-full bg-red-500" aria-hidden />
                        <BookOpen className="h-4 w-4" />
                        Wiki
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to={withDevParam("/patienten-bibliothek")} className="flex items-center gap-2 cursor-pointer">
                        <span className="h-2 w-2 rounded-full bg-blue-500" aria-hidden />
                        <Library className="h-4 w-4" />
                        Bibliothek
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <a
                        href="/datenschutz-fahrplan.html"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <span className="h-2 w-2 rounded-full bg-red-500" aria-hidden />
                        <ShieldCheck className="h-4 w-4" />
                        Datensicherheit
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to={withDevParam("/app-uebersicht")} className="flex items-center gap-2 cursor-pointer">
                        <span className="h-2 w-2 rounded-full bg-red-500" aria-hidden />
                        <LayoutGrid className="h-4 w-4" />
                        Übersicht der APP
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleSignOut}
                className="gap-2"
              >
                <LogOut className="h-4 w-4" />
                {t("Abmelden", "Logout")}
              </Button>
            </div>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={() => navigate("/auth")}
              className="ml-2 gap-2"
            >
              <LogIn className="h-4 w-4" />
              {t("Anmelden", "Login")}
            </Button>
          )}
        </nav>

        <div className="hidden" aria-hidden />

        {/* Mobile Menu Button */}
        <div className="flex items-center gap-2 lg:hidden">
          <LanguageSwitcher />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label={t(header.openMenu.de, header.openMenu.en)}
          >
            {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      <div className="border-t border-border/50 bg-muted/60">
        <div className="container flex min-h-12 flex-wrap items-center gap-2 py-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Schnellzugriff
          </span>
          {loading ? (
            <span className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-muted-foreground">
              Zugang wird geprüft …
            </span>
          ) : (
            quickAccessItems.map((item) => {
              const Icon = item.icon;
              return (
                <Button key={item.href} asChild variant="outline" size="sm" className="h-9 gap-2">
                  <Link to={item.href}>
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                </Button>
              );
            })
          )}
          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <Button variant="outline" size="sm" onClick={handleSignOut} className="h-9 gap-2">
                <LogOut className="h-4 w-4" />
                {t("Abmelden", "Logout")}
              </Button>
            ) : (
              <Button size="sm" onClick={() => navigate("/auth")} className="h-9 gap-2">
                <LogIn className="h-4 w-4" />
                {t("Anmelden", "Login")}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isMenuOpen && (
        <nav className="animate-slide-up border-t border-border bg-background p-4 lg:hidden">
          <div className="flex flex-col gap-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setIsMenuOpen(false)}
                className={cn(
                  "rounded-lg px-4 py-3 text-sm font-medium transition-colors",
                  location.pathname === item.href
                    ? "bg-sage-100 text-primary"
                    : "text-muted-foreground hover:bg-sage-50 hover:text-primary"
                )}
              >
                {item.label}
              </Link>
            ))}
            
            {/* Infothek Dropdown Mobile */}
            <InfothekDropdown isMobile onItemClick={() => setIsMenuOpen(false)} />

            {/* Anamnesebogen Mobile */}
            {showAnamnese && (showOnlineAnamnese ? (
              <Link
                to="/anamnesebogen"
                onClick={() => setIsMenuOpen(false)}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium transition-colors",
                  location.pathname === "/anamnesebogen"
                    ? "bg-sage-100 text-primary"
                    : "text-muted-foreground hover:bg-sage-50 hover:text-primary"
                )}
              >
                <ClipboardList className="h-4 w-4" />
                {t("Anamnesebogen", "Anamnesis Form")}
                {!anamneseEnabled && isAdmin && (
                  <span className="ml-1 rounded bg-red-100 px-1 text-[10px] text-red-700">gesperrt</span>
                )}
              </Link>
            ) : (
              <a
                href="/anamnesebogen-blanko.pdf"
                download
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-sage-50 hover:text-primary text-left"
              >
                <ClipboardList className="h-4 w-4" />
                {t("Anamnesebogen (PDF)", "Anamnesis Form (PDF)")}
              </a>
            ))}
            
            {/* Dev Mode Activate Button Mobile */}
            {showDevButton && (
              <Button
                variant="outline"
                onClick={activateDevMode}
                className="w-full justify-start gap-2 border-amber-400 text-amber-600"
              >
                <Shield className="h-4 w-4" />
                Admin-Modus aktivieren
              </Button>
            )}

            {/* Dev Mode Deactivate Button Mobile */}
            {showDevLogout && (
              <Button
                variant="outline"
                onClick={() => { deactivateDevMode(); setIsMenuOpen(false); }}
                className="w-full justify-start gap-2 border-amber-400 text-amber-700"
              >
                <LogOut className="h-4 w-4" />
                Dev-Modus beenden
              </Button>
            )}

            {/* Auth Button Mobile */}
            {user ? (
              <div className="mt-2 space-y-2">
                {isAdmin && (
                  <Link
                    to={withDevParam("/dashboard")}
                    onClick={() => setIsMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium transition-colors",
                      location.pathname === "/dashboard"
                        ? "bg-sage-100 text-primary"
                        : "text-muted-foreground hover:bg-sage-50 hover:text-primary"
                    )}
                  >
                    <User className="h-4 w-4" />
                    Dashboard
                  </Link>
                )}
                {isAdmin && (
                  <Link
                    to={withDevParam("/wissensdatenbank")}
                    onClick={() => setIsMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium transition-colors",
                      location.pathname === "/wissensdatenbank"
                        ? "bg-sage-100 text-primary"
                        : "text-muted-foreground hover:bg-sage-50 hover:text-primary"
                    )}
                  >
                    <BookOpen className="h-4 w-4" />
                    Wissensdatenbank
                  </Link>
                )}
                {isAdmin && (
                  <Link
                    to={withDevParam("/admin")}
                    onClick={() => setIsMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium transition-colors",
                      location.pathname === "/admin"
                        ? "bg-sage-100 text-primary"
                        : "text-muted-foreground hover:bg-sage-50 hover:text-primary"
                    )}
                  >
                    <Shield className="h-4 w-4" />
                    Admin-Dashboard
                  </Link>
                )}
                {isAdmin && (
                  <a
                    href="/datenschutz-fahrplan.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-sage-50 hover:text-primary"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Datensicherheit
                  </a>
                )}
                <div className="flex items-center gap-2 rounded-lg bg-sage-50 px-4 py-2">
                  <User className="h-4 w-4 text-primary" />
                  <span className="truncate text-sm text-muted-foreground">
                    {user.email}
                  </span>
                </div>
                <Button
                  variant="outline"
                  onClick={handleSignOut}
                  className="w-full justify-start gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  {t("Abmelden", "Logout")}
                </Button>
              </div>
            ) : (
              <Button
                variant="default"
                onClick={() => {
                  navigate("/auth");
                  setIsMenuOpen(false);
                }}
                className="mt-2 w-full justify-start gap-2"
              >
                <LogIn className="h-4 w-4" />
                {t("Anmelden", "Login")}
              </Button>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
