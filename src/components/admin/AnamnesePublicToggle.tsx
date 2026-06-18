import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAnamneseOnlineEnabled } from "@/hooks/useAnamneseOnlineEnabled";
import { Loader2, ShieldAlert, ShieldCheck } from "lucide-react";

/**
 * Datenschutz-Kill-Switch für das ONLINE-Anamnese-Formular (`/anamnesebogen`).
 * Steht standardmäßig auf AUS, weil Gesundheitsdaten (Art. 9 DSGVO) sonst
 * über die Lovable-Infrastruktur fließen würden, bevor Peter das mit dem
 * Datenschutz endgültig geklärt hat.
 *
 * Achtung: Das ist NICHT derselbe Schalter wie der PDF-Download-Toggle.
 */
export function AnamnesePublicToggle() {
  const { enabled, loading, refresh } = useAnamneseOnlineEnabled();
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleToggle = async (next: boolean) => {
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("app_settings").upsert({
      key: "anamnese_online_enabled",
      value: { enabled: next },
      updated_by: userData.user?.id ?? null,
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
      return;
    }
    await refresh();
    toast({
      title: next ? "Online-Anamnese AKTIV" : "Online-Anamnese GESPERRT",
      description: next
        ? "⚠️ Patienten können jetzt ihre Daten online absenden. Bitte nur einschalten, wenn DSGVO geklärt ist."
        : "Online-Formular und Edge-Function sind gesperrt. PDF-Download bleibt verfügbar.",
    });
  };

  const blocked = !enabled;

  return (
    <Card className={blocked ? "border-red-400 bg-red-50/40" : "border-amber-400 bg-amber-50/40"}>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              {blocked ? (
                <ShieldCheck className="h-5 w-5 text-red-600" />
              ) : (
                <ShieldAlert className="h-5 w-5 text-amber-600" />
              )}
              Online-Anamnesebogen – Datenschutz-Sperre
            </CardTitle>
            <CardDescription>
              Steuert <code>/anamnesebogen</code> (Online-Formular) <strong>und</strong> die Edge-Function
              <code> submit-anamnesis</code>. Unabhängig vom PDF-Download.
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            {loading || saving ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <Badge
                variant="outline"
                className={
                  blocked
                    ? "border-red-500 bg-red-100 text-red-700"
                    : "border-amber-500 bg-amber-100 text-amber-700"
                }
              >
                {blocked ? "GESPERRT (sicher)" : "AKTIV (Daten fließen!)"}
              </Badge>
            )}
            <Switch
              checked={enabled}
              disabled={loading || saving}
              onCheckedChange={handleToggle}
              aria-label="Online-Anamnese aktivieren/sperren"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {blocked ? (
          <p className="text-muted-foreground">
            🔒 Online-Eingabe ist für Patienten <strong>blockiert</strong> (Route + Server). Patienten sehen
            eine Hinweisseite mit Link zum PDF-Download. Admins kommen zum Testen weiterhin durch.
          </p>
        ) : (
          <p className="text-red-700">
            ⚠️ <strong>Achtung:</strong> Patienten können Anamnese-Daten online übermitteln. Nur einschalten,
            wenn AV-Vertrag, Verschlüsselung und Löschkonzept (Art. 9 DSGVO) endgültig geklärt sind.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
