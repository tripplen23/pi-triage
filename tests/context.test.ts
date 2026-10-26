/**
 * The previous request is what makes "ok now do it" classifiable. Getting this
 * wrong is silent: the engine still answers, just about the wrong job.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { CONTINUATION, lastUserText, priorRequest } from "../src/context.ts";

const user = (text: string) => ({ type: "message", message: { role: "user", content: text } });
const assistant = (text: string) => ({ type: "message", message: { role: "assistant", content: [{ type: "text", text }] } });

test("lastUserText reads string content and text blocks, ignores other roles", () => {
  assert.equal(lastUserText(user("hello")), "hello");
  assert.equal(lastUserText({ type: "message", message: { role: "user", content: [{ type: "text", text: "a" }, { type: "text", text: "b" }] } }), "a\nb");
  assert.equal(lastUserText(assistant("no")), "");
  assert.equal(lastUserText({ type: "custom" }), "");
  assert.equal(lastUserText(null), "");
});

test("a short prompt inherits the previous request", () => {
  const entries = [user("add a --verbose flag to tool.py"), assistant("done")];
  assert.equal(priorRequest(entries, "ok now do it"), "add a --verbose flag to tool.py");
});

test("a continuation opener inherits even when the prompt is long", () => {
  const prior = "x".repeat(400);
  const long = `instead do the same for the other command ${"y".repeat(300)}`;
  assert.equal(priorRequest([user(prior)], long), prior);
  assert.ok(CONTINUATION.test(long));
});

test("a long, unrelated prompt gets no prior, so it is classified on its own", () => {
  const entries = [user("something old")];
  const long = "z".repeat(400);
  assert.equal(priorRequest(entries, long), undefined);
});

test("the current request is never its own prior, and order decides", () => {
  const entries = [user("first"), user("second"), user("current")];
  assert.equal(priorRequest(entries, "current"), "second");
});

test("no earlier user turn means no prior", () => {
  assert.equal(priorRequest([assistant("hi")], "ok"), undefined);
  assert.equal(priorRequest([], "ok"), undefined);
});

test("the prior is truncated so a huge paste cannot blow the engine request", () => {
  const entries = [user("a".repeat(5000))];
  assert.equal(priorRequest(entries, "ok")!.length, 800);
});
