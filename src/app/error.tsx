"use client";

/**
 * The site's error boundary.
 *
 * This is the one Client Component in the app, and only because Next requires
 * `error.tsx` to be one — it needs the `reset` callback wired to a button.
 *
 * It exists so a database outage reads as an outage. The tempting alternative
 * — catching query errors and falling through to the empty state — would
 * render "0 companies tracked" when the truth is "we can't reach the record",
 * and those are not the same claim.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="shell py-20">
      <p className="eyebrow mb-5" style={{ color: "var(--color-vermillion)" }}>
        Something broke
      </p>
      <h1 className="display text-[clamp(2rem,6vw,4rem)] leading-[1.05]">
        <span className="mark-block">Couldn&apos;t load this.</span>
      </h1>
      <p className="mt-6 max-w-lg text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        This is a failure to read the record, not an empty record — so nothing
        is shown rather than zeros.
      </p>
      {error.digest ? (
        <p className="num mt-4 text-xs" style={{ color: "var(--text-muted)" }}>
          Ref {error.digest}
        </p>
      ) : null}
      <div className="mt-7">
        <button type="button" className="link-block link-block--primary" onClick={reset}>
          Try again
        </button>
      </div>
    </div>
  );
}
