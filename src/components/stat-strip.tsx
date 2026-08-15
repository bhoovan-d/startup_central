export type Stat = {
  /** The label. Also the React key, so it must be unique within a strip. */
  k: string;
  /** The figure. Already formatted — this component never does arithmetic. */
  v: string;
  /** The qualifier under it. Null renders nothing rather than an empty line. */
  note?: string | null;
};

/**
 * The four-up figure strip under a hero.
 *
 * The border logic is the fiddly part and the reason this is a component at
 * all — it was duplicated verbatim between the homepage and the podcast page.
 */
export function StatStrip({ items }: { items: Stat[] }) {
  return (
    <section className="border-b-[3px]">
      <dl className="shell grid grid-cols-2 md:grid-cols-4">
        {items.map((s, i) => (
          <div
            key={s.k}
            className={[
              "py-7",
              // Cells in the left column hug the gutter, so their labels line
              // up with the hero headline. Others sit inset past their rule.
              i % 2 === 0 ? "pr-5" : "border-l-[3px] pl-5 pr-5",
              // At 4-up, everything except the first cell gains a rule.
              i > 0 ? "md:border-l-[3px] md:pl-5" : "",
              i < 2 ? "border-b-[3px] md:border-b-0" : "",
            ].join(" ")}
          >
            <dt className="eyebrow mb-2.5">{s.k}</dt>
            <dd className="num text-4xl font-bold leading-none tracking-tight">
              {s.v}
            </dd>
            {s.note ? (
              <dd
                className="num mt-2 text-[0.6875rem]"
                style={{ color: "var(--text-muted)" }}
              >
                {s.note}
              </dd>
            ) : null}
          </div>
        ))}
      </dl>
    </section>
  );
}
