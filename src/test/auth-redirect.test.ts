import { describe, expect, it } from "vitest";
import { resolveAuthRedirectTarget } from "@/lib/authRedirect";

describe("resolveAuthRedirectTarget", () => {
  it("prefers the preserved route state including search and hash", () => {
    expect(
      resolveAuthRedirectTarget({
        stateFrom: {
          pathname: "/patienten-bibliothek",
          search: "?bereich=audio",
          hash: "#hypnose",
        },
        redirectParam: "/dashboard",
        fallbackPath: "/",
      }),
    ).toBe("/patienten-bibliothek?bereich=audio#hypnose");
  });

  it("uses the explicit redirect query parameter when no route state exists", () => {
    expect(
      resolveAuthRedirectTarget({
        redirectParam: "/patienten-bibliothek?bereich=audio#hypnose",
        fallbackPath: "/",
      }),
    ).toBe("/patienten-bibliothek?bereich=audio#hypnose");
  });

  it("rejects external or auth-loop targets and falls back safely", () => {
    expect(
      resolveAuthRedirectTarget({
        redirectParam: "https://evil.example/phish",
        fallbackPath: "/erstanmeldung",
      }),
    ).toBe("/erstanmeldung");

    expect(
      resolveAuthRedirectTarget({
        redirectParam: "/auth?redirect=%2Fdashboard",
        fallbackPath: "/erstanmeldung",
      }),
    ).toBe("/erstanmeldung");
  });
});
