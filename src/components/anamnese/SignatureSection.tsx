import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useLanguage } from "@/contexts/LanguageContext";
import { AnamneseFormData } from "@/lib/anamneseFormData";
import { AlertTriangle, Shield, FileCheck, ExternalLink, Baby } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface SignatureSectionProps {
  formData: AnamneseFormData;
  updateFormData: (field: string, value: any) => void;
}

const SignatureSection = ({ formData, updateFormData }: SignatureSectionProps) => {
  const { language } = useLanguage();

  // Check if patient is a minor
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

  const guardianLabel = React.useMemo(() => {
    if (formData.sorgeberechtigterTyp === "mutter") return language === "de" ? "Mutter" : "Mother";
    if (formData.sorgeberechtigterTyp === "vater") return language === "de" ? "Vater" : "Father";
    return language === "de" ? "Sorgeberechtigte/r" : "Guardian";
  }, [formData.sorgeberechtigterTyp, language]);

  // Auto-set today's date and auto-fill ort from contact data
  React.useEffect(() => {
    const updates: Record<string, any> = { ...formData.unterschrift };
    let changed = false;
    if (!updates.datum) {
      updates.datum = new Date().toISOString().split('T')[0];
      changed = true;
    }
    if (formData.wohnort && updates.ort !== formData.wohnort) {
      updates.ort = formData.wohnort;
      changed = true;
    }
    if (changed) {
      updateFormData("unterschrift", updates);
    }
  }, [formData.wohnort]);

  // Auto-fill name for adults from contact data, for minors from guardian
  React.useEffect(() => {
    if (isMinor && formData.sorgeberechtigterVorname && formData.sorgeberechtigterNachname) {
      const guardianName = `${formData.sorgeberechtigterVorname} ${formData.sorgeberechtigterNachname}`;
      updateFormData("unterschrift", {
        ...formData.unterschrift,
        nameInDruckbuchstaben: guardianName.toUpperCase()
      });
    } else if (!isMinor && formData.vorname && formData.nachname) {
      const patientName = `${formData.vorname} ${formData.nachname}`;
      if (!formData.unterschrift?.nameInDruckbuchstaben || formData.unterschrift.nameInDruckbuchstaben !== patientName.toUpperCase()) {
        updateFormData("unterschrift", {
          ...formData.unterschrift,
          nameInDruckbuchstaben: patientName.toUpperCase()
        });
      }
    }
  }, [isMinor, formData.sorgeberechtigterVorname, formData.sorgeberechtigterNachname, formData.vorname, formData.nachname]);

  // Validate signature date – for minors, signer must be ≥18
  const signatureDateError = React.useMemo(() => {
    if (!isMinor) return "";
    const datum = formData.unterschrift?.geburtsdatumUnterzeichner;
    if (!datum) return "";
    const birth = new Date(datum);
    if (isNaN(birth.getTime())) return "";
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    if (age < 18) {
      return language === "de"
        ? "Der/Die Unterzeichnende muss mindestens 18 Jahre alt sein."
        : "The signer must be at least 18 years old.";
    }
    return "";
  }, [isMinor, formData.unterschrift?.geburtsdatumUnterzeichner, language]);

  const updateUnterschrift = (field: string, value: any) => {
    updateFormData("unterschrift", {
      ...formData.unterschrift,
      [field]: value
    });
  };

  return (
    <div className="space-y-8">
      {/* Weitere Erkrankungen */}
      <div className="space-y-4">
        <h3 className="font-semibold text-lg">
          {language === "de" ? "Weitere Erkrankungen/Symptome" : "Additional Conditions/Symptoms"}
        </h3>
        <p className="text-sm text-muted-foreground">
          {language === "de"
            ? "Haben Sie Erkrankungen oder Schmerzen, die in diesem Fragebogen noch nicht abgefragt wurden?"
            : "Do you have conditions or pain that were not asked about in this questionnaire?"}
        </p>
        <Textarea
          value={formData.weitereErkrankungen || ""}
          onChange={(e) => updateFormData("weitereErkrankungen", e.target.value)}
          rows={4}
          placeholder={language === "de" ? "Falls ja, bitte beschreiben..." : "If yes, please describe..."}
        />
      </div>

      <Separator />

      {/* Zusätzliche Informationen */}
      <div className="space-y-4">
        <h3 className="font-semibold text-lg">
          {language === "de" ? "Zusätzliche Informationen (Optional)" : "Additional Information (Optional)"}
        </h3>
        <p className="text-sm text-muted-foreground">
          {language === "de"
            ? "Weitere Informationen, die für meine Behandlung relevant sein könnten:"
            : "Additional information that may be relevant for my treatment:"}
        </p>
        <Textarea
          value={formData.zusaetzlicheInfos || ""}
          onChange={(e) => updateFormData("zusaetzlicheInfos", e.target.value)}
          rows={4}
        />
      </div>

      <Separator />

      {/* DSGVO Hinweis */}
      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
        <div className="flex gap-4">
          <Shield className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-1" />
          <div className="space-y-3">
            <h4 className="font-semibold text-blue-900 dark:text-blue-100">
              {language === "de" ? "Datenschutz nach DSGVO" : "Data Protection (GDPR)"}
            </h4>
            <p className="text-sm text-blue-800 dark:text-blue-200">
              {language === "de"
                ? "Ihre Daten werden verschlüsselt übertragen und gemäß den Bestimmungen der DSGVO verarbeitet. Sie haben jederzeit das Recht auf Auskunft, Berichtigung und Löschung Ihrer Daten. Die Aufbewahrungsfrist für Behandlungsdaten beträgt 10 Jahre."
                : "Your data is encrypted during transmission and processed in accordance with GDPR regulations. You have the right to access, correct, and delete your data at any time. Medical records are retained for 10 years."}
            </p>
          </div>
        </div>
      </div>

      {/* Unterschrift & Bestätigung */}
      <div className="space-y-6">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <FileCheck className="w-5 h-5" />
          {language === "de" ? "Unterschrift & Bestätigung" : "Signature & Confirmation"}
        </h3>

        {/* Hinweis bei Minderjährigen */}
        {isMinor && (
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
            <div className="flex gap-3">
              <Baby className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  {language === "de"
                    ? `Da der Patient minderjährig ist, muss dieser Abschnitt vom Sorgeberechtigten (${guardianLabel}) ausgefüllt und unterschrieben werden.`
                    : `Since the patient is a minor, this section must be completed and signed by the legal guardian (${guardianLabel}).`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {language === "de"
                    ? "Bitte geben Sie das Geburtsdatum und den Namen des/der Sorgeberechtigten ein."
                    : "Please enter the date of birth and name of the legal guardian."}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ort">{language === "de" ? "Ort" : "Location"}</Label>
            <Input
              id="ort"
              value={formData.unterschrift?.ort || ""}
              readOnly
              className="bg-muted cursor-not-allowed"
            />
            <p className="text-xs text-muted-foreground">
              {language === "de" ? "Wird automatisch aus den Kontaktdaten übernommen." : "Automatically filled from contact data."}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="datum">{language === "de" ? "Datum" : "Date"} *</Label>
            <Input
              id="datum"
              type="date"
              value={new Date().toISOString().split('T')[0]}
              readOnly
              className="bg-muted cursor-not-allowed"
            />
            <p className="text-xs text-muted-foreground">
              {language === "de" ? "Das Datum wird automatisch auf heute gesetzt." : "The date is automatically set to today."}
            </p>
          </div>
        </div>

        {/* Geburtsdatum des Unterzeichners – nur bei Minderjährigen */}
        {isMinor && (
          <div className="space-y-2">
            <Label htmlFor="geburtsdatumUnterzeichner">
              {language === "de"
                ? `Geburtsdatum ${guardianLabel}`
                : `Date of Birth ${guardianLabel}`} *
            </Label>
            <Input
              id="geburtsdatumUnterzeichner"
              type="date"
              value={formData.unterschrift?.geburtsdatumUnterzeichner || ""}
              onChange={(e) => updateUnterschrift("geburtsdatumUnterzeichner", e.target.value)}
              required
              className={cn(signatureDateError && "border-destructive")}
            />
            {signatureDateError && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {signatureDateError}
              </p>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="nameInDruckbuchstaben">
            {isMinor
              ? (language === "de" ? `Name ${guardianLabel} in Druckbuchstaben` : `Name of ${guardianLabel} in Block Letters`)
              : (language === "de" ? "Name in Druckbuchstaben" : "Name in Block Letters")} *
          </Label>
          <Input
            id="nameInDruckbuchstaben"
            value={formData.unterschrift?.nameInDruckbuchstaben || ""}
            readOnly
            className="uppercase bg-muted cursor-not-allowed"
          />
          <p className="text-xs text-muted-foreground">
            {language === "de"
              ? (isMinor ? "Wird automatisch vom Sorgeberechtigten übernommen." : "Wird automatisch aus den Patientendaten übernommen.")
              : (isMinor ? "Automatically filled from guardian data." : "Automatically filled from patient data.")}
          </p>
        </div>

        <div className="bg-muted/50 rounded-lg p-6 space-y-4">
          <p className="text-sm">
            {isMinor
              ? (language === "de"
                ? `Hiermit bestätige ich als ${guardianLabel} und Sorgeberechtigte/r, dass ich die obigen Informationen zum Patienten ${formData.vorname || ""} ${formData.nachname || ""} nach bestem Wissen und Gewissen wahrheitsgemäß ausgefüllt habe. Ich habe die "Anleitung zum Ausfüllen" (S. 1) gelesen und verstanden. Ich bin damit einverstanden, dass diese Daten in der Patientenakte hinterlegt werden und in Zusammenhang mit der Behandlung verwendet werden.`
                : `I hereby confirm as ${guardianLabel} and legal guardian that I have filled in the above information about the patient ${formData.vorname || ""} ${formData.nachname || ""} truthfully to the best of my knowledge and belief. I have read and understood the "Instructions for Completion" (p. 1). I agree that this data will be stored in the patient file and used in connection with the treatment.`)
              : (language === "de"
                ? 'Hiermit bestätige ich, dass ich die obigen Informationen zu meiner Person nach bestem Wissen und Gewissen wahrheitsgemäß ausgefüllt habe. Ich habe die "Anleitung zum Ausfüllen" (S. 1) gelesen und verstanden. Ich bin damit einverstanden, dass diese Daten in meiner Patientenakte hinterlegt werden und in Zusammenhang mit meiner Behandlung verwendet werden.'
                : 'I hereby confirm that I have filled in the above information about myself truthfully to the best of my knowledge and belief. I have read and understood the "Instructions for Completion" (p. 1). I agree that this data will be stored in my patient file and used in connection with my treatment.')}
          </p>

          <div className="flex items-start space-x-3">
            <Checkbox
              id="bestaetigung"
              checked={formData.unterschrift?.bestaetigung || false}
              onCheckedChange={(checked) => updateUnterschrift("bestaetigung", !!checked)}
              className="mt-1"
            />
            <Label htmlFor="bestaetigung" className="font-medium cursor-pointer">
              {isMinor
                ? (language === "de"
                  ? `Ich bestätige als ${guardianLabel} die Richtigkeit der Angaben. *`
                  : `I confirm as ${guardianLabel} the accuracy of the information. *`)
                : (language === "de"
                  ? "Ich bestätige die Richtigkeit meiner Angaben. *"
                  : "I confirm the accuracy of my information. *")}
            </Label>
          </div>

          {/* Datenschutz-Einwilligung mit Link */}
          <div className="flex items-start space-x-3 pt-2">
            <Checkbox
              id="datenschutzEinwilligung"
              checked={formData.unterschrift?.datenschutzEinwilligung || false}
              onCheckedChange={(checked) => updateUnterschrift("datenschutzEinwilligung", !!checked)}
              className="mt-1"
            />
            <Label htmlFor="datenschutzEinwilligung" className="font-medium cursor-pointer">
              {language === "de" ? (
                <>
                  Ich erlaube, dass meine Gesundheitsdaten für meine Behandlung gespeichert werden. E-Mail-Kommunikation (Rechnungen, Termine, Fragen, Anfragen für eine Bewertung) ist ok. Ich habe die{" "}
                  <Link 
                    to="/datenschutz" 
                    target="_blank" 
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Datenschutzverordnung
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                  {" "}gelesen und stimme zu. *
                </>
              ) : (
                <>
                  I allow my health data to be stored for my treatment. Email communication (invoices, appointments, questions, review requests) is acceptable. I have read and agree to the{" "}
                  <Link 
                    to="/datenschutz" 
                    target="_blank" 
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Privacy Policy
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                  . *
                </>
              )}
            </Label>
          </div>

          {/* Patientenaufklärung Einwilligung */}
          <div className="flex items-start space-x-3 pt-2">
            <Checkbox
              id="patientenaufklaerung"
              checked={formData.unterschrift?.patientenaufklaerungAkzeptiert || false}
              onCheckedChange={(checked) => updateUnterschrift("patientenaufklaerungAkzeptiert", !!checked)}
              className="mt-1"
            />
            <Label htmlFor="patientenaufklaerung" className="font-medium cursor-pointer">
              {language === "de" ? (
                <>
                  Ich habe die{" "}
                  <Link
                    to="/patientenaufklaerung"
                    target="_blank"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Patientenaufklärung
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                  {" "}(Leistungserstattung, Preise, Terminregelung) gelesen und bin damit einverstanden. *
                </>
              ) : (
                <>
                  I have read and agree to the{" "}
                  <Link
                    to="/patientenaufklaerung"
                    target="_blank"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Patient Information
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                  {" "}(fee reimbursement, pricing, appointment policy). *
                </>
              )}
            </Label>
          </div>
        </div>

        {/* DSGVO-konformer Hinweis zur Datenübermittlung an die Praxis */}
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex gap-3">
            <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
              <p className="font-medium">
                {language === "de"
                  ? "Hinweis zur Datenübermittlung (Art. 13 DSGVO):"
                  : "Data Transmission Notice (Art. 13 GDPR):"}
              </p>
              <p>
                {language === "de"
                  ? "Mit dem Absenden werden folgende Kopien parallel an die Naturheilpraxis Peter Rauch übermittelt, um die Erstaufnahme und Behandlung vorzubereiten:"
                  : "Upon submission, the following copies are simultaneously transmitted to Naturopathic Practice Peter Rauch to prepare for your initial consultation and treatment:"}
              </p>
              <ul className="list-disc ml-4 space-y-1">
                <li>
                  {language === "de"
                    ? "Ihr ausgefüllter Anamnesebogen (an die Praxis-Fachabteilung)"
                    : "Your completed medical history form (to the practice department)"}
                </li>
                <li>
                  {language === "de"
                    ? "Ihr IAA-Fragebogen (Individuelle Austestung und Analyse) mit zugeordneten Diagnoseschlüsseln (an die medizinische Auswertung)"
                    : "Your IAA questionnaire (Individual Testing and Analysis) with assigned diagnostic codes (to medical evaluation)"}
                </li>
              </ul>
              <p>
                {language === "de"
                  ? "Sie selbst erhalten eine Kopie Ihres Anamnesebogens per E-Mail. Der IAA-Fragebogen mit Diagnoseschlüsseln wird ausschließlich der Praxis zur Verfügung gestellt und nicht an Sie übermittelt. Rechtsgrundlage: Art. 9 Abs. 2 lit. h DSGVO i.V.m. § 630f BGB."
                  : "You will receive a copy of your medical history form by email. The IAA questionnaire with diagnostic codes is provided exclusively to the practice and will not be sent to you. Legal basis: Art. 9(2)(h) GDPR in conjunction with § 630f BGB."}
              </p>
            </div>
          </div>
        </div>

        {/* Hinweis auf 2FA */}
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              {language === "de"
                ? "Nach dem Absenden erhalten Sie einen Bestätigungscode per E-Mail zur rechtssicheren Verifizierung Ihrer digitalen Unterschrift gemäß § 126a BGB."
                : "After submission, you will receive a confirmation code by email for legally secure verification of your digital signature in accordance with § 126a BGB."}
            </p>
          </div>
        </div>
      </div>

      {/* Danksagung */}
      <div className="text-center py-6 space-y-2">
        <p className="text-lg font-semibold text-primary">
          {language === "de" 
            ? "VIELEN DANK FÜR IHRE MÜHE!" 
            : "THANK YOU FOR YOUR EFFORT!"}
        </p>
        <p className="text-muted-foreground">
          {language === "de"
            ? "Diese Informationen sind die Grundlage für Ihre optimale Behandlung in der Naturheilpraxis Peter Rauch."
            : "This information forms the basis for your optimal treatment at the Naturopathic Practice Peter Rauch."}
        </p>
      </div>
    </div>
  );
};

export default SignatureSection;
