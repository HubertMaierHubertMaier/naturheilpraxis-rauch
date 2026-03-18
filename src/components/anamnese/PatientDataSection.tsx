import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { useLanguage } from "@/contexts/LanguageContext";
import { AnamneseFormData } from "@/lib/anamneseFormData";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface PatientDataSectionProps {
  formData: AnamneseFormData;
  updateFormData: (field: string, value: any) => void;
  userEmail?: string;
}

const PatientDataSection = ({ formData, updateFormData, userEmail }: PatientDataSectionProps) => {
  const { language } = useLanguage();

  // Auto-fill email from logged-in user
  React.useEffect(() => {
    if (userEmail && !formData.email) {
      updateFormData("email", userEmail);
    }
  }, [userEmail]);

  const sanitizeName = (raw: string) => {
    // Letters incl. German umlauts, spaces, hyphen, apostrophe
    const cleaned = raw
      .replace(/[^\p{L}\s'\-]/gu, "")
      .replace(/\s{2,}/g, " ")
      .trimStart();
    return cleaned;
  };

  const toggleInfoSource = (value: string, checked: boolean) => {
    const current = Array.isArray(formData.informationsquelle) ? formData.informationsquelle : [];
    const next = checked ? Array.from(new Set([...current, value])) : current.filter((v) => v !== value);
    updateFormData("informationsquelle", next);
  };

  /** Strip non-digits while typing; clamp only on blur */
  const sanitizeDigitsOnly = (raw: string) => {
    return raw.replace(/\D+/g, "");
  };

  const clampIntInRange = (raw: string, min: number, max: number) => {
    const digitsOnly = raw.replace(/\D+/g, "");
    if (!digitsOnly) return "";
    const n = Number.parseInt(digitsOnly, 10);
    if (Number.isNaN(n)) return "";
    return String(Math.min(max, Math.max(min, n)));
  };

  /** Allow only digits, +, -, (, ), spaces in phone numbers */
  const sanitizePhone = (raw: string) => raw.replace(/[^\d+\-() /]/g, "");

  // Calculate if patient is a minor (under 18)
  const isMinor = React.useMemo(() => {
    if (!formData.geburtsdatum) return false;
    const birth = new Date(formData.geburtsdatum);
    if (isNaN(birth.getTime())) return false;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age >= 0 && age < 18;
  }, [formData.geburtsdatum]);

  // Clear guardian data when patient becomes adult
  React.useEffect(() => {
    if (!isMinor && formData.sorgeberechtigterTyp) {
      updateFormData("sorgeberechtigterTyp", "");
      updateFormData("sorgeberechtigterVorname", "");
      updateFormData("sorgeberechtigterNachname", "");
      updateFormData("sorgeberechtigterAbweichendeAdresse", false);
      updateFormData("sorgeberechtigterStrasse", "");
      updateFormData("sorgeberechtigterPlz", "");
      updateFormData("sorgeberechtigterOrt", "");
      updateFormData("sorgeberechtigterTelefon", "");
      updateFormData("sorgeberechtigterEmail", "");
    }
  }, [isMinor]);

  return (
    <div className="space-y-8">
      {/* A. Personalia */}
      <div>
        <h3 className="text-lg font-semibold mb-4">
          {language === "de" ? "A. Personalia" : "A. Personal Information"}
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className={cn("space-y-2", !formData.nachname && "required-field-highlight")}>
            <Label htmlFor="nachname">{language === "de" ? "Nachname" : "Last Name"} <span className="text-destructive">*</span></Label>
            <Input 
              id="nachname" 
              value={formData.nachname} 
              onChange={(e) => updateFormData("nachname", sanitizeName(e.target.value))} 
              required 
              className={cn(!formData.nachname && "border-accent")}
            />
          </div>
          <div className={cn("space-y-2", !formData.vorname && "required-field-highlight")}>
            <Label htmlFor="vorname">{language === "de" ? "Vorname" : "First Name"} <span className="text-destructive">*</span></Label>
            <Input 
              id="vorname" 
              value={formData.vorname} 
              onChange={(e) => updateFormData("vorname", sanitizeName(e.target.value))} 
              required 
              className={cn(!formData.vorname && "border-accent")}
            />
          </div>
          <div className={cn("space-y-2", !formData.geburtsdatum && "required-field-highlight")}>
            <Label htmlFor="geburtsdatum">{language === "de" ? "Geburtsdatum" : "Date of Birth"} <span className="text-destructive">*</span></Label>
            <Input 
              id="geburtsdatum" 
              type="date" 
              value={formData.geburtsdatum} 
              onChange={(e) => updateFormData("geburtsdatum", e.target.value)} 
              required 
              min={(() => { const d = new Date(); d.setFullYear(d.getFullYear() - 100); return d.toISOString().split('T')[0]; })()}
              max={new Date().toISOString().split('T')[0]}
              className={cn(!formData.geburtsdatum && "border-accent")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nationalitaet">{language === "de" ? "Nationalität" : "Nationality"}</Label>
            <Input 
              id="nationalitaet" 
              value={formData.nationalitaet} 
              onChange={(e) => updateFormData("nationalitaet", e.target.value)} 
            />
          </div>
          <div className="space-y-3">
            <Label>{language === "de" ? "Geschlecht" : "Gender"}</Label>
            <RadioGroup 
              value={formData.geschlecht} 
              onValueChange={(value) => updateFormData("geschlecht", value)}
              className="flex flex-wrap gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="maennlich" id="maennlich" />
                <Label htmlFor="maennlich" className="font-normal">{language === "de" ? "männlich" : "male"}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="weiblich" id="weiblich" />
                <Label htmlFor="weiblich" className="font-normal">{language === "de" ? "weiblich" : "female"}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="divers" id="divers" />
                <Label htmlFor="divers" className="font-normal">{language === "de" ? "divers" : "diverse"}</Label>
              </div>
            </RadioGroup>
          </div>
          <div className="space-y-3">
            <Label>{language === "de" ? "Zivilstand" : "Marital Status"}</Label>
            <RadioGroup 
              value={formData.zivilstand} 
              onValueChange={(value) => updateFormData("zivilstand", value)}
              className="flex flex-wrap gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="ledig" id="ledig" />
                <Label htmlFor="ledig" className="font-normal">{language === "de" ? "ledig" : "single"}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="verheiratet" id="verheiratet" />
                <Label htmlFor="verheiratet" className="font-normal">{language === "de" ? "verheiratet" : "married"}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="geschieden" id="geschieden" />
                <Label htmlFor="geschieden" className="font-normal">{language === "de" ? "geschieden" : "divorced"}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="verwitwet" id="verwitwet" />
                <Label htmlFor="verwitwet" className="font-normal">{language === "de" ? "verwitwet" : "widowed"}</Label>
              </div>
            </RadioGroup>
          </div>
        </div>
      </div>

      <Separator />

      {/* B. Kontaktdaten */}
      <div>
        <h3 className="text-lg font-semibold mb-4">
          {language === "de" ? "B. Kontaktdaten" : "B. Contact Information"}
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className={cn("space-y-2 md:col-span-2", !formData.strasse && "required-field-highlight")}>
            <Label htmlFor="strasse">{language === "de" ? "Straße, Hausnummer" : "Street, House Number"} <span className="text-destructive">*</span></Label>
            <Input 
              id="strasse" 
              value={formData.strasse} 
              onChange={(e) => updateFormData("strasse", e.target.value)} 
              required
              className={cn(!formData.strasse && "border-accent")}
            />
          </div>
          <div className={cn("space-y-2", !formData.plz && "required-field-highlight")}>
            <Label htmlFor="plz">{language === "de" ? "PLZ" : "Postal Code"} <span className="text-destructive">*</span></Label>
            <Input 
              id="plz" 
              value={formData.plz} 
              onChange={(e) => {
                const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 5);
                updateFormData("plz", digitsOnly);
                // Auto-fill city when 5-digit PLZ is entered
                if (digitsOnly.length === 5) {
                  fetch(`https://api.zippopotam.us/de/${digitsOnly}`)
                    .then(r => r.ok ? r.json() : null)
                    .then(data => {
                      if (data?.places?.[0]?.["place name"]) {
                        updateFormData("wohnort", data.places[0]["place name"]);
                      }
                    })
                    .catch(() => { /* ignore lookup errors */ });
                }
              }}
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={5}
              placeholder="z.B. 86163"
              required
              className={cn(!formData.plz && "border-accent")}
            />
          </div>
          <div className={cn("space-y-2", !formData.wohnort && "required-field-highlight")}>
            <Label htmlFor="wohnort">{language === "de" ? "Wohnort" : "City"} <span className="text-destructive">*</span></Label>
            <Input 
              id="wohnort" 
              value={formData.wohnort} 
              onChange={(e) => updateFormData("wohnort", e.target.value)} 
              required
              className={cn(!formData.wohnort && "border-accent")}
            />
          </div>
          <div className={cn("space-y-2", !formData.telefonPrivat && !formData.mobil && "required-field-highlight")}>
            <Label htmlFor="telefonPrivat">{language === "de" ? "Telefon privat" : "Private Phone"} {!formData.mobil && <span className="text-destructive">*</span>}</Label>
            <Input 
              id="telefonPrivat" 
              type="tel"
              value={formData.telefonPrivat} 
              onChange={(e) => updateFormData("telefonPrivat", sanitizePhone(e.target.value))} 
              className={cn(!formData.telefonPrivat && !formData.mobil && "border-accent")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="telefonBeruflich">{language === "de" ? "Telefon beruflich" : "Work Phone"}</Label>
            <Input 
              id="telefonBeruflich" 
              type="tel"
              value={formData.telefonBeruflich} 
              onChange={(e) => updateFormData("telefonBeruflich", sanitizePhone(e.target.value))} 
            />
          </div>
          <div className={cn("space-y-2", !formData.mobil && !formData.telefonPrivat && "required-field-highlight")}>
            <Label htmlFor="mobil">{language === "de" ? "Mobil" : "Mobile"} {!formData.telefonPrivat && <span className="text-destructive">*</span>}</Label>
            <Input 
              id="mobil" 
              type="tel"
              value={formData.mobil} 
              onChange={(e) => updateFormData("mobil", sanitizePhone(e.target.value))} 
              className={cn(!formData.mobil && !formData.telefonPrivat && "border-accent")}
            />
          </div>
          {!formData.telefonPrivat && !formData.mobil && (
            <p className="text-xs text-destructive md:col-span-2">
              {language === "de" ? "Bitte geben Sie mindestens eine Telefonnummer an (privat oder mobil)." : "Please provide at least one phone number (private or mobile)."}
            </p>
          )}
          <div className={cn("space-y-2", !formData.email && "required-field-highlight")}>
            <Label htmlFor="email">{language === "de" ? "E-Mail" : "Email"} <span className="text-destructive">*</span></Label>
            <Input 
              id="email" 
              type="email"
              value={formData.email} 
              onChange={(e) => updateFormData("email", e.target.value)} 
              required
              className={cn(!formData.email && "border-accent")}
            />
          </div>
        </div>
      </div>

      {/* Sorgeberechtigter – nur bei Minderjährigen (unter 18) */}
      {isMinor && (
        <>
          <Separator />
          <div>
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-lg font-semibold">
                {language === "de" ? "Sorgeberechtigte/r (Patient unter 18 Jahre)" : "Legal Guardian (Patient under 18 years)"}
              </h3>
              <span className="text-xs bg-accent/20 text-accent-foreground px-2 py-0.5 rounded">
                {language === "de" ? "Pflichtangabe" : "Required"}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {language === "de"
                ? "Da der Patient minderjährig ist, benötigen wir die Daten eines Sorgeberechtigten."
                : "Since the patient is a minor, we need the data of a legal guardian."}
            </p>
            <div className="grid gap-4 md:grid-cols-2 p-4 border rounded-lg bg-muted/30">
              {/* Mutter/Vater Auswahl */}
              <div className={cn("space-y-3 md:col-span-2", !formData.sorgeberechtigterTyp && "required-field-highlight")}>
                <Label>{language === "de" ? "Sorgeberechtigte/r" : "Guardian"} <span className="text-destructive">*</span></Label>
                <RadioGroup
                  value={formData.sorgeberechtigterTyp || ""}
                  onValueChange={(value) => updateFormData("sorgeberechtigterTyp", value)}
                  className="flex gap-6"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="mutter" id="sorge-mutter" />
                    <Label htmlFor="sorge-mutter" className="font-normal">{language === "de" ? "Mutter" : "Mother"}</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="vater" id="sorge-vater" />
                    <Label htmlFor="sorge-vater" className="font-normal">{language === "de" ? "Vater" : "Father"}</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Name */}
              <div className={cn("space-y-2", !formData.sorgeberechtigterVorname && "required-field-highlight")}>
                <Label htmlFor="sorgeVorname">{language === "de" ? "Vorname" : "First Name"} <span className="text-destructive">*</span></Label>
                <Input
                  id="sorgeVorname"
                  value={formData.sorgeberechtigterVorname}
                  onChange={(e) => updateFormData("sorgeberechtigterVorname", sanitizeName(e.target.value))}
                  className={cn(!formData.sorgeberechtigterVorname && "border-accent")}
                />
              </div>
              <div className={cn("space-y-2", !formData.sorgeberechtigterNachname && "required-field-highlight")}>
                <Label htmlFor="sorgeNachname">{language === "de" ? "Nachname" : "Last Name"} <span className="text-destructive">*</span></Label>
                <Input
                  id="sorgeNachname"
                  value={formData.sorgeberechtigterNachname}
                  onChange={(e) => updateFormData("sorgeberechtigterNachname", sanitizeName(e.target.value))}
                  className={cn(!formData.sorgeberechtigterNachname && "border-accent")}
                />
              </div>

              {/* Kontakt */}
              <div className="space-y-2">
                <Label htmlFor="sorgeTelefon">{language === "de" ? "Telefon" : "Phone"} <span className="text-destructive">*</span></Label>
                <Input
                  id="sorgeTelefon"
                  type="tel"
                  value={formData.sorgeberechtigterTelefon}
                  onChange={(e) => updateFormData("sorgeberechtigterTelefon", sanitizePhone(e.target.value))}
                  className={cn(!formData.sorgeberechtigterTelefon && "border-accent")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sorgeEmail">{language === "de" ? "E-Mail" : "Email"}</Label>
                <Input
                  id="sorgeEmail"
                  type="email"
                  value={formData.sorgeberechtigterEmail}
                  onChange={(e) => updateFormData("sorgeberechtigterEmail", e.target.value)}
                />
              </div>

              {/* Abweichende Adresse – z.B. Kind im Heim */}
              <div className="md:col-span-2 pt-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="sorgeAbweichendeAdresse"
                    checked={formData.sorgeberechtigterAbweichendeAdresse}
                    onCheckedChange={(checked) => updateFormData("sorgeberechtigterAbweichendeAdresse", !!checked)}
                  />
                  <Label htmlFor="sorgeAbweichendeAdresse" className="font-normal text-sm">
                    {language === "de"
                      ? "Kind wohnt nicht beim Sorgeberechtigten (z. B. Heim, Pflegefamilie, anderer Wohnort)"
                      : "Child does not live with the guardian (e.g. care home, foster family, different address)"}
                  </Label>
                </div>
              </div>

              {formData.sorgeberechtigterAbweichendeAdresse && (
                <>
                  <div className="md:col-span-2 text-sm text-muted-foreground">
                    {language === "de"
                      ? `Bitte geben Sie die Adresse und Erreichbarkeit der/des ${formData.sorgeberechtigterTyp === "mutter" ? "Mutter" : formData.sorgeberechtigterTyp === "vater" ? "Vaters" : "Sorgeberechtigten"} an:`
                      : `Please provide the address and contact details of the ${formData.sorgeberechtigterTyp === "mutter" ? "mother" : formData.sorgeberechtigterTyp === "vater" ? "father" : "guardian"}:`}
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="sorgeStrasse">{language === "de" ? "Straße, Hausnummer" : "Street, House Number"}</Label>
                    <Input
                      id="sorgeStrasse"
                      value={formData.sorgeberechtigterStrasse}
                      onChange={(e) => updateFormData("sorgeberechtigterStrasse", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sorgePlz">{language === "de" ? "PLZ" : "Postal Code"}</Label>
                    <Input
                      id="sorgePlz"
                      value={formData.sorgeberechtigterPlz}
                      onChange={(e) => updateFormData("sorgeberechtigterPlz", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sorgeOrt">{language === "de" ? "Wohnort" : "City"}</Label>
                    <Input
                      id="sorgeOrt"
                      value={formData.sorgeberechtigterOrt}
                      onChange={(e) => updateFormData("sorgeberechtigterOrt", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sorgeFestnetz">
                      {language === "de" 
                        ? `Festnetz ${formData.sorgeberechtigterTyp === "mutter" ? "Mutter" : formData.sorgeberechtigterTyp === "vater" ? "Vater" : "Sorgeberechtigte/r"}`
                        : `Landline ${formData.sorgeberechtigterTyp === "mutter" ? "Mother" : formData.sorgeberechtigterTyp === "vater" ? "Father" : "Guardian"}`}
                    </Label>
                    <Input
                      id="sorgeFestnetz"
                      type="tel"
                      value={formData.sorgeberechtigterFestnetz || ""}
                      onChange={(e) => updateFormData("sorgeberechtigterFestnetz", sanitizePhone(e.target.value))}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      <Separator />

      {/* C. Versicherungsdaten */}
      <div>
        <h3 className="text-lg font-semibold mb-4">
          {language === "de" ? "C. Versicherungsdaten" : "C. Insurance Information"}
        </h3>
        <div className="space-y-4">
          <RadioGroup 
            value={formData.versicherungstyp} 
            onValueChange={(value) => updateFormData("versicherungstyp", value)}
            className="space-y-4"
          >
            <div className="flex items-start space-x-3 p-4 border rounded-lg">
              <RadioGroupItem value="privat" id="privat" className="mt-1" />
              <div className="space-y-2 flex-1">
                <Label htmlFor="privat" className="font-medium">
                  {language === "de" ? "Privatversichert (auch Zusatzversicherungen)" : "Private Insurance (including supplementary)"}
                </Label>
                {formData.versicherungstyp === "privat" && (
                  <div className="grid gap-4 md:grid-cols-2 mt-3">
                    <div className="space-y-2">
                      <Label htmlFor="versicherungsname" className="text-sm">{language === "de" ? "Versicherungsname" : "Insurance Name"}</Label>
                      <Input 
                        id="versicherungsname" 
                        value={formData.versicherungsname} 
                        onChange={(e) => updateFormData("versicherungsname", e.target.value)} 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="versicherungsnummer" className="text-sm">{language === "de" ? "Versicherungsnummer" : "Insurance Number"}</Label>
                      <Input 
                        id="versicherungsnummer" 
                        value={formData.versicherungsnummer} 
                        onChange={(e) => updateFormData("versicherungsnummer", e.target.value)} 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tarif" className="text-sm">{language === "de" ? "Tarif" : "Tariff"}</Label>
                      <Input 
                        id="tarif" 
                        value={formData.tarif} 
                        onChange={(e) => updateFormData("tarif", e.target.value)} 
                      />
                    </div>
                    <div className="flex items-center space-x-2 self-end pb-2">
                      <Checkbox 
                        id="kostenuebernahme" 
                        checked={formData.kostenuebernahmeNaturheilkunde}
                        onCheckedChange={(checked) => updateFormData("kostenuebernahmeNaturheilkunde", checked)}
                      />
                      <Label htmlFor="kostenuebernahme" className="text-sm font-normal">
                        {language === "de" ? "Kostenübernahme für Naturheilkunde" : "Coverage for naturopathy"}
                      </Label>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-start space-x-3 p-4 border rounded-lg">
              <RadioGroupItem value="gesetzlich" id="gesetzlich" className="mt-1" />
              <div className="space-y-2 flex-1">
                <Label htmlFor="gesetzlich" className="font-medium">
                  {language === "de" ? "Gesetzlich versichert" : "Statutory Health Insurance"}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {language === "de" 
                    ? "Bitte beachten: Die gesetzliche Krankenversicherung übernimmt in der Regel keine Kosten für Heilpraktiker-Leistungen. Sie sind Selbstzahler."
                    : "Please note: Statutory health insurance usually does not cover costs for naturopathic services. You are a self-payer."}
                </p>
              </div>
            </div>
          </RadioGroup>
        </div>
      </div>

      <Separator />

      {/* D. Berufliche Situation */}
      <div>
        <h3 className="text-lg font-semibold mb-4">
          {language === "de" ? "D. Berufliche Situation" : "D. Professional Situation"}
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="beruf">{language === "de" ? "Ausgeübte Tätigkeit" : "Occupation"}</Label>
            <Input 
              id="beruf" 
              value={formData.beruf} 
              onChange={(e) => updateFormData("beruf", e.target.value)} 
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="arbeitgeber">{language === "de" ? "Arbeitgeber/Firma" : "Employer/Company"}</Label>
            <Input 
              id="arbeitgeber" 
              value={formData.arbeitgeber} 
              onChange={(e) => updateFormData("arbeitgeber", e.target.value)} 
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="branche">{language === "de" ? "Branche/Sektor" : "Industry/Sector"}</Label>
            <Input 
              id="branche" 
              value={formData.branche} 
              onChange={(e) => updateFormData("branche", e.target.value)} 
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="arbeitsunfaehigSeit">{language === "de" ? "Arbeitsunfähig seit" : "Incapacitated since"}</Label>
            <Input 
              id="arbeitsunfaehigSeit" 
              value={formData.arbeitsunfaehigSeit} 
              onChange={(e) => updateFormData("arbeitsunfaehigSeit", e.target.value)} 
              placeholder={language === "de" ? "falls zutreffend" : "if applicable"}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* E. Körperliche Grunddaten */}
      <div>
        <h3 className="text-lg font-semibold mb-4">
          {language === "de" ? "E. Körperliche Grunddaten" : "E. Physical Data"}
        </h3>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="koerpergroesse">{language === "de" ? "Körpergröße (cm)" : "Height (cm)"}</Label>
            <Input 
              id="koerpergroesse" 
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              min={0}
              max={210}
              step={1}
              list="height-options"
              value={formData.koerpergroesse} 
              onChange={(e) => updateFormData("koerpergroesse", sanitizeIntInRange(e.target.value, 0, 210))} 
            />
            <datalist id="height-options">
              {Array.from({ length: 211 }, (_, i) => (
                <option key={i} value={i} />
              ))}
            </datalist>
          </div>
          <div className="space-y-2">
            <Label htmlFor="gewicht">{language === "de" ? "Gewicht (kg)" : "Weight (kg)"}</Label>
            <Input 
              id="gewicht" 
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              min={1}
              max={200}
              step={1}
              list="weight-options"
              value={formData.gewicht} 
              onChange={(e) => updateFormData("gewicht", sanitizeIntInRange(e.target.value, 1, 200))} 
            />
            <datalist id="weight-options">
              {Array.from({ length: 200 }, (_, i) => (
                <option key={i + 1} value={i + 1} />
              ))}
            </datalist>
          </div>
          <div className="space-y-2">
            <Label>{language === "de" ? "BMI (berechnet)" : "BMI (calculated)"}</Label>
            <div className="h-10 px-3 py-2 border rounded-md bg-muted flex items-center">
              {formData.koerpergroesse && formData.gewicht 
                ? (Number(formData.gewicht) / Math.pow(Number(formData.koerpergroesse) / 100, 2)).toFixed(1)
                : "—"}
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* F. Informationsquelle */}
      <div>
        <h3 className="text-lg font-semibold mb-4">
          {language === "de" ? "F. Wie haben Sie unsere Praxis gefunden?" : "F. How did you find our practice?"}
        </h3>
        <div className="grid gap-2 md:grid-cols-2">
          {[
            { value: "presse", labelDe: "Durch Presse/Internet", labelEn: "Through press/internet" },
            { value: "empfehlung", labelDe: "Durch Empfehlung", labelEn: "Through recommendation" },
            { value: "bni", labelDe: "Durch eine BNI Empfehlung", labelEn: "Through a BNI recommendation" },
            { value: "telefonbuch", labelDe: "Telefonbuch/Branchenbuch", labelEn: "Phone book/directory" },
            { value: "suchmaschine", labelDe: "Suchmaschine", labelEn: "Search engine" },
            { value: "mundpropaganda", labelDe: "Mundpropaganda/Freunde", labelEn: "Word of mouth/friends" },
            { value: "andere", labelDe: "Andere", labelEn: "Other" },
          ].map((option) => {
            const checked = (formData.informationsquelle || []).includes(option.value);
            return (
              <div key={option.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`info-${option.value}`}
                  checked={checked}
                  onCheckedChange={(next) => toggleInfoSource(option.value, !!next)}
                />
                <Label htmlFor={`info-${option.value}`} className="font-normal">
                  {language === "de" ? option.labelDe : option.labelEn}
                </Label>
              </div>
            );
          })}
        </div>

        {(formData.informationsquelle || []).includes("empfehlung") || (formData.informationsquelle || []).includes("bni") ? (
          <div className="mt-3 space-y-2">
            <Label htmlFor="empfehlungVon">{language === "de" ? "Von wem?" : "From whom?"}</Label>
            <Input 
              id="empfehlungVon" 
              value={formData.empfehlungVon} 
              onChange={(e) => updateFormData("empfehlungVon", e.target.value)} 
            />
          </div>
        ) : null}
      </div>

      <Separator />

      {/* G. Vorbehandler */}
      <div>
        <h3 className="text-lg font-semibold mb-4">
          {language === "de" ? "G. Vorbehandler (falls zutreffend)" : "G. Previous Practitioners (if applicable)"}
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="hausarzt">{language === "de" ? "Hausarzt (Name)" : "Family Doctor (Name)"}</Label>
            <Input 
              id="hausarzt" 
              value={formData.hausarzt} 
              onChange={(e) => updateFormData("hausarzt", sanitizeName(e.target.value))} 
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="heilpraktiker">{language === "de" ? "Naturheilkundler/Heilpraktiker" : "Naturopath"}</Label>
            <Input 
              id="heilpraktiker" 
              value={formData.heilpraktiker} 
              onChange={(e) => updateFormData("heilpraktiker", sanitizeName(e.target.value))} 
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="physiotherapeut">{language === "de" ? "Physiotherapeut" : "Physiotherapist"}</Label>
            <Input 
              id="physiotherapeut" 
              value={formData.physiotherapeut} 
              onChange={(e) => updateFormData("physiotherapeut", sanitizeName(e.target.value))} 
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="psychotherapeut">{language === "de" ? "Psychotherapeut" : "Psychotherapist"}</Label>
            <Input 
              id="psychotherapeut" 
              value={formData.psychotherapeut} 
              onChange={(e) => updateFormData("psychotherapeut", sanitizeName(e.target.value))} 
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sonstigeTherapeutenn">{language === "de" ? "Sonstige Therapeuten" : "Other Therapists"}</Label>
            <Input 
              id="sonstigeTherapeutenn" 
              value={formData.sonstigeTherapeutenn} 
              onChange={(e) => updateFormData("sonstigeTherapeutenn", e.target.value)} 
            />
          </div>
        </div>

        {/* Multi-Entry Fachärzte */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <Label className="text-base font-medium">
              {language === "de" ? "Fachärzte" : "Specialists"}
            </Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const current = Array.isArray((formData as any).facharztListe) ? (formData as any).facharztListe : [];
                updateFormData("facharztListe", [...current, { fachrichtung: "", name: "" }]);
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              {language === "de" ? "Facharzt hinzufügen" : "Add Specialist"}
            </Button>
          </div>
          {(Array.isArray((formData as any).facharztListe) ? (formData as any).facharztListe : []).map((entry: any, index: number) => (
            <div key={index} className="flex gap-3 items-start mb-3 p-3 border rounded-lg">
              <div className="flex-1 grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{language === "de" ? "Fachrichtung" : "Specialty"}</Label>
                  <Select
                    value={entry.fachrichtung || ""}
                    onValueChange={(v) => {
                      const list = [...(formData as any).facharztListe];
                      list[index] = { ...list[index], fachrichtung: v };
                      updateFormData("facharztListe", list);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={language === "de" ? "Fachrichtung wählen" : "Select specialty"} />
                    </SelectTrigger>
                    <SelectContent>
                      {[
                        { value: "orthopaedie", de: "Orthopädie", en: "Orthopedics" },
                        { value: "kardiologie", de: "Kardiologie", en: "Cardiology" },
                        { value: "neurologie", de: "Neurologie", en: "Neurology" },
                        { value: "dermatologie", de: "Dermatologie", en: "Dermatology" },
                        { value: "hno", de: "HNO", en: "ENT" },
                        { value: "augenheilkunde", de: "Augenheilkunde", en: "Ophthalmology" },
                        { value: "urologie", de: "Urologie", en: "Urology" },
                        { value: "gynaekologie", de: "Gynäkologie", en: "Gynecology" },
                        { value: "gastroenterologie", de: "Gastroenterologie", en: "Gastroenterology" },
                        { value: "endokrinologie", de: "Endokrinologie", en: "Endocrinology" },
                        { value: "pneumologie", de: "Pneumologie", en: "Pulmonology" },
                        { value: "onkologie", de: "Onkologie", en: "Oncology" },
                        { value: "psychiatrie", de: "Psychiatrie", en: "Psychiatry" },
                        { value: "rheumatologie", de: "Rheumatologie", en: "Rheumatology" },
                        { value: "chirurgie", de: "Chirurgie", en: "Surgery" },
                        { value: "radiologie", de: "Radiologie", en: "Radiology" },
                        { value: "sonstige", de: "Sonstige", en: "Other" },
                      ].map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {language === "de" ? opt.de : opt.en}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{language === "de" ? "Name" : "Name"}</Label>
                  <Input
                    value={entry.name || ""}
                    onChange={(e) => {
                      const list = [...(formData as any).facharztListe];
                      list[index] = { ...list[index], name: sanitizeName(e.target.value) };
                      updateFormData("facharztListe", list);
                    }}
                    placeholder={language === "de" ? "Name des Facharztes" : "Specialist name"}
                  />
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-destructive mt-5"
                onClick={() => {
                  const list = [...(formData as any).facharztListe];
                  list.splice(index, 1);
                  updateFormData("facharztListe", list);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {(!Array.isArray((formData as any).facharztListe) || (formData as any).facharztListe.length === 0) && (
            <p className="text-sm text-muted-foreground italic">
              {language === "de" ? "Noch keine Fachärzte hinzugefügt. Klicken Sie auf 'Facharzt hinzufügen'." : "No specialists added yet. Click 'Add Specialist'."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default PatientDataSection;
