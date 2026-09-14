import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { RedactedTextPreview } from "../components/admin/therapy/RedactedTextPreview";
afterEach(cleanup);
it("redacts only the selected text and retains surrounding clinical content", () => {
  function Preview() { const [text, setText] = useState("TESTPERSON: synthetische Schlafstörung"); return <RedactedTextPreview text={text} onChange={setText} />; }
  render(<Preview />);
  fireEvent.click(screen.getByText("Manuell nachschwärzen"));
  const field = screen.getByLabelText("Text zum manuellen Nachschwärzen") as HTMLTextAreaElement;
  field.setSelectionRange(0, 10); fireEvent.select(field);
  fireEvent.click(screen.getByRole("button", { name: "Markierte Angabe schwärzen" }));
  expect(field.value).toBe("[manuell geschwärzt]: synthetische Schlafstörung");
  expect(screen.getByLabelText("Manuell geschwärzte personenbezogene Angabe")).toHaveTextContent("Geschwaerzt");
});
it("retains page boundaries and disables changes during handoff", () => {
  const onChange = vi.fn();
  const { rerender } = render(<RedactedTextPreview text="--- Seite 1 ---\nTESTPERSON" onChange={onChange} />);
  fireEvent.click(screen.getByText("Manuell nachschwärzen"));
  const field = screen.getByLabelText("Text zum manuellen Nachschwärzen") as HTMLTextAreaElement;
  field.setSelectionRange(0, field.value.length); fireEvent.select(field);
  fireEvent.click(screen.getByRole("button", { name: "Markierte Angabe schwärzen" }));
  expect(onChange).not.toHaveBeenCalled(); expect(screen.getByRole("status")).toHaveTextContent("Seiten- und Dokumentgrenzen");
  rerender(<RedactedTextPreview text="--- Seite 1 ---\nTESTPERSON" onChange={onChange} disabled />);
  expect(screen.getByRole("button", { name: "Markierte Angabe schwärzen" })).toBeDisabled();
});
