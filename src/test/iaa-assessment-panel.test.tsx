import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { IAAAssessmentPanel } from "../components/admin/therapy/IAAAssessmentPanel";
afterEach(cleanup);
it("opens a separate checked-only result window with 6 first", () => {
  render(<IAAAssessmentPanel pseudonymId="P-2099-0101" values={{ "iaa.6.1": "5", "iaa.1.1": "6", "iaa.2.1.1": "0", "iaaNote.6.1": "Synthetic evening trigger" }} disabled={false} onChange={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "IAA – angekreuzte Fragen anzeigen" }));
  const dialog = screen.getByRole("dialog");
  const rows = within(dialog).getAllByRole("listitem");
  expect(rows.map(row => row.getAttribute("data-iaa-question"))).toEqual(["1.1", "6.1"]);
  expect(rows[0]).toHaveTextContent("6 / 6"); expect(rows[1]).toHaveTextContent("Synthetic evening trigger");
});
it("closes the old case window when the patient changes", () => {
  const onChange = vi.fn();
  const { rerender } = render(<IAAAssessmentPanel pseudonymId="P-2099-0101" values={{ "iaa.1.1": "6" }} disabled={false} onChange={onChange} />);
  fireEvent.click(screen.getByRole("button", { name: "IAA – angekreuzte Fragen anzeigen" }));
  rerender(<IAAAssessmentPanel pseudonymId="P-2099-0102" values={{}} disabled={false} onChange={onChange} />);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "IAA – angekreuzte Fragen anzeigen" }));
  expect(within(screen.getByRole("dialog")).queryAllByRole("listitem")).toHaveLength(0);
  expect(onChange).not.toHaveBeenCalled();
});
it("records a chosen rating without overwriting unrelated anamnesis fields", () => {
  const onChange = vi.fn();
  render(<IAAAssessmentPanel pseudonymId="P-2099-0101" values={{ allergies: "Synthetic existing note" }} disabled={false} onChange={onChange} />);
  fireEvent.click(screen.getByRole("button", { name: "IAA erfassen / prüfen" }));
  fireEvent.change(screen.getByLabelText("IAA-Frage suchen"), { target: { value: "1.1 ·" } });
  fireEvent.change(screen.getByLabelText("IAA-Frage suchen"), { target: { value: "Verstopfung?" } });
  fireEvent.change(screen.getByLabelText("1.1 · Verstopfung?"), { target: { value: "6" } });
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ allergies: "Synthetic existing note", "iaa.1.1": "6" }));
});
it("shows the scan review requirement even if no IAA heading was recognized", () => {
  const onChange = vi.fn();
  render(<IAAAssessmentPanel pseudonymId="P-2099-0101" values={{ iaaReviewRequired: "true", allergies: "Preserved" }} hasUnstructuredIAA={false} disabled={false} onChange={onChange} />);
  expect(screen.getByText(/IAA-Prüfung offen/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "IAA vollständig am Original geprüft" }));
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ iaaReviewRequired: "false", allergies: "Preserved", iaaReviewConfirmedAt: expect.any(String) }));
});
