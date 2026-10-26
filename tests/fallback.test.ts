/**
 * The keyword fallback is the last line of defence when neither engine answers, so
 * its ordering and its confidence ceiling are the contract. Run: `npm test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { classifyHeuristic, isContinuationCrumb } from "../src/fallback.ts";

test("a continuation crumb needs no classification at all", () => {
  for (const prompt of ["ok", "ship it", "LGTM", "go on", "thanks!", "👍"]) {
    assert.equal(isContinuationCrumb(prompt), true, prompt);
    assert.deepEqual(classifyHeuristic(prompt), {
      tier: "tier_0",
      confidence: 1,
      verification: "tests",
      matched: true,
    });
  }
  assert.equal(isContinuationCrumb("ok now add a settings page"), false);
});

test("audit wording is a review, and is checked before plan wording", () => {
  assert.equal(classifyHeuristic("do an architecture audit of the auth layer").tier, "tier_5_review");
  assert.equal(classifyHeuristic("run a security review").verification, "reviewer");
});

test("bare 'review' is not an audit, so 'review the plan' stays a plan", () => {
  const r = classifyHeuristic("review the plan for the importer");
  assert.equal(r.tier, "tier_3");
  assert.equal(r.verification, "tests");
});

test("driving a UI is QA, but not when the prompt is really a question", () => {
  const ui = classifyHeuristic("click through the signup flow and tell me if it breaks");
  assert.equal(ui.tier, "tier_4_qa");
  assert.equal(ui.verification, "browser");

  const question = classifyHeuristic("how do i click through the signup flow in tests?");
  assert.equal(question.tier, "tier_0", "an ask must not become a QA session");
});

test("a bug report that mentions clicking stays a fix", () => {
  // "when I click ..." is deliberately not an ASK opener.
  const r = classifyHeuristic("when I click x I get an empty list");
  assert.equal(r.tier, "tier_2");
});

test("naming a target skips recon and outranks the fix rule", () => {
  const r = classifyHeuristic("fix the typo in src/auth/login.ts");
  assert.equal(r.tier, "tier_1", "a named file needs no scout");
});

test("plans and feature work route to the planner", () => {
  for (const prompt of [
    "add a settings page",
    "design a migration for the billing tables",
    "refactor the session store",
  ]) {
    assert.equal(classifyHeuristic(prompt).tier, "tier_3", prompt);
  }
});

test("an unmatched prompt is a labelled guess, not a classification", () => {
  const r = classifyHeuristic("zzz qqq");
  assert.equal(r.matched, false);
  assert.equal(r.tier, "tier_1");
  assert.ok(r.confidence <= 0.5);
});

test("every heuristic answer stays under the tier_3 confirmation floor", () => {
  // The ceiling exists so a heuristic never silently authorises planner/qa/review.
  const prompts = [
    "architecture audit",
    "click through the checkout",
    "design a new api",
    "fix the crash",
    "typo in src/a.ts",
    "zzz",
  ];
  for (const prompt of prompts) {
    const r = classifyHeuristic(prompt);
    if (r.tier === "tier_0" && r.confidence === 1) continue; // crumb: answered inline
    assert.ok(r.confidence <= 0.6, `${prompt} → ${r.confidence}`);
  }
});

test("empty and whitespace input do not crash", () => {
  for (const prompt of ["", "   ", "\n"]) {
    const r = classifyHeuristic(prompt);
    assert.equal(typeof r.tier, "string");
    assert.equal(r.matched, false);
  }
});
