import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAnamneseEnabled } from "@/hooks/useAnamneseEnabled";
import { Loader2, ClipboardList, Lock } from "lucide-react";

export function AnamneseToggle() {
  const { enabled, loading, refresh } = useAnamneseEnabled();
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleToggle = async (next: boolean) => {
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("app_settings").upsert({
      key: "anamnese_enabled",
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
      title: next ? "Anamnesebogen freigeschaltet" : "Anamnesebogen gesperrt",
      description: next
        ? "Patienten sehen den Anamnesebogen wieder im Menü und im Dashboard."
        : "Der Anamnesebogen ist für Patienten ausgeblendet. Admins sehen ihn weiterhin.",
    });
  };

  return (
    <Card className={enabled ? "border-green-300" : "border-red-300"}>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              {enabled ? (
                <ClipboardList className="h-5 w-5 text-green-600" />
              ) : (
                <Lock className="h-5 w-5 text-red-600" />
              )}
              Anamnesebogen-Freigabe
            </CardTitle>
            <CardDescription>
              Steuert die Sichtbarkeit für Patienten. Admins haben immer Zugriff.
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
                {enabled ? "Freigeschaltet" : "Gesperrt"}
              </Badge>
            )}
            <Switch
              checked={enabled}
              disabled={loading || saving}
              onCheckedChange={handleToggle}
              aria-label="Anamnesebogen freischalten"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          {enabled
            ? "🟢 Patienten können den Anamnesebogen über Menü und Dashboard öffnen."
            : "🔴 Patienten sehen den Anamnesebogen nicht. Nützlich beim Testen oder bei Wartung."}
        </p>
      </CardContent>
    </Card>
  );
}
