import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("build-manifest script exists and can be invoked", () => {
  const result = spawnSync(process.execPath, ["scripts/build-manifest.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8"
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /build-manifest is not implemented yet/);
});
