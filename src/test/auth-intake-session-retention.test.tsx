// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "../contexts/AuthContext";
import TherapieKandidaten from "../pages/TherapieKandidaten";
import { sameAuthenticatedSession } from "../lib/authSessionIdentity";

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), rpc: vi.fn(), signOut: vi.fn(), listener: null as null | ((event: string, session: any) => void) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...args: any[]) => {
  const result = mocks.rpc(...args); return Object.assign(result, { setHeader: () => result });
}, auth: {
  getSession: mocks.getSession, signOut: mocks.signOut,
  onAuthStateChange: (callback: typeof mocks.listener) => { mocks.listener = callback; return { data: { subscription: { unsubscribe: () => {} } } }; },
} } }));
vi.mock("@/lib/devAdminBypass", () => ({ isDevAdminBypassActive: () => false, clearDevAdminBypass: vi.fn() }));
vi.mock("@/lib/roleSimulator", () => ({ getSimulatedPreset: () => null, onSimulatedRoleChange: () => () => {} }));
vi.mock("@/components/layout/Layout", () => ({ Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/admin/TherapyRecommendation", () => ({ TherapyRecommendation: () => {
  const [files, setFiles] = React.useState<File[]>([]);
  return <div><input type="file" aria-label="Testdatei" onChange={e => setFiles(Array.from(e.target.files || []))} /><span data-testid="file-count">{files.length}</span></div>;
} }));
const session = (user = "user-a", sid = "session-a", revision = 1) => ({ user: { id: user }, access_token: `${btoa('{}')}.${btoa(JSON.stringify({ session_id: sid, revision }))}.signature` });
const deferred = () => { let resolve!: (value: any) => void; const promise = new Promise<any>(done => { resolve = done; }); return { promise, resolve }; };
let requestSignOut: () => Promise<void>;
function StateProbe() { const a = useAuth(); requestSignOut = a.signOut; return <output data-testid="auth-state">{JSON.stringify({ user: a.user?.id || null, admin: a.isAdmin, roleChecked: a.roleChecked, twoFactor: a.twoFactorVerified, twoFactorChecked: a.twoFactorChecked })}</output>; }
function mount() { render(<AuthProvider><StateProbe /><MemoryRouter initialEntries={["/therapie-kandidaten"]}><Routes><Route path="/therapie-kandidaten" element={<TherapieKandidaten />} /><Route path="/" element={<span>Denied</span>} /><Route path="/auth" element={<span>Signed out</span>} /></Routes></MemoryRouter></AuthProvider>); }
const state = () => JSON.parse(screen.getByTestId("auth-state").textContent || "{}");
async function ready() { await waitFor(() => expect(state()).toMatchObject({ admin: true, roleChecked: true, twoFactor: true })); const input = screen.getByLabelText("Testdatei"); fireEvent.change(input, { target: { files: [new File(["synthetic"], "probe.pdf")] } }); expect(screen.getByTestId("file-count").textContent).toBe("1"); return input; }
async function emit(event: string, next: any) { await act(async () => { mocks.listener?.(event, next); await new Promise(resolve => setTimeout(resolve, 0)); }); }
beforeEach(() => { mocks.getSession.mockReset().mockResolvedValue({ data: { session: session() } }); mocks.rpc.mockReset().mockResolvedValue({ data: true, error: null }); mocks.signOut.mockReset().mockResolvedValue({ error: null }); mocks.listener = null; });
afterEach(() => cleanup());

it("compares session identity without treating another user/session as a refresh", () => {
  expect(sameAuthenticatedSession(session(), session("user-a", "session-a", 2))).toBe(true);
  expect(sameAuthenticatedSession(session(), session("user-b", "session-a"))).toBe(false);
  expect(sameAuthenticatedSession(session(), session("user-a", "session-b"))).toBe(false);
  expect(sameAuthenticatedSession(session(), null)).toBe(false);
  expect(sameAuthenticatedSession({ user: { id: "a" }, access_token: "broken" }, { user: { id: "a" }, access_token: "also-broken" })).toBe(false);
});
it("keeps the actual intake route mounted during same-session sign-in and token-refresh checks", async () => {
  mount(); const input = await ready(); const gate = deferred();
  mocks.rpc.mockImplementation(name => name === "has_role" ? gate.promise : Promise.resolve({ data: true, error: null }));
  await emit("SIGNED_IN", session());
  expect(screen.getByLabelText("Testdatei")).toBe(input); expect(screen.getByTestId("file-count").textContent).toBe("1");
  await act(async () => gate.resolve({ data: true, error: null }));
  mocks.rpc.mockResolvedValue({ data: true, error: null }); await emit("TOKEN_REFRESHED", session("user-a", "session-a", 2));
  expect(screen.getByLabelText("Testdatei")).toBe(input); expect(screen.getByTestId("file-count").textContent).toBe("1");
});
it("requires fresh verification and discards old local files for a new session", async () => {
  mount(); await ready(); const gate = deferred(); mocks.rpc.mockImplementation(name => name === "has_role" ? gate.promise : Promise.resolve({ data: true, error: null }));
  await emit("SIGNED_IN", session("user-a", "session-b"));
  expect(state().roleChecked).toBe(false); expect(screen.queryByLabelText("Testdatei")).toBeNull();
  await act(async () => gate.resolve({ data: true, error: null }));
  await waitFor(() => expect(screen.getByTestId("file-count").textContent).toBe("0"));
});
it("does not let stale role results grant access to a different user", async () => {
  mount(); await ready(); const old = deferred();
  mocks.rpc.mockImplementation((name, args) => name === "has_role" ? (args._user_id === "user-a" ? old.promise : Promise.resolve({ data: false, error: null })) : Promise.resolve({ data: true, error: null }));
  await emit("TOKEN_REFRESHED", session("user-a", "session-a", 2)); await emit("SIGNED_IN", session("user-b", "session-b"));
  await waitFor(() => expect(state()).toMatchObject({ user: "user-b", admin: false, roleChecked: true }));
  await act(async () => old.resolve({ data: true, error: null }));
  expect(state()).toMatchObject({ user: "user-b", admin: false }); expect(screen.queryByLabelText("Testdatei")).toBeNull();
});
it("applies failed revalidation and cannot revive a signed-out session", async () => {
  mount(); await ready(); mocks.rpc.mockResolvedValue({ data: false, error: null }); await emit("TOKEN_REFRESHED", session("user-a", "session-a", 2));
  await waitFor(() => expect(state()).toMatchObject({ admin: false, twoFactor: false }));
  await emit("SIGNED_OUT", null); expect(state()).toMatchObject({ user: null, admin: false, twoFactor: false });
});
it("ignores a stale initial session read after a newer user has signed in", async () => {
  const initial = deferred(); mocks.getSession.mockReturnValue(initial.promise); mount();
  await emit("SIGNED_IN", session("user-b", "session-b")); await waitFor(() => expect(state()).toMatchObject({ user: "user-b", admin: true }));
  await act(async () => initial.resolve({ data: { session: session() } }));
  expect(state()).toMatchObject({ user: "user-b", admin: true });
});

it("does not revive authorization when an old check resolves after sign-out", async () => {
  mount(); await ready(); const old = deferred(); mocks.rpc.mockImplementation(name => name === "has_role" ? old.promise : Promise.resolve({ data: true, error: null }));
  await emit("TOKEN_REFRESHED", session("user-a", "session-a", 2)); await emit("SIGNED_OUT", null);
  await act(async () => old.resolve({ data: true, error: null }));
  expect(state()).toMatchObject({ user: null, admin: false, twoFactor: false }); expect(screen.queryByLabelText("Testdatei")).toBeNull();
});
it("keeps local files during a transient null event if the same session is confirmed", async () => {
  mount(); const input = await ready(); await emit("INITIAL_SESSION", null);
  expect(screen.getByLabelText("Testdatei")).toBe(input);
  await waitFor(() => expect(mocks.getSession.mock.calls.length).toBeGreaterThan(1));
  expect(screen.getByLabelText("Testdatei")).toBe(input); expect(screen.getByTestId("file-count").textContent).toBe("1");
});

it("does not clear or sign out a replacement session after an old audit request resolves", async () => {
  mount(); await ready(); const audit = deferred();
  mocks.rpc.mockImplementation((name, args) => name === "insert_audit_log" && args?._action === "logout" ? audit.promise : Promise.resolve({ data: true, error: null }));
  let pending!: Promise<void>; act(() => { pending = requestSignOut(); });
  await emit("SIGNED_IN", session("user-b", "session-b"));
  await act(async () => { audit.resolve({ data: true, error: null }); await pending; });
  expect(mocks.rpc.mock.calls.some(([name]) => name === "clear_current_two_factor_session")).toBe(false);
  expect(mocks.signOut).not.toHaveBeenCalled(); expect(state()).toMatchObject({ user: "user-b", admin: true });
});
it("does not sign out a replacement session after an old 2FA-clear request resolves", async () => {
  mount(); await ready(); const clear = deferred();
  mocks.rpc.mockImplementation(name => name === "clear_current_two_factor_session" ? clear.promise : Promise.resolve({ data: true, error: null }));
  let pending!: Promise<void>; act(() => { pending = requestSignOut(); });
  await waitFor(() => expect(mocks.rpc.mock.calls.some(([name]) => name === "clear_current_two_factor_session")).toBe(true));
  await emit("SIGNED_IN", session("user-b", "session-b"));
  await act(async () => { clear.resolve({ data: true, error: null }); await pending; });
  expect(mocks.signOut).not.toHaveBeenCalled(); expect(state()).toMatchObject({ user: "user-b", admin: true });
});
it("still completes a normal explicit sign-out", async () => {
  mount(); await ready();
  mocks.signOut.mockImplementation(async () => { mocks.listener?.("SIGNED_OUT", null); return { error: null }; });
  await act(async () => { await requestSignOut(); });
  expect(mocks.signOut).toHaveBeenCalledOnce(); expect(state()).toMatchObject({ user: null, admin: false, twoFactor: false });
});
