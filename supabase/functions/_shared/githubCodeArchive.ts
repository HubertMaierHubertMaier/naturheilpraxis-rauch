// Called only after backup-export has authenticated the administrator.
export async function fetchGithubCodeArchive(
  repo: string,
  branch: string,
  token: string,
  request: typeof fetch = fetch,
): Promise<Response> {
  const publicUrl = `https://codeload.github.com/${repo}/zip/refs/heads/${encodeURIComponent(branch)}`;
  const headers = { "User-Agent": "naturheilpraxis-backup-export" };
  let response = await request(
    token ? `https://api.github.com/repos/${repo}/zipball/${encodeURIComponent(branch)}` : publicUrl,
    { headers: token ? { ...headers, Authorization: `Bearer ${token}` } : headers, redirect: "follow" },
  );
  const initialStatus = response.status;
  // A stale token must not prevent downloading a genuinely public archive.
  // This separate request has no credentials; private repositories stay inaccessible.
  if (token && (initialStatus === 401 || initialStatus === 403)) {
    await response.body?.cancel();
    response = await request(publicUrl, { headers: { ...headers }, redirect: "follow" });
  }
  if (!response.ok || !response.body) {
    const initial = initialStatus !== response.status ? ` (erster Abruf HTTP ${initialStatus})` : "";
    throw new Error(`GitHub-Code-ZIP HTTP ${response.status}${initial} — Repository, Branch und gegebenenfalls die GitHub-Zugangsberechtigung prüfen.`);
  }
  const type = (response.headers.get("Content-Type") ?? "").split(";")[0].trim().toLowerCase();
  if (!["application/zip", "application/x-zip-compressed", "application/octet-stream"].includes(type)) {
    await response.body.cancel();
    throw new Error("GitHub lieferte kein ZIP-Archiv. Das Code-Backup wurde nicht abgeschlossen.");
  }
  return response;
}
