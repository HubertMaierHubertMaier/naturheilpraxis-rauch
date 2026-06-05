import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  clearAppSmokeConsoleSpies,
  expectNoAppSmokeConsoleWarnings,
  renderAppAtRoute,
} from "./appSmokeTestUtils";

afterEach(() => {
  clearAppSmokeConsoleSpies();
  window.history.pushState({}, "", "/");
});

describe("App start page smoke test", () => {
  it("renders the public start page with the main practice headline and visitor choices without React act warnings", async () => {
    renderAppAtRoute("/");

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

    await expectNoAppSmokeConsoleWarnings();
  });
});
