import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useLanguage } from "@/contexts/LanguageContext";
import { AnamneseFormData } from "@/lib/anamneseFormData";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import YearMonthSelect from "./shared/YearMonthSelect";

interface EnvironmentSectionProps {
  formData: AnamneseFormData;
  updateFormData: (field: string, value: any) => void;
}

const EnvironmentSection = ({ formData, updateFormData }: EnvironmentSectionProps) => {
  const { language } = useLanguage();

  const birthYear = formData.geburtsdatum
    ? new Date(formData.geburtsdatum).getFullYear()
    : undefined;

  const updateChemosensibilitaet = (field: string, subfield: string, value: any) => {
    updateFormData("umweltbelastungen", {
      ...formData.umweltbelastungen,
      chemosensibilitaet: {
        ...formData.umweltbelastungen?.chemosensibilitaet,
        [field]: {
          ...(formData.umweltbelastungen?.chemosensibilitaet?.[field as keyof typeof formData.umweltbelastungen.chemosensibilitaet] as object),
          [subfield]: value
        }
      }
    });
  };

  const updateKoerperbelastungen = (field: string, subfield: string, value: any) => {
    updateFormData("umweltbelastungen", {
      ...formData.umweltbelastungen,
      koerperbelastungen: {
        ...formData.umweltbelastungen?.koerperbelastungen,
        [field]: {
          ...(formData.umweltbelastungen?.koerperbelastungen?.[field as keyof typeof formData.umweltbelastungen.koerperbelastungen] as object),
          [subfield]: value
        }
      }
    });
  };

  const chemikalien = [
    { field: "dieselAbgase", labelDe: "Dieselabgase", labelEn: "Diesel exhaust" },
    { field: "tabakrauch", labelDe: "Tabakrauch", labelEn: "Tobacco smoke" },
    { field: "pestizide", labelDe: "Pestizide/Insektizide", labelEn: "Pesticides/Insecticides" },
    { field: "benzin", labelDe: "Benzin", labelEn: "Gasoline" },
    { field: "farben", labelDe: "Farben/Lacke", labelEn: "Paints/Lacquers" },
    { field: "desinfektionsmittel", labelDe: "Desinfektionsmittel", labelEn: "Disinfectants" },
    { field: "reiniger", labelDe: "Reinigungsmittel", labelEn: "Cleaning agents" },
    { field: "parfuems", labelDe: "Parfüms/Duftstoffe", labelEn: "Perfumes/Fragrances" },
    { field: "teer", labelDe: "Teer/Asphalt", labelEn: "Tar/Asphalt" },
    { field: "nagellack", labelDe: "Nagellack/-entferner", labelEn: "Nail polish/remover" },
    { field: "haarspray", labelDe: "Haarspray", labelEn: "Hair spray" },
    { field: "neueRaumausstattung", labelDe: "Neue Raumausstattung", labelEn: "New furnishings" },
    { field: "kunststoff", labelDe: "Kunststoffe", labelEn: "Plastics" },
    { field: "neuesAuto", labelDe: "Neues Auto (Geruch)", labelEn: "New car (smell)" },
  ];

  return (
    <div className="space-y-8">
      {/* Chemosensibilität */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">
          {language === "de" ? "Chemische Sensibilitäten" : "Chemical Sensitivities"}
        </h3>
        <p className="text-sm text-muted-foreground">
          {language === "de" 
            ? "Reagieren Sie empfindlich auf folgende Stoffe? Bitte angeben, ob und wie stark."
            : "Are you sensitive to the following substances? Please indicate if and how strongly."}
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          {chemikalien.map((item) => {
            const data = formData.umweltbelastungen?.chemosensibilitaet?.[item.field as keyof typeof formData.umweltbelastungen.chemosensibilitaet] as { ja?: boolean; staerke?: string } | undefined;
            return (
              <div key={item.field} className="space-y-2 p-3 bg-muted/30 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id={`chemo-${item.field}`}
                    checked={data?.ja || false}
                    onCheckedChange={(checked) => updateChemosensibilitaet(item.field, "ja", checked)}
                  />
                  <Label htmlFor={`chemo-${item.field}`} className="font-normal">
                    {language === "de" ? item.labelDe : item.labelEn}
                  </Label>
                </div>
                {data?.ja && (
                  <RadioGroup
                    value={data?.staerke || ""}
                    onValueChange={(value) => updateChemosensibilitaet(item.field, "staerke", value)}
                    className="flex gap-4 pl-6"
                  >
                    {[
                      { value: "leicht", labelDe: "Leicht", labelEn: "Mild" },
                      { value: "mittel", labelDe: "Mittel", labelEn: "Moderate" },
                      { value: "stark", labelDe: "Stark", labelEn: "Severe" },
                    ].map((option) => (
                      <div key={option.value} className="flex items-center space-x-1">
                        <RadioGroupItem value={option.value} id={`${item.field}-${option.value}`} />
                        <Label htmlFor={`${item.field}-${option.value}`} className="font-normal text-xs">
                          {language === "de" ? option.labelDe : option.labelEn}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <Separator />

      {/* Strahlenbelastung */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">
          {language === "de" ? "Strahlung & Elektrosmog" : "Radiation & Electrosmog"}
        </h3>

        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="strahlung"
              checked={formData.umweltbelastungen?.koerperbelastungen?.strahlung?.ja || false}
              onCheckedChange={(checked) => updateKoerperbelastungen("strahlung", "ja", checked)}
            />
            <Label htmlFor="strahlung">
              {language === "de" ? "Ich bin Strahlenbelastungen ausgesetzt" : "I am exposed to radiation"}
            </Label>
          </div>

          {formData.umweltbelastungen?.koerperbelastungen?.strahlung?.ja && (
            <div className="flex flex-wrap gap-4 pl-6">
              {[
                { field: "geopathie", labelDe: "Geopathische Belastung", labelEn: "Geopathic stress" },
                { field: "elektrosmog", labelDe: "Elektrosmog", labelEn: "Electrosmog" },
                { field: "hochspannung", labelDe: "Hochspannung in Nähe", labelEn: "High voltage nearby" },
                { field: "funkmasten", labelDe: "Funkmasten in Nähe", labelEn: "Cell towers nearby" },
                { field: "wlan", labelDe: "WLAN-Belastung", labelEn: "WiFi exposure" },
              ].map((option) => (
                <div key={option.field} className="flex items-center space-x-2">
                  <Checkbox
                    id={`strahlung-${option.field}`}
                    checked={formData.umweltbelastungen?.koerperbelastungen?.strahlung?.[option.field as keyof typeof formData.umweltbelastungen.koerperbelastungen.strahlung] || false}
                    onCheckedChange={(checked) => updateKoerperbelastungen("strahlung", option.field, checked)}
                  />
                  <Label htmlFor={`strahlung-${option.field}`} className="font-normal text-sm">
                    {language === "de" ? option.labelDe : option.labelEn}
                  </Label>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>



      <Separator />

      {/* Nebenhöhlen */}
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="nebenhoehlen"
            checked={formData.umweltbelastungen?.koerperbelastungen?.nebenhoehlen?.ja || false}
            onCheckedChange={(checked) => updateKoerperbelastungen("nebenhoehlen", "ja", checked)}
          />
          <Label htmlFor="nebenhoehlen" className="text-lg font-medium">
            {language === "de" ? "Nebenhöhlenprobleme" : "Sinus problems"}
          </Label>
        </div>

        {formData.umweltbelastungen?.koerperbelastungen?.nebenhoehlen?.ja && (
          <div className="space-y-4 pl-6">
            <div className="flex flex-wrap gap-4">
              {[
                { field: "stirn", labelDe: "Stirnhöhle", labelEn: "Frontal sinus" },
                { field: "kiefer", labelDe: "Kieferhöhle", labelEn: "Maxillary sinus" },
                { field: "beide", labelDe: "Beide", labelEn: "Both" },
              ].map((option) => (
                <div key={option.field} className="flex items-center space-x-2">
                  <Checkbox
                    id={`nebenhoehlen-${option.field}`}
                    checked={formData.umweltbelastungen?.koerperbelastungen?.nebenhoehlen?.[option.field as keyof typeof formData.umweltbelastungen.koerperbelastungen.nebenhoehlen] || false}
                    onCheckedChange={(checked) => updateKoerperbelastungen("nebenhoehlen", option.field, checked)}
                  />
                  <Label htmlFor={`nebenhoehlen-${option.field}`} className="font-normal text-sm">
                    {language === "de" ? option.labelDe : option.labelEn}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EnvironmentSection;
