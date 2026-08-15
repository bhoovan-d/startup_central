/**
 * The search box.
 *
 * A plain GET form: submitting navigates to `/search?q=…` with no JavaScript
 * and no client component. This is the one place on the site where reaching
 * for `"use client"` would be the reflex — debounced type-ahead needs a
 * `useRouter`. If that is ever wanted, this file is the single leaf that
 * becomes a Client Component, and the boundary must not climb into the
 * masthead that renders it.
 */
export function SearchForm({ defaultValue }: { defaultValue?: string }) {
  return (
    <form action="/search" method="get" role="search" className="flex items-center gap-2">
      <label className="sr-only" htmlFor="site-search">
        Search companies
      </label>
      <input
        id="site-search"
        name="q"
        type="search"
        defaultValue={defaultValue}
        placeholder="Search companies"
        maxLength={120}
        autoComplete="off"
        className="num rounded-xs border-2 bg-transparent px-2 py-1 text-xs"
        style={{ borderColor: "var(--rule)", color: "var(--text-primary)" }}
      />
      <button type="submit" className="link-block">
        Go
      </button>
    </form>
  );
}
