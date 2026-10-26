/**
 * The rendered text is the tool's whole contract with the agent. Two rules must
 * never regress: a keyword match is not presented as a decision, and only a
 * model answer may ask the user to confirm.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { formatResult } from "../src/result.ts";

test("a model result carries tier, confidence, route, agent and verification", () => {
  const lines = formatResult({ tier: "tier_3", confidence: 1, verification: "tests", source: "jev", warnings: [] });
  assert.match(lines[0]!, /^Triage Result: tier_3 \(confidence 100%\) — via jev$/);
  assert.match(lines.join("\n"), /Route: subagent\(\{ agent: "planner"/);
  assert.match(lines.join("\n"), /Agent: planner → worker/);
  assert.match(lines.join("\n"), /Verification: tests — the worker's own tests are the check/);
});

test("a low-confidence model answer asks for confirmation first", () => {
  const lines = formatResult({ tier: "tier_3", confidence: 0.5, verification: "tests", source: "laya", warnings: [] });
  assert.match(lines.join("\n"), /WARNING: low confidence\. Confirm the tier with the user/);
});

test("a keyword result never claims a confidence and never asks for confirmation", () => {
  const lines = formatResult({ tier: "tier_2", confidence: 0.5, verification: "tests", source: "heuristic", warnings: ["no keyword rule matched — this is a guess, not a classification"] });
  const text = lines.join("\n");
  assert.match(text, /No classifier available — no keyword rule matched/);
  assert.match(text, /Keyword hint only, no accuracy claim: tier_2\./);
  assert.doesNotMatch(text, /confidence \d+%/);
  assert.doesNotMatch(text, /WARNING: low confidence/);
});

test("a crumb is answered inline", () => {
  const lines = formatResult({ tier: "tier_0", confidence: 1, verification: "tests", source: "crumb", warnings: [] });
  assert.match(lines[0]!, /continuation crumb, nothing to classify/);
  assert.match(lines.join("\n"), /Do not spawn anything/);
});

test("an unknown tier still yields a usable route, and engine warnings are surfaced", () => {
  const lines = formatResult({ tier: "tier_9", confidence: undefined, verification: "scout", source: "jev", warnings: ["Laya not configured"] });
  const text = lines.join("\n");
  assert.match(text, /Triage Result: tier_9 — via jev/);
  assert.match(text, /Fallback note: Laya not configured/);
  assert.match(text, /Route: subagent\(\{ agent: "worker"/, "falls back to tier_1's route");
  assert.match(text, /Verification: scout/);
});
