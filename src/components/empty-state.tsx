/**
 * "There is nothing here yet."
 *
 * Borrows the treatment the podcast page already used for unrecorded
 * episodes: a dashed hairline rule and no offset block, so it reads as
 * *unbuilt* rather than merely differently coloured. Status is never carried
 * by colour alone.
 *
 * This is the honest counterpart to the sample data this site used to ship
 * with. An empty section says so; it does not fill itself with plausible rows.
 */
export function EmptyState({
  title,
  detail,
  children,
}: {
  title: string;
  detail?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className="border-2 border-dashed p-6 sm:p-8"
      style={{ borderColor: "var(--rule-hairline)" }}
    >
      <p className="display text-xl" style={{ color: "var(--text-secondary)" }}>
        {title}
      </p>
      {detail ? (
        <p
          className="mt-2 max-w-lg text-sm leading-relaxed"
          style={{ color: "var(--text-muted)" }}
        >
          {detail}
        </p>
      ) : null}
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}
