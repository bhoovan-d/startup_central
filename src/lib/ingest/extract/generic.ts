import { SYSTEM_PROMPT, buildUserMessage } from "./prompt";
import type { ExtractInput, Extractor } from "./index";

/**
 * Any OpenAI-compatible chat-completions endpoint.
 *
 * This is the path to a free model. Groq, Google Gemini and OpenRouter all
 * expose an OpenAI-compatible API, so switching provider is three env vars and
 * no code. Plain `fetch` rather than a client library — the surface used here
 * is one POST, which is not worth a dependency.
 *
 * Output is validated by the same zod schema as every other extractor, so a
 * weaker free model cannot put a malformed row into the database; it just
 * sends more items to review.
 */

/** Free tiers rate-limit aggressively; back off rather than dropping items. */
const MAX_ATTEMPTS = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createGenericExtractor(): Extractor {
  const baseUrl = process.env.GENERIC_LLM_BASE_URL!.replace(/\/+$/, "");
  const model = process.env.GENERIC_LLM_MODEL!;
  const apiKey = process.env.GENERIC_LLM_API_KEY;

  return {
    name: "generic",
    async extract(input: ExtractInput) {
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          const res = await fetch(`${baseUrl}/chat/completions`, {
            method: "POST",
            signal: AbortSignal.timeout(30_000),
            headers: {
              "content-type": "application/json",
              ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
            },
            body: JSON.stringify({
              model,
              temperature: 0,
              max_tokens: 700,
              response_format: { type: "json_object" },
              messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: buildUserMessage(input) },
              ],
            }),
          });

          // 429 is the normal free-tier signal, not a failure. Honour
          // Retry-After when the provider sends it.
          if (res.status === 429 || res.status >= 500) {
            const retryAfter = Number(res.headers.get("retry-after"));
            const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
              ? retryAfter * 1000
              : attempt * 2000;
            if (attempt < MAX_ATTEMPTS) {
              await sleep(Math.min(waitMs, 15_000));
              continue;
            }
            return null;
          }

          if (!res.ok) return null;

          const body = (await res.json()) as {
            choices?: { message?: { content?: string } }[];
          };
          const content = body.choices?.[0]?.message?.content;
          return content ? JSON.parse(stripCodeFence(content)) : null;
        } catch {
          if (attempt < MAX_ATTEMPTS) {
            await sleep(attempt * 2000);
            continue;
          }
          return null;
        }
      }
      return null;
    },
  };
}

/**
 * Smaller models often wrap JSON in a markdown fence despite being asked for
 * JSON only, and some ignore `response_format` entirely. Cheaper to unwrap
 * here than to lose the extraction to a parse error.
 */
function stripCodeFence(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return (fenced ? fenced[1]! : text).trim();
}
