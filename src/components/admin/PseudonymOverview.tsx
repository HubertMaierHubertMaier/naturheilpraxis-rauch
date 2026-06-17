import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, AlertTriangle, Hash, CalendarDays } from "lucide-react";

type OrderInfo = {
  orderNumber: string;
  createdAt: string | null;
  expectedNumber: string;
  sequence: number;
};

type Row = {
  pseudonym: string;
  inTherapy: boolean;
  therapyCount: number;
  orderCount: number;
  orders: OrderInfo[];
  hasMismatch: boolean;
};

type UnassignedOrder = {
  orderNumber: string;
  patientLabel: string | null;
  createdAt: string | null;
};

const PSEUDO_RE = /P-2026-\d{4}/g;

function extractPseudo(s: string | null | undefined): string | null {
  if (!s) return null;
  const m = s.match(PSEUDO_RE);
  return m ? m[0] : null;
}

function expectedOrderNumber(pseudonym: string, sequence: number) {
  return `B-${pseudonym.replace(/^P-/, "")}-${sequence}`;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

export function PseudonymOverview() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [unassignedOrders, setUnassignedOrders] = useState<UnassignedOrder[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [therapyRes, ordersRes] = await Promise.all([
        supabase.from("therapy_sessions").select("pseudonym_id"),
        supabase.from("mannayan_orders").select("order_number, patient_label, pseudonym_id, created_at"),
      ]);
      if (therapyRes.error) throw therapyRes.error;
      if (ordersRes.error) throw ordersRes.error;

      const map = new Map<string, Row>();
      for (const r of therapyRes.data ?? []) {
        const pid = extractPseudo(r.pseudonym_id);
        if (!pid) continue;
        const existing = map.get(pid) ?? { pseudonym: pid, inTherapy: false, therapyCount: 0, orderCount: 0, orders: [], hasMismatch: false };
        existing.inTherapy = true;
        existing.therapyCount += 1;
        map.set(pid, existing);
      }
      const orphaned: UnassignedOrder[] = [];
      for (const o of ordersRes.data ?? []) {
        const pid = (o as any).pseudonym_id ?? extractPseudo(o.patient_label);
        if (!pid) {
          orphaned.push({ orderNumber: o.order_number ?? "—", patientLabel: o.patient_label ?? null, createdAt: o.created_at ?? null });
          continue;
        }
        const existing = map.get(pid) ?? { pseudonym: pid, inTherapy: false, therapyCount: 0, orderCount: 0, orders: [], hasMismatch: false };
        existing.orderCount += 1;
        existing.orders.push({ orderNumber: o.order_number ?? "—", createdAt: o.created_at ?? null, expectedNumber: "", sequence: 0 });
        map.set(pid, existing);
      }
      const list = Array.from(map.values()).sort((a, b) => a.pseudonym.localeCompare(b.pseudonym));
      for (const r of list) {
        r.orders.sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? "") || a.orderNumber.localeCompare(b.orderNumber));
        r.orders = r.orders.map((order, index) => ({
          ...order,
          sequence: index + 1,
          expectedNumber: expectedOrderNumber(r.pseudonym, index + 1),
        }));
        r.hasMismatch = r.orders.some((order) => order.orderNumber !== order.expectedNumber);
      }
      orphaned.sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? "") || a.orderNumber.localeCompare(b.orderNumber));
      setRows(list);
      setUnassignedOrders(orphaned);
    } catch (e: any) {
      setError(e?.message ?? "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const { nextFree, gaps, usedNumbers } = useMemo(() => {
    const nums = rows
      .map((r) => parseInt(r.pseudonym.slice(-4), 10))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b);
    const used = new Set(nums);
    // Nur sinnvoller Bereich: ab erster genutzter Nummer bis max
    const inMain = nums.filter((n) => n < 2000);
    const max = inMain.length ? Math.max(...inMain) : 0;
    let next = 1;
    while (used.has(next)) next++;
    const gapsArr: number[] = [];
    for (let i = 1; i <= max; i++) {
      if (!used.has(i)) gapsArr.push(i);
    }
    return { nextFree: next, gaps: gapsArr, usedNumbers: nums };
  }, [rows]);

  const fmt = (n: number) => `P-2026-${String(n).padStart(4, "0")}`;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Hash className="h-5 w-5" />
            Pseudonym-Übersicht (P-2026-XXXX)
          </CardTitle>
          <CardDescription>
            Alle Pseudonyme aus Therapie-Sessions und Mannayan-Bestellungen im Vergleich.
            Hilft beim Anlegen neuer Patienten, damit keine Nummer doppelt vergeben wird.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Aktualisieren
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 mt-0.5" />
            <div>{error}</div>
          </div>
        )}

        {loading ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="text-xs uppercase text-muted-foreground">Vergebene Nummern</div>
                <div className="text-2xl font-semibold">{rows.length}</div>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="text-xs uppercase text-muted-foreground">Nächste freie Nummer</div>
                <div className="text-2xl font-semibold text-primary">{fmt(nextFree)}</div>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="text-xs uppercase text-muted-foreground">Lücken (bis Max &lt; 2000)</div>
                <div className="text-sm font-mono leading-snug">
                  {gaps.length === 0 ? "—" : gaps.map((n) => String(n).padStart(4, "0")).join(", ")}
                </div>
              </div>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pseudonym</TableHead>
                    <TableHead className="text-center">Therapie</TableHead>
                    <TableHead className="text-center">Bestellungen</TableHead>
                    <TableHead>Bestell-Nr.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                        Keine Pseudonyme gefunden.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((r) => (
                      <TableRow key={r.pseudonym}>
                        <TableCell className="font-mono">{r.pseudonym}</TableCell>
                        <TableCell className="text-center">
                          {r.inTherapy ? (
                            <Badge variant="secondary">✓</Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">—</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {r.orderCount > 0 ? (
                            <Badge>{r.orderCount}</Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {r.orderNumbers.length ? r.orderNumbers.join(", ") : "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <p className="text-xs text-muted-foreground">
              Hinweis: Nummern ≥ 2000 (z. B. Test-/Demo-Pseudonyme) werden in der „nächste freie Nummer"-Berechnung ignoriert.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default PseudonymOverview;
