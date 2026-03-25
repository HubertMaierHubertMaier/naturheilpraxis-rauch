import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Bug, Pill, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface KnowledgeEntry {
  id: string;
  title: string;
  category: string;
  tags: string[];
  content: string;
}

interface PathogenProduct {
  productName: string;
  wirksamkeit: string;
  dosierung: string;
}

interface PathogenData {
  pathogen: string;
  gruppe: string; // Bakterien, Viren, Pilze, Parasiten, Sonstige
  products: PathogenProduct[];
}

const PATHOGEN_GROUPS: Record<string, string> = {
  // Bakterien
  "borrelia": "Bakterien",
  "borrelia burgdorferi": "Bakterien",
  "bartonella": "Bakterien",
  "chlamydia": "Bakterien",
  "chlamydia pneumoniae": "Bakterien",
  "chlamydia trachomatis": "Bakterien",
  "mykoplasmen": "Bakterien",
  "rickettsien": "Bakterien",
  "ehrlichia": "Bakterien",
  "rickettsien / ehrlichia": "Bakterien",
  "mrsa": "Bakterien",
  "staphylococcus aureus": "Bakterien",
  "streptokokken": "Bakterien",
  "helicobacter pylori": "Bakterien",
  "bakterielle infektionen": "Bakterien",
  "bakterielle infektionen allg.": "Bakterien",
  // Viren
  "ebv": "Viren",
  "cmv": "Viren",
  "hepatitis": "Viren",
  "hepatitis-viren": "Viren",
  "herpes": "Viren",
  "herpes-viren": "Viren",
  "herpes-viren / zoster": "Viren",
  "hpv": "Viren",
  "sars": "Viren",
  "sars-cov-2": "Viren",
  "hiv": "Viren",
  "grippe": "Viren",
  "influenza": "Viren",
  "viren": "Viren",
  "virale infektionen": "Viren",
  "erkältung": "Viren",
  // Pilze
  "candida": "Pilze",
  "candida albicans": "Pilze",
  "candida krusei": "Pilze",
  "aspergillus": "Pilze",
  "aspergillus niger": "Pilze",
  "pilze": "Pilze",
  "mykosen": "Pilze",
  // Parasiten - Protozoen
  "babesia": "Parasiten",
  "parasiten": "Parasiten",
  "trichomonaden": "Parasiten",
  "trichomonas vaginalis": "Parasiten",
  "toxoplasmen": "Parasiten",
  "toxoplasma": "Parasiten",
  "toxoplasma gondii": "Parasiten",
  "leishmaniasis": "Parasiten",
  "leishmanien": "Parasiten",
  "malaria": "Parasiten",
  "plasmodium": "Parasiten",
  "plasmodium (malaria)": "Parasiten",
  "giardia lamblia": "Parasiten",
  "giardia": "Parasiten",
  "blastocystis hominis": "Parasiten",
  "blastocystis": "Parasiten",
  "entamoeba histolytica": "Parasiten",
  "entamoeba": "Parasiten",
  "cryptosporidium": "Parasiten",
  "protozoen allgemein": "Parasiten",
  // Parasiten - Helminthen
  "rundwürmer": "Parasiten",
  "rundwürmer (nematoden)": "Parasiten",
  "hakenwürmer": "Parasiten",
  "hakenwürmer (ancylostoma)": "Parasiten",
  "peitschenwürmer": "Parasiten",
  "peitschenwürmer (trichuris trichiura)": "Parasiten",
  "fadenwürmer": "Parasiten",
  "würmer": "Parasiten",
  "protozoen": "Parasiten",
  "bandwürmer": "Parasiten",
  "bandwürmer (cestoden)": "Parasiten",
  "madenwurm": "Parasiten",
  "madenwurm (enterobius vermicularis)": "Parasiten",
  "spulwurm": "Parasiten",
  "spulwurm (ascaris lumbricoides)": "Parasiten",
  "rinderbandwurm (taenia saginata)": "Parasiten",
  "schweinebandwurm (taenia solium)": "Parasiten",
  "parasiteneier allgemein": "Parasiten",
};

function classifyPathogen(name: string): string {
  const lower = name.toLowerCase().trim();
  if (PATHOGEN_GROUPS[lower]) return PATHOGEN_GROUPS[lower];
  // Fuzzy matching
  for (const [key, group] of Object.entries(PATHOGEN_GROUPS)) {
    if (lower.includes(key) || key.includes(lower)) return group;
  }
  return "Sonstige";
}

function extractProductName(title: string): string {
  // "NutraMedix SAMENTO" -> "SAMENTO"
  return title.replace(/^NutraMedix\s+/i, "").trim();
}

function parsePathogenTable(content: string): { pathogen: string; wirksamkeit: string }[] {
  const results: { pathogen: string; wirksamkeit: string }[] = [];

  // Match multiple section header variants:
  // "## 🦠 Wirkspektrum / Pathogene", "## 🦠 Wirkspektrum", "### Gegen XYZ"
  const sectionPatterns = [
    /##\s*🦠\s*Wirkspektrum\s*(?:\/?\s*Pathogene)?([\s\S]*?)(?=##\s(?!#)|$)/g,
    /###\s*Gegen\s+(\w[\s\S]*?)(?=###\s|##\s(?!#)|$)/g,
  ];

  const parseTableRows = (section: string) => {
    const rowRegex = /\|\s*\*?\*?([^|*]+?)\*?\*?\s*\|\s*([^|]+?)\s*\|/g;
    let match;
    while ((match = rowRegex.exec(section)) !== null) {
      const name = match[1].trim().replace(/\*\*/g, "");
      const wirk = match[2].trim();
      // Skip header rows and separator rows
      if (name.toLowerCase() === "pathogen" || name.toLowerCase() === "pflanze" || name.match(/^[-]+$/)) continue;
      if (wirk.toLowerCase() === "wirksamkeit" || wirk.toLowerCase() === "wirkung" || wirk.match(/^[-]+$/)) continue;
      if (wirk.toLowerCase() === "evidenzgrad" || wirk.toLowerCase() === "evidenz") continue;
      results.push({ pathogen: name, wirksamkeit: wirk });
    }
  };

  // Try primary pattern (Wirkspektrum sections)
  let sectionMatch;
  const primaryRegex = /##\s*🦠\s*Wirkspektrum\s*(?:\/?\s*Pathogene)?([\s\S]*?)(?=##\s(?!#)|$)/g;
  while ((sectionMatch = primaryRegex.exec(content)) !== null) {
    parseTableRows(sectionMatch[1]);
  }

  // Also parse "### Gegen Trichomonaden" / "### Gegen Toxoplasmen" style sections from protocol entries
  const protocolRegex = /###\s*Gegen\s+(\w+)([\s\S]*?)(?=###\s|##\s(?!#)|$)/g;
  while ((sectionMatch = protocolRegex.exec(content)) !== null) {
    const targetPathogen = sectionMatch[1].trim();
    const section = sectionMatch[2];
    // Parse 4-column table: | Pflanze | Wirkung | Evidenzgrad | Quelle |
    const rowRegex = /\|\s*\*?\*?([^|*]+?)\*?\*?\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|/g;
    let match;
    while ((match = rowRegex.exec(section)) !== null) {
      const pflanze = match[1].trim().replace(/\*\*/g, "");
      const wirkung = match[2].trim().replace(/\*\*/g, "");
      const evidenz = match[3].trim().replace(/\*\*/g, "");
      if (pflanze.toLowerCase() === "pflanze" || pflanze.match(/^[-]+$/)) continue;
      if (wirkung.toLowerCase() === "wirkung" || wirkung.match(/^[-]+$/)) continue;
      // For protocol entries, the "pathogen" is the target (e.g., Trichomonaden)
      // and the product is the plant - we store as pathogen=target, product comes from title
      results.push({ pathogen: targetPathogen, wirksamkeit: evidenz });
    }
  }

  return results;
}

function parseDosierung(content: string): string {
  // Find the dosage section
  const dosisMatch = content.match(/##\s*💊\s*Dosierung([\s\S]*?)(?=##\s|$)/);
  if (!dosisMatch) return "Siehe Produkteintrag";

  const section = dosisMatch[1];
  // Extract standard dosage from table
  const standardMatch = section.match(/\|\s*\*?\*?Standard[^|]*\*?\*?\s*\|\s*([^|]+?)\s*\|/i);
  if (standardMatch) return standardMatch[1].trim().replace(/\*\*/g, "");

  // Try to get any dosage info
  const anyDoseMatch = section.match(/\|\s*[^|]+\|\s*([^|]*(?:Tropfen|tgl|mg|ml)[^|]*)\s*\|/i);
  if (anyDoseMatch) return anyDoseMatch[1].trim().replace(/\*\*/g, "");

  return "Siehe Produkteintrag";
}

interface PathogenIndexProps {
  entries: KnowledgeEntry[];
  loading: boolean;
}

export function PathogenIndex({ entries, loading }: PathogenIndexProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState<string>("all");

  // Build pathogen index from all entries
  const pathogenIndex = useMemo(() => {
    const index: Record<string, PathogenData> = {};

    for (const entry of entries) {
      if (!entry.content) continue;

      const productName = extractProductName(entry.title);
      const pathogens = parsePathogenTable(entry.content);
      const dosierung = parseDosierung(entry.content);

      for (const { pathogen, wirksamkeit } of pathogens) {
        const key = pathogen.toLowerCase().trim();
        if (!index[key]) {
          index[key] = {
            pathogen,
            gruppe: classifyPathogen(pathogen),
            products: [],
          };
        }
        // Avoid duplicates
        if (!index[key].products.some((p) => p.productName === productName)) {
          index[key].products.push({ productName, wirksamkeit, dosierung });
        }
      }
    }

    // Sort products within each pathogen by star count (descending)
    for (const data of Object.values(index)) {
      data.products.sort((a, b) => {
        const starsA = (a.wirksamkeit.match(/⭐/g) || []).length;
        const starsB = (b.wirksamkeit.match(/⭐/g) || []).length;
        return starsB - starsA;
      });
    }

    return Object.values(index).sort((a, b) => {
      // Sort by group, then alphabetically
      if (a.gruppe !== b.gruppe) return a.gruppe.localeCompare(b.gruppe);
      return a.pathogen.localeCompare(b.pathogen);
    });
  }, [entries]);

  // Available groups
  const groups = useMemo(() => {
    const g = new Set(pathogenIndex.map((p) => p.gruppe));
    return Array.from(g).sort();
  }, [pathogenIndex]);

  // Filter
  const filtered = useMemo(() => {
    let result = pathogenIndex;
    if (groupFilter && groupFilter !== "all") {
      result = result.filter((p) => p.gruppe === groupFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.pathogen.toLowerCase().includes(q) ||
          p.products.some((pr) => pr.productName.toLowerCase().includes(q))
      );
    }
    return result;
  }, [pathogenIndex, groupFilter, searchQuery]);

  const totalProducts = useMemo(
    () => new Set(pathogenIndex.flatMap((p) => p.products.map((pr) => pr.productName))).size,
    [pathogenIndex]
  );

  const groupColors: Record<string, string> = {
    Bakterien: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    Viren: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    Pilze: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    Parasiten: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    Sonstige: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-muted/50 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="flex flex-wrap gap-3 text-sm">
        <Badge variant="outline" className="gap-1">
          <Bug className="h-3 w-3" />
          {pathogenIndex.length} Pathogene
        </Badge>
        <Badge variant="outline" className="gap-1">
          <Pill className="h-3 w-3" />
          {totalProducts} Produkte
        </Badge>
        {groups.map((g) => (
          <Badge
            key={g}
            className={`cursor-pointer ${groupColors[g] || ""} ${groupFilter === g ? "ring-2 ring-primary" : ""}`}
            onClick={() => setGroupFilter(groupFilter === g ? "all" : g)}
          >
            {g} ({pathogenIndex.filter((p) => p.gruppe === g).length})
          </Badge>
        ))}
      </div>

      {/* Search & Filter */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pathogen oder Produkt suchen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={groupFilter} onValueChange={setGroupFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Gruppe filtern" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Gruppen</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(searchQuery || groupFilter !== "all") && (
              <button
                onClick={() => { setSearchQuery(""); setGroupFilter("all"); }}
                className="text-primary hover:underline flex items-center gap-1 text-sm whitespace-nowrap"
              >
                <X className="h-3 w-3" /> Zurücksetzen
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results info */}
      <p className="text-sm text-muted-foreground">
        {filtered.length} von {pathogenIndex.length} Pathogenen
      </p>

      {/* Pathogen Table */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Keine Pathogene gefunden.
          </CardContent>
        </Card>
      ) : (
        filtered.map((pathogenData) => (
          <Card key={pathogenData.pathogen}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <CardTitle className="text-base font-semibold">{pathogenData.pathogen}</CardTitle>
                <Badge className={groupColors[pathogenData.gruppe] || ""}>
                  {pathogenData.gruppe}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {pathogenData.products.length} Mittel
                </span>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[160px]">Produkt</TableHead>
                    <TableHead className="w-[280px]">Wirksamkeit</TableHead>
                    <TableHead>Dosierung</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pathogenData.products.map((product) => (
                    <TableRow key={product.productName}>
                      <TableCell className="font-medium">{product.productName}</TableCell>
                      <TableCell className="text-sm">{product.wirksamkeit}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{product.dosierung}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
