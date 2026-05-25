import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function copySchemaFile(workspace, fileName) {
  const sourcePath = path.join(process.cwd(), "schema", fileName);
  const targetPath = path.join(workspace, "schema", fileName);
  const value = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  writeJson(targetPath, value);
}

test("build-manifest writes a sorted manifest", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "hades-release-index-"));

  copySchemaFile(workspace, "product-manifest-entry.schema.json");
  copySchemaFile(workspace, "product-manifest.schema.json");

  writeJson(path.join(workspace, "entries", "beta.json"), {
    name: "Beta",
    slug: "beta",
    summary: "Beta app",
    status: "beta",
    featured: false,
    version: "0.2.0",
    websiteUrl: "https://example.com/products/beta",
    releaseNotesUrl: "https://github.com/HADESforCode/Beta/releases/tag/v0.2.0",
    coverImage: "/images/products/beta.jpg",
    updatedAt: "2026-05-01T00:00:00.000Z",
    platforms: [
      {
        os: "windows",
        arch: "x64",
        downloadUrl:
          "https://github.com/HADESforCode/hades-release-index/releases/download/beta-v0.2.0/Beta-Setup.exe",
        fileName: "Beta-Setup.exe",
        sha256: "beta123",
        size: 200
      }
    ]
  });

  writeJson(path.join(workspace, "entries", "alpha.json"), {
    name: "Alpha",
    slug: "alpha",
    summary: "Alpha app",
    status: "stable",
    featured: true,
    version: "1.0.0",
    websiteUrl: "https://example.com/products/alpha",
    releaseNotesUrl: "https://github.com/HADESforCode/Alpha/releases/tag/v1.0.0",
    coverImage: "/images/products/alpha.jpg",
    updatedAt: "2026-05-03T00:00:00.000Z",
    platforms: [
      {
        os: "windows",
        arch: "x64",
        downloadUrl:
          "https://github.com/HADESforCode/hades-release-index/releases/download/alpha-v1.0.0/Alpha-Setup.exe",
        fileName: "Alpha-Setup.exe",
        sha256: "alpha123",
        size: 100
      }
    ]
  });

  const result = spawnSync(
    process.execPath,
    [path.resolve("scripts/build-manifest.mjs")],
    {
      cwd: workspace,
      encoding: "utf8",
      env: {
        ...process.env,
        HADES_RELEASE_INDEX_REPOSITORY: "HADESforCode/hades-release-index"
      }
    }
  );

  assert.equal(result.status, 0, result.stderr);

  const manifest = JSON.parse(
    fs.readFileSync(path.join(workspace, "manifest.json"), "utf8")
  );

  assert.deepEqual(
    manifest.map((entry) => entry.slug),
    ["alpha", "beta"]
  );
});

test("build-manifest fails on invalid entries", () => {
  const workspace = fs.mkdtempSync(
    path.join(os.tmpdir(), "hades-release-index-invalid-")
  );

  copySchemaFile(workspace, "product-manifest-entry.schema.json");
  copySchemaFile(workspace, "product-manifest.schema.json");

  writeJson(path.join(workspace, "entries", "broken.json"), {
    name: "Broken",
    slug: "broken",
    summary: "Broken app",
    status: "beta",
    featured: true,
    version: "0.1.0",
    websiteUrl: "https://example.com/products/broken",
    releaseNotesUrl:
      "https://github.com/HADESforCode/Broken/releases/tag/v0.1.0",
    coverImage: "/images/products/broken.jpg",
    updatedAt: "not-a-date",
    platforms: []
  });

  const result = spawnSync(
    process.execPath,
    [path.resolve("scripts/build-manifest.mjs")],
    {
      cwd: workspace,
      encoding: "utf8",
      env: {
        ...process.env,
        HADES_RELEASE_INDEX_REPOSITORY: "HADESforCode/hades-release-index"
      }
    }
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /updatedAt|platforms/);
});

test("repository manifest matches the seeded easywrite entry", () => {
  const result = spawnSync(process.execPath, ["scripts/build-manifest.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      HADES_RELEASE_INDEX_REPOSITORY: "HADESforCode/hades-release-index"
    }
  });

  assert.equal(result.status, 0, result.stderr);

  const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));

  assert.deepEqual(manifest, [
    {
      name: "EasyWrite",
      slug: "easywrite",
      summary: "A focused writing tool.",
      status: "beta",
      featured: true,
      version: "0.1.4",
      websiteUrl: "https://example.com/products/easywrite",
      releaseNotesUrl:
        "https://github.com/HADESforCode/EasyWrite/releases/tag/v0.1.4",
      coverImage: "/images/products/easywrite-cover.jpg",
      updatedAt: "2026-05-25T12:00:00.000Z",
      platforms: [
        {
          os: "windows",
          arch: "x64",
          downloadUrl:
            "https://github.com/HADESforCode/hades-release-index/releases/download/easywrite-v0.1.4/EasyWrite-Setup.exe",
          fileName: "EasyWrite-Setup.exe",
          sha256: "abc123",
          size: 12345678
        }
      ]
    }
  ]);
});
