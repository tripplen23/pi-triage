/**
 * The two decision engines.
 *
 * Both take the same question set and answer in the same shape, so the tool can
 * fall through from one to the other without knowing which replied.
 */
import type { Answers } from "./compose.ts";
import { QUESTIONS } from "./questions.ts";

export const JEV_ENDPOINT = "https://openrouter.ai/api/alpha/decisions";
export const JEV_MODEL = "jev-1.13";
export const JEV_TIMEOUT_MS = 2_500; // measured ~350ms; fail over fast
export const LAYA_TIMEOUT_MS = 9_000; // measured ~5.8s for this 4-question set on the CPU box

function usable(answers: Answers | undefined): boolean {
	return Boolean(answers?.task_tier || answers?.is_ui_test || answers?.is_code_review);
}

/** The hosted decision model. Returns its cost, which is not billed per token. */
export async function askJev(prompt: string, prior: string | undefined, key: string) {
	const r = await fetch(JEV_ENDPOINT, {
		method: "POST",
		headers: { "content-type": "application/json", Authorization: `Bearer ${key}` },
		body: JSON.stringify({
			model: JEV_MODEL,
			state: prior ? { request: prompt, prior_request: prior } : { request: prompt },
			questions: QUESTIONS,
		}),
		signal: AbortSignal.timeout(JEV_TIMEOUT_MS),
	});
	if (!r.ok) throw new Error(`HTTP ${r.status}`);
	const d = (await r.json()) as { answers?: Answers; usage?: { cost?: number } };
	if (!usable(d.answers)) throw new Error("malformed body");
	return { answers: d.answers!, cost: d.usage?.cost };
}

/** The self-hosted engine. Slower and weaker on this set, but not keyword-bound. */
export async function askLaya(prompt: string, prior: string | undefined, url: string, key: string) {
	const r = await fetch(`${url.replace(/\/$/, "")}/systemone`, {
		method: "POST",
		headers: { "content-type": "application/json", Authorization: `Bearer ${key}` },
		body: JSON.stringify({
			state: prior ? { request: prompt, prior_request: prior } : { request: prompt },
			questions: QUESTIONS,
		}),
		signal: AbortSignal.timeout(LAYA_TIMEOUT_MS),
	});
	if (!r.ok) throw new Error(`HTTP ${r.status}`);
	const d = (await r.json()) as { answers?: Answers };
	if (!usable(d.answers)) throw new Error("malformed body");
	return { answers: d.answers! };
}
