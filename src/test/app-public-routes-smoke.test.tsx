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

describe("App public route smoke tests", () => {
  it("renders the public privacy page at /datenschutz with an accessible main landmark", async () => {
    renderAppAtRoute("/datenschutz");

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Patienteninformationen zum Datenschutz/i,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("main", { name: /Datenschutz/i })
    ).toBeInTheDocument();

    await expectNoAppSmokeConsoleWarnings();
  });

  it("renders the public legal notice page at /impressum with an accessible main landmark", async () => {
    renderAppAtRoute("/impressum");

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Impressum/i,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("main", { name: /Impressum/i })
    ).toBeInTheDocument();

    await expectNoAppSmokeConsoleWarnings();
  });
});
