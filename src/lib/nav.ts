import { BookMarked, FolderOpen, Home, Lightbulb, LineChart, Library, MessageCircle, Mic, Palette, PenLine, ScanSearch, Settings, ShieldCheck, Wrench, type LucideIcon } from "lucide-react";

export interface NavItem { label: string; href: string; icon: LucideIcon; match?: string }
export const NAV_GROUPS: Array<{ title: string; items: NavItem[] }> = [
  { title: "Write", items: [
    { label: "Dashboard", href: "/dashboard", icon: Home },
    { label: "My Projects", href: "/projects", icon: FolderOpen },
    { label: "Writing Studio", href: "/studio", icon: PenLine },
    { label: "Talk to Co Writer", href: "/studio?ai=1", icon: MessageCircle, match: "none" },
  ] },
  { title: "Create", items: [
    { label: "Idea Lab", href: "/ideas", icon: Lightbulb },
    { label: "Writing Tools", href: "/tools", icon: Wrench },
    { label: "Cover Studio", href: "/covers", icon: Palette },
    { label: "My Writing Voice", href: "/voice", icon: Mic },
  ] },
  { title: "Refine", items: [
    { label: "Story Bible", href: "/bible", icon: BookMarked },
    { label: "Story Guard", href: "/guard", icon: ShieldCheck },
    { label: "Chapter Analyser", href: "/analyser", icon: ScanSearch },
    { label: "Writing Analytics", href: "/analytics", icon: LineChart },
  ] },
  { title: "Keep", items: [
    { label: "My Library", href: "/library", icon: Library },
    { label: "Settings", href: "/settings", icon: Settings },
  ] },
];
