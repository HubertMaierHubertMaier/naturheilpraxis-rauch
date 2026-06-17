import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  SIM_ROLE_LABELS,
  SimulatedRole,
  getSimulatedRole,
  onSimulatedRoleChange,
  setSimulatedRole,
} from "@/lib/roleSimulator";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";

/**
 * Schwebendes Panel unten rechts. Nur für echte Admins sichtbar.
 * Erlaubt das Umschalten der Patienten-Sicht zu Test-Zwecken – ohne DB-Änderungen.
 */
export function RoleSimulator() {
  const { realIsAdmin, user } = useAuth();
  const [role, setRole] = useState<SimulatedRole>(getSimulatedRole());
  const [open, setOpen] = useState(false);

  useEffect(() => onSimulatedRoleChange(() => setRole(getSimulatedRole())), []);

  if (!realIsAdmin || !user) return null;

  const apply = (r: SimulatedRole) => {
    setSimulatedRole(r);
    setRole(r);
  };

  const active = role !== "off";

  return (
    <div className="fixed bottom-4 right-4 z-[60] print:hidden">
      {!open ? (
        <Button
          size="sm"
          variant={active ? "default" : "outline"}
          onClick={() => setOpen(true)}
          className="shadow-lg"
        >
          {active ? <Eye className="h-4 w-4 mr-2" /> : <EyeOff className="h-4 w-4 mr-2" />}
          Rollen-Simulator{active ? " • aktiv" : ""}
        </Button>
      ) : (
        <div className="w-[320px] rounded-lg border bg-background shadow-xl p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="font-semibold text-sm">Rollen-Simulator</h4>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Nur Anzeige – verändert nichts in der Datenbank. Damit kannst du
                alle Patienten-Zustände durchspielen.
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
              aria-label="Schließen"
            >
              ✕
            </button>
          </div>

          <div className="space-y-1.5">
            {(Object.keys(SIM_ROLE_LABELS) as SimulatedRole[]).map((r) => (
              <button
                key={r}
                onClick={() => apply(r)}
                className={`w-full text-left text-xs rounded-md px-3 py-2 border transition ${
                  role === r
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-muted border-border"
                }`}
              >
                {SIM_ROLE_LABELS[r]}
              </button>
            ))}
          </div>

          {active && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400">
              Admin-Buttons werden ausgeblendet, solange ein Override aktiv ist.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
