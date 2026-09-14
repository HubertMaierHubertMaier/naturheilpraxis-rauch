import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PatientBatchUploadZone } from "../components/admin/therapy/PatientBatchUploadZone";

afterEach(cleanup);

it("accepts several dropped PDFs and explicitly reports unsupported files", () => {
  const onFiles = vi.fn();
  render(<PatientBatchUploadZone disabled={false} disabledReason="" onFiles={onFiles} onSelectFiles={vi.fn()} />);
  const pdf = new File(["%PDF-test"], "synthetic.pdf", { type: "application/pdf" });
  const other = new File(["text"], "synthetic.txt", { type: "text/plain" });
  fireEvent.drop(screen.getByRole("button", { name: /hineinziehen/ }), { dataTransfer: { files: [pdf, other], items: [] } });
  expect(onFiles).toHaveBeenCalledWith([pdf]);
  expect(screen.getByRole("status").textContent).toContain("1 andere Datei(en)");
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
  const input = screen.getByLabelText("Lokalen Ordner mit PDFs auswählen");
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
  expect(screen.getByRole("status").textContent).toContain("Ordner mit PDFs auswählen");
});
