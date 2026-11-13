"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Home, FolderOpen, PenLine, Lightbulb, Menu, X } from "lucide-react";
import { NAV_GROUPS, type NavItem } from "@/lib/nav";
import LogoutButton from "@/components/LogoutButton";

const isActive = (path: string, it: NavItem) => it.match !== "none" && (path === it.href || path.startsWith(it.href + "/"));

/** Desktop: grouped sidebar. Mobile: bottom tab bar in the thumb zone + a "More" sheet. */
export function Sidebar() {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="hidden flex-1 overflow-y-auto px-3 pb-3 md:block">
      {NAV_GROUPS.map((g) => (
        <div key={g.title} className="mt-4 first:mt-0">
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">{g.title}</p>
          <ul>{g.items.map((it) => {
            const on = isActive(path, it);
            return <li key={it.label}><Link href={it.href} aria-current={on ? "page" : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm ${on ? "bg-lavender font-semibold text-electric-dark" : "text-ink hover:bg-lavender/60"}`}>
              <it.icon size={18} aria-hidden /> {it.label}</Link></li>;
          })}</ul>
        </div>
      ))}
    </nav>
  );
}

export function BottomNav({ name }: { name: string }) {
  const path = usePathname();
  const [more, setMore] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { setMore(false); }, [path]);
  useEffect(() => {
    if (!more) return;
    closeRef.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMore(false);
    document.addEventListener("keydown", esc); return () => document.removeEventListener("keydown", esc);
  }, [more]);
  const tabs: Array<[string, string, typeof Home]> = [["Home", "/dashboard", Home], ["Projects", "/projects", FolderOpen], ["Write", "/studio", PenLine], ["Ideas", "/ideas", Lightbulb]];
  return (
    <>
      <nav aria-label="Main" className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 backdrop-blur md:hidden">
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {tabs.map(([label, href, Icon]) => {
            const on = path === href || path.startsWith(href + "/");
            const primary = label === "Write";
            return <li key={label}><Link href={href} aria-current={on ? "page" : undefined} className={`flex min-h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${on ? "text-electric-dark" : "text-muted"}`}>
              <span className={`grid place-items-center rounded-full ${primary ? "-mt-5 h-12 w-12 bg-electric text-white shadow-lg" : "h-7 w-7"} ${on && !primary ? "bg-lavender" : ""}`}><Icon size={primary ? 22 : 20} aria-hidden /></span>{label}</Link></li>;
          })}
          <li><button onClick={() => setMore(true)} aria-haspopup="dialog" className="flex min-h-16 w-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted"><span className="grid h-7 w-7 place-items-center"><Menu size={20} aria-hidden /></span>More</button></li>
        </ul>
      </nav>
      {more && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="All sections">
          <button aria-label="Close menu" className="absolute inset-0 bg-deep/50" onClick={() => setMore(false)} tabIndex={-1} />
          <div className="pb-safe absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white p-4 shadow-2xl">
            <div className="mb-2 flex items-center justify-between"><p className="truncate font-semibold">{name}</p>
              <button ref={closeRef} onClick={() => setMore(false)} aria-label="Close" className="grid h-11 w-11 place-items-center rounded-full bg-lavender"><X size={20} aria-hidden /></button></div>
            {NAV_GROUPS.map((g) => (
              <div key={g.title} className="mt-3"><p className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">{g.title}</p>
                <ul className="grid grid-cols-2 gap-2">{g.items.map((it) => (
                  <li key={it.label}><Link href={it.href} onClick={() => setMore(false)} className="flex min-h-12 items-center gap-2 rounded-xl bg-cream px-3 text-sm font-medium"><it.icon size={18} className="text-electric" aria-hidden />{it.label}</Link></li>))}</ul></div>))}
            <div className="mt-4 border-t border-line pt-3"><LogoutButton /></div>
          </div>
        </div>
      )}
    </>
  );
}
