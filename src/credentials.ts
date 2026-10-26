/**
 * Where the credentials come from.
 *
 * Kept apart from the tool because a wrong lookup here does not fail loudly: it
 * silently demotes every request to the keyword fallback.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

/** Read a KEY=value file without touching the shell. Empty result on any error. */
export function readEnvFile(path: string): Record<string, string> {
	try {
		const out: Record<string, string> = {};
		for (const line of readFileSync(path, "utf8").split("\n")) {
			const m = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
			if (!m) continue;
			out[m[1]!] = m[2]!.trim().replace(/^["']|["']$/g, "");
		}
		return out;
	} catch {
		return {};
	}
}

function layaEnvFile(): Record<string, string> {
	return readEnvFile(join(process.env.HOME ?? "", ".config", "laya", "env"));
}

/**
 * OpenRouter credential for Jev, resolved the way Pi resolves credentials
 * everywhere else: an explicit env var wins, then Pi's own credential store —
 * which is what `/login` writes — and only then a KEY=value file some setups keep
 * beside the Laya credentials. Nothing here needs env.sh.
 */
export async function resolveOpenRouter(ctx: ExtensionContext): Promise<string | undefined> {
	const fromEnv = process.env.OPENROUTER_API_KEY?.trim();
	if (fromEnv) return fromEnv;

	try {
		const key = await ctx.modelRegistry?.getApiKeyForProvider?.("openrouter");
		if (key?.trim()) return key.trim();
	} catch {
		/* provider not configured, or the lookup failed: fall through */
	}

	return layaEnvFile().OPENROUTER_API_KEY;
}

/** Laya endpoint and bearer. No Pi-side equivalent, so env then the Laya env file. */
export function layaConfig(): { layaUrl: string | undefined; layaKey: string | undefined } {
	const file = layaEnvFile();
	const pick = (k: string) => process.env[k]?.trim() || file[k] || undefined;
	return { layaUrl: pick("LAYA_URL"), layaKey: pick("LAYA_API_KEY") };
}
