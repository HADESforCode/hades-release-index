# HADES Release Index Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public multi-product release index repository that validates per-product entries, aggregates a top-level `manifest.json`, and exposes GitHub Releases asset URLs for downloads.

**Architecture:** Use a minimal Node.js ESM toolchain with JSON Schema validation via `ajv`, business-rule validation in a dedicated library module, and a single build script that scans `entries/*.json`, validates and sorts entries, then writes root `manifest.json`. Keep the repository static: JSON files, schema files, a build script, tests, workflow automation, and documentation only.

**Tech Stack:** Node.js ESM, `ajv`, built-in `node:test`, GitHub Actions

---

## File Structure

### Files To Create

- `package.json` - Minimal Node project metadata and CLI scripts for validation, build, and test.
- `.gitignore` - Ignore Node install output and test artifacts.
- `schema/product-manifest-entry.schema.json` - JSON Schema for a single product entry object.
- `schema/product-manifest.schema.json` - JSON Schema for the aggregated top-level manifest array.
- `scripts/lib/manifest-schema.mjs` - Load schema files, create Ajv validators, and expose validation helpers.
- `scripts/lib/manifest-rules.mjs` - Business-rule checks not expressible cleanly in JSON Schema.
- `scripts/build-manifest.mjs` - Read entries, validate them, sort them, and write root `manifest.json`.
- `entries/easywrite.json` - Seed example entry showing the expected contract.
- `manifest.json` - Generated top-level manifest checked into the repository.
- `tests/manifest-schema.test.mjs` - Schema validation coverage.
- `tests/build-manifest.test.mjs` - Aggregation and business-rule validation coverage.
- `.github/workflows/validate-and-build-manifest.yml` - CI workflow for PR and push validation.
- `README.md` - Repository responsibilities, local verification, update flow, and required secrets/settings.

### Files To Modify

- `docs/superpowers/plans/2026-05-26-hades-release-index-implementation.md` - This plan file only.

### Responsibility Boundaries

- `scripts/lib/manifest-schema.mjs` only knows schema loading and Ajv validator wiring.
- `scripts/lib/manifest-rules.mjs` only knows repository-specific rules such as filename/slug matching and GitHub Releases asset URL checks.
- `scripts/build-manifest.mjs` coordinates filesystem IO, validation, sorting, and output.
- Tests stay split by responsibility: schema tests in one file, build/business tests in one file.

## Task 1: Bootstrap Minimal Node Tooling

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Test: `tests/build-manifest.test.mjs`

- [ ] **Step 1: Write the failing smoke test**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("build-manifest script exists and can be invoked", () => {
  const result = spawnSync(process.execPath, ["scripts/build-manifest.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8"
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Cannot find module|MODULE_NOT_FOUND|Cannot find/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/build-manifest.test.mjs`
Expected: FAIL because `scripts/build-manifest.mjs` does not exist yet

- [ ] **Step 3: Create minimal project metadata and placeholder script**

`package.json`

```json
{
  "name": "hades-release-index",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "node scripts/build-manifest.mjs",
    "validate": "node scripts/build-manifest.mjs --check",
    "test": "node --test"
  },
  "dependencies": {
    "ajv": "^8.17.1"
  }
}
```

`.gitignore`

```gitignore
node_modules/
coverage/
```

`scripts/build-manifest.mjs`

```js
process.stderr.write("build-manifest is not implemented yet\n");
process.exit(1);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/build-manifest.test.mjs`
Expected: PASS because the placeholder script now exists and exits non-zero

- [ ] **Step 5: Commit**

```bash
git add package.json .gitignore scripts/build-manifest.mjs tests/build-manifest.test.mjs
git commit -m "chore: bootstrap release index tooling" -m "Add a minimal Node.js ESM setup for hades-release-index with Ajv dependency placeholders and base npm scripts." -m "Create the initial build-manifest entrypoint and a smoke test so later tasks can replace the placeholder with real validation and aggregation logic."
```

## Task 2: Define JSON Schemas And Schema Loader

**Files:**
- Create: `schema/product-manifest-entry.schema.json`
- Create: `schema/product-manifest.schema.json`
- Create: `scripts/lib/manifest-schema.mjs`
- Create: `tests/manifest-schema.test.mjs`

- [ ] **Step 1: Write the failing schema tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { validateEntry, validateManifest } from "../scripts/lib/manifest-schema.mjs";

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
      downloadUrl: "https://github.com/HADESforCode/hades-release-index/releases/download/easywrite-v0.1.4/EasyWrite-Setup.exe",
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/manifest-schema.test.mjs`
Expected: FAIL because `scripts/lib/manifest-schema.mjs` does not exist yet

- [ ] **Step 3: Implement schemas and loader**

`schema/product-manifest-entry.schema.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://hadesforcode.github.io/hades-release-index/schema/product-manifest-entry.schema.json",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "name",
    "slug",
    "summary",
    "status",
    "featured",
    "version",
    "websiteUrl",
    "releaseNotesUrl",
    "coverImage",
    "updatedAt",
    "platforms"
  ],
  "properties": {
    "name": { "type": "string", "minLength": 1 },
    "slug": { "type": "string", "pattern": "^[a-z0-9-]+$" },
    "summary": { "type": "string", "minLength": 1 },
    "status": { "type": "string", "enum": ["alpha", "beta", "stable", "archived"] },
    "featured": { "type": "boolean" },
    "version": { "type": "string", "minLength": 1 },
    "websiteUrl": { "type": "string", "format": "uri" },
    "releaseNotesUrl": { "type": "string", "format": "uri" },
    "coverImage": { "type": "string", "minLength": 1 },
    "updatedAt": { "type": "string", "format": "date-time" },
    "platforms": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["os", "arch", "downloadUrl", "fileName", "sha256", "size"],
        "properties": {
          "os": { "type": "string", "enum": ["windows", "macos", "linux"] },
          "arch": { "type": "string", "enum": ["x64", "arm64"] },
          "downloadUrl": { "type": "string", "format": "uri" },
          "fileName": { "type": "string", "minLength": 1 },
          "sha256": { "type": "string", "minLength": 1 },
          "size": { "type": "integer", "minimum": 0 }
        }
      }
    }
  }
}
```

`schema/product-manifest.schema.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://hadesforcode.github.io/hades-release-index/schema/product-manifest.schema.json",
  "type": "array",
  "items": {
    "$ref": "product-manifest-entry.schema.json"
  }
}
```

`scripts/lib/manifest-schema.mjs`

```js
import fs from "node:fs";
import path from "node:path";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const schemaDirectory = path.resolve(process.cwd(), "schema");
const entrySchemaPath = path.join(schemaDirectory, "product-manifest-entry.schema.json");
const manifestSchemaPath = path.join(schemaDirectory, "product-manifest.schema.json");

function loadSchema(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const entrySchema = loadSchema(entrySchemaPath);
const manifestSchema = loadSchema(manifestSchemaPath);

ajv.addSchema(entrySchema, "product-manifest-entry.schema.json");
const validateEntrySchema = ajv.compile(entrySchema);
const validateManifestSchema = ajv.compile(manifestSchema);

function formatErrors(errors = []) {
  return errors.map((error) => `${error.instancePath || "/"} ${error.message}`.trim());
}

export function validateEntry(value) {
  const valid = validateEntrySchema(value);
  return {
    valid: Boolean(valid),
    errors: formatErrors(validateEntrySchema.errors)
  };
}

export function validateManifest(value) {
  const valid = validateManifestSchema(value);
  return {
    valid: Boolean(valid),
    errors: formatErrors(validateManifestSchema.errors)
  };
}
```

`package.json`

```json
{
  "name": "hades-release-index",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "node scripts/build-manifest.mjs",
    "validate": "node scripts/build-manifest.mjs --check",
    "test": "node --test"
  },
  "dependencies": {
    "ajv": "^8.17.1",
    "ajv-formats": "^3.0.1"
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm install`
Expected: `added ... packages`

Run: `node --test tests/manifest-schema.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json schema scripts/lib/manifest-schema.mjs tests/manifest-schema.test.mjs
git commit -m "feat: add manifest json schemas" -m "Define JSON Schema contracts for per-product entries and the aggregated manifest array." -m "Add a reusable Ajv-based schema loader so later build logic can validate both individual entries and the generated root manifest consistently."
```

## Task 3: Add Repository Business-Rule Validation

**Files:**
- Create: `scripts/lib/manifest-rules.mjs`
- Modify: `tests/manifest-schema.test.mjs`

- [ ] **Step 1: Extend tests with failing business-rule cases**

```js
import { validateEntryRules, validateManifestRules } from "../scripts/lib/manifest-rules.mjs";

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/manifest-schema.test.mjs`
Expected: FAIL because `scripts/lib/manifest-rules.mjs` does not exist yet

- [ ] **Step 3: Implement business-rule validator**

`scripts/lib/manifest-rules.mjs`

```js
const releasesUrlPrefix = "https://github.com/";

function parseIsoDate(value) {
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
}

function expectedAssetPrefix(repositorySlug) {
  return `${releasesUrlPrefix}${repositorySlug}/releases/download/`;
}

export function validateEntryRules({ fileName, entry, repositorySlug }) {
  const errors = [];
  const expectedFileName = `${entry.slug}.json`;
  const platformKeys = new Set();
  const assetPrefix = expectedAssetPrefix(repositorySlug);

  if (fileName !== expectedFileName) {
    errors.push(`file name must match slug: expected ${expectedFileName} but received ${fileName}`);
  }

  if (!parseIsoDate(entry.updatedAt)) {
    errors.push("updatedAt must be a valid ISO timestamp");
  }

  for (const platform of entry.platforms) {
    const key = `${platform.os}:${platform.arch}`;
    if (platformKeys.has(key)) {
      errors.push(`duplicate platform entry for ${key}`);
    }
    platformKeys.add(key);

    if (!platform.downloadUrl.startsWith(assetPrefix)) {
      errors.push(`downloadUrl must target ${assetPrefix}`);
    }

    if (!platform.downloadUrl.endsWith(`/${platform.fileName}`)) {
      errors.push(`downloadUrl file name must match ${platform.fileName}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateManifestRules(entries) {
  const errors = [];
  const seen = new Set();

  for (const entry of entries) {
    if (seen.has(entry.slug)) {
      errors.push(`duplicate slug found in manifest: ${entry.slug}`);
    }
    seen.add(entry.slug);
  }

  return { valid: errors.length === 0, errors };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/manifest-schema.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/manifest-rules.mjs tests/manifest-schema.test.mjs
git commit -m "feat: add release index business rule checks" -m "Validate rules beyond JSON Schema, including slug-to-file-name matching, release asset URL format, duplicate platform tuples, and duplicate manifest slugs." -m "Keep repository-specific constraints separate from structural schema validation so the build script can compose both layers cleanly."
```

## Task 4: Implement Manifest Aggregation Script

**Files:**
- Modify: `scripts/build-manifest.mjs`
- Modify: `tests/build-manifest.test.mjs`

- [ ] **Step 1: Replace the smoke test with failing aggregation tests**

```js
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

test("build-manifest writes a sorted manifest", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "hades-release-index-"));

  writeJson(path.join(workspace, "schema", "product-manifest-entry.schema.json"), JSON.parse(fs.readFileSync("schema/product-manifest-entry.schema.json", "utf8")));
  writeJson(path.join(workspace, "schema", "product-manifest.schema.json"), JSON.parse(fs.readFileSync("schema/product-manifest.schema.json", "utf8")));
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
        downloadUrl: "https://github.com/HADESforCode/hades-release-index/releases/download/beta-v0.2.0/Beta-Setup.exe",
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
        downloadUrl: "https://github.com/HADESforCode/hades-release-index/releases/download/alpha-v1.0.0/Alpha-Setup.exe",
        fileName: "Alpha-Setup.exe",
        sha256: "alpha123",
        size: 100
      }
    ]
  });

  const result = spawnSync(process.execPath, [path.resolve("scripts/build-manifest.mjs")], {
    cwd: workspace,
    encoding: "utf8",
    env: {
      ...process.env,
      HADES_RELEASE_INDEX_REPOSITORY: "HADESforCode/hades-release-index"
    }
  });

  assert.equal(result.status, 0, result.stderr);
  const manifest = JSON.parse(fs.readFileSync(path.join(workspace, "manifest.json"), "utf8"));
  assert.deepEqual(manifest.map((entry) => entry.slug), ["alpha", "beta"]);
});

test("build-manifest fails on invalid entries", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "hades-release-index-invalid-"));

  writeJson(path.join(workspace, "schema", "product-manifest-entry.schema.json"), JSON.parse(fs.readFileSync("schema/product-manifest-entry.schema.json", "utf8")));
  writeJson(path.join(workspace, "schema", "product-manifest.schema.json"), JSON.parse(fs.readFileSync("schema/product-manifest.schema.json", "utf8")));
  writeJson(path.join(workspace, "entries", "broken.json"), {
    name: "Broken",
    slug: "broken",
    summary: "Broken app",
    status: "beta",
    featured: true,
    version: "0.1.0",
    websiteUrl: "https://example.com/products/broken",
    releaseNotesUrl: "https://github.com/HADESforCode/Broken/releases/tag/v0.1.0",
    coverImage: "/images/products/broken.jpg",
    updatedAt: "not-a-date",
    platforms: []
  });

  const result = spawnSync(process.execPath, [path.resolve("scripts/build-manifest.mjs")], {
    cwd: workspace,
    encoding: "utf8",
    env: {
      ...process.env,
      HADES_RELEASE_INDEX_REPOSITORY: "HADESforCode/hades-release-index"
    }
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /updatedAt|platforms/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/build-manifest.test.mjs`
Expected: FAIL because the script is still a placeholder

- [ ] **Step 3: Implement build-manifest**

`scripts/build-manifest.mjs`

```js
import fs from "node:fs";
import path from "node:path";
import { validateEntry, validateManifest } from "./lib/manifest-schema.mjs";
import { validateEntryRules, validateManifestRules } from "./lib/manifest-rules.mjs";

const repositorySlug = process.env.HADES_RELEASE_INDEX_REPOSITORY || "HADESforCode/hades-release-index";
const rootDirectory = process.cwd();
const entriesDirectory = path.join(rootDirectory, "entries");
const outputPath = path.join(rootDirectory, "manifest.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function listEntryFiles() {
  if (!fs.existsSync(entriesDirectory)) {
    return [];
  }

  return fs.readdirSync(entriesDirectory).filter((fileName) => fileName.endsWith(".json")).sort();
}

function sortEntries(entries) {
  return [...entries].sort((left, right) => {
    const timeDiff = Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
    if (timeDiff !== 0) {
      return timeDiff;
    }

    return left.slug.localeCompare(right.slug);
  });
}

function collectValidatedEntries() {
  const entries = [];

  for (const fileName of listEntryFiles()) {
    const filePath = path.join(entriesDirectory, fileName);
    const entry = readJson(filePath);
    const schemaResult = validateEntry(entry);
    if (!schemaResult.valid) {
      throw new Error(`${fileName} schema validation failed: ${schemaResult.errors.join("; ")}`);
    }

    const rulesResult = validateEntryRules({ fileName, entry, repositorySlug });
    if (!rulesResult.valid) {
      throw new Error(`${fileName} business validation failed: ${rulesResult.errors.join("; ")}`);
    }

    entries.push(entry);
  }

  return sortEntries(entries);
}

function writeManifest(manifest) {
  fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

function main() {
  const manifest = collectValidatedEntries();
  const manifestRulesResult = validateManifestRules(manifest);
  if (!manifestRulesResult.valid) {
    throw new Error(`manifest validation failed: ${manifestRulesResult.errors.join("; ")}`);
  }

  const manifestSchemaResult = validateManifest(manifest);
  if (!manifestSchemaResult.valid) {
    throw new Error(`manifest schema validation failed: ${manifestSchemaResult.errors.join("; ")}`);
  }

  writeManifest(manifest);

  if (process.argv.includes("--check")) {
    process.stdout.write("Manifest validation passed.\n");
  } else {
    process.stdout.write(`Manifest written to ${outputPath}\n`);
  }
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/build-manifest.test.mjs`
Expected: PASS

Run: `npm test`
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/build-manifest.mjs tests/build-manifest.test.mjs
git commit -m "feat: implement manifest aggregation script" -m "Build the root manifest by scanning entries, applying schema and business-rule validation, sorting by updatedAt and slug, and writing the generated JSON output." -m "Cover both success and failure paths with node:test so CI can reject malformed entries before they reach the public manifest consumed by the site."
```

## Task 5: Seed Repository Data And Verify Generated Output

**Files:**
- Create: `entries/easywrite.json`
- Create: `manifest.json`
- Modify: `tests/build-manifest.test.mjs`

- [ ] **Step 1: Add a failing repository fixture assertion**

```js
test("repository manifest matches generated output", () => {
  const result = spawnSync(process.execPath, ["scripts/build-manifest.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      HADES_RELEASE_INDEX_REPOSITORY: "HADESforCode/hades-release-index"
    }
  });

  assert.equal(result.status, 0, result.stderr);
  const rootManifest = fs.readFileSync("manifest.json", "utf8");
  const rebuiltManifest = fs.readFileSync("manifest.json", "utf8");
  assert.equal(rootManifest, rebuiltManifest);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/build-manifest.test.mjs`
Expected: FAIL because `entries/easywrite.json` and `manifest.json` do not exist yet

- [ ] **Step 3: Create the initial repository data**

`entries/easywrite.json`

```json
{
  "name": "EasyWrite",
  "slug": "easywrite",
  "summary": "A focused writing tool.",
  "status": "beta",
  "featured": true,
  "version": "0.1.4",
  "websiteUrl": "https://example.com/products/easywrite",
  "releaseNotesUrl": "https://github.com/HADESforCode/EasyWrite/releases/tag/v0.1.4",
  "coverImage": "/images/products/easywrite-cover.jpg",
  "updatedAt": "2026-05-25T12:00:00.000Z",
  "platforms": [
    {
      "os": "windows",
      "arch": "x64",
      "downloadUrl": "https://github.com/HADESforCode/hades-release-index/releases/download/easywrite-v0.1.4/EasyWrite-Setup.exe",
      "fileName": "EasyWrite-Setup.exe",
      "sha256": "abc123",
      "size": 12345678
    }
  ]
}
```

Run: `npm run build`
Expected: `Manifest written to ...\manifest.json`

`manifest.json`

```json
[
  {
    "name": "EasyWrite",
    "slug": "easywrite",
    "summary": "A focused writing tool.",
    "status": "beta",
    "featured": true,
    "version": "0.1.4",
    "websiteUrl": "https://example.com/products/easywrite",
    "releaseNotesUrl": "https://github.com/HADESforCode/EasyWrite/releases/tag/v0.1.4",
    "coverImage": "/images/products/easywrite-cover.jpg",
    "updatedAt": "2026-05-25T12:00:00.000Z",
    "platforms": [
      {
        "os": "windows",
        "arch": "x64",
        "downloadUrl": "https://github.com/HADESforCode/hades-release-index/releases/download/easywrite-v0.1.4/EasyWrite-Setup.exe",
        "fileName": "EasyWrite-Setup.exe",
        "sha256": "abc123",
        "size": 12345678
      }
    ]
  }
]
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS

Run: `npm run validate`
Expected: `Manifest validation passed.`

- [ ] **Step 5: Commit**

```bash
git add entries/easywrite.json manifest.json tests/build-manifest.test.mjs
git commit -m "feat: add initial public release entry" -m "Seed the repository with the first EasyWrite entry and the generated top-level manifest output." -m "Keep the checked-in manifest aligned with the build script so the site can consume a ready-to-serve public JSON file directly from the repository."
```

## Task 6: Add CI Workflow And Repository Documentation

**Files:**
- Create: `.github/workflows/validate-and-build-manifest.yml`
- Create: `README.md`

- [ ] **Step 1: Write the failing documentation and workflow checks**

```js
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("README documents repository responsibilities and local validation", () => {
  const readme = fs.readFileSync("README.md", "utf8");
  assert.match(readme, /仓库职责/);
  assert.match(readme, /如何本地验证/);
  assert.match(readme, /GitHub Releases assets/);
});

test("workflow validates and rebuilds manifest on push and PR", () => {
  const workflow = fs.readFileSync(".github/workflows/validate-and-build-manifest.yml", "utf8");
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /push:/);
  assert.match(workflow, /npm run build/);
  assert.match(workflow, /git diff --exit-code -- manifest.json/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/build-manifest.test.mjs`
Expected: FAIL because README and workflow do not exist yet

- [ ] **Step 3: Implement workflow and README**

`.github/workflows/validate-and-build-manifest.yml`

```yaml
name: Validate And Build Manifest

on:
  pull_request:
    paths:
      - "entries/**"
      - "schema/**"
      - "scripts/**"
      - "package.json"
      - "package-lock.json"
      - ".github/workflows/validate-and-build-manifest.yml"
  push:
    paths:
      - "entries/**"
      - "schema/**"
      - "scripts/**"
      - "package.json"
      - "package-lock.json"
      - ".github/workflows/validate-and-build-manifest.yml"

jobs:
  validate-and-build:
    runs-on: ubuntu-latest
    env:
      HADES_RELEASE_INDEX_REPOSITORY: HADESforCode/hades-release-index
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Validate and rebuild manifest
        run: npm run build

      - name: Ensure manifest is up to date
        run: git diff --exit-code -- manifest.json
```

`README.md`

```md
# hades-release-index

## 仓库职责

- 公开保存多产品最新发布元数据
- 聚合输出根目录 `manifest.json`
- 通过本仓 `GitHub Releases assets` 提供安装包公开下载地址
- 不保存私有源码，不引入数据库或后端服务

## 目录结构

```text
entries/
manifest.json
schema/
scripts/
.github/workflows/
```

## 如何本地验证

```bash
npm install
npm test
npm run build
npm run validate
```

## 主站公开地址

```text
https://raw.githubusercontent.com/HADESforCode/hades-release-index/main/manifest.json
```

## 如何让产品私仓更新这个仓库

1. 私仓构建安装包
2. 私仓向本仓对应 release 上传 `GitHub Releases assets`
3. 私仓生成并提交 `entries/<slug>.json`
4. 本仓 CI 重新生成并校验 `manifest.json`

## 需要手工配置的 secrets 或仓库设置

- 公共仓启用 GitHub Actions
- 公共仓默认分支确认使用 `main`
- 私仓配置一个可写本公共仓 contents 和 releases 的 token
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/validate-and-build-manifest.yml README.md
git commit -m "docs: add release index workflow and usage guide" -m "Document repository responsibilities, local validation steps, public manifest URL usage, and the private-repository update flow." -m "Add GitHub Actions automation that reruns tests, rebuilds manifest.json, and fails if committed output drifts from entries or validation logic."
```

## Plan Self-Review

- Spec coverage: tasks cover minimal Node setup, entry and manifest schemas, business-rule validation, aggregation output, GitHub Actions, README responsibilities, local verification, private-repo update flow, and required repository settings.
- Placeholder scan: no `TODO`, `TBD`, or abstract “implement later” instructions remain; each code-changing step includes concrete file content or commands.
- Type consistency: `validateEntry`, `validateManifest`, `validateEntryRules`, `validateManifestRules`, and `HADES_RELEASE_INDEX_REPOSITORY` naming stay consistent across tasks.
