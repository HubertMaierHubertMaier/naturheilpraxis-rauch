import { render } from "@testing-library/react";
import App from "@/App";

export const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
export const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

export const flushPendingAuthEffects = () =>
  new Promise((resolve) => window.setTimeout(resolve, 0));

export function renderAppAtRoute(path: string) {
  window.history.pushState({}, "", path);
  return render(<App />);
}

export async function expectNoAppSmokeConsoleWarnings() {
  await flushPendingAuthEffects();

  expect(consoleErrorSpy).not.toHaveBeenCalledWith(
    expect.stringContaining("not wrapped in act")
  );
  expect(consoleWarnSpy).not.toHaveBeenCalledWith(
    expect.stringContaining("React Router Future Flag Warning")
  );
}

export function clearAppSmokeConsoleSpies() {
  consoleErrorSpy.mockClear();
  consoleWarnSpy.mockClear();
}
