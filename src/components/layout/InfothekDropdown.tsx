import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown, BookOpen, Lock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { infothekGroups, type InfothekItem } from "@/lib/infothekContent";
import { useAuth } from "@/contexts/AuthContext";
import { useInfothekGating } from "@/hooks/useInfothekGating";
import { usePatientAccess } from "@/hooks/usePatientAccess";

const allItems = infothekGroups.flatMap((g) => g.items);

interface InfothekDropdownProps {
  isMobile?: boolean;
  onItemClick?: () => void;
}

export function InfothekDropdown({ isMobile = false, onItemClick }: InfothekDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { getVisibility } = useInfothekGating();
  const { canSeeInfothekItem } = usePatientAccess();

  const isInfothekActive = allItems.some((item) => location.pathname === item.href);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  const renderItem = (item: InfothekItem, compact = false) => {
    const isActive = location.pathname === item.href;
    const visibility = getVisibility(item.href, !!item.gated);
    const locked = visibility === "new_patient" ? !user : visibility === "patient" && !canSeeInfothekItem(item.href);

    if (locked) {
      return (
        <button
          key={item.href}
          type="button"
          onClick={() => {
            setIsOpen(false);
            onItemClick?.();
            toast.info(
              t(
                "Dieser Beitrag ist nur für freigeschaltete Patientinnen und Patienten sichtbar.",
                "This entry is only available for approved patients."
              ),
              { duration: 6000 }
            );
          }}
          className={cn(
            "flex w-full items-start gap-3 rounded-lg border border-dashed border-sage-300 bg-muted/40 text-left opacity-70 grayscale transition-colors hover:bg-muted/60",
            compact ? "px-3 py-2.5" : "p-3"
          )}
          aria-label={t(
            `Gesperrt: ${item.label.de} – Freischaltung erforderlich`,
            `Locked: ${item.label.en} – approval required`
          )}
        >
          {compact ? (
            <>
              <Lock className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{t(item.label.de, item.label.en)}</span>
            </>
          ) : (
            <>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                <item.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground/80">
                  {t(item.label.de, item.label.en)}
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="text-xs text-muted-foreground">Freischaltung nötig</div>
              </div>
            </>
          )}
        </button>
      );
    }

    if (item.external) {
      return (
        <a
          key={item.href}
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            setIsOpen(false);
            onItemClick?.();
          }}
          className={cn(
            "flex items-start gap-3 rounded-lg transition-colors hover:bg-sage-50",
            compact ? "px-3 py-2.5" : "p-3"
          )}
        >
          {compact ? (
            <>
              <item.icon className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{t(item.label.de, item.label.en)}</span>
            </>
          ) : (
            <>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sage-100">
                <item.icon className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-foreground">{t(item.label.de, item.label.en)}</div>
                <div className="text-xs text-muted-foreground">{t(item.description.de, item.description.en)}</div>
              </div>
            </>
          )}
        </a>
      );
    }

    return (
      <Link
        key={item.href}
        to={item.href}
        onClick={() => {
          setIsOpen(false);
          onItemClick?.();
        }}
        className={cn(
          "flex items-start gap-3 rounded-lg transition-colors",
          compact ? "px-3 py-2.5" : "p-3",
          isActive ? "bg-sage-100 text-primary" : "hover:bg-sage-50"
        )}
      >
        {compact ? (
          <>
            <item.icon className={cn("h-4 w-4 shrink-0 mt-0.5", isActive ? "text-primary" : "text-muted-foreground")} />
            <span className={cn("text-sm", isActive ? "text-primary font-medium" : "text-muted-foreground")}>{t(item.label.de, item.label.en)}</span>
          </>
        ) : (
          <>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sage-100">
              <item.icon className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1">
              <div className={cn("text-sm font-medium", isActive ? "text-primary" : "text-foreground")}>{t(item.label.de, item.label.en)}</div>
              <div className="text-xs text-muted-foreground">{t(item.description.de, item.description.en)}</div>
            </div>
          </>
        )}
      </Link>
    );
  };

  if (isMobile) {
    return (
      <div className="space-y-1">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "flex w-full items-center justify-between rounded-lg px-4 py-3 text-sm font-medium transition-colors",
            isInfothekActive
              ? "bg-sage-100 text-primary"
              : "text-muted-foreground hover:bg-sage-50 hover:text-primary"
          )}
        >
          <span className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            {t("Infothek", "Info Center")}
          </span>
          <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", isOpen && "rotate-180")} />
        </button>
        {isOpen && (
          <div className="ml-4 space-y-3 border-l-2 border-sage-200 pl-4">
            {infothekGroups.map((group) => (
              <div key={group.title.de}>
                <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {t(group.title.de, group.title.en)}
                </div>
                <div className="space-y-0.5">
                  {group.items.map((item) => renderItem(item, true))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-sage-100 hover:text-primary",
          isInfothekActive ? "bg-sage-100 text-primary" : "text-muted-foreground"
        )}
      >
        <BookOpen className="mr-1 h-4 w-4" />
        {t("Infothek", "Info Center")}
        <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 w-80 max-h-[calc(100vh-5rem)] overflow-y-auto animate-in fade-in-0 slide-in-from-top-2 rounded-xl border border-border bg-background p-2 shadow-elevated scrollbar-thin scrollbar-thumb-sage-300 scrollbar-track-transparent">
          {infothekGroups.map((group, idx) => (
            <div key={group.title.de}>
              {idx > 0 && <div className="my-1.5 border-t border-border/50" />}
              <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                {t(group.title.de, group.title.en)}
              </div>
              {group.items.map((item) => renderItem(item))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
