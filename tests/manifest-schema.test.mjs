import test from "node:test";
import assert from "node:assert/strict";
import { validateEntry, validateManifest } from "../scripts/lib/manifest-schema.mjs";
import {
  validateEntryRules,
  validateManifestRules
} from "../scripts/lib/manifest-rules.mjs";

const validEntry = {
  name: "EasyWrite",
  slug: "easywrite",
  summary: "A focused writing tool.",
  status: "beta",
  featured: true,
  version: "0.1.4",
  websiteUrl: "https://example.com/products/easywrite",
  releaseNotesUrl: "https://github.com/HADESforCode/EasyWrite/releases/tag/v0.1.4",
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
};

test("validateEntry accepts a valid entry", () => {
  const result = validateEntry(validEntry);
  assert.equal(result.valid, true);
});

test("validateManifest rejects a non-array payload", () => {
  const result = validateManifest({ invalid: true });
  assert.equal(result.valid, false);
  assert.match(result.errors[0], /must be array/);
});

test("validateEntryRules rejects filename and slug mismatch", () => {
  const result = validateEntryRules({
    fileName: "writer.json",
    entry: validEntry,
    repositorySlug: "HADESforCode/hades-release-index"
  });

  assert.equal(result.valid, false);
  assert.match(result.errors[0], /file name must match slug/);
});

test("validateManifestRules rejects duplicate slugs", () => {
  const result = validateManifestRules([validEntry, validEntry]);
  assert.equal(result.valid, false);
  assert.match(result.errors[0], /duplicate slug/);
});
