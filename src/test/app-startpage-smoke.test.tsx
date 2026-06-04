import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "@/App";

describe("App start page smoke test", () => {
  it("renders the public start page with the main practice headline and visitor choices", () => {
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
  });
});
