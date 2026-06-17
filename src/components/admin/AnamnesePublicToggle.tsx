import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Lock } from "lucide-react";

export function AnamnesePublicToggle() {
  return (
    <Card className="border-border">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-muted-foreground" />
              Online-Anamnesebogen – öffentlicher Zugriff deaktiviert
            </CardTitle>
            <CardDescription>
              <code>/anamnesebogen</code> bleibt aus Datenschutz- und Sicherheitsgründen immer login-geschützt.
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
              Login erforderlich
            </Badge>
            <Switch
              checked={false}
              disabled
              aria-label="Anamnesebogen bleibt login-geschützt"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p className="text-muted-foreground">
          🔒 Normalbetrieb: <code>/anamnesebogen</code> ist nur nach Login erreichbar; eine öffentliche Online-Übermittlung wird hier nicht mehr angeboten.
        </p>
      </CardContent>
    </Card>
  );
}
