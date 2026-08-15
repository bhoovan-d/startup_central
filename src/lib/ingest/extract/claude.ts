import Anthropic from "@anthropic-ai/sdk";

import { eventTypeEnum, roundTypeEnum } from "@/db/schema";

import { toDateOnly } from "../normalize";
import type { ExtractInput, Extractor } from "./index";

/**
 * The Claude extractor. Optional — `EXTRACTOR=claude` plus an API key.
 *
 * It is sent the headline, the short excerpt, and the publication name, and
 * nothing else. It is never given an article body: we don't fetch one, and
 * storing one would break the promise in the site footer.
 */

/**
 * The JSON Schema the API constrains the response to.
 *
 * Deliberately separate from the zod schema in `../schema.ts`, which does the
 * validating. The structured-outputs dialect rejects `minLength`, `maximum`,
 * and friends, so the bounds live in zod and only the *shape* lives here.
 * Every property is listed in `required` and `additionalProperties` is false,
 * as strict schemas demand; optionality is expressed as a nullable type.
 */
const SCHEMA = {
  type: "object",
  properties: {
    eventType: { type: "string", enum: [...eventTypeEnum.enumValues] },
    companyName: {
      type: "string",
      description: "The company the event is about, exactly as the headline writes it.",
    },
    roundType: {
      type: ["string", "null"],
      enum: [...roundTypeEnum.enumValues, null],
      description: "Null unless the article names a stage.",
    },
    amountUsd: {
      type: ["integer", "null"],
      description:
        "Whole US dollars. 41000000 for '$41 million'. Null if the figure was reported in rupees or not disclosed.",
    },
    amountInr: {
      type: ["integer", "null"],
      description:
        "Whole rupees. 3400000000 for '340 crore'. Never convert from USD — report only what the source stated in rupees.",
    },
    announcedDate: {
      type: ["string", "null"],
      description: "YYYY-MM-DD, only if the article states it. Null otherwise.",
    },
    investors: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          isLead: { type: "boolean" },
        },
        required: ["name", "isLead"],
        additionalProperties: false,
      },
    },
    confidence: {
      type: "number",
      description:
        "0 to 1. How confident you are that every field above is correct. Be strict: below 0.85 sends this to human review, which is the right outcome when anything is uncertain.",
    },
  },
  required: [
    "eventType",
    "companyName",
    "roundType",
    "amountUsd",
    "amountInr",
    "announcedDate",
    "investors",
    "confidence",
  ],
  additionalProperties: false,
} as const;

const SYSTEM = `You extract structured facts from Indian startup news headlines.

Rules:
- Extract only what the text states. Never infer a figure, a date, or an investor that is not written down.
- Never convert between currencies. If the source says "340 crore", set amountInr and leave amountUsd null.
- If the text is not about a funding round, shutdown, launch or acquisition, use eventType "other" and a low confidence.
- Prefer a low confidence over a confident guess. Uncertain rows go to a human, which is cheap; wrong rows get published, which is not.`;

export function createClaudeExtractor(): Extractor {
  const client = new Anthropic();
  const model = process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5";

  return {
    name: "claude",
    async extract(input: ExtractInput) {
      const message = [
        `Source: ${input.sourceName}`,
        `Published: ${toDateOnly(input.publishedAt) ?? "unknown"}`,
        `Headline: ${input.title}`,
        input.excerpt ? `Excerpt: ${input.excerpt}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      try {
        const response = await client.messages.create({
          model,
          // Small on purpose: the output is one flat JSON object, and a
          // structured extraction has a known, tiny ceiling. This is the
          // documented exception to sizing max_tokens generously.
          max_tokens: 1024,
          // Accepted on Haiku 4.5. Note there is deliberately no
          // `output_config.effort` here — that parameter errors on this model.
          temperature: 0,
          system: SYSTEM,
          output_config: {
            format: { type: "json_schema", schema: SCHEMA },
          },
          messages: [{ role: "user", content: message }],
        });

        const block = response.content.find((b) => b.type === "text");
        return block ? JSON.parse(block.text) : null;
      } catch (err) {
        // A provider outage must not fail the run. Returning null lets the
        // caller fall through to the regex extractor for this item.
        if (err instanceof Anthropic.RateLimitError) {
          console.warn("[ingest] Claude rate limited; falling back to regex");
        } else if (err instanceof Anthropic.APIError) {
          console.warn(`[ingest] Claude API error ${err.status}; falling back to regex`);
        } else {
          console.warn("[ingest] Claude extraction failed:", err);
        }
        return null;
      }
    },
  };
}
