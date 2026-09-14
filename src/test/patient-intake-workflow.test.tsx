import { useEffect } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PatientIntakeWorkflow, PatientWorkflowLayout } from "../components/admin/therapy/PatientIntakeWorkflow";

afterEach(cleanup);
it("orders the actual DOM as case before files and keeps mounted input state", () => {
  let mounts = 0;
  function Queue() { useEffect(() => { mounts++; }, []); return <div data-testid="files">Dateiliste</div>; }
  const content = (title: string) => <PatientWorkflowLayout>
    <Queue data-workflow-order={2} />
    <input data-workflow-order={1} data-testid="case" defaultValue="SYNTH" />
    <h1>{title}</h1>
  </PatientWorkflowLayout>;
  const view = render(content("Start"));
  expect([...view.container.firstElementChild!.children].map(node => node.tagName)).toEqual(["H1", "INPUT", "DIV"]);
  fireEvent.change(screen.getByTestId("case"), { target: { value: "Beibehalten" } });
  view.rerender(content("Aktualisiert"));
  expect(mounts).toBe(1);
  expect(screen.getByTestId("case")).toHaveValue("Beibehalten");
});
it("offers all five steps without pretending an invalid case is saved", () => {
  const navigate = vi.fn();
  render(<PatientIntakeWorkflow pseudonymId="P-unvollständig" caseReady={false} saveStatus="saved" hasSources={false} hasReport={false} onNavigate={navigate} />);
  expect(screen.getAllByRole("button")).toHaveLength(5);
  expect(screen.getByRole("status").textContent).toContain("gültige Fall-ID");
  fireEvent.click(screen.getByRole("button", { name: /Einzelangaben/ }));
  expect(navigate).toHaveBeenCalledWith("patient-intake-facts");
});
it("keeps an unconfirmed save visible", () => {
  render(<PatientIntakeWorkflow pseudonymId="SYNTH" caseReady saveStatus="error" hasSources hasReport={false} onNavigate={vi.fn()} />);
  expect(screen.getByRole("status").textContent).toContain("noch nicht bestätigt");
});
