import { redirect } from "next/navigation";
import Link from "next/link";
import { getUser } from "@/lib/auth";
import LogoutButton from "@/components/LogoutButton";
import { Sidebar, BottomNav } from "@/components/NavLinks";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/login");
  const name = user.name || user.email;
  return (
    <div className="min-h-screen md:flex">
      <a href="#main" className="skip-link">Skip to content</a>
      <aside className="hidden border-r border-line bg-white md:sticky md:top-0 md:flex md:h-screen md:w-64 md:shrink-0 md:flex-col">
        <div className="px-5 py-5"><Link href="/dashboard" className="bg-gradient-to-r from-electric to-coral bg-clip-text text-xl font-bold tracking-tight text-transparent">Co Writer</Link></div>
        <Sidebar />
        <div className="border-t border-line px-5 py-4"><p className="truncate text-sm text-muted">{name}</p><LogoutButton /></div>
      </aside>
      <header className="flex items-center justify-between border-b border-line bg-white px-5 py-3 md:hidden">
        <Link href="/dashboard" className="bg-gradient-to-r from-electric to-coral bg-clip-text text-lg font-bold text-transparent">Co Writer</Link>
      </header>
      <main id="main" className="min-w-0 flex-1 px-4 pb-28 pt-6 md:px-10 md:pb-10 md:pt-8">{children}</main>
      <BottomNav name={name} />
    </div>
  );
}
