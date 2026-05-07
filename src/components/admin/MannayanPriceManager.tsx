import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pencil, Save, X, Plus, Trash2, Upload, FileText, FileType, Search, ShoppingCart, FolderOpen, Archive } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import jsPDF from "jspdf";
import { Document, Packer, Paragraph, TextRun, Table as DocxTable, TableRow as DocxRow, TableCell as DocxCell, AlignmentType, WidthType, BorderStyle, HeadingLevel } from "docx";
import { saveAs } from "file-saver";

interface MannayanProduct {
  id: string;
  name: string;
  price_eur: number;
  unit: string | null;
  sku: string | null;
  category: string | null;
  is_active: boolean;
}

interface CartItem {
  product: MannayanProduct;
  quantity: number;
}

export default function MannayanPriceManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<MannayanProduct>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState<Partial<MannayanProduct>>({
    name: "", price_eur: 0, unit: "", sku: "", category: "", is_active: true,
  });
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [patientName, setPatientName] = useState("");
  const [orderNumber, setOrderNumber] = useState<string>("");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderNotes, setOrderNotes] = useState("");
  const [showOrders, setShowOrders] = useState(false);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["mannayan-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mannayan_products" as any)
        .select("*")
        .order("name");
      if (error) throw error;
      return (data as unknown) as MannayanProduct[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<MannayanProduct> & { id: string }) => {
      const { error } = await supabase.from("mannayan_products" as any).update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mannayan-products"] });
      setEditingId(null);
      toast({ title: "Produkt aktualisiert" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (item: Partial<MannayanProduct>) => {
      const { error } = await supabase.from("mannayan_products" as any).insert([item as any]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mannayan-products"] });
      setIsAdding(false);
      setNewItem({ name: "", price_eur: 0, unit: "", sku: "", category: "", is_active: true });
      toast({ title: "Produkt hinzugefügt" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("mannayan_products" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mannayan-products"] });
      toast({ title: "Produkt gelöscht" });
    },
  });

  const bulkInsertMutation = useMutation({
    mutationFn: async (items: Partial<MannayanProduct>[]) => {
      const { error } = await supabase.from("mannayan_products" as any).insert(items as any);
      if (error) throw error;
    },
    onSuccess: (_, items) => {
      queryClient.invalidateQueries({ queryKey: ["mannayan-products"] });
      toast({ title: `${items.length} Produkte importiert` });
    },
    onError: (e: any) => toast({ title: "Import-Fehler", description: e.message, variant: "destructive" }),
  });

  // CSV Import: Format: name;price;unit;sku;category  (Header optional)
  const handleCSVUpload = async (file: File) => {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length === 0) return;
    // Detect delimiter
    const delim = lines[0].includes(";") ? ";" : ",";
    // Skip header if first row contains "name" or "preis"
    const firstLower = lines[0].toLowerCase();
    const hasHeader = firstLower.includes("name") || firstLower.includes("preis") || firstLower.includes("price");
    const dataLines = hasHeader ? lines.slice(1) : lines;
    const items: Partial<MannayanProduct>[] = dataLines.map(line => {
      const cols = line.split(delim).map(c => c.trim().replace(/^"|"$/g, ""));
      const priceStr = (cols[1] || "0").replace(",", ".").replace(/[^\d.]/g, "");
      return {
        name: cols[0] || "",
        price_eur: parseFloat(priceStr) || 0,
        unit: cols[2] || "",
        sku: cols[3] || "",
        category: cols[4] || "",
        is_active: true,
      };
    }).filter(i => i.name);
    if (items.length === 0) {
      toast({ title: "Keine gültigen Zeilen gefunden", variant: "destructive" });
      return;
    }
    bulkInsertMutation.mutate(items);
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return products;
    return products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.sku || "").toLowerCase().includes(q) ||
      (p.category || "").toLowerCase().includes(q)
    );
  }, [products, search]);

  const addToCart = (product: MannayanProduct) => {
    setCart(prev => {
      const existing = prev.find(c => c.product.id === product.id);
      if (existing) return prev.map(c => c.product.id === product.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateCartQty = (id: string, qty: number) => {
    if (qty <= 0) { setCart(prev => prev.filter(c => c.product.id !== id)); return; }
    setCart(prev => prev.map(c => c.product.id === id ? { ...c, quantity: qty } : c));
  };

  const total = cart.reduce((sum, c) => sum + c.product.price_eur * c.quantity, 0);

  const formatPrice = (n: number) => n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
  const today = new Date().toLocaleDateString("de-DE");

  const { data: savedOrders = [], refetch: refetchOrders } = useQuery({
    queryKey: ["mannayan-orders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("mannayan_orders" as any).select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const saveOrder = async (): Promise<string | undefined> => {
    if (cart.length === 0) { toast({ title: "Leere Bestellung", variant: "destructive" }); return; }
    const itemsPayload = cart.map(c => ({
      product_id: c.product.id, name: c.product.name, unit: c.product.unit,
      sku: c.product.sku, price_eur: c.product.price_eur, quantity: c.quantity,
    }));
    const { data: userRes } = await supabase.auth.getUser();
    const userId = userRes.user?.id;
    if (!userId) { toast({ title: "Nicht angemeldet", variant: "destructive" }); return; }

    if (orderId) {
      const { error } = await supabase.from("mannayan_orders" as any)
        .update({ patient_label: patientName, items: itemsPayload, total_eur: total, notes: orderNotes, updated_at: new Date().toISOString() })
        .eq("id", orderId);
      if (error) { toast({ title: "Fehler", description: error.message, variant: "destructive" }); return; }
      toast({ title: `Bestellung ${orderNumber} aktualisiert` });
      refetchOrders();
      return orderNumber;
    }
    const { data: numData, error: numErr } = await supabase.rpc("next_mannayan_order_number" as any);
    if (numErr) { toast({ title: "Nummern-Fehler", description: numErr.message, variant: "destructive" }); return; }
    const newNum = numData as unknown as string;
    const { data: inserted, error } = await supabase.from("mannayan_orders" as any).insert([{
      order_number: newNum, patient_label: patientName, items: itemsPayload,
      total_eur: total, notes: orderNotes, created_by: userId,
    }]).select().single();
    if (error) { toast({ title: "Fehler", description: error.message, variant: "destructive" }); return; }
    setOrderId((inserted as any).id);
    setOrderNumber(newNum);
    toast({ title: `Bestellung ${newNum} gespeichert` });
    refetchOrders();
    return newNum;
  };

  const loadOrder = (o: any) => {
    setOrderId(o.id); setOrderNumber(o.order_number);
    setPatientName(o.patient_label || ""); setOrderNotes(o.notes || "");
    setCart((o.items || []).map((it: any) => ({
      product: {
        id: it.product_id || it.name, name: it.name, price_eur: Number(it.price_eur) || 0,
        unit: it.unit || "", sku: it.sku || "", category: "", is_active: true,
      },
      quantity: it.quantity,
    })));
    setShowOrders(false);
    toast({ title: `Bestellung ${o.order_number} geladen` });
  };

  const newOrder = () => { setCart([]); setOrderId(null); setOrderNumber(""); setPatientName(""); setOrderNotes(""); };

  const deleteOrder = async (id: string, num: string) => {
    if (!confirm(`Bestellung ${num} wirklich löschen?`)) return;
    const { error } = await supabase.from("mannayan_orders" as any).delete().eq("id", id);
    if (error) { toast({ title: "Fehler", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Bestellung gelöscht" });
    if (orderId === id) newOrder();
    refetchOrders();
  };


  const exportPDF = async () => {
    if (cart.length === 0) return;
    const num = orderNumber || (await saveOrder()) || "—";
    const doc = new jsPDF();
    let y = 18;
    doc.setFontSize(16);
    doc.text("Naturheilpraxis Peter Rauch", 20, y);
    y += 6;
    doc.setFontSize(9);
    doc.text("Friedrich-Deffner-Str. 19a · 86163 Augsburg · Tel. 0821-2621462", 20, y);
    y += 10;
    doc.setFontSize(13);
    doc.setFont(undefined, "bold");
    doc.text(`Bestellung Mannayan – ${num}`, 20, y);
    doc.setFont(undefined, "normal");
    y += 7;
    doc.setFontSize(10);
    doc.text(`Augsburg, den ${today}`, 20, y);
    if (patientName) { y += 6; doc.text(`Patient/Kunde: ${patientName}`, 20, y); }
    y += 8;
    doc.setFontSize(9);
    doc.text("Hiermit bestelle ich die unten aufgeführten Produkte über die Naturheilpraxis Peter Rauch", 20, y);
    y += 4; doc.text("zur Weiterleitung an die Firma Mannayan GmbH & Co. KG, Julbach.", 20, y);
    y += 8;

    doc.setFontSize(11);
    doc.text("Menge", 20, y); doc.text("Produkt", 45, y);
    doc.text("Einzelpreis", 130, y); doc.text("Summe", 170, y);
    y += 2; doc.line(20, y, 195, y); y += 6;
    doc.setFontSize(10);
    cart.forEach(c => {
      const lineSum = c.product.price_eur * c.quantity;
      doc.text(String(c.quantity), 20, y);
      const nameLines = doc.splitTextToSize(c.product.name + (c.product.unit ? ` (${c.product.unit})` : ""), 80);
      doc.text(nameLines, 45, y);
      doc.text(formatPrice(c.product.price_eur), 130, y);
      doc.text(formatPrice(lineSum), 170, y);
      y += 6 * Math.max(1, nameLines.length);
      if (y > 250) { doc.addPage(); y = 20; }
    });
    y += 4; doc.line(20, y, 195, y); y += 8;
    doc.setFontSize(12); doc.setFont(undefined, "bold");
    doc.text("Gesamtsumme:", 130, y); doc.text(formatPrice(total), 170, y);
    doc.setFont(undefined, "normal");
    y += 14;
    doc.setFontSize(9);
    doc.text("Endkundenpreise inkl. MwSt. gemäß Mannayan-Preisliste, Änderungen vorbehalten.", 20, y);
    y += 14;
    if (y > 240) { doc.addPage(); y = 30; }
    doc.setFontSize(10);
    doc.text("Mit meiner Unterschrift bestätige ich die oben aufgeführte Bestellung verbindlich.", 20, y);
    y += 20;
    doc.line(20, y, 100, y);
    doc.line(115, y, 195, y);
    y += 5;
    doc.setFontSize(8);
    doc.text("Ort, Datum", 20, y);
    doc.text("Unterschrift Patient/Kunde", 115, y);
    doc.save(`Mannayan-Bestellung-${num}.pdf`);
  };

  const exportDocx = async () => {
    if (cart.length === 0) return;
    const num = orderNumber || (await saveOrder()) || "—";
    const cellBorder = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
    const borders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };
    const headerCell = (text: string, width: number) => new DocxCell({
      borders, width: { size: width, type: WidthType.DXA },
      children: [new Paragraph({ children: [new TextRun({ text, bold: true })] })],
    });
    const dataCell = (text: string, width: number, align?: typeof AlignmentType[keyof typeof AlignmentType]) => new DocxCell({
      borders, width: { size: width, type: WidthType.DXA },
      children: [new Paragraph({ alignment: align, children: [new TextRun(text)] })],
    });
    const noBorderCell = (text: string, width: number, bold = false) => new DocxCell({
      borders: { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } },
      width: { size: width, type: WidthType.DXA },
      children: [new Paragraph({ children: [new TextRun({ text, bold })] })],
    });

    const doc = new Document({
      sections: [{
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
        children: [
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "Naturheilpraxis Peter Rauch", bold: true, size: 32 })] }),
          new Paragraph({ children: [new TextRun({ text: "Friedrich-Deffner-Str. 19a · 86163 Augsburg · Tel. 0821-2621462", size: 18 })] }),
          new Paragraph({ children: [new TextRun("")] }),
          new Paragraph({ children: [new TextRun({ text: `Bestellung Mannayan – ${num}`, bold: true, size: 28 })] }),
          new Paragraph({ children: [new TextRun(`Augsburg, den ${today}`)] }),
          ...(patientName ? [new Paragraph({ children: [new TextRun(`Patient/Kunde: ${patientName}`)] })] : []),
          new Paragraph({ children: [new TextRun("")] }),
          new Paragraph({ children: [new TextRun("Hiermit bestelle ich die unten aufgeführten Produkte über die Naturheilpraxis Peter Rauch zur Weiterleitung an die Firma Mannayan GmbH & Co. KG, Julbach.")] }),
          new Paragraph({ children: [new TextRun("")] }),
          new DocxTable({
            width: { size: 9026, type: WidthType.DXA },
            columnWidths: [1000, 4500, 1763, 1763],
            rows: [
              new DocxRow({ children: [
                headerCell("Menge", 1000), headerCell("Produkt", 4500),
                headerCell("Einzelpreis", 1763), headerCell("Summe", 1763),
              ]}),
              ...cart.map(c => new DocxRow({ children: [
                dataCell(String(c.quantity), 1000),
                dataCell(c.product.name + (c.product.unit ? ` (${c.product.unit})` : ""), 4500),
                dataCell(formatPrice(c.product.price_eur), 1763, AlignmentType.RIGHT),
                dataCell(formatPrice(c.product.price_eur * c.quantity), 1763, AlignmentType.RIGHT),
              ]})),
              new DocxRow({ children: [
                dataCell("", 1000),
                new DocxCell({ borders, width: { size: 4500, type: WidthType.DXA },
                  children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "Gesamtsumme:", bold: true })] })] }),
                dataCell("", 1763),
                new DocxCell({ borders, width: { size: 1763, type: WidthType.DXA },
                  children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: formatPrice(total), bold: true })] })] }),
              ]}),
            ],
          }),
          new Paragraph({ children: [new TextRun("")] }),
          new Paragraph({ children: [new TextRun({ text: "Endkundenpreise inkl. MwSt. gemäß Mannayan-Preisliste, Änderungen vorbehalten.", size: 16, italics: true })] }),
          new Paragraph({ children: [new TextRun("")] }),
          new Paragraph({ children: [new TextRun("")] }),
          new Paragraph({ children: [new TextRun("Mit meiner Unterschrift bestätige ich die oben aufgeführte Bestellung verbindlich.")] }),
          new Paragraph({ children: [new TextRun("")] }),
          new Paragraph({ children: [new TextRun("")] }),
          new DocxTable({
            width: { size: 9026, type: WidthType.DXA },
            columnWidths: [4500, 526, 4000],
            rows: [
              new DocxRow({ children: [
                noBorderCell("", 4500),
                new DocxCell({ borders: { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } }, width: { size: 526, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun("")] })] }),
                noBorderCell("", 4000),
              ]}),
              new DocxRow({ children: [
                new DocxCell({ borders: { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } }, width: { size: 4500, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: "Ort, Datum", size: 16 })] })] }),
                new DocxCell({ borders: { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } }, width: { size: 526, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun("")] })] }),
                new DocxCell({ borders: { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } }, width: { size: 4000, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: "Unterschrift Patient/Kunde", size: 16 })] })] }),
              ]}),
            ],
          }),
        ],
      }],
    });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `Mannayan-Bestellung-${num}.docx`);
  };


  return (
    <Tabs defaultValue="recipe" className="space-y-4">
      <TabsList>
        <TabsTrigger value="recipe"><ShoppingCart className="h-4 w-4 mr-2" />Rezept-Builder</TabsTrigger>
        <TabsTrigger value="manage"><Pencil className="h-4 w-4 mr-2" />Preisliste verwalten</TabsTrigger>
      </TabsList>

      <TabsContent value="recipe" className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="font-serif">
                  Mannayan-Bestellung {orderNumber && <span className="text-primary">· {orderNumber}</span>}
                </CardTitle>
                <CardDescription>
                  {orderId ? "Geladene Bestellung – Änderungen werden beim Speichern aktualisiert." : "Neue Bestellung – wird beim Export oder Speichern fortlaufend nummeriert (P-JJJJ-XXXX)."}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={newOrder}><Plus className="h-4 w-4 mr-1" />Neue Bestellung</Button>
                <Button variant="outline" size="sm" onClick={() => setShowOrders(true)}><Archive className="h-4 w-4 mr-1" />Gespeicherte ({savedOrders.length})</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Patient / Kunde</Label>
                <Input value={patientName} onChange={e => setPatientName(e.target.value)} placeholder="Name oder Pseudonym" />
              </div>
              <div>
                <Label>Produkt suchen</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-9" value={search} onChange={e => setSearch(e.target.value)} placeholder="Name, Artikelnr., Kategorie..." />
                </div>
              </div>
            </div>

            {search && (
              <div className="border rounded-md max-h-60 overflow-y-auto">
                {filtered.slice(0, 20).map(p => (
                  <button key={p.id} onClick={() => addToCart(p)}
                    className="w-full text-left p-2 hover:bg-sage-50 border-b flex justify-between items-center text-sm">
                    <span>{p.name} {p.unit && <span className="text-muted-foreground">({p.unit})</span>}</span>
                    <span className="font-medium">{formatPrice(p.price_eur)}</span>
                  </button>
                ))}
                {filtered.length === 0 && <p className="p-3 text-sm text-muted-foreground">Nichts gefunden</p>}
              </div>
            )}

            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Menge</TableHead>
                    <TableHead>Produkt</TableHead>
                    <TableHead className="text-right">Einzelpreis</TableHead>
                    <TableHead className="text-right">Summe</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cart.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Noch keine Produkte ausgewählt</TableCell></TableRow>
                  )}
                  {cart.map(c => (
                    <TableRow key={c.product.id}>
                      <TableCell>
                        <Input type="number" min={1} value={c.quantity}
                          onChange={e => updateCartQty(c.product.id, parseInt(e.target.value) || 0)}
                          className="w-20" />
                      </TableCell>
                      <TableCell>{c.product.name} {c.product.unit && <span className="text-muted-foreground text-xs">({c.product.unit})</span>}</TableCell>
                      <TableCell className="text-right">{formatPrice(c.product.price_eur)}</TableCell>
                      <TableCell className="text-right font-medium">{formatPrice(c.product.price_eur * c.quantity)}</TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" onClick={() => updateCartQty(c.product.id, 0)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {cart.length > 0 && (
                    <TableRow className="bg-sage-50 font-bold">
                      <TableCell colSpan={3} className="text-right">Gesamtsumme:</TableCell>
                      <TableCell className="text-right">{formatPrice(total)}</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div>
              <Label>Notiz (intern, wird mitgespeichert)</Label>
              <Textarea value={orderNotes} onChange={e => setOrderNotes(e.target.value)} rows={2} placeholder="Optionale interne Notiz zur Bestellung" />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={saveOrder} disabled={cart.length === 0}><Save className="h-4 w-4 mr-2" />{orderId ? "Aktualisieren" : "Bestellung speichern"}</Button>
              <Button onClick={exportPDF} disabled={cart.length === 0} variant="secondary"><FileText className="h-4 w-4 mr-2" />PDF (mit Unterschrift)</Button>
              <Button onClick={exportDocx} disabled={cart.length === 0} variant="secondary"><FileType className="h-4 w-4 mr-2" />Word (.docx)</Button>
              <Button variant="outline" onClick={newOrder} disabled={cart.length === 0 && !orderId}>Liste leeren</Button>
            </div>
          </CardContent>
        </Card>

        <Dialog open={showOrders} onOpenChange={setShowOrders}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Gespeicherte Bestellungen</DialogTitle>
              <DialogDescription>Klicken Sie auf eine Bestellung zum Laden.</DialogDescription>
            </DialogHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nr.</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead className="text-right">Summe</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {savedOrders.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Noch keine gespeicherten Bestellungen</TableCell></TableRow>
                )}
                {savedOrders.map((o: any) => (
                  <TableRow key={o.id} className="cursor-pointer hover:bg-sage-50">
                    <TableCell className="font-mono font-medium" onClick={() => loadOrder(o)}>{o.order_number}</TableCell>
                    <TableCell onClick={() => loadOrder(o)}>{new Date(o.created_at).toLocaleDateString("de-DE")}</TableCell>
                    <TableCell onClick={() => loadOrder(o)}>{o.patient_label || "—"}</TableCell>
                    <TableCell className="text-right" onClick={() => loadOrder(o)}>{formatPrice(Number(o.total_eur))}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => loadOrder(o)}><FolderOpen className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteOrder(o.id, o.order_number)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DialogContent>
        </Dialog>
      </TabsContent>

      <TabsContent value="manage" className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="font-serif">Mannayan-Preisliste</CardTitle>
              <CardDescription>{products.length} Produkte gespeichert</CardDescription>
            </div>
            <div className="flex gap-2">
              <label className="cursor-pointer">
                <input type="file" accept=".csv,.txt" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleCSVUpload(f); e.target.value = ""; }} />
                <span className="inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 h-9 px-3">
                  <Upload className="h-4 w-4" />CSV-Import
                </span>
              </label>
              <Button size="sm" onClick={() => setIsAdding(true)} className="gap-2"><Plus className="h-4 w-4" />Neu</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              CSV-Format: <code>Name;Preis;Einheit;Artikelnr.;Kategorie</code> (Semikolon oder Komma; Header optional). Beispiel: <code>Vitamin D3;19,90;30 Kapseln;MN-D3;Vitamine</code>
            </p>

            {isAdding && (
              <Card className="border-primary/30 bg-sage-50">
                <CardContent className="pt-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2"><Label>Name *</Label><Input value={newItem.name || ""} onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))} /></div>
                    <div><Label>Preis (€) *</Label><Input type="number" step="0.01" min="0" value={newItem.price_eur ? newItem.price_eur : ""} placeholder="0,00" onChange={e => setNewItem(p => ({ ...p, price_eur: e.target.value === "" ? 0 : parseFloat(e.target.value) || 0 }))} /></div>
                    <div><Label>Einheit</Label><Input value={newItem.unit || ""} onChange={e => setNewItem(p => ({ ...p, unit: e.target.value }))} placeholder="z.B. 30 Kapseln" /></div>
                    <div><Label>Artikelnr.</Label><Input value={newItem.sku || ""} onChange={e => setNewItem(p => ({ ...p, sku: e.target.value }))} /></div>
                    <div><Label>Kategorie</Label><Input value={newItem.category || ""} onChange={e => setNewItem(p => ({ ...p, category: e.target.value }))} /></div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => createMutation.mutate(newItem)} disabled={!newItem.name}><Save className="h-4 w-4 mr-1" />Speichern</Button>
                    <Button size="sm" variant="outline" onClick={() => setIsAdding(false)}><X className="h-4 w-4 mr-1" />Abbrechen</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <Input placeholder="Filter..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm" />

            {isLoading ? <p>Laden...</p> : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Einheit</TableHead>
                      <TableHead>Artikelnr.</TableHead>
                      <TableHead className="text-right">Preis (€)</TableHead>
                      <TableHead>Aktiv</TableHead>
                      <TableHead className="w-32">Aktion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(item => (
                      <TableRow key={item.id}>
                        {editingId === item.id ? (
                          <>
                            <TableCell><Input value={editData.name || ""} onChange={e => setEditData(p => ({ ...p, name: e.target.value }))} /></TableCell>
                            <TableCell><Input value={editData.unit || ""} onChange={e => setEditData(p => ({ ...p, unit: e.target.value }))} /></TableCell>
                            <TableCell><Input value={editData.sku || ""} onChange={e => setEditData(p => ({ ...p, sku: e.target.value }))} /></TableCell>
                            <TableCell><Input type="number" step="0.01" min="0" value={editData.price_eur ?? ""} placeholder="0,00" onChange={e => setEditData(p => ({ ...p, price_eur: e.target.value === "" ? 0 : parseFloat(e.target.value) || 0 }))} className="text-right" /></TableCell>
                            <TableCell><Switch checked={editData.is_active} onCheckedChange={v => setEditData(p => ({ ...p, is_active: v }))} /></TableCell>
                            <TableCell>
                              <Button size="icon" variant="ghost" onClick={() => updateMutation.mutate({ id: editingId, ...editData })}><Save className="h-4 w-4" /></Button>
                              <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}><X className="h-4 w-4" /></Button>
                            </TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">{item.unit}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">{item.sku}</TableCell>
                            <TableCell className="text-right">{formatPrice(item.price_eur)}</TableCell>
                            <TableCell>{item.is_active ? "✓" : "–"}</TableCell>
                            <TableCell>
                              <Button size="icon" variant="ghost" onClick={() => addToCart(item)} title="Zur Empfehlung hinzufügen"><Plus className="h-4 w-4 text-primary" /></Button>
                              <Button size="icon" variant="ghost" onClick={() => { setEditingId(item.id); setEditData(item); }}><Pencil className="h-4 w-4" /></Button>
                              <Button size="icon" variant="ghost" onClick={() => { if (confirm(`"${item.name}" wirklich löschen?`)) deleteMutation.mutate(item.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    ))}
                    {filtered.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Keine Produkte. Verwenden Sie "Neu" oder "CSV-Import".</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
