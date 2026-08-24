import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RedactedTextPreview } from "@/components/admin/therapy/RedactedTextPreview";

describe("redacted text preview", () => {
  it("shows removed identifiers as black bars while keeping clinical text visible", () => {
    const html = renderToStaticMarkup(
      <RedactedTextPreview text={"Name: [personenbezogene Angabe entfernt]\nCRP 18 mg/l\n[Anschrift entfernt]"} />,
    );

    expect(html).toContain("bg-black");
    expect(html).toContain("Geschwaerzt");
    expect(html).toContain("CRP 18 mg/l");
    expect(html).not.toContain("personenbezogene Angabe entfernt");
    expect(html).not.toContain("Anschrift entfernt");
  });
});
