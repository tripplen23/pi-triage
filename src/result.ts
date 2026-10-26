/**
 * The text the agent reads.
 *
 * The rules it encodes are not cosmetic: a keyword match must never look like a
 * decision, and only a model's answer may consume an ask_user_question.
 */
import { minConfidenceFor } from "./questions.ts";
import type { Verification } from "./fallback.ts";
import { ROUTE, VERIFY_TEXT } from "./routes.ts";

export type Source = "crumb" | "jev" | "laya" | "heuristic";

export interface ResultInput {
	tier: string;
	/** 0..1 as the engine reports it. */
	confidence: number | undefined;
	verification: Verification;
	source: Source;
	warnings: readonly string[];
}

/** Render the tool result. Pure: same input, same lines. */
export function formatResult(input: ResultInput): string[] {
	const { tier, confidence, verification, source, warnings } = input;
	const pct = confidence === undefined ? undefined : Math.round(confidence * 100);
	const route = ROUTE[tier] ?? ROUTE.tier_1!;
	// Only a model's answer can be low-confidence. A regex match is not a
	// classification, so it must never consume an ask_user_question.
	const flagged = source !== "heuristic" && pct !== undefined && pct < minConfidenceFor(tier);

	const lines: string[] = [];
	if (source === "crumb") {
		lines.push("Triage Result: tier_0 — continuation crumb, nothing to classify.");
	} else if (source === "heuristic") {
		// No model answered. Say so plainly rather than dressing a keyword match up
		// as a decision: a guess presented as a result is worse than no result.
		lines.push(`No classifier available — ${warnings.join("; ") || "no engine answered"}.`);
		lines.push("Apply the routing rules in AGENTS.md yourself; do not ask the user to confirm this.");
		lines.push(`Keyword hint only, no accuracy claim: ${tier}.`);
	} else {
		lines.push(`Triage Result: ${tier}${pct === undefined ? "" : ` (confidence ${pct}%)`} — via ${source}`);
		if (flagged) {
			lines.push("WARNING: low confidence. Confirm the tier with the user via ask_user_question BEFORE routing.");
		}
		if (warnings.length) lines.push(`Fallback note: ${warnings.join("; ")}`);
	}
	lines.push(`Route: ${route.route}`);
	lines.push(`Agent: ${route.agent}`);
	lines.push(`Verification: ${verification} — ${VERIFY_TEXT[verification]}`);
	return lines;
}
