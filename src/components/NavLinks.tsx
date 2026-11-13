"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Only features that exist are links. The rest are listed so the roadmap is visible, but cannot be opened.
const items: Array<[string, string | null]> = [
  ["Dashboard", "/dashboard"], ["My Projects", "/projects"], ["Writing Studio", "/projects"],
  ["Talk to Co Writer", null], ["Idea Lab", null], ["Story Guard", null], ["Story Bible", null],
  ["Chapter Analyser", null], ["Cover Studio", null], ["My Writing Voice", null], ["Writing Tools", null],
  ["Writing Analytics", null], ["My Library", null], ["Settings", "/settings"],
];

export default function NavLinks() {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="flex gap-1 overflow-x-auto px-3 pb-3 md:block md:space-y-0.5 md:overflow-visible">
      {items.map(([label, href], i) => {
        const active = href && (path === href || (href === "/projects" && i === 1 && path.startsWith("/projects")));
        const base = "flex shrink-0 items-center justify-between rounded-xl px-3 py-2 text-sm whitespace-nowrap";
        return href ? (
          <Link key={label} href={href} aria-current={active ? "page" : undefined} className={`${base} ${active ? "bg-lavender font-semibold text-electric" : "text-ink/80 hover:bg-lavender/60"}`}>{label}</Link>
        ) : (
          <span key={label} aria-disabled="true" className={`${base} cursor-not-allowed text-ink/35`}>{label}<span className="ml-2 rounded-full bg-lavender px-2 py-0.5 text-[10px] font-medium text-electric/70">Soon</span></span>
        );
      })}
    </nav>
  );
}
