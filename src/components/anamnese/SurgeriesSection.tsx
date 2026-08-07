import { useState } from "react";
import { format, differenceInWeeks, parse, isValid } from "date-fns";
import { de, enUS } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLanguage } from "@/contexts/LanguageContext";
import { AnamneseFormData } from "@/lib/anamneseFormData";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, CalendarIcon, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import TemporalStatusSelect from "./shared/TemporalStatusSelect";

interface SurgeriesSectionProps {
  formData: AnamneseFormData;
  updateFormData: (field: string, value: any) => void;
}

const SurgeriesSection = ({ formData, updateFormData }: SurgeriesSectionProps) => {
  const { language } = useLanguage();

  const birthYear = formData.geburtsdatum
    ? new Date(formData.geburtsdatum).getFullYear()
    : undefined;

  const updateUnfaelleOperationen = (field: string, value: any) => {
    updateFormData("unfaelleOperationen", {
      ...formData.unfaelleOperationen,
      [field]: value
    });
  };

  const updateNestedField = (parentField: string, field: string, value: any) => {
    updateFormData("unfaelleOperationen", {
      ...formData.unfaelleOperationen,
      [parentField]: {
        ...(formData.unfaelleOperationen[parentField as keyof typeof formData.unfaelleOperationen] as object),
        [field]: value
      }
    });
  };

  const parseYearMonth = (raw: string) => {
    if (!raw) return { year: "", month: "" };
    const m = raw.match(/^(\d{4})(?:-(\d{2}))?$/);
    if (!m) return { year: "", month: "" };
    return { year: m[1] ?? "", month: m[2] ?? "" };
  };

  const setYearMonth = (parentField: string, timeKey: string, next: { year?: string; month?: string }) => {
    const parent = formData.unfaelleOperationen?.[parentField as keyof typeof formData.unfaelleOperationen] as any || {};
    const currentRaw = String(parent?.[timeKey] || parent?.jahr || "");
    const current = parseYearMonth(currentRaw);
    const year = (next.year ?? current.year).slice(0, 4);
    const month = (next.month ?? current.month).slice(0, 2);
    const combined = month ? `${year}-${month}` : year;
    updateNestedField(parentField, timeKey, combined);
  };

  const getNestedBoolean = (parentField: string, key: string): boolean => {
    const parent = formData.unfaelleOperationen?.[parentField as keyof typeof formData.unfaelleOperationen] as any;
    return typeof parent?.[key] === 'boolean' ? parent[key] : false;
  };

  const renderEventWithTemporal = (
    parentField: string,
    labelDe: string,
    labelEn: string,
    subOptions?: { key: string; labelDe: string; labelEn: string }[],
    extraContent?: React.ReactNode
  ) => {
    const parent = formData.unfaelleOperationen?.[parentField as keyof typeof formData.unfaelleOperationen] as any || {};
    const seitParsed = parseYearMonth(parent?.seit || parent?.jahr || "");
    const bisParsed = parseYearMonth(parent?.bisJahr || "");

    return (
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            id={parentField}
            checked={parent?.ja || false}
            onCheckedChange={(checked) => updateNestedField(parentField, "ja", checked)}
          />
          <Label htmlFor={parentField}>{language === "de" ? labelDe : labelEn}</Label>
        </div>
        {parent?.ja && (
          <div className="pl-6 space-y-4">
            {subOptions && subOptions.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {subOptions.map(opt => (
                  <div key={opt.key} className="flex items-center gap-2">
                    <Checkbox
                      checked={getNestedBoolean(parentField, opt.key)}
                      onCheckedChange={(checked) => updateNestedField(parentField, opt.key, !!checked)}
                    />
                    <Label className="font-normal text-sm">{language === "de" ? opt.labelDe : opt.labelEn}</Label>
                  </div>
                ))}
              </div>
            )}
            {extraContent}
            <TemporalStatusSelect
              prefix={parentField}
              seitYear={seitParsed.year}
              seitMonth={seitParsed.month}
              status={parent?.status || ""}
              bisYear={bisParsed.year}
              bisMonth={bisParsed.month}
              onSeitYearChange={(v) => setYearMonth(parentField, "seit", { year: v })}
              onSeitMonthChange={(v) => setYearMonth(parentField, "seit", { month: v })}
              onStatusChange={(v) => updateNestedField(parentField, "status", v)}
              onBisYearChange={(v) => setYearMonth(parentField, "bisJahr", { year: v })}
              onBisMonthChange={(v) => setYearMonth(parentField, "bisJahr", { month: v })}
              birthYear={birthYear}
            />
          </div>
        )}
      </div>
    );
  };

  const addOperation = () => {
    const currentOps = formData.unfaelleOperationen?.operationen || [];
    updateUnfaelleOperationen("operationen", [...currentOps, { jahr: "", grund: "", status: "", bisJahr: "" }]);
  };

  const removeOperation = (index: number) => {
    const currentOps = formData.unfaelleOperationen?.operationen || [];
    updateUnfaelleOperationen("operationen", currentOps.filter((_, i) => i !== index));
  };

  const updateOperation = (index: number, field: string, value: string) => {
    const currentOps = formData.unfaelleOperationen?.operationen || [];
    const updated = currentOps.map((op, i) =>
      i === index ? { ...op, [field]: value } : op
    );
    updateUnfaelleOperationen("operationen", updated);
  };

  return (
    <div className="space-y-8">
      {/* Unfälle */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">
          {language === "de" ? "Unfälle" : "Accidents"}
        </h3>

        {renderEventWithTemporal("unfall", "Hatte einen Unfall", "Had an accident", [
          { key: "verkehrsunfall", labelDe: "Verkehrsunfall", labelEn: "Traffic accident" },
          { key: "sportunfall", labelDe: "Sportunfall", labelEn: "Sports accident" },
          { key: "arbeitsunfall", labelDe: "Arbeitsunfall", labelEn: "Work accident" },
          { key: "haushaltsunfall", labelDe: "Haushaltsunfall", labelEn: "Household accident" },
          { key: "sturzunfall", labelDe: "Sturzunfall", labelEn: "Fall accident" },
          { key: "sonstigerUnfall", labelDe: "Sonstiger Unfall", labelEn: "Other accident" },
        ], (
          <Input
            placeholder={language === "de" ? "Lokalisation/Beschreibung" : "Location/Description"}
            value={(formData.unfaelleOperationen?.unfall as any)?.lokalisation || ""}
            onChange={(e) => updateNestedField("unfall", "lokalisation", e.target.value)}
          />
        ))}

        {renderEventWithTemporal("knochenbruch", "Knochenbruch", "Bone fracture", undefined, (
          <Input
            placeholder={language === "de" ? "Welcher Knochen?" : "Which bone?"}
            value={(formData.unfaelleOperationen?.knochenbruch as any)?.welcher || ""}
            onChange={(e) => updateNestedField("knochenbruch", "welcher", e.target.value)}
          />
        ))}

        {renderEventWithTemporal("kopfverletzung", "Kopfverletzung / Gehirnerschütterung", "Head injury / Concussion", undefined, (
          <Input
            placeholder={language === "de" ? "Schweregrad" : "Severity"}
            value={(formData.unfaelleOperationen?.kopfverletzung as any)?.schweregrad || ""}
            onChange={(e) => updateNestedField("kopfverletzung", "schweregrad", e.target.value)}
          />
        ))}
      </div>

      <Separator />

      {/* Operationen */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">
            {language === "de" ? "Operationen" : "Surgeries"}
          </h3>
          <Button type="button" variant="outline" size="sm" onClick={addOperation}>
            <Plus className="w-4 h-4 mr-2" />
            {language === "de" ? "Operation hinzufügen" : "Add surgery"}
          </Button>
        </div>

        {(formData.unfaelleOperationen?.operationen || []).length === 0 && (
          <p className="text-sm text-muted-foreground">
            {language === "de"
              ? "Keine Operationen eingetragen. Klicken Sie auf 'Operation hinzufügen' um eine neue einzutragen."
              : "No surgeries recorded. Click 'Add surgery' to add one."}
          </p>
        )}

        {(formData.unfaelleOperationen?.operationen || []).map((op, index) => {
          const seitParsed = parseYearMonth(op.jahr || "");
          return (
            <div key={index} className="flex gap-4 items-start p-4 bg-muted/30 rounded-lg">
              <div className="flex-1 space-y-3">
                <Input
                  placeholder={language === "de" ? "Grund / Art der Operation" : "Reason / Type of surgery"}
                  value={op.grund}
                  onChange={(e) => updateOperation(index, "grund", e.target.value)}
                />
                <TemporalStatusSelect
                  prefix={`op-${index}`}
                  seitYear={seitParsed.year}
                  seitMonth={seitParsed.month}
                  status={(op as any).status || ""}
                  bisYear={parseYearMonth((op as any).bisJahr || "").year}
                  bisMonth={parseYearMonth((op as any).bisJahr || "").month}
                  onSeitYearChange={(v) => updateOperation(index, "jahr", v)}
                  onSeitMonthChange={() => {}}
                  onStatusChange={(v) => updateOperation(index, "status", v)}
                  onBisYearChange={(v) => updateOperation(index, "bisJahr", v)}
                  onBisMonthChange={() => {}}
                  birthYear={birthYear}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeOperation(index)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          );
        })}
      </div>

      <Separator />

      {/* Krankenhausaufenthalt */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">
          {language === "de" ? "Krankenhausaufenthalte" : "Hospital Stays"}
        </h3>

        {renderEventWithTemporal("krankenhausaufenthalt", "Krankenhausaufenthalt (ohne OP)", "Hospital stay (without surgery)", undefined, (
          <Input
            placeholder={language === "de" ? "Grund" : "Reason"}
            value={(formData.unfaelleOperationen?.krankenhausaufenthalt as any)?.grund || ""}
            onChange={(e) => updateNestedField("krankenhausaufenthalt", "grund", e.target.value)}
          />
        ))}

        {renderEventWithTemporal("kuraufenthalt", "Kur- / Reha-Aufenthalt", "Rehabilitation stay", undefined, (
          <Input
            placeholder={language === "de" ? "Art der Kur" : "Type of rehabilitation"}
            value={(formData.unfaelleOperationen?.kuraufenthalt as any)?.art || ""}
            onChange={(e) => updateNestedField("kuraufenthalt", "art", e.target.value)}
          />
        ))}
      </div>

      <Separator />

      {/* Spezielle Behandlungen */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">
          {language === "de" ? "Spezielle Behandlungen" : "Special Treatments"}
        </h3>

        {renderEventWithTemporal("bluttransfusion", "Bluttransfusion erhalten", "Received blood transfusion", undefined, (
          <Input
            placeholder={language === "de" ? "Grund" : "Reason"}
            value={(formData.unfaelleOperationen?.bluttransfusion as any)?.grund || ""}
            onChange={(e) => updateNestedField("bluttransfusion", "grund", e.target.value)}
          />
        ))}

        {renderEventWithTemporal("chemotherapie", "Chemotherapie", "Chemotherapy", undefined, (
          <Input
            placeholder={language === "de" ? "Art der Chemotherapie" : "Type of chemotherapy"}
            value={(formData.unfaelleOperationen?.chemotherapie as any)?.art || ""}
            onChange={(e) => updateNestedField("chemotherapie", "art", e.target.value)}
          />
        ))}

        {renderEventWithTemporal("strahlentherapie", "Strahlentherapie", "Radiation therapy", undefined, (
          <Input
            placeholder={language === "de" ? "Bestrahlter Bereich" : "Irradiated area"}
            value={(formData.unfaelleOperationen?.strahlentherapie as any)?.bereich || ""}
            onChange={(e) => updateNestedField("strahlentherapie", "bereich", e.target.value)}
          />
        ))}

        {/* CT with iodinated contrast medium */}
        <div className="mt-6 space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="ctKontrastmittel"
              checked={formData.unfaelleOperationen?.ctKontrastmittel?.ja || false}
              onCheckedChange={(checked) => updateNestedField("ctKontrastmittel", "ja", checked)}
            />
            <Label htmlFor="ctKontrastmittel">
              {language === "de" ? "CT mit jodhaltigem Kontrastmittel" : "CT with iodinated contrast medium"}
            </Label>
          </div>
          <p className="text-sm text-muted-foreground pl-6">
            {language === "de"
              ? "Das Kontrastmittel enthält nicht-radioaktives Jod. Bitte mehrere Untersuchungen jeweils einzeln eintragen."
              : "The contrast medium contains non-radioactive iodine. Please enter repeated examinations separately."}
          </p>
          {formData.unfaelleOperationen?.ctKontrastmittel?.ja && (
            <NuclearMedicineDetails
              formData={formData}
              updateNestedField={updateNestedField}
              language={language}
              fieldName="ctKontrastmittel"
              requiredWeeks={0}
              nameDe="CT mit jodhaltigem Kontrastmittel"
              nameEn="CT with iodinated contrast medium"
              placeholderDe="z.B. Bauch, Brustkorb, Gefäße"
              placeholderEn="e.g. abdomen, chest, blood vessels"
            />
          )}
        </div>

        {/* Nuklearmedizinische Untersuchungen */}
        <div className="mt-6 mb-4">
          <h4 className="text-base font-medium text-muted-foreground flex items-center gap-2">
            ☢️ {language === "de" ? "Nuklearmedizinische Untersuchungen" : "Nuclear Medicine Examinations"}
          </h4>
          <p className="text-sm text-muted-foreground mt-1">
            {language === "de"
              ? "Praxisinterner Planungshinweis: Nach Untersuchungen mit radioaktiven Stoffen sind Untersuchungen und Therapien in der Naturheilpraxis Peter Rauch für mindestens etwa 6 Wochen nicht vorgesehen; nach einer Radiojodtherapie gilt derzeit ein längerer Abstand von 12 Wochen. Das ist keine pauschale Sperre für medizinisch notwendige Maßnahmen. Bitte den konkreten Termin vorab mit der Praxis abstimmen."
              : "Practice planning note: After examinations involving radioactive substances, examinations and treatments at Naturheilpraxis Peter Rauch are not scheduled for at least approximately 6 weeks; a longer interval of 12 weeks currently applies after radioiodine therapy. This is not a general restriction on medically necessary care. Please coordinate the specific appointment with the practice in advance."}
          </p>
        </div>

        {/* Szintigraphie */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="szintigraphie"
              checked={formData.unfaelleOperationen?.szintigraphie?.ja || false}
              onCheckedChange={(checked) => updateNestedField("szintigraphie", "ja", checked)}
            />
            <Label htmlFor="szintigraphie">
              {language === "de" ? "Szintigraphie" : "Scintigraphy"}
            </Label>
          </div>
          <p className="text-sm text-muted-foreground pl-6">
            {language === "de"
              ? "Nuklearmedizinische Untersuchung, häufig bei Schilddrüsendiagnostik und Tumorsuche eingesetzt."
              : "Nuclear medicine examination, commonly used for thyroid diagnostics and tumor detection."}
          </p>
          {formData.unfaelleOperationen?.szintigraphie?.ja && (
            <NuclearMedicineDetails
              formData={formData}
              updateNestedField={updateNestedField}
              language={language}
              fieldName="szintigraphie"
              requiredWeeks={6}
              nameDe="Szintigraphie"
              nameEn="Scintigraphy"
              placeholderDe="z.B. Schilddrüse, Tumorsuche"
              placeholderEn="e.g. thyroid, tumor detection"
              birthYear={birthYear}
            />
          )}
        </div>

        {/* PET-CT */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="petCt"
              checked={formData.unfaelleOperationen?.petCt?.ja || false}
              onCheckedChange={(checked) => updateNestedField("petCt", "ja", checked)}
            />
            <Label htmlFor="petCt">
              {language === "de" ? "PET-CT (Positronen-Emissions-Tomographie)" : "PET-CT (Positron Emission Tomography)"}
            </Label>
          </div>
          <p className="text-sm text-muted-foreground pl-6">
            {language === "de"
              ? "Kombinierte Bildgebung zur Darstellung von Stoffwechselprozessen, häufig in der Tumordiagnostik und Verlaufskontrolle eingesetzt."
              : "Combined imaging to visualize metabolic processes, commonly used in tumor diagnostics and follow-up monitoring."}
          </p>
          {formData.unfaelleOperationen?.petCt?.ja && (
            <NuclearMedicineDetails
              formData={formData}
              updateNestedField={updateNestedField}
              language={language}
              fieldName="petCt"
              requiredWeeks={6}
              nameDe="PET-CT"
              nameEn="PET-CT"
              placeholderDe="z.B. Tumorstaging, Metastasensuche"
              placeholderEn="e.g. tumor staging, metastasis detection"
              birthYear={birthYear}
            />
          )}
        </div>

        {/* Radioiodine diagnostics / whole-body scintigraphy */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="radioioddiagnostik"
              checked={formData.unfaelleOperationen?.radioioddiagnostik?.ja || false}
              onCheckedChange={(checked) => updateNestedField("radioioddiagnostik", "ja", checked)}
            />
            <Label htmlFor="radioioddiagnostik">
              {language === "de"
                ? "Radiojoddiagnostik / Ganzkörperszintigrafie, ggf. SPECT/CT"
                : "Radioiodine diagnostics / whole-body scintigraphy, possibly SPECT/CT"}
            </Label>
          </div>
          <p className="text-sm text-muted-foreground pl-6">
            {language === "de"
              ? "Nuklearmedizinische Untersuchung, bei der radioaktives Jod meist als Kapsel eingenommen wird. Die CT-Komponente einer möglichen SPECT/CT ist selbst ein Röntgenverfahren."
              : "Nuclear medicine examination in which radioactive iodine is usually taken as a capsule. The CT component of a possible SPECT/CT is itself an X-ray procedure."}
          </p>
          {formData.unfaelleOperationen?.radioioddiagnostik?.ja && (
            <NuclearMedicineDetails
              formData={formData}
              updateNestedField={updateNestedField}
              language={language}
              fieldName="radioioddiagnostik"
              requiredWeeks={6}
              nameDe="Radiojoddiagnostik"
              nameEn="Radioiodine diagnostics"
              placeholderDe="z.B. Schilddrüsenkarzinom-Nachsorge, Radiojodtest"
              placeholderEn="e.g. thyroid cancer follow-up, radioiodine test"
              showDosis={true}
              birthYear={birthYear}
            />
          )}
        </div>

        {/* Radioiodtherapie */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="radioiodtherapie"
              checked={formData.unfaelleOperationen?.radioiodtherapie?.ja || false}
              onCheckedChange={(checked) => updateNestedField("radioiodtherapie", "ja", checked)}
            />
            <Label htmlFor="radioiodtherapie">
              {language === "de" ? "Radioiodtherapie" : "Radioiodine Therapy"}
            </Label>
          </div>
          <p className="text-sm text-muted-foreground pl-6">
            {language === "de"
              ? "Therapie mit radioaktivem Jod, meist bei Schilddrüsenerkrankungen (Überfunktion, Krebs)."
              : "Therapy with radioactive iodine, usually for thyroid conditions (hyperthyroidism, cancer)."}
          </p>
          {formData.unfaelleOperationen?.radioiodtherapie?.ja && (
            <NuclearMedicineDetails
              formData={formData}
              updateNestedField={updateNestedField}
              language={language}
              fieldName="radioiodtherapie"
              requiredWeeks={12}
              nameDe="Radioiodtherapie"
              nameEn="Radioiodine Therapy"
              placeholderDe="z.B. Schilddrüsenüberfunktion, Schilddrüsenkarzinom"
              placeholderEn="e.g. hyperthyroidism, thyroid carcinoma"
              showDosis={true}
              birthYear={birthYear}
            />
          )}
        </div>
      </div>
    </div>
  );
};

// Subkomponente für nuklearmedizinische Details
interface NuclearMedicineDetailsProps {
  formData: AnamneseFormData;
  updateNestedField: (parentField: string, field: string, value: any) => void;
  language: string;
  fieldName: string;
  requiredWeeks: number;
  nameDe: string;
  nameEn: string;
  placeholderDe: string;
  placeholderEn: string;
  showDosis?: boolean;
  birthYear?: number;
}

const NuclearMedicineDetails = ({
  formData,
  updateNestedField,
  language,
  fieldName,
  requiredWeeks,
  nameDe,
  nameEn,
  placeholderDe,
  placeholderEn,
  showDosis = false,
}: NuclearMedicineDetailsProps) => {
  const data = formData.unfaelleOperationen?.[fieldName as keyof typeof formData.unfaelleOperationen] as any;
  const [calendarOpenIndex, setCalendarOpenIndex] = useState<number | null>(null);

  const dateLocale = language === "de" ? de : enUS;
  const legacyEntry = {
    datum: String(data?.datum || ""),
    grund: String(data?.grund || ""),
    dosis: String(data?.dosis || ""),
  };
  const entries = Array.isArray(data?.termine) && data.termine.length > 0
    ? data.termine
    : [legacyEntry];

  const updateEntries = (next: { datum: string; grund: string; dosis: string }[]) => {
    updateNestedField(fieldName, "termine", next);
  };

  const updateEntry = (index: number, key: "datum" | "grund" | "dosis", value: string) => {
    updateEntries(entries.map((entry: any, entryIndex: number) =>
      entryIndex === index ? { ...entry, [key]: value } : entry
    ));
  };

  const addEntry = () => {
    updateEntries([...entries, { datum: "", grund: "", dosis: "" }]);
  };

  const removeEntry = (index: number) => {
    const next = entries.filter((_: any, entryIndex: number) => entryIndex !== index);
    updateEntries(next.length > 0 ? next : [{ datum: "", grund: "", dosis: "" }]);
  };

  return (
    <div className="space-y-4 pl-6">
      {entries.map((entry: any, index: number) => {
        const parsed = entry.datum ? parse(entry.datum, "yyyy-MM-dd", new Date()) : null;
        const parsedDate = parsed && isValid(parsed) ? parsed : null;
        const weeksSince = parsedDate ? differenceInWeeks(new Date(), parsedDate) : null;
        const isWaitComplete = requiredWeeks === 0 || (weeksSince !== null && weeksSince >= requiredWeeks);
        const remainingWeeks = Math.max(0, requiredWeeks - (weeksSince || 0));

        return (
          <div key={index} className="space-y-4 p-4 bg-muted/30 rounded-lg">
            <div className="flex items-center justify-between gap-3">
              <h5 className="text-sm font-medium">
                {language === "de" ? `Eintrag ${index + 1}` : `Entry ${index + 1}`}
              </h5>
              {entries.length > 1 && (
                <Button type="button" variant="ghost" size="icon" onClick={() => removeEntry(index)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{language === "de" ? "Datum" : "Date"}</Label>
                <Popover
                  open={calendarOpenIndex === index}
                  onOpenChange={(open) => setCalendarOpenIndex(open ? index : null)}
                >
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !entry.datum && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {parsedDate
                        ? format(parsedDate, "PPP", { locale: dateLocale })
                        : (language === "de" ? "Datum wählen" : "Pick a date")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={parsedDate || undefined}
                      onSelect={(date) => {
                        if (date) updateEntry(index, "datum", format(date, "yyyy-MM-dd"));
                        setCalendarOpenIndex(null);
                      }}
                      disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>{language === "de" ? "Grund" : "Reason"}</Label>
                <Input
                  placeholder={language === "de" ? placeholderDe : placeholderEn}
                  value={entry.grund || ""}
                  onChange={(e) => updateEntry(index, "grund", e.target.value)}
                />
              </div>
            </div>

            {showDosis && (
              <div className="space-y-2">
                <Label>{language === "de" ? "Dosis / Aktivität (falls bekannt)" : "Dose / activity (if known)"}</Label>
                <Input
                  placeholder={language === "de" ? "z.B. Radiopharmakon und MBq" : "e.g. radiopharmaceutical and MBq"}
                  value={entry.dosis || ""}
                  onChange={(e) => updateEntry(index, "dosis", e.target.value)}
                  className="max-w-md"
                />
              </div>
            )}

            {requiredWeeks > 0 && parsedDate && (
              <div className={cn(
                "flex items-center gap-2 p-3 rounded-lg",
                isWaitComplete ? "bg-green-100 dark:bg-green-950/30" : "bg-amber-100 dark:bg-amber-950/30"
              )}>
                {isWaitComplete ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <span className="text-sm text-green-800 dark:text-green-200">
                      {language === "de"
                        ? `Praxisinterner Abstand erfüllt (${weeksSince} Wochen seit ${nameDe})`
                        : `Practice-specific interval complete (${weeksSince} weeks since ${nameEn})`}
                    </span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                    <span className="text-sm text-amber-800 dark:text-amber-200">
                      {language === "de"
                        ? `Praxisinterner Abstand: noch etwa ${remainingWeeks} Wochen (insgesamt ${requiredWeeks} Wochen)`
                        : `Practice-specific interval: approximately ${remainingWeeks} weeks remaining (${requiredWeeks} weeks total)`}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}

      <Button type="button" variant="outline" size="sm" onClick={addEntry}>
        <Plus className="mr-2 h-4 w-4" />
        {language === "de" ? "Weitere Untersuchung hinzufügen" : "Add another examination"}
      </Button>
    </div>
  );
};

export default SurgeriesSection;
