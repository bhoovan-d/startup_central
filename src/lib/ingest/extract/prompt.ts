import { eventTypeEnum, roundTypeEnum } from "@/db/schema";

import { toDateOnly } from "../normalize";
import type { ExtractInput } from "./index";

/**
 * The prompt shared by every model-backed extractor.
 *
 * Kept in one place so the Claude and OpenAI-compatible paths can't drift into
 * classifying things differently — the whole point of routing both through one
 * zod schema is that the output means the same thing regardless of provider.
 */

/** The seeded sector slugs. Kept in sync with `src/db/seed.ts` by hand. */
export const SECTOR_SLUGS = [
  "fintech",
  "consumer",
  "saas",
  "mobility",
  "healthtech",
  "edtech",
  "deeptech",
  "other",
] as const;

export const SYSTEM_PROMPT = `You extract structured facts from Indian startup news headlines. Reply with JSON only.

Fields:
- eventType: one of ${eventTypeEnum.enumValues.join(" | ")}
- companyName: the company the event happened TO, or null.
- roundType: one of ${roundTypeEnum.enumValues.join(" | ")}, or null if no stage is named.
- amountUsd: whole US dollars as an integer, or null.
- amountInr: whole rupees as an integer, or null.
- announcedDate: "YYYY-MM-DD", or null if the text does not state one.
- investors: [{ name, isLead }].
- isIndian: true if the company is headquartered in India, false if clearly elsewhere, null if you cannot tell.
- sector: one of ${SECTOR_SLUGS.join(" | ")}, or null.
- confidence: 0 to 1.

Rules that matter more than completeness:

1. Extract only what the text states. Never infer an amount, a date, or an
   investor that is not written down.
2. Never convert between currencies. "Rs 340 crore" sets amountInr and leaves
   amountUsd null. 1 crore = 10,000,000 rupees; 1 lakh = 100,000.
3. companyName is the company RECEIVING money, not the investor. In
   "Kae Capital leads Rs 8.5 Cr round in Lane", the company is Lane.
4. A VC firm raising or closing its own fund is NOT a startup funding round.
   "Accel raises $550 Mn India fund" is eventType "other", not "funding".
   So is a fund deploying capital across a portfolio.
5. An IPO filing, listing, oversubscription or block trade is not a private
   funding round. Neither is a regulatory licence, an earnings report, a
   revenue or loss figure, or a stake sale. All of those are "other".
6. A weekly roundup covering several companies has no single company: set
   companyName null and confidence low.
7. Prefer a low confidence over a confident guess. Below 0.85 the item goes to
   a human, which is cheap. A wrong row gets published, which is not.

Reply with a single JSON object and nothing else.`;

export function buildUserMessage(input: ExtractInput): string {
  return [
    `Source: ${input.sourceName}`,
    `Published: ${toDateOnly(input.publishedAt) ?? "unknown"}`,
    `Headline: ${input.title}`,
    input.excerpt ? `Excerpt: ${input.excerpt}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
