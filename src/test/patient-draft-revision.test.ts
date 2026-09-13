// @vitest-environment node
import { describe, expect, it } from "vitest";
import { PatientDraftRevisionTracker, selectLoadedDraftRevision, stampOwnedDraftRevision, writeConfirmedPatientDraftCopies } from "@/lib/patientDraftRevision";

const pid = "P-2099-0301";
const oldRevision = "00000000-0000-4000-8000-000000000001";
const newRevision = "00000000-0000-4000-8000-000000000002";

describe("browser revision provenance", () => {
  it("writes the confirmed imported contents and revision to both owned recovery copies", () => {
    const key = `therapy.inputs.draft.patientSafe.v4.${pid}`;
    const makeStorage = () => { const values = new Map<string, string>(); return {
      getItem: (name: string) => values.get(name) ?? null,
      setItem: (name: string, value: string) => { values.set(name, value); },
    }; };
    const own = makeStorage(); const shared = makeStorage();
    const stale = { _pseudonym_id: pid, pseudonymId: pid, anamnese: "synthetic old", _draftWriterId: "window-a", _draftBaseRevision: oldRevision };
    own.setItem(key, JSON.stringify(stale)); shared.setItem(key, JSON.stringify(stale));
    const confirmed = { _pseudonym_id: pid, pseudonymId: pid, anamnese: "synthetic confirmed import" };
    expect(writeConfirmedPatientDraftCopies(own, shared, pid, confirmed, newRevision, "window-a", "2099-01-01")).toEqual({ windowSaved: true, sharedSaved: true });
    for (const storage of [own, shared]) expect(JSON.parse(storage.getItem(key)!)).toEqual({ ...confirmed,
      savedAt: "2099-01-01", _draftWriterId: "window-a", _draftBaseRevision: newRevision });
    const other = { ...stale, _draftWriterId: "window-b" }; shared.setItem(key, JSON.stringify(other));
    expect(writeConfirmedPatientDraftCopies(own, shared, pid, confirmed, newRevision, "window-a", "2099-01-02").sharedSaved).toBe(false);
    expect(JSON.parse(shared.getItem(key)!)).toEqual(other);
  });
  it("does not grant a stale local draft the revision of a newer cloud draft", () => {
    expect(selectLoadedDraftRevision({ hasCloudRow: true, cloudRevision: newRevision, usedLocal: true,
      localInput: { _draftBaseRevision: oldRevision } })).toBe(oldRevision);
    expect(selectLoadedDraftRevision({ hasCloudRow: true, cloudRevision: newRevision, usedLocal: true,
      localInput: { anamnese: "synthetic legacy draft" } })).toBeUndefined();
  });
  it("distinguishes a new case from an unknown or deleted baseline", () => {
    expect(selectLoadedDraftRevision({ hasCloudRow: false, cloudRevision: undefined, usedLocal: false })).toBeNull();
    expect(selectLoadedDraftRevision({ hasCloudRow: true, cloudRevision: undefined, usedLocal: false })).toBeUndefined();
    expect(selectLoadedDraftRevision({ hasCloudRow: false, cloudRevision: undefined, usedLocal: true,
      localInput: { _draftBaseRevision: oldRevision } })).toBe(oldRevision);
  });
  it("accepts the revision only when the cloud contents were actually selected", () => {
    expect(selectLoadedDraftRevision({ hasCloudRow: true, cloudRevision: newRevision, usedLocal: false,
      localInput: { _draftBaseRevision: oldRevision } })).toBe(newRevision);
  });
  it("rejects saving without a known baseline and ignores late responses after a reload", () => {
    const tracker = new PatientDraftRevisionTracker();
    expect(() => tracker.capture(pid)).toThrow(/Ausgangsstand/);
    tracker.load(pid, null);
    const beforeReload = tracker.capture(pid);
    tracker.load(pid, newRevision);
    expect(tracker.acknowledge(pid, beforeReload, oldRevision)).toBe(false);
    expect(tracker.revision(pid)).toBe(newRevision);
    const current = tracker.capture(pid.toLowerCase());
    expect(tracker.acknowledge(pid, current, oldRevision)).toBe(true);
    expect(tracker.revision(pid)).toBe(oldRevision);
  });
  it("does not rebase another window's unsaved fields", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    const draft = { _pseudonym_id: pid, pseudonymId: pid, _draftWriterId: "window-b", _draftBaseRevision: oldRevision,
      anamnese: "synthetic unsaved edit" };
    storage.setItem("draft", JSON.stringify(draft));
    const saved = { _pseudonym_id: pid, pseudonymId: pid, anamnese: draft.anamnese };
    expect(stampOwnedDraftRevision(storage, "draft", pid, "window-a", newRevision, saved)).toBe(false);
    expect(JSON.parse(storage.getItem("draft")!)).toEqual(draft);
    expect(stampOwnedDraftRevision(storage, "draft", pid, "window-b", newRevision, { ...saved, anamnese: "new import not applied to the form yet" })).toBe(false);
    expect(stampOwnedDraftRevision(storage, "draft", pid, "window-b", newRevision, saved)).toBe(true);
    expect(JSON.parse(storage.getItem("draft")!)).toEqual({ ...draft, _draftBaseRevision: newRevision });
  });
});
