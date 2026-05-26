import fs from "node:fs";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const schemaDirectory = path.resolve(process.cwd(), "schema");
const entrySchemaPath = path.join(
  schemaDirectory,
  "product-manifest-entry.schema.json"
);
const manifestSchemaPath = path.join(
  schemaDirectory,
  "product-manifest.schema.json"
);

function loadSchema(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);

const entrySchema = loadSchema(entrySchemaPath);
const manifestSchema = loadSchema(manifestSchemaPath);

ajv.addSchema(entrySchema, "product-manifest-entry.schema.json");

const validateEntrySchema = ajv.compile(entrySchema);
const validateManifestSchema = ajv.compile(manifestSchema);

function formatErrors(errors) {
  if (!errors) {
    return [];
  }

  return errors.map((error) =>
    `${error.instancePath || "/"} ${error.message}`.trim()
  );
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
