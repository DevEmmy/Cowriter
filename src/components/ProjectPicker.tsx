"use client";
import { useRouter, usePathname } from "next/navigation";

export default function ProjectPicker({ projects, value, extra }: { projects: Array<{ id: string; title: string }>; value: string; extra?: React.ReactNode }) {
  const router = useRouter(), path = usePathname();
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="block min-w-0 flex-1 text-sm font-medium sm:max-w-xs">Project
        <select value={value} onChange={(e) => router.replace(`${path}?project=${e.target.value}`)} className="field mt-1">
          {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
      </label>
      {extra}
    </div>
  );
}
