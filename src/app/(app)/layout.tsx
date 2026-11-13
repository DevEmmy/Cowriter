import { redirect } from "next/navigation";
import Link from "next/link";
import { getUser } from "@/lib/auth";
import LogoutButton from "@/components/LogoutButton";
import NavLinks from "@/components/NavLinks";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/login");
  return (
    <div className="min-h-screen md:flex">
      <aside className="border-b border-lavender bg-white md:min-h-screen md:w-64 md:shrink-0 md:border-b-0 md:border-r">
        <div className="flex items-center justify-between px-5 py-4 md:block">
          <Link href="/dashboard" className="bg-gradient-to-r from-electric to-coral bg-clip-text text-xl font-bold tracking-tight text-transparent">Co Writer</Link>
          <div className="md:hidden"><LogoutButton /></div>
        </div>
        <NavLinks />
        <div className="hidden px-5 py-4 md:block">
          <p className="truncate text-sm text-ink/70">{user.name || user.email}</p>
          <LogoutButton />
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-5 py-8 md:px-10">{children}</main>
    </div>
  );
}
