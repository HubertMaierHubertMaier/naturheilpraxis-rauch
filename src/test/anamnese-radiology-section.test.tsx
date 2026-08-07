import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SurgeriesSection from "@/components/anamnese/SurgeriesSection";
import { initialFormData, type AnamneseFormData } from "@/lib/anamneseFormData";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ language: "de" }),
}));

function Harness() {
  const [formData, setFormData] = useState<AnamneseFormData>(initialFormData);

  return (
    <SurgeriesSection
      formData={formData}
      updateFormData={(field, value) => setFormData((current) => ({ ...current, [field]: value }))}
    />
  );
}

describe("radiological and nuclear medicine anamnesis", () => {
  it("distinguishes non-radioactive CT contrast and accepts repeated radioiodine examinations", () => {
    render(<Harness />);

    expect(screen.getByText(/Kontrastmittel enthält nicht-radioaktives Jod/)).toBeInTheDocument();
    expect(screen.getByText(/mindestens etwa 6 Wochen/)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/Radiojoddiagnostik \/ Ganzkörperszintigrafie/));
    expect(screen.getByText("Eintrag 1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Weitere Untersuchung hinzufügen" }));
    expect(screen.getByText("Eintrag 2")).toBeInTheDocument();
  });
});
