/**
 * Conversation context for the classifier.
 *
 * The engines classify one string. Without the previous request, "ok now do it"
 * and "one more" are unclassifiable; with it, they inherit the job. This is pure
 * apart from reading the session entries, so it is tested with a fake session.
 */
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

export const PRIOR_MAX = 800;
export const PRIOR_ATTACH_MAX = 240;

/** Continuation openers: the request is the same job as the last one. */
export const CONTINUATION = /^(alright|all right|one more|also[, ]|instead |now,|ok so |and also|ship it)/i;

export function lastUserText(entry: unknown): string {
	const e = entry as { type?: string; message?: { role?: string; content?: unknown } };
	if (e?.type !== "message" || e.message?.role !== "user") return "";
	const c = e.message.content;
	if (typeof c === "string") return c.trim();
	if (!Array.isArray(c)) return "";
	return c
		.filter((b): b is { type: string; text: string } => !!b && (b as { type?: string }).type === "text")
		.map((b) => b.text)
		.join("\n")
		.trim();
}

/**
 * The classifier has no conversation; hand it the previous turn when it looks
 * needed — a short prompt, or one that opens like a continuation.
 */
export function priorRequest(
	entries: readonly unknown[],
	current: string,
): string | undefined {
	const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
	const trimmed = current.trim();
	if (trimmed.length > PRIOR_ATTACH_MAX && !CONTINUATION.test(trimmed)) return undefined;
	const users: string[] = [];
	for (const entry of entries) {
		const text = lastUserText(entry);
		if (text && norm(text) !== norm(current)) users.push(text);
	}
	const prior = users.at(-1);
	return prior ? prior.slice(0, PRIOR_MAX) : undefined;
}

/** Read the branch and hand it to `priorRequest`. */
export function priorFromContext(ctx: ExtensionContext, current: string): string | undefined {
	return priorRequest(ctx.sessionManager?.getEntries?.() ?? [], current);
}
