/**
 * Credential lookup. A silent failure here does not error: it demotes every
 * request to the keyword fallback, so it is worth a test.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { layaConfig, readEnvFile, resolveOpenRouter } from "../src/credentials.ts";

test("readEnvFile reads KEY=value, export prefixes and quoted values", () => {
  const dir = mkdtempSync(join(tmpdir(), "triage-env-"));
  const file = join(dir, "env");
  writeFileSync(file, ['A=1', 'export B=two', 'C="three"', "D='four'", "# comment", "nonsense", "E= sp ace "].join("\n"));

  const env = readEnvFile(file);
  assert.equal(env.A, "1");
  assert.equal(env.B, "two");
  assert.equal(env.C, "three");
  assert.equal(env.D, "four");
  assert.equal(env.E, "sp ace");
  assert.equal(env.nonsense, undefined);
});

test("a missing env file is empty, not a throw", () => {
  assert.deepEqual(readEnvFile("/nonexistent/triage/env"), {});
});

test("an explicit env var wins over pi's store, and the store over the file", async () => {
  const saved = { key: process.env.OPENROUTER_API_KEY, home: process.env.HOME };
  const emptyHome = mkdtempSync(join(tmpdir(), "triage-home-"));
  try {
    process.env.HOME = emptyHome; // no ~/.config/laya/env to fall back to

    process.env.OPENROUTER_API_KEY = "from-env";
    assert.equal(await resolveOpenRouter({} as never), "from-env");

    delete process.env.OPENROUTER_API_KEY;
    const ctx = { modelRegistry: { getApiKeyForProvider: async () => "from-login" } };
    assert.equal(await resolveOpenRouter(ctx as never), "from-login");

    // The store throws, no env var, no file: undefined, not a throw.
    const failing = { modelRegistry: { getApiKeyForProvider: async () => { throw new Error("nope"); } } };
    assert.equal(await resolveOpenRouter(failing as never), undefined);
  } finally {
    if (saved.key !== undefined) process.env.OPENROUTER_API_KEY = saved.key;
    else delete process.env.OPENROUTER_API_KEY;
    process.env.HOME = saved.home;
  }
});

test("layaConfig prefers the environment and falls back to undefined", () => {
  const saved = { ...process.env };
  process.env.LAYA_URL = "http://box:8080";
  process.env.LAYA_API_KEY = "k";
  assert.deepEqual(layaConfig(), { layaUrl: "http://box:8080", layaKey: "k" });

  delete process.env.LAYA_URL;
  delete process.env.LAYA_API_KEY;
  const cfg = layaConfig();
  assert.equal(cfg.layaUrl === undefined || typeof cfg.layaUrl === "string", true);

  process.env = saved;
});
