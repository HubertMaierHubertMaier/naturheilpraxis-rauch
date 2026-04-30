import { Badge } from "@/components/ui/badge";
import { User, Pill, Heart, Wallet, FlaskConical, Baby, FlaskRound, Scale, Venus, Mars, Transgender } from "lucide-react";

interface Props {
  alter?: string;
  geschlecht?: string;
  bmi?: number;
  bmiKategorie?: string;
  bmiTone?: "ok" | "warn" | "danger";
  schwanger?: string;
  medikamente?: string;
  budget?: string;
  laborErhoeht?: string;
  laborErniedrigt?: string;
  stuhlbefund?: string;
}

export function PatientContextBar({ alter, schwanger, medikamente, budget, laborErhoeht, laborErniedrigt, stuhlbefund }: Props) {
  const items: Array<{ icon: React.ReactNode; label: string; value: string; tone?: "warn" | "danger" | "ok" }> = [];

  if (alter) {
    const isMinor = parseInt(alter) < 12;
    items.push({
      icon: isMinor ? <Baby className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />,
      label: "Alter",
      value: `${alter} J.`,
      tone: isMinor ? "warn" : "ok",
    });
  }
  if (schwanger && schwanger !== "nein") {
    items.push({
      icon: <Heart className="h-3.5 w-3.5" />,
      label: "Status",
      value: schwanger,
      tone: "danger",
    });
  }
  if (medikamente) {
    const isAnticoag = /marcumar|warfarin|eliquis|xarelto|pradaxa/i.test(medikamente);
    items.push({
      icon: <Pill className="h-3.5 w-3.5" />,
      label: "Medikation",
      value: medikamente.length > 40 ? medikamente.slice(0, 40) + "…" : medikamente,
      tone: isAnticoag ? "danger" : "warn",
    });
  }
  if (budget) {
    items.push({ icon: <Wallet className="h-3.5 w-3.5" />, label: "Budget", value: `${budget} €`, tone: "ok" });
  }
  if (laborErhoeht || laborErniedrigt) {
    items.push({ icon: <FlaskConical className="h-3.5 w-3.5" />, label: "Labor", value: "auffällig", tone: "warn" });
  }
  if (stuhlbefund) {
    items.push({ icon: <FlaskRound className="h-3.5 w-3.5" />, label: "Stuhl", value: "Befund", tone: "warn" });
  }

  if (items.length === 0) return null;

  const toneClass = (tone?: "warn" | "danger" | "ok") => {
    if (tone === "danger") return "bg-destructive/10 text-destructive border-destructive/30";
    if (tone === "warn") return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30";
    return "bg-primary/10 text-primary border-primary/30";
  };

  return (
    <div className="sticky top-28 z-20 -mx-1 px-1 py-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-y border-border">
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium mr-1">Patient</span>
        {items.map((it, i) => (
          <Badge key={i} variant="outline" className={`gap-1.5 font-medium ${toneClass(it.tone)}`}>
            {it.icon}
            <span className="text-[10px] uppercase opacity-70">{it.label}</span>
            <span>{it.value}</span>
          </Badge>
        ))}
      </div>
    </div>
  );
}
