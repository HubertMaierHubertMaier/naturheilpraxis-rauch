import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { usePatientLoginEnabled } from "@/hooks/usePatientLoginEnabled";
import { Loader2, LockKeyhole, Unlock } from "lucide-react";

export function PatientLoginToggle() {
  const { enabled, loading, refresh } = usePatientLoginEnabled();
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleToggle = async (next: boolean) => {
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("app_settings")
      .upsert({
        key: "patient_login_enabled",
        value: { enabled: next },
        updated_by: userData.user?.id ?? null,
        updated_at: new Date().toISOString(),
      });
    setSaving(false);
    if (error) {
      toast({
        title: "Fehler",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    await refresh();
    toast({
      title: next ? "Patienten-Anmeldung aktiviert" : "Patienten-Anmeldung deaktiviert",
      description: next
        ? "Patienten können sich wieder anmelden und registrieren."
        : "Nur Sie als Admin können sich anmelden. Die Infothek bleibt öffentlich.",
    });
  };

  return (
    <Card className={enabled ? "border-green-300" : "border-red-300"}>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              {enabled ? (
                <Unlock className="h-5 w-5 text-green-600" />
              ) : (
                <LockKeyhole className="h-5 w-5 text-red-600" />
              )}
              Patienten-Anmeldung
            </CardTitle>
            <CardDescription>
              Globaler Schalter. Admin-Login funktioniert immer.
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            {loading || saving ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <Badge
                variant="outline"
                className={
                  enabled
                    ? "border-green-500 bg-green-50 text-green-700"
                    : "border-red-500 bg-red-50 text-red-700"
                }
              >
                {enabled ? "ON · grün" : "OFF · rot"}
              </Badge>
            )}
            <Switch
              checked={enabled}
              disabled={loading || saving}
              onCheckedChange={handleToggle}
              aria-label="Patienten-Anmeldung an/aus"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          {enabled
            ? "🟢 Anmeldung ist aktiv – Patienten können sich registrieren und einloggen."
            : "🔴 Anmeldung ist gesperrt – nur der Admin kann sich anmelden. Die Infothek bleibt öffentlich erreichbar."}
        </p>
      </CardContent>
    </Card>
  );
}
