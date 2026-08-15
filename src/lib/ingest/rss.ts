import { parseFeedDate, stripHtml } from "./normalize";

/**
 * A deliberately small RSS/Atom reader.
 *
 * Four fields are needed — title, link, date, description — from
 * machine-generated XML, and a malformed entry should be skipped rather than
 * abort the run. That is a much smaller problem than general XML parsing, so
 * it is solved here instead of by a dependency. If a real feed ever defeats
 * this, reach for `fast-xml-parser` rather than growing the regexes.
 *
 * One rule is not negotiable: `<content:encoded>` is never read. That element
 * carries the publisher's full article body. We store facts and a short
 * attributed excerpt — see `EXCERPT_MAX` in `./persist.ts` — and the article
 * text is theirs.
 */

export type FeedItem = {
  title: string;
  url: string;
  publishedAt: Date | null;
  /** Cleaned plain text from <description>/<summary>. Not yet truncated. */
  description: string;
};

/** Unwraps CDATA and decodes the entities feeds actually use. */
function decode(raw: string): string {
  const cdata = raw.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  return stripHtml(cdata ? cdata[1]! : raw);
}

/** First non-empty match for any of the given tag names. */
function tag(block: string, ...names: string[]): string | null {
  for (const name of names) {
    const m = block.match(
      new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"),
    );
    const value = m ? decode(m[1]!) : "";
    if (value) return value;
  }
  return null;
}

/**
 * Atom puts the URL in an attribute (`<link href="…"/>`); RSS puts it in the
 * element body. Atom feeds also carry `rel="replies"` and similar, so an
 * explicit rel other than "alternate" is skipped.
 */
function link(block: string): string | null {
  const atom = [...block.matchAll(/<link\b([^>]*)\/?>/gi)];
  for (const [, attrs] of atom) {
    if (!attrs) continue;
    const rel = attrs.match(/\brel\s*=\s*["']([^"']+)["']/i)?.[1];
    if (rel && rel.toLowerCase() !== "alternate") continue;
    const href = attrs.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
    if (href) return href.trim();
  }

  const rss = tag(block, "link");
  return rss ?? null;
}

export function parseFeed(xml: string): FeedItem[] {
  // <item> is RSS, <entry> is Atom.
  const blocks = [
    ...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi),
    ...xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi),
  ].map((m) => m[0]);

  const items: FeedItem[] = [];

  for (const block of blocks) {
    const title = tag(block, "title");
    const url = link(block);
    if (!title || !url) continue;

    // NOTE: "content:encoded" and "content" are intentionally absent from this
    // list. See the note at the top of this file.
    const description = tag(block, "description", "summary") ?? "";

    let absolute: string;
    try {
      absolute = new URL(url).toString();
    } catch {
      continue; // A relative or malformed link is not something to guess at.
    }

    items.push({
      title,
      url: absolute,
      publishedAt: parseFeedDate(
        tag(block, "pubDate", "published", "updated", "dc:date"),
      ),
      description,
    });
  }

  return items;
}

export class FeedFetchError extends Error {
  constructor(
    readonly source: string,
    message: string,
  ) {
    super(message);
    this.name = "FeedFetchError";
  }
}

/**
 * Fetches one feed.
 *
 * Only ever hits the publisher's feed endpoint — never an article page. A
 * descriptive User-Agent so we are identifiable in their logs, and a hard
 * timeout so one unresponsive host can't hold the whole run open.
 */
export async function fetchFeed(
  url: string,
  sourceName: string,
  timeoutMs = 10_000,
): Promise<FeedItem[]> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      "user-agent":
        "StartupCentralBot/1.0 (+https://startupcentral.in/about; feed reader)",
      accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
    },
  });

  if (res.status === 429) {
    const retryAfter = res.headers.get("retry-after");
    throw new FeedFetchError(
      sourceName,
      `rate limited${retryAfter ? `, retry after ${retryAfter}s` : ""}`,
    );
  }
  if (!res.ok) {
    throw new FeedFetchError(sourceName, `HTTP ${res.status}`);
  }

  return parseFeed(await res.text());
}
