/**
 * What each tier tells the agent to do, and how to verify it.
 *
 * This is the half of the contract that names agent roles: a route here and an
 * agent definition in pi-swarm have to agree, or the model is told to spawn
 * something that does not exist.
 */
import type { Verification } from "./fallback.ts";

export const ROUTE: Record<string, { agent: string; route: string }> = {
	tier_0: { agent: "—", route: "Answer directly in this session. Do not spawn anything." },
	tier_1: { agent: "worker", route: "subagent({ agent: \"worker\", … })" },
	tier_2: {
		agent: "scout → worker",
		route: "subagent({ agent: \"scout\", … }) for the file/line map, then hand that map to subagent({ agent: \"worker\", … })",
	},
	tier_3: {
		agent: "planner → worker",
		route: `subagent({ agent: "planner", … }) — it writes a spec to .pi/plans/<slug>.md. Show that spec to the user before spawning workers.`,
	},
	tier_4_qa: { agent: "qa", route: "subagent({ agent: \"qa\", … })" },
	tier_5_review: { agent: "reviewer", route: "subagent({ agent: \"reviewer\", … })" },
};

export const VERIFY_TEXT: Record<Verification, string> = {
	tests: "the worker's own tests are the check",
	scout: "re-read the changed logic with subagent({ agent: \"scout\" })",
	browser: "verify in a running UI with subagent({ agent: \"qa\" })",
	reviewer: "get a verdict from subagent({ agent: \"reviewer\" })",
};
