import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/components/admin/BackupCenter.tsx"), "utf8");

describe("BackupCenter one-click sequence", () => {
  it("reports the full-backup result explicitly", () => {
    const fullBackup = source.slice(
      source.indexOf("const downloadFullBackup"),
      source.indexOf("const downloadAreaBackup"),
    );

    expect(fullBackup).toContain("return true;");
    expect(fullBackup).toContain("return false;");
  });

  it("does not start the code backup after a failed full backup", () => {
    const oneClick = source.slice(
      source.indexOf("const runOneClick"),
      source.indexOf("const totalRows"),
    );
    const resultCheck = oneClick.indexOf("if (!fullBackupSucceeded)");
    const codeDownload = oneClick.indexOf("downloadGithubZip");

    expect(oneClick).toContain("const fullBackupSucceeded = await downloadFullBackup()");
    expect(resultCheck).toBeGreaterThan(-1);
    expect(oneClick).toContain("githubWindow?.close()");
    expect(codeDownload).toBeGreaterThan(resultCheck);
  });

  it("uses the user-opened window for the second automatic ZIP", () => {
    const codeBackup = source.slice(
      source.indexOf("const downloadGithubZip"),
      source.indexOf("useEffect(()", source.indexOf("const downloadGithubZip")),
    );
    const oneClick = source.slice(
      source.indexOf("const runOneClick"),
      source.indexOf("const totalRows"),
    );

    expect(codeBackup).toContain("filename, preparedWindow");
    expect(oneClick).toContain("githubWindow.document.close()");
    expect(oneClick).toContain("downloadGithubZip(githubWindow)");
  });
});

describe("BackupCenter resource-safe data export", () => {
  const dataExport = source.slice(
    source.indexOf("async function fetchDbZipBytes"),
    source.indexOf("const downloadDbBackup"),
  );
  const fullBackup = source.slice(
    source.indexOf("const downloadFullBackup"),
    source.indexOf("const downloadAreaBackup"),
  );

  it("loads tables and auth users in bounded pages instead of requesting the monolithic DB ZIP", () => {
    expect(dataExport).toContain("?mode=stats");
    expect(dataExport).toContain("mode=table-page");
    expect(dataExport).toContain("limit=500");
    expect(dataExport).toContain("mode=auth-page");
    expect(dataExport).not.toContain("?mode=db");
  });

  it("rejects incomplete table and auth responses", () => {
    expect(dataExport).toContain("rows.length !== total");
    expect(dataExport).toContain("authUsers.length !== expectedAuthTotal");
    expect(dataExport).toContain('exportStats.discovery.tableSource !== "openapi"');
  });

  it("rejects incomplete storage lists and downloads", () => {
    expect(fullBackup).toContain("files.length !== bucket.files");
    expect(fullBackup).toContain("listedBytes !== bucket.totalBytes");
    expect(fullBackup).toContain("warnings > 0 || downloadedBytes !== totalBytes");
  });
});
