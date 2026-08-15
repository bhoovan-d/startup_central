import type { ExtractedEvent } from "../schema";

export type ExtractInput = {
  title: string;
  /** The short attribution excerpt — never a full article body. */
  excerpt: string;
  url: string;
  sourceName: string;
  publishedAt: Date | null;
};

export type ExtractorName = "regex" | "claude" | "generic";

export type Extractor = {
  name: ExtractorName;
  /**
   * Returns raw, unvalidated output. Every implementation's result is parsed
   * through `ExtractedEvent` in `../index.ts` before it can reach the
   * database — that boundary is what makes a hallucinated field or a stray
   * regex capture land in the review queue instead of the ledger.
   */
  extract(input: ExtractInput): Promise<unknown>;
};

/**
 * Picks the extractor from `EXTRACTOR`, defaulting to `regex`.
 *
 * Falls back to regex whenever the chosen provider's credentials are missing,
 * rather than throwing. A misconfigured key should degrade the extraction
 * quality of a scheduled job, not take the whole ingest run down — and the
 * regex path needs no credentials at all, so there is always something to
 * fall back to.
 */
export async function getExtractor(): Promise<Extractor> {
  const choice = (process.env.EXTRACTOR ?? "regex").trim().toLowerCase();

  if (choice === "claude" && process.env.ANTHROPIC_API_KEY) {
    const { createClaudeExtractor } = await import("./claude");
    return createClaudeExtractor();
  }

  if (
    choice === "generic" &&
    process.env.GENERIC_LLM_BASE_URL &&
    process.env.GENERIC_LLM_MODEL
  ) {
    const { createGenericExtractor } = await import("./generic");
    return createGenericExtractor();
  }

  const { createRegexExtractor } = await import("./regex");
  return createRegexExtractor();
}

export type { ExtractedEvent };
