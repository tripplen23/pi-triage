/**
 * Folding the engine answers into one tier. The traps here cost real money: a
 * missed `is_code_review` silently skips the review step.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { compose, verificationOf } from "../src/compose.ts";

test("the task tier wins when neither noul question fires", () => {
  const r = compose({ task_tier: { choice: "tier_2", confidence: 0.9 } });
  assert.deepEqual(r, { tier: "tier_2", confidence: 0.9 });
});

test("UI outranks review, because the reviewer has no browser", () => {
  const r = compose({
    task_tier: { choice: "tier_1" },
    is_ui_test: { noul: 0.9, confidence: 0.9 },
    is_code_review: { noul: 0.95, confidence: 0.95 },
  });
  assert.equal(r.tier, "tier_4_qa");
});

test("a confident review noul routes to review", () => {
  const r = compose({
    task_tier: { choice: "tier_1" },
    is_ui_test: { noul: 0.1, confidence: 0.9 },
    is_code_review: { noul: 0.9, confidence: 0.8 },
  });
  assert.deepEqual(r, { tier: "tier_5_review", confidence: 0.8 });
});

test("a high noul with low confidence does not route", () => {
  const r = compose({
    task_tier: { choice: "tier_1" },
    is_ui_test: { noul: 0.95, confidence: 0.4 },
    is_code_review: { noul: 0.95, confidence: 0.4 },
  });
  assert.equal(r.tier, "tier_1", "below the confidence floor it must fall through");
});

test("a missing noul confidence still counts as confident", () => {
  // Jev omits it; requiring it would drop every QA route.
  const r = compose({ is_ui_test: { noul: 0.9 } });
  assert.equal(r.tier, "tier_4_qa");
  assert.equal(r.confidence, undefined);
});

test("answer_confidence is read before confidence", () => {
  const r = compose({
    task_tier: { choice: "tier_2", confidence: 0.2, answer_confidence: 0.9 },
  });
  assert.equal(r.confidence, 0.9);
});

test("empty answers are unknown, not a guessed tier", () => {
  assert.deepEqual(compose({}), { tier: "unknown", confidence: undefined });
});

test("verification follows the tier, then the engine's choice, then tests", () => {
  assert.equal(verificationOf({}, "tier_4_qa"), "browser");
  assert.equal(verificationOf({}, "tier_5_review"), "reviewer");
  assert.equal(verificationOf({ verification: { choice: "scout" } }, "tier_2"), "scout");
  assert.equal(verificationOf({ verification: { choice: "browser" } }, "tier_1"), "browser");
  assert.equal(verificationOf({ verification: { choice: "nonsense" } }, "tier_1"), "tests");
  assert.equal(verificationOf({}, "tier_0"), "tests");
});
