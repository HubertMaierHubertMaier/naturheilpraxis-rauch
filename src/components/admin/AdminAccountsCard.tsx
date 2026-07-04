import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldCheck, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface AdminAccount {
  user_id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  admin_since: string | null;
  profile_created_at: string | null;
}

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" }) : "—";

export const AdminAccountsCard = () => {
  const [rows, setRows] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc("list_admin_accounts" as never);
      if (error) {
        setError(error.message);
      } else {
        setRows((data as AdminAccount[]) ?? []);
      }
      setLoading(false);
    })();
  }, []);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <CardTitle>Administrator-Accounts</CardTitle>
        </div>
        <CardDescription>
          Alle Konten mit Rolle <code>admin</code>. Änderungen erfolgen weiterhin ausschließlich über die Rollen-Tabelle
          (nicht im UI editierbar).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-24 w-full" />
        ) : error ? (
          <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine Admin-Accounts gefunden.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>E-Mail</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Admin seit</TableHead>
                <TableHead>Konto seit</TableHead>
                <TableHead>Rolle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.user_id}>
                  <TableCell className="font-medium">{r.email ?? "—"}</TableCell>
                  <TableCell>{[r.first_name, r.last_name].filter(Boolean).join(" ") || "—"}</TableCell>
                  <TableCell>{fmt(r.admin_since)}</TableCell>
                  <TableCell>{fmt(r.profile_created_at)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">admin</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
