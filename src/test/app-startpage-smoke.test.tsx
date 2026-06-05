import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "@/App";

const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

const flushPendingAuthEffects = () => new Promise((resolve) => window.setTimeout(resolve, 0));

afterEach(() => {
  consoleErrorSpy.mockClear();
  consoleWarnSpy.mockClear();
});

describe("App start page smoke test", () => {
  it("renders the public start page with the main practice headline and visitor choices without React act warnings", async () => {
    render(<App />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Ganzheitliche Heilkunde für Körper und Seele/i,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /Ich bin Neupatient/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Ich bin schon Patient/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Ich möchte mich informieren/i })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("main", { name: /Startseite/i })
    ).toBeInTheDocument();

    await flushPendingAuthEffects();

    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("not wrapped in act")
    );
    expect(consoleWarnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("React Router Future Flag Warning")
    );
  });
});
