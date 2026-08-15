import Link from "next/link";

import { SiteHeader } from "@/components/site-header";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <div className="shell py-20">
          <p className="eyebrow mb-5">404</p>
          <h1 className="display text-[clamp(2rem,6vw,4rem)] leading-[1.05]">
            <span className="mark-block">Not here.</span>
          </h1>
          <p className="mt-6 max-w-lg text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            The record you asked for doesn&apos;t exist — either it was never
            added, or the address is wrong.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link className="link-block link-block--primary" href="/">
              Home
            </Link>
            <Link className="link-block" href="/startups">
              Browse companies
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
