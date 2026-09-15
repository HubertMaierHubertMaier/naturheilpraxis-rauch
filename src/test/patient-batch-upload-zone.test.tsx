import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PatientBatchUploadZone } from "../components/admin/therapy/PatientBatchUploadZone";

afterEach(cleanup);

it("rejects a multiple-file drop in single mode without silently taking the first file", () => {
  const onFiles = vi.fn();
  render(<PatientBatchUploadZone mode="single" disabled={false} disabledReason="" onFiles={onFiles} onSelectFiles={vi.fn()} />);
  const files = [new File(["one"], "one.pdf"), new File(["two"], "two.pdf")];
  fireEvent.drop(screen.getByRole("button", { name: /hineinziehen/ }), { dataTransfer: { files, items: [] } });
  expect(onFiles).not.toHaveBeenCalled();
  expect(screen.getByRole("status")).toHaveTextContent("keine Datei übernommen");
  expect(screen.queryByLabelText("Lokalen Ordner mit Dokumenten auswählen")).not.toBeInTheDocument();
});

it("accepts a single PDF and routes a folder drop to the visible batch-mode choice", () => {
  const onFiles = vi.fn(); const onModeChange = vi.fn();
  render(<PatientBatchUploadZone mode="single" disabled={false} disabledReason="" onFiles={onFiles} onSelectFiles={vi.fn()} onModeChange={onModeChange} />);
  const pdf = new File(["one"], "one.pdf");
  const zone = screen.getByRole("button", { name: /hineinziehen/ });
  fireEvent.drop(zone, { dataTransfer: { files: [pdf], items: [] } });
  expect(onFiles).toHaveBeenCalledWith([pdf]);
  fireEvent.drop(zone, { dataTransfer: { files: [], items: [{ webkitGetAsEntry: () => ({ isDirectory: true }) }] } });
  expect(screen.getByRole("status")).toHaveTextContent("zuerst die Sammeleingabe wählen");
  fireEvent.click(screen.getByRole("radio", { name: /Sammeleingabe/ }));
  expect(onModeChange).toHaveBeenCalledWith("batch");
  expect(onFiles).toHaveBeenCalledTimes(1);
});

it("preserves an existing selection by locking both entry-mode controls", () => {
  const onModeChange = vi.fn();
  render(<PatientBatchUploadZone mode="single" selectionLocked disabled={false} disabledReason="" onFiles={vi.fn()} onSelectFiles={vi.fn()} onModeChange={onModeChange} />);
  for (const radio of screen.getAllByRole("radio")) {
    expect(radio).toBeDisabled();
    fireEvent.click(radio);
  }
  expect(onModeChange).not.toHaveBeenCalled();
});

it("accepts several dropped PDFs and explicitly reports unsupported files", () => {
  const onFiles = vi.fn();
  render(<PatientBatchUploadZone disabled={false} disabledReason="" onFiles={onFiles} onSelectFiles={vi.fn()} />);
  const pdf = new File(["%PDF-test"], "synthetic.pdf", { type: "application/pdf" });
  const other = new File(["text"], "synthetic.txt", { type: "text/plain" });
  const word = new File(["word"], "synthetic.docx");
  const excel = new File(["excel"], "synthetic.xlsx");
  fireEvent.drop(screen.getByRole("button", { name: /hineinziehen/ }), { dataTransfer: { files: [pdf, word, excel, other], items: [] } });
  expect(onFiles).toHaveBeenCalledWith([pdf, word, excel]);
  expect(screen.getByRole("status").textContent).toContain("1 nicht unterstützte Datei(en)");
});

it("does not queue files until the patient context is ready", () => {
  const onFiles = vi.fn(); const onSelectFiles = vi.fn();
  render(<PatientBatchUploadZone disabled disabledReason="Zuerst Fall auswählen" onFiles={onFiles} onSelectFiles={onSelectFiles} />);
  const zone = screen.getByRole("button", { name: /hineinziehen/ });
  fireEvent.click(zone);
  fireEvent.drop(zone, { dataTransfer: { files: [new File(["test"], "synthetic.pdf")], items: [] } });
  expect(onFiles).not.toHaveBeenCalled();
  expect(onSelectFiles).not.toHaveBeenCalled();
  expect(screen.getByRole("status").textContent).toContain("Zuerst Fall auswählen");
});

it("supports keyboard file selection and snapshots folder files before resetting the input", () => {
  const onFiles = vi.fn(); const onSelectFiles = vi.fn();
  render(<PatientBatchUploadZone disabled={false} disabledReason="" onFiles={onFiles} onSelectFiles={onSelectFiles} />);
  fireEvent.keyDown(screen.getByRole("button", { name: /hineinziehen/ }), { key: "Enter" });
  expect(onSelectFiles).toHaveBeenCalledOnce();
  const input = screen.getByLabelText("Lokalen Ordner mit Dokumenten auswählen");
  expect(input).toHaveAttribute("webkitdirectory");
  const files = [new File(["one"], "one.pdf"), new File(["two"], "two.pdf")];
  fireEvent.change(input, { target: { files } });
  expect(onFiles).toHaveBeenCalledWith(files);
});

it("explains the folder picker instead of pretending a dropped directory was imported", () => {
  const onFiles = vi.fn();
  render(<PatientBatchUploadZone disabled={false} disabledReason="" onFiles={onFiles} onSelectFiles={vi.fn()} />);
  fireEvent.drop(screen.getByRole("button", { name: /hineinziehen/ }), { dataTransfer: { files: [], items: [{ webkitGetAsEntry: () => ({ isDirectory: true }) }] } });
  expect(onFiles).not.toHaveBeenCalled();
  expect(screen.getByRole("status").textContent).toContain("Ordner mit Dokumenten auswählen");
});
