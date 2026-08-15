import { chartVar } from "@/lib/chart-palette";

/**
 * Where a fact came from, and how much to trust it.
 *
 * This is what replaced the global "design proof · illustrative sample data"
 * banner. A blanket disclaimer told you nothing about any particular row; the
 * schema already carries the real answer per row — `startups.verified` and
 * `funding_rounds.auto_published` — and this surfaces it.
 */
export function SourceLink({
  url,
  name,
}: {
  url: string | null | undefined;
  name?: string | null;
}) {
  if (!url) return null;
  return (
    <a
      className="tag"
      href={url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      style={{ color: "var(--text-muted)" }}
    >
      {name ?? "Source"} ↗
    </a>
  );
}

/** Shown until a human has confirmed the record. */
export function UnverifiedTag({ verified }: { verified: boolean }) {
  if (verified) return null;
  return (
    <span className="tag" style={{ color: "var(--color-warning)" }}>
      Unverified
    </span>
  );
}

/** Shown on rows ingestion wrote with no human in the loop. */
export function AutoPublishedTag({ autoPublished }: { autoPublished: boolean }) {
  if (!autoPublished) return null;
  return (
    <span className="tag" style={{ color: "var(--text-muted)" }}>
      Auto-extracted
    </span>
  );
}

/**
 * A sector pill in its own colour.
 *
 * `colorSlot` null means untagged, and untagged is drawn in muted ink — never
 * slot 0, which would silently claim the company is GenAI.
 */
export function TagPill({
  label,
  colorSlot,
}: {
  label: string;
  colorSlot: number | null;
}) {
  return (
    <span
      className="tag"
      style={{ color: colorSlot === null ? "var(--text-muted)" : chartVar(colorSlot) }}
    >
      {label}
    </span>
  );
}

export function TagPills({
  tags,
}: {
  tags: { slug: string; label: string; colorSlot: number | null }[];
}) {
  if (tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((t) => (
        <TagPill key={t.slug} label={t.label} colorSlot={t.colorSlot} />
      ))}
    </div>
  );
}
