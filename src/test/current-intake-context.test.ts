import { expect, it } from "vitest";
import { formatCurrentNaturalIntake } from "../../supabase/functions/_shared/currentIntakeContext";

it("preserves all five current intake categories without promoting historical or proposed remedies", () => {
  const text = formatCurrentNaturalIntake({
    naturheilMittelHomoeopathie: "Testmittel mit belegter Potenz",
    naturheilMittelPflanzenheilkunde: "Pflanzliches Testpräparat",
    naturheilMittelVitamine: "Vitamin D3 1000 IE täglich",
    naturheilMittelMineralstoffe: "Magnesium 200 mg abends",
    naturheilMittelSpurenelemente: "Zink 10 mg täglich",
    bisherigeMittel: "ABGESETZT",
    proposedRemedies: "NUR VORSCHLAG",
  });
  for (const expected of ["Testmittel", "Pflanzliches Testpräparat", "1000 IE täglich", "200 mg abends", "10 mg täglich"]) expect(text).toContain(expected);
  expect(text).not.toContain("ABGESETZT");
  expect(text).not.toContain("NUR VORSCHLAG");
  expect(formatCurrentNaturalIntake({ naturheilMittelVitamine: null })).toBe("");
});
