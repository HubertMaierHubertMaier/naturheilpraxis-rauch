import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PathogenInput, parseBulkPaste, formatPathogensForAI, type PathogenEntry } from "@/components/admin/therapy/PathogenInput";
import { inferMetatronGroup, metatronGroupFor } from "@/lib/metatronPathogenGroups";

describe("Metatron pathogen groups", () => {
  it.each([
    ["Helicobacter pylori", "bacteria"], ["Epstein-Barr-Virus", "viruses"],
    ["Candida albicans", "yeasts"], ["Candida glabrata", "yeasts"],
    ["Aspergillus niger", "moulds"], ["Giardia lamblia", "parasites"],
    ["Unbekannte Belastung", "unassigned"], ["Hepatitis autoimmun", "unassigned"],
  ])("groups %s without changing the source name", (name, group) => {
    expect(inferMetatronGroup(name)).toBe(group);
  });
  it("preserves an explicit review assignment instead of replacing it with a guess", () => {
    expect(metatronGroupFor({ name: "Candida albicans", category: "unassigned" })).toBe("unassigned");
  });
  it("carries category headings through bulk parsing and resets an ambiguous fungi heading", () => {
    const entries = parseBulkPaste("Bakterien\nHelicobacter pylori: Magen | 0.24\nHefepilze (Candida-Arten)\nCandida albicans: DD | 0.42\nPilze\nAspergillus niger: Lu | 0.35");
    expect(entries).toHaveLength(3);
    expect(entries.map(metatronGroupFor)).toEqual(["bacteria", "yeasts", "moulds"]);
    expect(entries[1]).toMatchObject({ name: "Candida albicans", organe: "Dünndarm", index: "0.42" });
  });
  it("keeps unknown and non-microbial legacy entries instead of dropping them", () => {
    const entries = parseBulkPaste("Viren\nEBV: Ly\nSchwermetalle\nQuecksilber: Ni");
    expect(entries.map(entry => entry.name)).toEqual(["EBV", "Quecksilber"]);
    expect(entries.map(metatronGroupFor)).toEqual(["viruses", "unassigned"]);
  });
  it("does not discard a Candida genus entry as a category heading", () => {
    const entries = parseBulkPaste("CANDIDA");
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe("CANDIDA");
    expect(metatronGroupFor(entries[0])).toBe("yeasts");
  });
  it("shows all five requested sections even before data has been entered", () => {
    render(<PathogenInput entries={[]} onChange={() => {}} bulkText="" onBulkTextChange={() => {}} />);
    for (const label of ["Bakterien", "Viren", "Hefepilze (Candida-Arten)", "Schimmelpilze", "Parasiten"]) {
      expect(screen.getByRole("region", { name: `Metatron-Pathogene: ${label}` })).toBeInTheDocument();
    }
  });
  it("keeps identity, source metadata, organs and index when a category is corrected", () => {
    const original = { id: "synthetic", name: "Candida albicans", organe: "Dünndarm", index: "0.42", source: "Synthetische Quelle" };
    const changed = vi.fn();
    function Harness() {
      const [entries, setEntries] = useState<PathogenEntry[]>([original]);
      return <PathogenInput entries={entries} onChange={next => { changed(next); setEntries(next); }} bulkText="" onBulkTextChange={() => {}} />;
    }
    render(<Harness />);
    expect(within(screen.getByRole("region", { name: "Metatron-Pathogene: Hefepilze (Candida-Arten)" })).getByText("Candida albicans")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Liste bearbeiten/ }));
    fireEvent.change(screen.getByRole("combobox", { name: "Gruppe für Candida albicans" }), { target: { value: "unassigned" } });
    expect(changed.mock.lastCall?.[0]).toEqual([{ ...original, category: "unassigned" }]);
    expect(screen.getByRole("region", { name: "Metatron-Pathogene: Noch zuzuordnen" })).toBeInTheDocument();
  });
  it("includes the group without omitting the original name, organ or index from analysis context", () => {
    const text = formatPathogensForAI([{ id: "synthetic", name: "Candida albicans", organe: "Dünndarm", index: "0.42" }]);
    for (const part of ["Candida albicans", "Hefepilze (Candida-Arten)", "Dünndarm", "0.42"]) expect(text).toContain(part);
  });
});
