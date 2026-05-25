import fs from "node:fs";
import path from "node:path";
import { validateEntry, validateManifest } from "./lib/manifest-schema.mjs";
import {
  validateEntryRules,
  validateManifestRules
} from "./lib/manifest-rules.mjs";

const repositorySlug =
  process.env.HADES_RELEASE_INDEX_REPOSITORY ||
  "HADESforCode/hades-release-index";
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

  return fs
    .readdirSync(entriesDirectory)
    .filter((fileName) => fileName.endsWith(".json"))
    .sort();
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
      throw new Error(
        `${fileName} schema validation failed: ${schemaResult.errors.join("; ")}`
      );
    }

    const rulesResult = validateEntryRules({
      fileName,
      entry,
      repositorySlug
    });

    if (!rulesResult.valid) {
      throw new Error(
        `${fileName} business validation failed: ${rulesResult.errors.join("; ")}`
      );
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
    throw new Error(
      `manifest validation failed: ${manifestRulesResult.errors.join("; ")}`
    );
  }

  const manifestSchemaResult = validateManifest(manifest);

  if (!manifestSchemaResult.valid) {
    throw new Error(
      `manifest schema validation failed: ${manifestSchemaResult.errors.join(
        "; "
      )}`
    );
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
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exit(1);
}
