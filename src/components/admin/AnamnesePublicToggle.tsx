import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAnamnesePublic } from "@/hooks/useAnamnesePublic";
import { Loader2, Globe, Lock } from "lucide-react";

export function AnamnesePublicToggle() {
  const { enabled, loading, refresh } = useAnamnesePublic();
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleToggle = async (next: boolean) => {
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("app_settings").upsert({
      key: "anamnese_public",
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
      title: next ? "Öffentlicher Testzugang aktiv" : "Öffentlicher Testzugang deaktiviert",
      description: next
        ? "/anamnesebogen ist jetzt OHNE Login erreichbar (nur zum Ausprobieren)."
        : "/anamnesebogen erfordert wieder Login.",
    });
  };

  return (
    <Card className={enabled ? "border-amber-400" : "border-border"}>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              {enabled ? (
                <Globe className="h-5 w-5 text-amber-600" />
              ) : (
                <Lock className="h-5 w-5 text-muted-foreground" />
              )}
              Anamnesebogen ohne Login (Test-Modus)
            </CardTitle>
            <CardDescription>
              Schaltet <code>/anamnesebogen</code> kurzzeitig öffentlich frei – zum reinen Ausprobieren der UI ohne Anmeldung.
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
                    ? "border-amber-500 bg-amber-50 text-amber-700"
                    : "border-border bg-muted text-muted-foreground"
                }
              >
                {enabled ? "Öffentlich" : "Login erforderlich"}
              </Badge>
            )}
            <Switch
              checked={enabled}
              disabled={loading || saving}
              onCheckedChange={handleToggle}
              aria-label="Anamnesebogen ohne Login freischalten"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {enabled ? (
          <>
            <p className="text-amber-700 font-medium">
              ⚠️ Achtung: Jeder mit dem Link kann die Form öffnen. Absenden/Speichern funktioniert ohne Login NICHT –
              es lassen sich nur Felder ausprobieren.
            </p>
            <p className="text-muted-foreground">
              Nach dem Test bitte wieder deaktivieren.
            </p>
          </>
        ) : (
          <p className="text-muted-foreground">
            🔒 Normalbetrieb: <code>/anamnesebogen</code> ist nur nach Login erreichbar.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
