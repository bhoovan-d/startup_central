import { SiteHeader } from "@/components/site-header";

/** Search has no nav item of its own, so no section is marked active. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">{children}</main>
    </>
  );
}
