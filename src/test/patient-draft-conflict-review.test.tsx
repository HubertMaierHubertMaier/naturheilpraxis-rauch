import { act, fireEvent, render, screen, within, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PatientDraftConflictReview } from "@/components/admin/therapy/PatientDraftConflictReview";
import { draftConflictFields, mergeReviewedDraft } from "@/lib/patientDraftConflict";
import { readWindowPatientInputDraft } from "@/lib/patientDraftRecovery";

afterEach(cleanup);
const local = { anamnese: "synthetic local source", laborKomplett: "synthetic local laboratory" };
const remote = { anamnese: "synthetic saved source", laborKomplett: "synthetic saved laboratory", futureField: "retained extra" };

describe("explicit conflict choices", () => {
  it("uses the server inventory instead of an invisible stale local inventory", () => {
    const oldInventory = [{ archivePath: "synthetic-old" }];
    const currentInventory = [{ archivePath: "synthetic-current" }];
    expect(mergeReviewedDraft({ document_inventory: oldInventory }, { document_inventory: currentInventory }, {}))
      .toEqual({});
    expect(mergeReviewedDraft({ document_inventory: oldInventory }, {}, {})).not.toHaveProperty("document_inventory");
  });
  it("requires every changed field and retains unknown server fields", () => {
    expect(draftConflictFields(local, remote)).toEqual(["anamnese", "laborKomplett"]);
    expect(() => mergeReviewedDraft(local, remote, { anamnese: "local" })).toThrow(/jedes/);
    expect(mergeReviewedDraft(local, remote, { anamnese: "local", laborKomplett: "remote" })).toEqual({
      anamnese: local.anamnese, laborKomplett: remote.laborKomplett, futureField: remote.futureField,
    });
  });
  it("represents deliberately selected absent fields as empty controlled input values", () => {
    expect(mergeReviewedDraft({ symptome: "synthetic", pathogens: [{ name: "synthetic" }] }, {},
      { symptome: "remote", pathogens: "remote" })).toEqual({ symptome: "", pathogens: [] });
  });
  it("keeps saving disabled until the user chooses both fields", async () => {
    const onResolve = vi.fn(async () => undefined);
    render(<PatientDraftConflictReview local={local} remote={remote} onResolve={onResolve} onCancel={vi.fn()} />);
    const save = screen.getByRole("button", { name: "Ausgewählte Fassung speichern" });
    expect(save).toBeDisabled();
    fireEvent.click(within(screen.getByRole("group", { name: "Anamnese" })).getByRole("radio", { name: /Meine Eingaben/ }));
    expect(save).toBeDisabled();
    fireEvent.click(within(screen.getByRole("group", { name: "Laborbefund" })).getByRole("radio", { name: /Gespeicherte Fassung/ }));
    expect(save).toBeEnabled();
    await act(async () => { fireEvent.click(save); });
    expect(onResolve).toHaveBeenCalledWith({ ...remote, anamnese: local.anamnese });
  });
  it("keeps the comparison visible after a new server conflict", async () => {
    const onCancel = vi.fn();
    render(<PatientDraftConflictReview local={{ anamnese: "synthetic" }} remote={{ anamnese: "synthetic" }}
      onResolve={async () => { throw new Error("synthetic newer server revision"); }} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: "Ausgewählte Fassung speichern" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("synthetic newer server revision");
    expect(onCancel).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Vergleich schließen/ }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
  it("restores this window's own draft instead of another window's newer shared copy", () => {
    const pid = "P-2099-0501";
    const own = { _pseudonym_id: pid, pseudonymId: pid, anamnese: "synthetic own edit", savedAt: "2099-01-01" };
    const other = { ...own, anamnese: "synthetic other window", savedAt: "2099-01-02" };
    const key = `therapy.inputs.draft.patientSafe.v4.${pid}`;
    const storage = (data: unknown) => ({ getItem: (candidate: string) => candidate === key ? JSON.stringify(data) : null });
    expect(readWindowPatientInputDraft(storage(own), storage(other), pid, data => !!data.anamnese).data).toEqual(own);
  });
});
