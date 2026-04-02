import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Search, Users, RefreshCw, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";

interface PatientProfile {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  street: string | null;
  postal_code: string | null;
  city: string | null;
  date_of_birth: string | null;
  phone: string | null;
  created_at: string;
  is_verified_patient: boolean;
  login_count: number;
  submission_id?: string | null;
}

interface PatientManagerProps {
  devBypass?: boolean;
}

export function PatientManager({ devBypass = false }: PatientManagerProps) {
  const [patients, setPatients] = useState<PatientProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    setLoading(true);
    try {
      // Use edge function to fetch patients (bypasses RLS with service role)
      const headers: Record<string, string> = {};

      const { data, error } = await supabase.functions.invoke("get-patients", {
        headers,
      });

      if (error) throw error;
      if (data?.patients) {
        setPatients(data.patients);
      }
    } catch (err) {
      console.error("Error fetching patients:", err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = patients.filter((p) => {
    const term = search.toLowerCase();
    return (
      !term ||
      (p.first_name?.toLowerCase() || "").includes(term) ||
      (p.last_name?.toLowerCase() || "").includes(term) ||
      p.email.toLowerCase().includes(term) ||
      (p.city?.toLowerCase() || "").includes(term)
    );
  });

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "–";
    try {
      return format(new Date(dateStr), "dd.MM.yyyy", { locale: de });
    } catch {
      return dateStr;
    }
  };

  const [resending, setResending] = useState<string | null>(null);
  const [verifying, setVerifying] = useState<string | null>(null);

  const handleResend = async (patient: PatientProfile) => {
    if (!patient.submission_id) {
      toast.error("Keine Einreichung für diesen Patienten gefunden.");
      return;
    }
    setResending(patient.user_id);
    try {
      const { data, error } = await supabase.functions.invoke("resend-submission", {
        body: { submissionId: patient.submission_id },
      });
      if (error) throw error;
      toast.success(`E-Mails für ${patient.first_name || patient.email} erneut gesendet!`);
    } catch (err: any) {
      console.error("Resend error:", err);
      toast.error("Fehler beim erneuten Senden: " + (err.message || "Unbekannt"));
    } finally {
      setResending(null);
    }
  };

  const handleToggleVerified = async (patient: PatientProfile) => {
    setVerifying(patient.user_id);
    const newValue = !patient.is_verified_patient;
    try {
      // Use service-role via edge function for RLS bypass
      const { error } = await supabase.functions.invoke("get-patients", {
        method: "PATCH" as any,
        body: { userId: patient.user_id, is_verified_patient: newValue },
        headers: devBypass ? { "x-dev-mode": "true" } : {},
      });
      // Actually, let's update directly since admin has RLS access
      // We need a dedicated approach - update via the profiles table
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ is_verified_patient: newValue } as any)
        .eq("user_id", patient.user_id);
      
      if (updateError) throw updateError;
      
      // Update local state
      setPatients(prev => prev.map(p => 
        p.user_id === patient.user_id ? { ...p, is_verified_patient: newValue } : p
      ));
      
      toast.success(
        newValue
          ? `✅ ${patient.first_name || patient.email} freigeschaltet!`
          : `❌ ${patient.first_name || patient.email} Zugang gesperrt.`
      );
    } catch (err: any) {
      console.error("Verify error:", err);
      toast.error("Fehler: " + (err.message || "Unbekannt"));
    } finally {
      setVerifying(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          {filtered.length} {filtered.length === 1 ? "Patient" : "Patienten"}
        </div>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Suchen (Name, E-Mail, Ort)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>E-Mail</TableHead>
              <TableHead>PLZ / Ort</TableHead>
              <TableHead>Geburtsdatum</TableHead>
              <TableHead>Erstanmeldung</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right">Logins</TableHead>
              <TableHead className="text-center">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  Keine Patienten gefunden.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((p) => {
                const name = [p.first_name, p.last_name].filter(Boolean).join(" ") || "–";
                return (
                  <TableRow key={p.user_id}>
                    <TableCell className="font-medium whitespace-nowrap">{name}</TableCell>
                    <TableCell>{p.email}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {p.postal_code || p.city
                        ? `${p.postal_code || ""} ${p.city || ""}`.trim()
                        : "–"}
                    </TableCell>
                    <TableCell>{formatDate(p.date_of_birth)}</TableCell>
                    <TableCell>{formatDate(p.created_at)}</TableCell>
                    <TableCell className="text-center">
                      {p.is_verified_patient ? (
                        <Badge variant="default" className="bg-green-600 hover:bg-green-700 gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Freigeschaltet
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1 text-amber-700 bg-amber-100">
                          <XCircle className="h-3 w-3" />
                          Ausstehend
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{p.login_count}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          size="sm"
                          variant={p.is_verified_patient ? "outline" : "default"}
                          onClick={() => handleToggleVerified(p)}
                          disabled={verifying === p.user_id}
                          className="gap-1"
                          title={p.is_verified_patient ? "Zugang sperren" : "Freischalten"}
                        >
                          {p.is_verified_patient ? (
                            <><XCircle className="h-3 w-3" /> Sperren</>
                          ) : (
                            <><CheckCircle className="h-3 w-3" /> Freischalten</>
                          )}
                        </Button>
                        {p.submission_id && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleResend(p)}
                            disabled={resending === p.user_id}
                            className="gap-1"
                          >
                            <RefreshCw className={`h-3 w-3 ${resending === p.user_id ? "animate-spin" : ""}`} />
                            Resend
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
