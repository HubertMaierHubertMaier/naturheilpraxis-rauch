import { expect, it } from "vitest";
import { extractUniquePatientPseudonym, loadPatientMannayanOrders, mannayanOrderMatchesPatient, orderNumberOrMissing, type MannayanOrderRow } from "../lib/mannayanPatientOrders";
const pid = "P-2099-0001";
const row = (id: string, canonical: string | null = pid, label: string | null = null): MannayanOrderRow => ({ id, pseudonym_id: canonical, patient_label: label, order_number: `B-${id}`, created_at: "2099-01-01T00:00:00Z", items: [{ name: "Synthetic product", quantity: 1 }], notes: null });
function client(canonical: MannayanOrderRow[], legacy: MannayanOrderRow[], repeat = false) {
  const calls: Array<{ legacy: boolean; offset: number; end: number; exact?: string }> = [];
  return { calls, from: (table: string) => {
    expect(table).toBe("mannayan_orders"); let isLegacy = false; let exact: string | undefined;
    const query = { select: () => query, eq: (field: string, value: string) => { expect(field).toBe("pseudonym_id"); exact = value; return query; }, or: () => { isLegacy = true; return query; }, ilike: () => query, order: () => query,
      range: async (offset: number, end: number) => { calls.push({ legacy: isLegacy, offset, end, exact }); const source = isLegacy ? legacy : canonical; return { data: repeat ? source.slice(0, 200) : source.slice(offset, end + 1), error: null }; } };
    return query;
  } };
}
it("does not truncate malformed or ambiguous patient identifiers", () => {
  expect(extractUniquePatientPseudonym("Bestellung für p-2099-0001")).toBe(pid);
  for (const label of ["P-2099-00010", "P-2099-0001A", "P-2099-0001 / P-2099-0002", "Name ohne Pseudonym", "XP-2099-0001", "P-2099-0001ä", "ÄP-2099-0001"]) expect(extractUniquePatientPseudonym(label)).toBeNull();
});
it("uses canonical links ahead of legacy labels and rejects other cases", () => {
  expect(mannayanOrderMatchesPatient(row("one", pid, "anderer Text"), pid)).toBe(true);
  expect(mannayanOrderMatchesPatient(row("two", "P-2099-0002", pid), pid)).toBe(false);
  expect(mannayanOrderMatchesPatient(row("three", null, `Bestellung ${pid}`), pid)).toBe(true);
  expect(mannayanOrderMatchesPatient(row("four", null, "P-2099-00010"), pid)).toBe(false);
  expect(mannayanOrderMatchesPatient(row("five", pid, "P-2099-00010"), pid)).toBe(false);
  expect(mannayanOrderMatchesPatient(row("six", pid, "P-2099-0002"), pid)).toBe(false);
});
it("loads beyond 20 orders and paginates all canonical rows plus unambiguous legacy rows", async () => {
  const canonical = Array.from({ length: 201 }, (_, index) => row(String(index)));
  const c = client(canonical, [row("legacy", null, pid), row("foreign", null, "P-2099-00010"), row("ambiguous", null, `${pid} / P-2099-0002`)]);
  const result = await loadPatientMannayanOrders(c, pid);
  expect(result).toHaveLength(202); expect(result.some(r => r.id === "legacy")).toBe(true); expect(result.some(r => r.id === "foreign" || r.id === "ambiguous")).toBe(false);
  expect(c.calls.map(c => c.offset)).toEqual([0, 200, 0]); expect(c.calls[0].exact).toBe(pid);
});
it("never accepts a foreign canonical row from a faulty query result", async () => {
  await expect(loadPatientMannayanOrders(client([row("wrong", "P-2099-0002")], []), pid)).rejects.toThrow(/nicht zum angefragten Fall/);
});
it("stops repeated pages rather than hanging or silently claiming completeness", async () => {
  await expect(loadPatientMannayanOrders(client(Array.from({ length: 200 }, (_, n) => row(String(n))), [], true), pid)).rejects.toThrow(/wiederholt/);
});
it("does not start queries for a cancelled context and preserves explicit zero amounts", async () => {
  const c = client([row("one")], []); expect(await loadPatientMannayanOrders(c, pid, () => false)).toEqual([]); expect(c.calls).toEqual([]);
  expect(orderNumberOrMissing(0)).toBe(0); expect(orderNumberOrMissing("0")).toBe(0);
  for (const value of [null, undefined, "", " ", false, "unbekannt"]) expect(orderNumberOrMissing(value)).toBeUndefined();
});
