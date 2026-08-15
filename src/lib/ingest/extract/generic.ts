import { toDateOnly } from "../normalize";
import type { ExtractInput, Extractor } from "./index";

/**
 * Any OpenAI-compatible endpoint, for self-hosted or third-party models.
 *
 * Plain `fetch` rather than a client library — the surface used here is one
 * POST with `response_format: json_object`, which is not worth a dependency.
 * Output is validated by the same zod schema as every other extractor.
 */

const SYSTEM = `Extract structured facts from an Indian startup news headline. Reply with JSON only.

{
  "eventType": "funding" | "shutdown" | "launch" | "acquisition" | "other",
  "companyName": string,
  "roundType": string | null,
  "amountUsd": integer | null,
  "amountInr": integer | null,
  "announcedDate": "YYYY-MM-DD" | null,
  "investors": [{ "name": string, "isLead": boolean }],
  "confidence": number between 0 and 1
}

Extract only what the text states. Never convert between currencies — if the source says rupees, fill amountInr and leave amountUsd null. Prefer a low confidence over a confident guess.`;

export function createGenericExtractor(): Extractor {
  const baseUrl = process.env.GENERIC_LLM_BASE_URL!.replace(/\/+$/, "");
  const model = process.env.GENERIC_LLM_MODEL!;
  const apiKey = process.env.GENERIC_LLM_API_KEY;

  return {
    name: "generic",
    async extract(input: ExtractInput) {
      const user = [
        `Source: ${input.sourceName}`,
        `Published: ${toDateOnly(input.publishedAt) ?? "unknown"}`,
        `Headline: ${input.title}`,
        input.excerpt ? `Excerpt: ${input.excerpt}` : "",
      ]
        .filter(Boolean)
        .join("\n");

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
            max_tokens: 1024,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: SYSTEM },
              { role: "user", content: user },
            ],
          }),
        });

        if (!res.ok) {
          console.warn(`[ingest] generic extractor HTTP ${res.status}; falling back to regex`);
          return null;
        }

        const body = (await res.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        const content = body.choices?.[0]?.message?.content;
        return content ? JSON.parse(content) : null;
      } catch (err) {
        console.warn("[ingest] generic extraction failed:", err);
        return null;
      }
    },
  };
}
