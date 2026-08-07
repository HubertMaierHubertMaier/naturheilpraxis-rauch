import { useEffect, useRef, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  BarChart3,
  ClipboardCopy,
  Download,
  FileJson,
  FileText,
  Sparkles,
  Upload,
  Users,
} from "lucide-react";

type ParticipantFormData = {
  name: string;
  category: string;
  business: string;
  website: string;
  social: string;
  businessFocus: string;
  coreServices: string;
  knownFor: string;
  thinkOfMeWhen: string;
  clientQuotes: string;
  multipliers: string;
  cooperations: string;
  topics: string;
  contribution: string;
  groupWish: string;
  boundary: string;
  logoStatus: string;
  photoStatus: string;
  profileRelease: string;
};

type ParticipantExport = {
  source: string;
  version: number;
  exportedAt: string;
  data: ParticipantFormData;
};

type DashboardEntry = {
  id: string;
  sourceFile: string;
  importedAt: string;
  data: ParticipantFormData;
};

const FORM_STORAGE_KEY = "bni-gesundheitsrunde-formular-app-v1";
const DASHBOARD_STORAGE_KEY = "bni-gesundheitsrunde-dashboard-app-v1";
const FORM_VERSION = 1;

const totalSteps = 5;

const stepMeta = [
  {
    title: "1. Basis",
    description: "Name, Kategorie, Unternehmen, Website",
  },
  {
    title: "2. Profil",
    description: "Leistungen, Positionierung, typische Aussagen",
  },
  {
    title: "3. Kooperation",
    description: "Multiplikatoren, Themen und Gruppenfit",
  },
  {
    title: "4. Freigaben",
    description: "Beitrag, Wunsch, Abgrenzung, Medien",
  },
  {
    title: "5. Export",
    description: "Vorschau, Kopieren, Download",
  },
] as const;

const emptyFormData: ParticipantFormData = {
  name: "",
  category: "",
  business: "",
  website: "",
  social: "",
  businessFocus: "",
  coreServices: "",
  knownFor: "",
  thinkOfMeWhen: "",
  clientQuotes: "",
  multipliers: "",
  cooperations: "",
  topics: "",
  contribution: "",
  groupWish: "",
  boundary: "",
  logoStatus: "",
  photoStatus: "",
  profileRelease: "",
};

function splitLines(value: string) {
  return value
    .split(/\r?\n|;|,/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function slugify(value: string) {
  return (value || "teilnehmerprofil")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "teilnehmerprofil";
}

function downloadBlob(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const helper = document.createElement("textarea");
    helper.value = text;
    document.body.appendChild(helper);
    helper.select();
    document.execCommand("copy");
    helper.remove();
  }
}

function csvEscape(value: string) {
  return `"${(value || "").replace(/\r?\n/g, " | ").replace(/"/g, '""')}"`;
}

function buildFormSummary(data: ParticipantFormData) {
  const parts: string[] = [];
  const addLine = (label: string, value: string) => {
    if (value) {
      parts.push(`${label}: ${value}`);
    }
  };

  const addListBlock = (title: string, values: string[]) => {
    if (!values.length) return;
    parts.push("");
    parts.push(`${title}:`);
    values.forEach((value) => parts.push(`- ${value}`));
  };

  parts.push("BNI GESUNDHEITSRUNDE - TEILNEHMERPROFIL");
  parts.push("");

  addLine("Name", data.name);
  addLine("BNI-Kategorie", data.category);
  addLine("Unternehmen / Praxis", data.business);
  addLine("Website", data.website);
  addLine("Social Media", data.social);
  addLine("Kurzprofil", data.businessFocus);

  addListBlock("Meine 3 wichtigsten Leistungen", splitLines(data.coreServices));
  addLine("Dafuer moechte ich in der Runde bekannt sein", data.knownFor);
  addLine("An mich sollte man denken, wenn", data.thinkOfMeWhen);
  addListBlock("Drei Saetze, die ich oft hoere", splitLines(data.clientQuotes));
  addListBlock("Top Multiplikatoren / Branchen", splitLines(data.multipliers));
  addListBlock("Kooperationsmoeglichkeiten in der Gruppe", splitLines(data.cooperations));
  addListBlock("Vortrags- / Workshopthemen", splitLines(data.topics));
  addLine("Das kann ich der Gruppe konkret geben", data.contribution);
  addLine("Das wuensche ich mir von der Gruppe", data.groupWish);
  addLine("Wichtige Abgrenzung", data.boundary);

  parts.push("");
  addLine("Logo vorhanden", data.logoStatus);
  addLine("Foto vorhanden", data.photoStatus);
  addLine("Kurzprofil darf verwendet werden", data.profileRelease);

  return parts.join("\n").trim();
}

function buildParticipantCsv(data: ParticipantFormData) {
  const headers = [
    "Name",
    "BNI_Kategorie",
    "Unternehmen_Praxis",
    "Website",
    "Social_Media",
    "Kurzprofil",
    "Kernleistungen",
    "Bekannt_fuer",
    "An_mich_denken_wenn",
    "Typische_Saetze",
    "Multiplikatoren",
    "Kooperationen",
    "Vortragsthemen",
    "Beitrag",
    "Wunsch",
    "Abgrenzung",
    "Logo",
    "Foto",
    "Kurzprofil_Freigabe",
  ];

  const row = [
    data.name,
    data.category,
    data.business,
    data.website,
    data.social,
    data.businessFocus,
    data.coreServices,
    data.knownFor,
    data.thinkOfMeWhen,
    data.clientQuotes,
    data.multipliers,
    data.cooperations,
    data.topics,
    data.contribution,
    data.groupWish,
    data.boundary,
    data.logoStatus,
    data.photoStatus,
    data.profileRelease,
  ];

  return `${headers.join(";")}\n${row.map(csvEscape).join(";")}`;
}

function buildEntryKey(data: ParticipantFormData, fallback: string) {
  const key = `${data.name}__${data.business}`.toLowerCase().trim();
  return key || fallback.toLowerCase();
}

function collectTopValues(entries: DashboardEntry[], selector: (entry: DashboardEntry) => string) {
  const counts = new Map<string, number>();

  entries.forEach((entry) => {
    splitLines(selector(entry)).forEach((value) => {
      counts.set(value, (counts.get(value) || 0) + 1);
    });
  });

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 10);
}

function buildDashboardCsv(entries: DashboardEntry[]) {
  const headers = [
    "Name",
    "BNI_Kategorie",
    "Unternehmen_Praxis",
    "Website",
    "Social_Media",
    "Kurzprofil",
    "Kernleistungen",
    "Bekannt_fuer",
    "An_mich_denken_wenn",
    "Typische_Saetze",
    "Multiplikatoren",
    "Kooperationen",
    "Vortragsthemen",
    "Beitrag",
    "Wunsch",
    "Abgrenzung",
    "Logo",
    "Foto",
    "Kurzprofil_Freigabe",
    "Importiert_am",
    "Quelldatei",
  ];

  const rows = entries.map(({ importedAt, sourceFile, data }) => [
    data.name,
    data.category,
    data.business,
    data.website,
    data.social,
    data.businessFocus,
    data.coreServices,
    data.knownFor,
    data.thinkOfMeWhen,
    data.clientQuotes,
    data.multipliers,
    data.cooperations,
    data.topics,
    data.contribution,
    data.groupWish,
    data.boundary,
    data.logoStatus,
    data.photoStatus,
    data.profileRelease,
    importedAt,
    sourceFile,
  ]);

  return [headers.join(";"), ...rows.map((row) => row.map((value) => csvEscape(value || "")).join(";"))].join("\n");
}

function buildAIBriefing(entries: DashboardEntry[]) {
  const topMultipliers = collectTopValues(entries, (entry) => entry.data.multipliers);
  const topTopics = collectTopValues(entries, (entry) => entry.data.topics);

  const lines: string[] = [];
  lines.push("BNI GESUNDHEITSRUNDE - KI BRIEFING");
  lines.push("");
  lines.push(`Teilnehmerzahl: ${entries.length}`);
  lines.push("");
  lines.push("Teilnehmerprofile:");

  entries.forEach((entry, index) => {
    lines.push("");
    lines.push(`${index + 1}. ${entry.data.name || "Ohne Namen"} - ${entry.data.category || "Ohne Kategorie"}`);
    if (entry.data.business) lines.push(`   Unternehmen / Praxis: ${entry.data.business}`);
    if (entry.data.knownFor) lines.push(`   Bekannt fuer: ${entry.data.knownFor}`);
    if (entry.data.thinkOfMeWhen) lines.push(`   An mich denken, wenn: ${entry.data.thinkOfMeWhen}`);
    if (entry.data.multipliers) lines.push(`   Multiplikatoren: ${splitLines(entry.data.multipliers).join(", ")}`);
    if (entry.data.cooperations) lines.push(`   Kooperationen: ${splitLines(entry.data.cooperations).join(", ")}`);
    if (entry.data.topics) lines.push(`   Vortragsthemen: ${splitLines(entry.data.topics).join(", ")}`);
  });

  lines.push("");
  lines.push("Haeufigste Multiplikatoren:");
  topMultipliers.forEach(([label, count]) => lines.push(`- ${label}: ${count}`));

  lines.push("");
  lines.push("Haeufigste Vortragsthemen:");
  topTopics.forEach(([label, count]) => lines.push(`- ${label}: ${count}`));

  lines.push("");
  lines.push("Bitte daraus ableiten:");
  lines.push("- die wichtigsten gemeinsamen Multiplikatoren");
  lines.push("- moegliche Kooperationspaare in der Gruppe");
  lines.push("- gemeinsame Vortragsthemen");
  lines.push("- eine Positionierung fuer Flyer, Landingpage und 16.10.-Praesentation");

  return lines.join("\n");
}

function parseImportedData(raw: unknown) {
  if (!raw || typeof raw !== "object") return null;

  const record = raw as Record<string, unknown>;
  const data = record.data;
  if (!data || typeof data !== "object") return null;

  const payload = data as Record<string, unknown>;

  const normalized: ParticipantFormData = {
    name: String(payload.name || ""),
    category: String(payload.category || ""),
    business: String(payload.business || ""),
    website: String(payload.website || ""),
    social: String(payload.social || ""),
    businessFocus: String(payload.businessFocus || ""),
    coreServices: String(payload.coreServices || ""),
    knownFor: String(payload.knownFor || ""),
    thinkOfMeWhen: String(payload.thinkOfMeWhen || ""),
    clientQuotes: String(payload.clientQuotes || ""),
    multipliers: String(payload.multipliers || ""),
    cooperations: String(payload.cooperations || ""),
    topics: String(payload.topics || ""),
    contribution: String(payload.contribution || ""),
    groupWish: String(payload.groupWish || ""),
    boundary: String(payload.boundary || ""),
    logoStatus: String(payload.logoStatus || ""),
    photoStatus: String(payload.photoStatus || ""),
    profileRelease: String(payload.profileRelease || ""),
  };

  if (!normalized.name && !normalized.business) return null;
  return normalized;
}

function StatCard({ title, value, hint }: { title: string; value: string; hint: string }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-3xl font-serif">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function SidebarStepCard({
  active,
  title,
  description,
}: {
  active: boolean;
  title: string;
  description: string;
}) {
  return (
    <div className={`rounded-xl border p-4 transition-colors ${active ? "border-primary bg-primary/5" : "bg-muted/40"}`}>
      <p className="font-medium text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export default function BNIGesundheitsrunde() {
  const [formData, setFormData] = useState<ParticipantFormData>(emptyFormData);
  const [currentStep, setCurrentStep] = useState(1);
  const [saveMessage, setSaveMessage] = useState("Noch nicht gespeichert");
  const [entries, setEntries] = useState<DashboardEntry[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const rawForm = window.localStorage.getItem(FORM_STORAGE_KEY);
    if (rawForm) {
      try {
        const parsed = JSON.parse(rawForm) as { data?: ParticipantFormData; currentStep?: number; updatedAt?: string };
        if (parsed.data) {
          setFormData({ ...emptyFormData, ...parsed.data });
        }
        if (parsed.currentStep) {
          setCurrentStep(Math.min(Math.max(parsed.currentStep, 1), totalSteps));
        }
        if (parsed.updatedAt) {
          setSaveMessage(`Letzter Stand geladen: ${new Date(parsed.updatedAt).toLocaleString("de-DE")}`);
        }
      } catch {
        setSaveMessage("Gespeicherter Formularstand konnte nicht geladen werden");
      }
    }

    const rawDashboard = window.localStorage.getItem(DASHBOARD_STORAGE_KEY);
    if (rawDashboard) {
      try {
        const parsed = JSON.parse(rawDashboard) as DashboardEntry[];
        setEntries(parsed);
      } catch {
        toast.error("Das Auswertungs-Dashboard konnte nicht aus dem Browser geladen werden.");
      }
    }
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      window.localStorage.setItem(
        FORM_STORAGE_KEY,
        JSON.stringify({
          version: FORM_VERSION,
          currentStep,
          updatedAt: new Date().toISOString(),
          data: formData,
        }),
      );
      setSaveMessage(`Automatisch gespeichert: ${new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`);
    }, 250);

    return () => window.clearTimeout(handle);
  }, [formData, currentStep]);

  useEffect(() => {
    window.localStorage.setItem(DASHBOARD_STORAGE_KEY, JSON.stringify(entries));
  }, [entries]);

  function setField<K extends keyof ParticipantFormData>(key: K, value: ParticipantFormData[K]) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  const summaryText = buildFormSummary(formData);
  const formExport: ParticipantExport = {
    source: "bni-gesundheitsrunde-app",
    version: FORM_VERSION,
    exportedAt: new Date().toISOString(),
    data: formData,
  };

  const topMultipliers = collectTopValues(entries, (entry) => entry.data.multipliers);
  const topTopics = collectTopValues(entries, (entry) => entry.data.topics);

  async function handleCopySummary() {
    await copyToClipboard(summaryText);
    toast.success("Das Teilnehmerprofil wurde in die Zwischenablage kopiert.");
  }

  function handleDownloadText() {
    downloadBlob(`${slugify(formData.name)}-gesundheitsrunde-profil.txt`, summaryText, "text/plain;charset=utf-8");
    toast.success("Die Textdatei wurde heruntergeladen.");
  }

  function handleDownloadJson() {
    downloadBlob(
      `${slugify(formData.name)}-gesundheitsrunde-profil.json`,
      JSON.stringify(formExport, null, 2),
      "application/json;charset=utf-8",
    );
    toast.success("Die JSON-Datei wurde heruntergeladen.");
  }

  function handleDownloadCsvRow() {
    downloadBlob(`${slugify(formData.name)}-gesundheitsrunde-zeile.csv`, buildParticipantCsv(formData), "text/csv;charset=utf-8");
    toast.success("Die CSV-Zeile wurde heruntergeladen.");
  }

  function handleResetForm() {
    if (!window.confirm("Wirklich alle Eingaben im Formular loeschen?")) return;
    setFormData(emptyFormData);
    setCurrentStep(1);
    window.localStorage.removeItem(FORM_STORAGE_KEY);
    setSaveMessage("Alle Eingaben wurden geloescht");
    toast.success("Das Formular wurde zurueckgesetzt.");
  }

  async function handleImportFiles(fileList: FileList | null) {
    if (!fileList?.length) return;

    const imported: DashboardEntry[] = [];
    const failed: string[] = [];

    for (const file of Array.from(fileList)) {
      try {
        const raw = JSON.parse(await file.text()) as unknown;
        const data = parseImportedData(raw);
        if (!data) {
          failed.push(file.name);
          continue;
        }

        imported.push({
          id: buildEntryKey(data, file.name),
          sourceFile: file.name,
          importedAt: new Date().toISOString(),
          data,
        });
      } catch {
        failed.push(file.name);
      }
    }

    if (imported.length) {
      setEntries((prev) => {
        const next = new Map(prev.map((entry) => [entry.id, entry]));
        imported.forEach((entry) => next.set(entry.id, entry));
        return Array.from(next.values()).sort((a, b) => a.data.name.localeCompare(b.data.name, "de"));
      });
      toast.success(`${imported.length} Profil(e) wurden in das Dashboard importiert.`);
    }

    if (failed.length) {
      toast.error(`Diese Datei(en) konnten nicht gelesen werden: ${failed.join(", ")}`);
    }
  }

  function handleDashboardCsvExport() {
    downloadBlob("gesundheitsrunde-auswertung.csv", buildDashboardCsv(entries), "text/csv;charset=utf-8");
    toast.success("Die gemeinsame CSV-Auswertung wurde heruntergeladen.");
  }

  async function handleCopyAIBriefing() {
    await copyToClipboard(buildAIBriefing(entries));
    toast.success("Das KI-Briefing wurde in die Zwischenablage kopiert.");
  }

  function handleClearDashboard() {
    if (!window.confirm("Wirklich alle importierten Antworten aus dem Dashboard entfernen?")) return;
    setEntries([]);
    window.localStorage.removeItem(DASHBOARD_STORAGE_KEY);
    toast.success("Das Dashboard wurde geleert.");
  }

  return (
    <Layout mainAriaLabel="BNI Gesundheitsrunde Arbeitsbereich">
      <div className="bg-gradient-to-br from-sage-950 via-sage-800 to-sage-700 px-4 py-16 text-primary-foreground">
        <div className="container max-w-6xl">
          <Badge className="mb-4 bg-white/15 text-white hover:bg-white/15">BNI Claudius - Gesundheitsrunde</Badge>
          <h1 className="max-w-4xl font-serif text-4xl font-semibold tracking-tight sm:text-5xl">
            Freundliches Formular und automatische Auswertung in einer App
          </h1>
          <p className="mt-4 max-w-3xl text-base text-white/85 sm:text-lg">
            Statt trockener Textdateien gibt es hier einen gefuehrten Teilnehmer-Bogen mit Autosave,
            Export und ein Dashboard fuer die gemeinsame Auswertung mit KI-Briefing.
          </p>
        </div>
      </div>

      <div className="container max-w-6xl py-8">
        <Card className="mb-6 border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="font-serif text-2xl">Lovable-faehige HTML-Uebergabe</CardTitle>
            <CardDescription>
              Die Reveal-Slides aus `BNI-Claudius/gesundheitsrunde-beispiel-fuer-die-gruppe.html` liegen jetzt zusaetzlich als deploybare
              Datei unter `/bni-claudius/gesundheitsrunde-beispiel-fuer-die-gruppe.html`.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <a href="/bni-claudius/gesundheitsrunde-beispiel-fuer-die-gruppe.html" target="_blank" rel="noreferrer">
                <FileText className="h-4 w-4" />
                Slide-HTML oeffnen
              </a>
            </Button>
          </CardContent>
        </Card>

        <Tabs defaultValue="formular" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 md:w-[420px]">
            <TabsTrigger value="formular" className="gap-2">
              <Users className="h-4 w-4" />
              Teilnehmer-Formular
            </TabsTrigger>
            <TabsTrigger value="auswertung" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Auswertungs-Dashboard
            </TabsTrigger>
          </TabsList>

          <TabsContent value="formular" className="space-y-6">
            <Alert>
              <Sparkles className="h-4 w-4" />
              <AlertTitle>So sollte die Gruppe dieses Formular benutzen</AlertTitle>
              <AlertDescription>
                Die Teilnehmer koennen ihre Antworten direkt hier eingeben und dann als JSON-Datei exportieren.
                Genau diese JSON-Dateien lassen sich spaeter unten im Dashboard gesammelt importieren.
              </AlertDescription>
            </Alert>

            <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
              <Card className="h-fit lg:sticky lg:top-4">
                <CardHeader>
                  <CardTitle className="font-serif text-2xl">Schritt fuer Schritt</CardTitle>
                  <CardDescription>
                    Alles wird lokal im Browser gespeichert. Es reichen einfache Stichpunkte.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {stepMeta.map((step, index) => (
                    <SidebarStepCard
                      key={step.title}
                      active={currentStep === index + 1}
                      title={step.title}
                      description={step.description}
                    />
                  ))}

                  <Separator className="my-4" />

                  <div className="space-y-3">
                    <Button variant="outline" className="w-full" onClick={() => setSaveMessage(`Automatisch gespeichert: ${new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`)}>
                      Speicherstatus anzeigen
                    </Button>
                    <Button variant="ghost" className="w-full" onClick={handleResetForm}>
                      Formular leeren
                    </Button>
                    <p className="text-sm text-muted-foreground">{saveMessage}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle className="font-serif text-2xl">Teilnehmer-Bogen</CardTitle>
                      <CardDescription>Freundlich, gefuehrt und exportierbar statt menschenfeindlicher Textabfrage.</CardDescription>
                    </div>
                    <Badge variant="secondary">Schritt {currentStep} von {totalSteps}</Badge>
                  </div>
                  <Progress value={(currentStep / totalSteps) * 100} />
                </CardHeader>
                <CardContent className="space-y-6">
                  {currentStep === 1 && (
                    <div className="space-y-5">
                      <div className="grid gap-5 md:grid-cols-2">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-foreground" htmlFor="name">Name</label>
                          <Input id="name" value={formData.name} onChange={(event) => setField("name", event.target.value)} placeholder="z. B. Peter Rauch" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-foreground" htmlFor="category">BNI-Kategorie</label>
                          <Input id="category" value={formData.category} onChange={(event) => setField("category", event.target.value)} placeholder="z. B. Heilpraktik" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-foreground" htmlFor="business">Unternehmen / Praxis</label>
                          <Input id="business" value={formData.business} onChange={(event) => setField("business", event.target.value)} placeholder="z. B. Naturheilpraxis Peter Rauch" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-foreground" htmlFor="website">Website</label>
                          <Input id="website" value={formData.website} onChange={(event) => setField("website", event.target.value)} placeholder="z. B. rauch-heilpraktiker.de" />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground" htmlFor="social">Social Media</label>
                        <Input id="social" value={formData.social} onChange={(event) => setField("social", event.target.value)} placeholder="z. B. Instagram oder LinkedIn" />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground" htmlFor="businessFocus">In einem Satz: Was machst du hauptsaechlich?</label>
                        <p className="rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
                          Beispiel: Ich begleite Menschen mit ganzheitlicher Diagnostik und Naturheilkunde bei Praevention, Orientierung und wiederkehrenden Beschwerden.
                        </p>
                        <Textarea id="businessFocus" value={formData.businessFocus} onChange={(event) => setField("businessFocus", event.target.value)} className="min-h-[110px]" placeholder="Ein klarer Satz reicht voellig." />
                      </div>
                    </div>
                  )}

                  {currentStep === 2 && (
                    <div className="space-y-5">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground" htmlFor="coreServices">Meine 3 wichtigsten Leistungen</label>
                        <p className="rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
                          Beispiel: Ernaehrungsberatung fuer Frauen in Stressphasen | Rueckenkurse / Firmenfitness | Gesundheitsvortraege fuer Unternehmen
                        </p>
                        <Textarea id="coreServices" value={formData.coreServices} onChange={(event) => setField("coreServices", event.target.value)} placeholder="Bitte moeglichst je Zeile ein Punkt." />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground" htmlFor="knownFor">Dafuer moechte ich in der Runde bekannt sein</label>
                        <p className="rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
                          Beispiel: fuer ganzheitliche Einordnung, Praevention und Orientierung bei komplexeren Gesundheitsfragen
                        </p>
                        <Textarea id="knownFor" value={formData.knownFor} onChange={(event) => setField("knownFor", event.target.value)} className="min-h-[110px]" placeholder="Ein oder zwei klare Saetze reichen." />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground" htmlFor="thinkOfMeWhen">An mich sollte man denken, wenn ...</label>
                        <p className="rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
                          Beispiel: wenn jemand nicht nur ein Symptom hat, sondern mehrere Themen zusammenkommen und eine verstaendliche Einordnung braucht
                        </p>
                        <Textarea id="thinkOfMeWhen" value={formData.thinkOfMeWhen} onChange={(event) => setField("thinkOfMeWhen", event.target.value)} className="min-h-[110px]" placeholder="Wann soll die Gruppe an dich denken?" />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground" htmlFor="clientQuotes">Drei Saetze, die ich oft von Kunden / Patienten / Klienten hoere</label>
                        <p className="rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
                          Beispiel: Ich habe schon vieles probiert, aber es kommt immer wieder. | Ich brauche endlich einen Plan, der zu meinem Alltag passt. | Ich weiss nicht, wer mir wirklich helfen kann.
                        </p>
                        <Textarea id="clientQuotes" value={formData.clientQuotes} onChange={(event) => setField("clientQuotes", event.target.value)} placeholder="Bitte moeglichst je Zeile ein Satz." />
                      </div>
                    </div>
                  )}

                  {currentStep === 3 && (
                    <div className="space-y-5">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground" htmlFor="multipliers">Meine Top 3 bis 5 Wunsch-Multiplikatoren / Branchen</label>
                        <p className="rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
                          Beispiel: Physiotherapeuten | Orthopaeden | Psychotherapeuten | Apotheken | BGM / HR in Unternehmen
                        </p>
                        <Textarea id="multipliers" value={formData.multipliers} onChange={(event) => setField("multipliers", event.target.value)} placeholder="Bitte moeglichst je Zeile ein Multiplikator." />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground" htmlFor="cooperations">Mit wem aus der Gruppe sehe ich gute Kooperationsmoeglichkeiten?</label>
                        <p className="rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
                          Beispiel: mit Nadine Spiel fuer Ernaehrung + Vortrag | mit Christina Herrmann fuer Psyche + Koerper | mit Chong Liu fuer lokale Gesundheitsversorgung
                        </p>
                        <Textarea id="cooperations" value={formData.cooperations} onChange={(event) => setField("cooperations", event.target.value)} placeholder="Bitte moeglichst je Zeile eine Idee." />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground" htmlFor="topics">Diese Themen koennte ich fuer gemeinsame Vortraege / Workshops beisteuern</label>
                        <p className="rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
                          Beispiel: Stress und Regeneration | Darm, Ernaehrung und Energie | Gesund bleiben im Unternehmeralltag
                        </p>
                        <Textarea id="topics" value={formData.topics} onChange={(event) => setField("topics", event.target.value)} placeholder="Bitte moeglichst je Zeile ein Thema." />
                      </div>
                    </div>
                  )}

                  {currentStep === 4 && (
                    <div className="space-y-5">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground" htmlFor="contribution">Das kann ich der Gruppe konkret geben</label>
                        <p className="rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
                          Beispiel: Vortrag, Workshop, Kontakt zu Unternehmen, Social-Media-Input, Fachwissen zu meinem Gesundheitsbereich
                        </p>
                        <Textarea id="contribution" value={formData.contribution} onChange={(event) => setField("contribution", event.target.value)} className="min-h-[110px]" placeholder="Was kannst du konkret einbringen?" />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground" htmlFor="groupWish">Das wuensche ich mir konkret von der Gruppe</label>
                        <p className="rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
                          Beispiel: mehr Sichtbarkeit, klare Weiterempfehlungen, gute Kooperationen, passende Besucher im Chapter
                        </p>
                        <Textarea id="groupWish" value={formData.groupWish} onChange={(event) => setField("groupWish", event.target.value)} className="min-h-[110px]" placeholder="Was wuenschst du dir konkret?" />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground" htmlFor="boundary">Wichtige Abgrenzung meiner Rolle / meines Angebots</label>
                        <p className="rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
                          Beispiel: Ich arbeite eher praeventiv und begleitend. Ich bin nicht fuer akute Notfaelle da. Ich bin nicht im manuellen Bereich positioniert.
                        </p>
                        <Textarea id="boundary" value={formData.boundary} onChange={(event) => setField("boundary", event.target.value)} className="min-h-[110px]" placeholder="Wo braucht die Gruppe eine saubere Abgrenzung?" />
                      </div>

                      <div className="grid gap-5 md:grid-cols-3">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-foreground" htmlFor="logoStatus">Logo vorhanden</label>
                          <select
                            id="logoStatus"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={formData.logoStatus}
                            onChange={(event) => setField("logoStatus", event.target.value)}
                          >
                            <option value="">Bitte waehlen</option>
                            <option value="Ja">Ja</option>
                            <option value="Nein">Nein</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-foreground" htmlFor="photoStatus">Foto vorhanden</label>
                          <select
                            id="photoStatus"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={formData.photoStatus}
                            onChange={(event) => setField("photoStatus", event.target.value)}
                          >
                            <option value="">Bitte waehlen</option>
                            <option value="Ja">Ja</option>
                            <option value="Nein">Nein</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-foreground" htmlFor="profileRelease">Kurzprofil darf verwendet werden</label>
                          <select
                            id="profileRelease"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={formData.profileRelease}
                            onChange={(event) => setField("profileRelease", event.target.value)}
                          >
                            <option value="">Bitte waehlen</option>
                            <option value="Ja">Ja</option>
                            <option value="Nein">Nein</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {currentStep === 5 && (
                    <div className="space-y-5">
                      <Alert>
                        <FileText className="h-4 w-4" />
                        <AlertTitle>Empfohlener Ablauf</AlertTitle>
                        <AlertDescription>
                          Am besten das Profil als JSON-Datei herunterladen und an den Organisator weitergeben.
                          Genau diese JSON-Datei kann spaeter gesammelt in das Dashboard importiert werden.
                        </AlertDescription>
                      </Alert>

                      <Card className="bg-muted/40">
                        <CardHeader>
                          <CardTitle className="text-xl">Vorschau</CardTitle>
                          <CardDescription>So sieht dein Profil als zusammenhaengender Text aus.</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-foreground">{summaryText || "Noch keine Daten vorhanden."}</pre>
                        </CardContent>
                      </Card>

                      <div className="grid gap-3 md:grid-cols-2">
                        <Button variant="hero" onClick={handleCopySummary}>
                          <ClipboardCopy className="h-4 w-4" />
                          Text kopieren
                        </Button>
                        <Button variant="accent" onClick={handleDownloadText}>
                          <Download className="h-4 w-4" />
                          Textdatei herunterladen
                        </Button>
                        <Button variant="outline" onClick={handleDownloadJson}>
                          <FileJson className="h-4 w-4" />
                          JSON fuer Auswertung herunterladen
                        </Button>
                        <Button variant="outline" onClick={handleDownloadCsvRow}>
                          <Download className="h-4 w-4" />
                          CSV-Zeile herunterladen
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <Button variant="ghost" onClick={() => setCurrentStep((step) => Math.max(step - 1, 1))} disabled={currentStep === 1}>
                      Zurueck
                    </Button>
                    <Button onClick={() => setCurrentStep((step) => Math.min(step + 1, totalSteps))} disabled={currentStep === totalSteps}>
                      Weiter
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="auswertung" className="space-y-6">
            <Alert>
              <Upload className="h-4 w-4" />
              <AlertTitle>Dashboard fuer den Organisator</AlertTitle>
              <AlertDescription>
                Hier lassen sich die JSON-Exporte der Teilnehmer gesammelt importieren, auswerten und wieder als CSV oder KI-Briefing exportieren.
              </AlertDescription>
            </Alert>

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4" />
                JSON-Dateien importieren
              </Button>
              <Button variant="outline" onClick={handleDashboardCsvExport} disabled={entries.length === 0}>
                <Download className="h-4 w-4" />
                Gemeinsame CSV exportieren
              </Button>
              <Button variant="outline" onClick={handleCopyAIBriefing} disabled={entries.length === 0}>
                <Sparkles className="h-4 w-4" />
                KI-Briefing kopieren
              </Button>
              <Button variant="ghost" onClick={handleClearDashboard} disabled={entries.length === 0}>
                Dashboard leeren
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                multiple
                className="hidden"
                onChange={(event) => {
                  handleImportFiles(event.target.files);
                  event.currentTarget.value = "";
                }}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <StatCard title="Importierte Profile" value={String(entries.length)} hint="Anzahl der aktuell im Dashboard geladenen Teilnehmerprofile" />
              <StatCard title="Top Multiplikatoren" value={String(topMultipliers.length)} hint="Unterschiedliche Begriffe aus den bisherigen Multiplikator-Antworten" />
              <StatCard title="Top Vortragsthemen" value={String(topTopics.length)} hint="Unterschiedliche Vortragsthemen aus den bisherigen Importen" />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="font-serif text-2xl">Haeufigste Multiplikatoren</CardTitle>
                  <CardDescription>Die Liste wird automatisch aus allen importierten Profilen erzeugt.</CardDescription>
                </CardHeader>
                <CardContent>
                  {topMultipliers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Noch keine Daten vorhanden.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {topMultipliers.map(([label, count]) => (
                        <Badge key={label} variant="secondary" className="px-3 py-1 text-sm">
                          {label} ({count})
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="font-serif text-2xl">Haeufigste Vortragsthemen</CardTitle>
                  <CardDescription>Auch diese Liste wird direkt aus den Teilnehmerantworten verdichtet.</CardDescription>
                </CardHeader>
                <CardContent>
                  {topTopics.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Noch keine Daten vorhanden.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {topTopics.map(([label, count]) => (
                        <Badge key={label} variant="secondary" className="px-3 py-1 text-sm">
                          {label} ({count})
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="font-serif text-2xl">Importierte Teilnehmer</CardTitle>
                <CardDescription>
                  Kompakte Uebersicht aller bisher geladenen Profile. Beim erneuten Import derselben Person wird der vorhandene Eintrag aktualisiert.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {entries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Noch keine JSON-Dateien importiert.</p>
                ) : (
                  <div className="space-y-4">
                    {entries.map((entry) => (
                      <div key={entry.id} className="rounded-xl border bg-muted/30 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="font-serif text-xl text-foreground">{entry.data.name || "Ohne Namen"}</h3>
                            <p className="text-sm text-muted-foreground">
                              {entry.data.category || "Ohne Kategorie"}
                              {entry.data.business ? ` - ${entry.data.business}` : ""}
                            </p>
                          </div>
                          <Badge variant="outline">{entry.sourceFile}</Badge>
                        </div>

                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <div>
                            <p className="text-sm font-medium text-foreground">Bekannt fuer</p>
                            <p className="mt-1 text-sm text-muted-foreground">{entry.data.knownFor || "-"}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">An mich denken, wenn</p>
                            <p className="mt-1 text-sm text-muted-foreground">{entry.data.thinkOfMeWhen || "-"}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">Multiplikatoren</p>
                            <p className="mt-1 text-sm text-muted-foreground">{splitLines(entry.data.multipliers).join(", ") || "-"}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">Vortragsthemen</p>
                            <p className="mt-1 text-sm text-muted-foreground">{splitLines(entry.data.topics).join(", ") || "-"}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
