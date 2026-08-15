import { SiteHeader } from "@/components/site-header";

/**
 * Section layouts exist so the masthead knows which nav item to light without
 * `usePathname()` — that would turn the whole header into a Client Component
 * to render one border. `/startups/[slug]` inherits this, so detail pages get
 * the right nav state for free.
 */
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader active="startups" />
      <main className="flex-1">{children}</main>
    </>
  );
}
