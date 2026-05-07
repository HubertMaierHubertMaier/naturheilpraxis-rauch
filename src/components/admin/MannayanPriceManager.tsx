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

  const exportPDF = () => {
    if (cart.length === 0) return;
    const doc = new jsPDF();
    let y = 20;
    doc.setFontSize(16);
    doc.text("Naturheilpraxis Peter Rauch", 20, y);
    y += 8;
    doc.setFontSize(10);
    doc.text("Mannayan-Produktempfehlung", 20, y);
    y += 6;
    doc.text(`Datum: ${today}`, 20, y);
    if (patientName) { y += 6; doc.text(`Patient: ${patientName}`, 20, y); }
    y += 10;
    doc.setFontSize(11);
    doc.text("Menge", 20, y);
    doc.text("Produkt", 45, y);
    doc.text("Einzelpreis", 130, y);
    doc.text("Summe", 170, y);
    y += 2;
    doc.line(20, y, 195, y);
    y += 6;
    doc.setFontSize(10);
    cart.forEach(c => {
      const lineSum = c.product.price_eur * c.quantity;
      doc.text(String(c.quantity), 20, y);
      const nameLines = doc.splitTextToSize(c.product.name + (c.product.unit ? ` (${c.product.unit})` : ""), 80);
      doc.text(nameLines, 45, y);
      doc.text(formatPrice(c.product.price_eur), 130, y);
      doc.text(formatPrice(lineSum), 170, y);
      y += 6 * Math.max(1, nameLines.length);
      if (y > 270) { doc.addPage(); y = 20; }
    });
    y += 4;
    doc.line(20, y, 195, y);
    y += 8;
    doc.setFontSize(12);
    doc.setFont(undefined, "bold");
    doc.text("Gesamtsumme:", 130, y);
    doc.text(formatPrice(total), 170, y);
    doc.setFont(undefined, "normal");
    y += 12;
    doc.setFontSize(8);
    doc.text("Endkundenpreise inkl. MwSt. Preise gemäß Mannayan-Preisliste, Änderungen vorbehalten.", 20, y);
    doc.save(`Mannayan-Empfehlung-${today.replace(/\./g, "-")}.pdf`);
  };

  const exportDocx = async () => {
    if (cart.length === 0) return;
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

    const doc = new Document({
      sections: [{
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
        children: [
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "Naturheilpraxis Peter Rauch", bold: true, size: 32 })] }),
          new Paragraph({ children: [new TextRun({ text: "Mannayan-Produktempfehlung", size: 24 })] }),
          new Paragraph({ children: [new TextRun(`Datum: ${today}`)] }),
          ...(patientName ? [new Paragraph({ children: [new TextRun(`Patient: ${patientName}`)] })] : []),
          new Paragraph({ children: [new TextRun("")] }),
          new DocxTable({
            width: { size: 9026, type: WidthType.DXA },
            columnWidths: [1000, 4500, 1763, 1763],
            rows: [
              new DocxRow({ children: [
                headerCell("Menge", 1000),
                headerCell("Produkt", 4500),
                headerCell("Einzelpreis", 1763),
                headerCell("Summe", 1763),
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
          new Paragraph({ children: [new TextRun({ text: "Endkundenpreise inkl. MwSt. Preise gemäß Mannayan-Preisliste, Änderungen vorbehalten.", size: 16, italics: true })] }),
        ],
      }],
    });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `Mannayan-Empfehlung-${today.replace(/\./g, "-")}.docx`);
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
            <CardTitle className="font-serif">Mannayan-Empfehlung erstellen</CardTitle>
            <CardDescription>Produkte suchen, Mengen festlegen und als PDF/Word exportieren.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Patient (optional)</Label>
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

            <div className="flex flex-wrap gap-2">
              <Button onClick={exportPDF} disabled={cart.length === 0}><FileText className="h-4 w-4 mr-2" />PDF exportieren</Button>
              <Button onClick={exportDocx} disabled={cart.length === 0} variant="secondary"><FileType className="h-4 w-4 mr-2" />Word (.docx) exportieren</Button>
              <Button variant="outline" onClick={() => setCart([])} disabled={cart.length === 0}>Liste leeren</Button>
            </div>
          </CardContent>
        </Card>
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
