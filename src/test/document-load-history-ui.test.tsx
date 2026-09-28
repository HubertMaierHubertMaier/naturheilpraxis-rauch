import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DocumentLoadHistory } from "../components/admin/therapy/DocumentLoadHistory";
const fixture = vi.hoisted(() => ({ fail: false, rows: [] as any[] }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => {
  const query = { select: () => query, eq: () => query, order: () => query,
    range: async () => ({ data: fixture.rows, error: fixture.fail ? { message: "offline" } : null }) };
  return query;
} } }));
afterEach(() => { cleanup(); fixture.rows = []; fixture.fail = false; });
describe("visible load history", () => {
  it("shows all five dates in the interface without interpreting them as clinical dates", async () => {
    fixture.rows = [1, 2, 3, 4, 5].map(day => ({ id: String(day), created_at: `2026-09-0${day}`, befund_meta: { loads: [{ documentKey: "a".repeat(64), documentType: "anamnese", loadedAt: `2026-09-0${day}T10:00:00Z` }] } }));
    render(<DocumentLoadHistory userId="user-a" pid="case-a" revision={0} saveError="" />);
    await waitFor(() => expect(screen.getAllByText(/Kennung aaaaaaaaaa/)).toHaveLength(5));
    expect(screen.getByRole("heading", { name: /Ladeverlauf/ })).toBeVisible();
    for (let day = 1; day <= 5; day++) expect(screen.getByText(new RegExp(`Ladedatum: ${day}\\.9\\.2026`))).toBeVisible();
  });
  it("shows a failed persistence explicitly instead of a success", async () => {
    fixture.fail = true;
    render(<DocumentLoadHistory userId="user-a" pid="case-a" revision={0} saveError="Nicht gespeichert" />);
    await waitFor(() => expect(screen.getByText(/nicht abgerufen/)).toBeVisible());
    expect(screen.getByText(/Nicht gespeichert/)).toBeVisible();
  });
  it("labels an existing generic Hospital event from its matching local selection without changing its key or time", async () => {
    const documentKey = "b".repeat(64);
    fixture.rows = [{ id: "event-hospital", created_at: "2030-04-29", befund_meta: { loads: [{ documentKey, documentType: "", loadedAt: "2030-04-29T13:33:57Z" }] } }];
    render(<DocumentLoadHistory userId="user-a" pid="case-a" revision={0} saveError="" selectionHints={[{ eventId: "event-hospital", fileName: "P-2030-1234 - Hospital - - Muster.pdf", documentKey }]} />);
    await waitFor(() => expect(screen.getByText(/Metatron \/ Hospital · Kennung bbbbbbbbbb · Ladedatum: 29\.4\.2030/)).toBeVisible());
  });
  it("keeps a generic historical label when no matching local selection is available", async () => {
    fixture.rows = [{ id: "event-hospital", created_at: "2030-04-29", befund_meta: { loads: [{ documentKey: "b".repeat(64), documentType: "", loadedAt: "2030-04-29T13:33:57Z" }] } }];
    render(<DocumentLoadHistory userId="user-a" pid="case-a" revision={0} saveError="" selectionHints={[{ eventId: "event-hospital", fileName: "Hospital.pdf", documentKey: "c".repeat(64) }]} />);
    await waitFor(() => expect(screen.getByText(/Dokument · Kennung bbbbbbbbbb/)).toBeVisible());
  });
  it("keeps an explicitly stored type ahead of a filename hint", async () => {
    const documentKey = "b".repeat(64);
    fixture.rows = [{ id: "event-hospital", created_at: "2030-04-29", befund_meta: { loads: [{ documentKey, documentType: "sonstige", loadedAt: "2030-04-29T13:33:57Z" }] } }];
    render(<DocumentLoadHistory userId="user-a" pid="case-a" revision={0} saveError="" selectionHints={[{ eventId: "event-hospital", fileName: "Hospital.pdf", documentKey }]} />);
    await waitFor(() => expect(screen.getByText(/Allgemeine Unterlagen · Kennung bbbbbbbbbb/)).toBeVisible());
  });
});
