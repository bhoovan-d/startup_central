import assert from "node:assert/strict";
import { test } from "node:test";

import { parseFeed } from "./rss";

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Example Feed</title>
    <item>
      <title><![CDATA[Sarvam AI raises $41M Series B]]></title>
      <link>https://example.com/sarvam-series-b</link>
      <pubDate>Wed, 22 Jul 2026 09:15:00 +0530</pubDate>
      <description>&lt;p&gt;The round was led by Lightspeed.&lt;/p&gt;</description>
      <content:encoded><![CDATA[<p>FULL ARTICLE BODY THAT MUST NEVER BE STORED</p>]]></content:encoded>
    </item>
    <item>
      <title>Relative link item</title>
      <link>/not-absolute</link>
    </item>
    <item>
      <link>https://example.com/no-title</link>
    </item>
  </channel>
</rss>`;

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Krutrim shuts down consumer app</title>
    <link rel="replies" href="https://example.com/comments"/>
    <link href="https://example.com/krutrim-shutdown"/>
    <updated>2026-06-01T10:00:00Z</updated>
    <summary>A short summary.</summary>
  </entry>
</feed>`;

test("parseFeed reads RSS items", () => {
  const items = parseFeed(RSS);
  const first = items[0]!;

  assert.equal(first.title, "Sarvam AI raises $41M Series B");
  assert.equal(first.url, "https://example.com/sarvam-series-b");
  assert.equal(first.description, "The round was led by Lightspeed.");
  assert.equal(first.publishedAt?.toISOString(), "2026-07-22T03:45:00.000Z");
});

test("parseFeed never reads content:encoded", () => {
  // The copyright rule, asserted mechanically: the publisher's article body
  // must not appear anywhere in the parsed output.
  const serialized = JSON.stringify(parseFeed(RSS));
  assert.ok(!serialized.includes("FULL ARTICLE BODY"));
});

test("parseFeed skips items it cannot use", () => {
  const items = parseFeed(RSS);
  // Three <item>s, but one has a relative link and one has no title.
  assert.equal(items.length, 1);
});

test("parseFeed reads Atom entries and prefers the alternate link", () => {
  const items = parseFeed(ATOM);
  const entry = items[0]!;

  assert.equal(entry.title, "Krutrim shuts down consumer app");
  assert.equal(entry.url, "https://example.com/krutrim-shutdown");
  assert.equal(entry.description, "A short summary.");
});

test("parseFeed returns nothing for an HTML error page", () => {
  // A publisher serving a 404 HTML page parses to zero items rather than
  // throwing — the run reports it as a quiet source, not a crash.
  assert.deepEqual(parseFeed("<html><body>Not Found</body></html>"), []);
});
