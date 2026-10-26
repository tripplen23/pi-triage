/**
 * pi-triage — classify the request, hand back the route.
 *
 * Source order, and each step is only tried when the previous one gave no tier:
 *   crumb → Jev (hosted decision model) → Laya (self-hosted) → keyword fallback.
 *
 * The keyword step is labelled as a hint, never as a result: a guess dressed up
 * as a decision is what makes a bad route expensive.
 */
import { appendFileSync } from "node:fs";
import { join } from "node:path";
import { Type } from "typebox";
import { getAgentDir, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { compose, verificationOf } from "./src/compose.ts";
import { layaConfig, resolveOpenRouter } from "./src/credentials.ts";
import { priorFromContext } from "./src/context.ts";
import { askJev, askLaya } from "./src/engines.ts";
import { classifyHeuristic, isContinuationCrumb, type Verification } from "./src/fallback.ts";
import { formatResult, type Source } from "./src/result.ts";

export default function (pi: ExtensionAPI) {
	const trace = (row: Record<string, unknown>) => {
		try {
			appendFileSync(join(getAgentDir(), "triage.log"), JSON.stringify(row) + "\n");
		} catch {
			/* tracing must never break routing */
		}
	};

	pi.registerTool({
		name: "triage",
		label: "Triage",
		description:
			"Classify the user's exact request into a routing tier before doing any work. " +
			"Pass the user's wording verbatim — do not rewrite, summarise, or translate it. " +
			"Returns the tier, a confidence, the verification level, and the exact route to take " +
			"(which subagent to spawn). Call this once at the start of a request that may need work done.",
		parameters: Type.Object({
			prompt: Type.String({ description: "The user's exact request string, verbatim" }),
		}),

		async execute(_id, params, _signal, _onUpdate, ctx) {
			const prompt = String(params.prompt ?? "").trim();
			if (!prompt) return { content: [{ type: "text", text: "triage: empty prompt." }], details: {} };

			const prior = priorFromContext(ctx, prompt);
			const { layaUrl, layaKey } = layaConfig();
			const openrouter = await resolveOpenRouter(ctx);
			const warnings: string[] = [];
			const started = Date.now();
			let source: Source | "" = ""; // always set below; never default to the regex
			let tier = "";
			let confidence: number | undefined;
			let verification: Verification = "tests";

			// A continuation crumb needs no decision: no engine is consulted.
			if (isContinuationCrumb(prompt)) {
				tier = "tier_0";
				confidence = 1;
				source = "crumb";
			} else {
				// 1. Jev — the decision model. Most accurate and fastest (measured 482ms).
				if (openrouter) {
					try {
						const answers = (await askJev(prompt, prior, openrouter)).answers;
						const c = compose(answers);
						if (c.tier !== "unknown") {
							tier = c.tier;
							confidence = c.confidence;
							verification = verificationOf(answers, tier);
							source = "jev";
						} else {
							warnings.push("Jev returned no usable tier");
						}
					} catch (e) {
						warnings.push(`Jev unavailable (${(e as Error).message})`);
					}
				} else {
					warnings.push("no OpenRouter credential (env or pi login)");
				}

				// 2. Laya — also a trained model, self-hosted. Slower (~5.8s) and weaker on
				//    our set, but it generalises where a regex cannot, so it outranks one.
				if (!tier) {
					if (layaUrl && layaKey) {
						try {
							const answers = (await askLaya(prompt, prior, layaUrl, layaKey)).answers;
							const c = compose(answers);
							if (c.tier !== "unknown") {
								tier = c.tier;
								confidence = c.confidence;
								verification = verificationOf(answers, tier);
								source = "laya";
							}
						} catch (e) {
							warnings.push(`Laya unavailable (${(e as Error).message})`);
						}
					} else {
						warnings.push("Laya not configured (LAYA_URL/LAYA_API_KEY)");
					}
				}

				// 3. Local regex — last resort. Hardcoded rules only match phrasings we
				//    anticipated, so this is a fallback, never a first choice.
				if (!tier) {
					const fb = classifyHeuristic(prompt);
					tier = fb.tier;
					confidence = fb.confidence;
					verification = fb.verification;
					source = "heuristic";
					if (!fb.matched) warnings.push("no keyword rule matched — this is a guess, not a classification");
				}
			}

			const lines = formatResult({ tier, confidence, verification, source: source as Source, warnings });
			const pct = confidence === undefined ? undefined : Math.round(confidence * 100);

			trace({
				at: new Date().toISOString(),
				tier,
				confidence: pct,
				verification,
				source,
				ms: Date.now() - started,
				warnings,
				prompt: prompt.slice(0, 300),
			});

			return {
				content: [{ type: "text", text: lines.join("\n") }],
				details: { tier, confidence: pct, verification, source },
			};
		},
	});
}
