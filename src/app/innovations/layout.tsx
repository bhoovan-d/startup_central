import { SiteHeader } from "@/components/site-header";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader active="innovations" />
      <main className="flex-1">{children}</main>
    </>
  );
}
