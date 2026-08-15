/**
 * The `h2` + right-aligned eyebrow pairing used above every block on the site.
 * `tone` exists for the Graveyard, which is vermillion — a section identity,
 * not a status, so it is set explicitly rather than derived from the data.
 */
export function SectionHeading({
  title,
  aside,
  tone,
  as: Tag = "h2",
}: {
  title: string;
  aside?: string | null;
  tone?: "vermillion";
  as?: "h1" | "h2" | "h3";
}) {
  return (
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
      <Tag
        className="display text-3xl"
        style={tone === "vermillion" ? { color: "var(--color-vermillion)" } : undefined}
      >
        {title}
      </Tag>
      {aside ? <span className="eyebrow">{aside}</span> : null}
    </div>
  );
}
