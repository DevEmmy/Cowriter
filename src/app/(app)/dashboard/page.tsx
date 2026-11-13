import Link from "next/link";
import { getUser } from "@/lib/auth";
import { dashboardStats } from "@/lib/stats";
import NewProject from "@/components/NewProject";

export const dynamic = "force-dynamic";
const typeLabel = (t: string) => t.replace("_", " ");
const ago = (d: Date) => { const m = Math.round((Date.now() - d.getTime()) / 60000); return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };

export default async function Dashboard() {
  const user = (await getUser())!;
  const s = await dashboardStats(user.id);
  const pct = Math.min(100, Math.round((s.todayWords / user.dailyGoal) * 100));
  const max = Math.max(1, ...s.week.map((d) => d.words));
  const last = s.activity[0];
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Welcome back{user.name ? `, ${user.name.split(" ")[0]}` : ""}</h1>
          <p className="mt-1 text-muted">Your ideas. Your voice. A better story.</p>
        </div>
        <NewProject />
      </header>

      {last && (
        <Link href={`/studio/${last.projectId}?chapter=${last.id}`} className="block rounded-3xl bg-gradient-to-r from-deep to-electric p-6 text-white shadow-lg transition hover:brightness-110">
          <p className="text-sm text-white/70">Continue writing</p>
          <p className="mt-1 text-xl font-semibold">{last.title}</p>
          <p className="mt-1 text-sm text-white/70">{last.words.toLocaleString()} words · edited {ago(last.at)}</p>
        </Link>
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Your numbers">
        {[["Projects", s.projectCount], ["Words written", s.totalWords.toLocaleString()], ["Writing streak", `${s.streak} day${s.streak === 1 ? "" : "s"}`], ["Chapters", s.totalChapters]].map(([l, v]) => (
          <div key={l as string} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-lavender">
            <p className="text-sm text-muted">{l}</p><p className="mt-1 text-2xl font-bold">{v}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-lavender">
          <h2 className="font-semibold">Today&apos;s goal</h2>
          <p className="mt-1 text-sm text-muted">{s.todayWords.toLocaleString()} of {user.dailyGoal.toLocaleString()} words</p>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-lavender" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Daily writing progress">
            <div className="h-full rounded-full bg-gradient-to-r from-electric to-coral" style={{ width: `${pct}%` }} />
          </div>
          <Link href="/settings" className="mt-3 inline-block text-sm text-electric hover:underline">Change goal</Link>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-lavender">
          <h2 className="font-semibold">Last 7 days</h2>
          <div className="mt-4 flex h-24 items-end gap-2">
            {s.week.map((d) => (
              <div key={d.day} className="flex flex-1 flex-col items-center gap-1" title={`${d.words} words`}>
                <div className="w-full rounded-t-md bg-gradient-to-t from-electric to-peach" style={{ height: `${Math.max(4, (d.words / max) * 80)}px`, opacity: d.words ? 1 : 0.25 }} />
                <span className="text-[11px] text-muted">{d.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Recent projects</h2><Link href="/projects" className="text-sm text-electric hover:underline">All projects</Link></div>
        {s.recent.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-electric/30 bg-white p-10 text-center text-muted">No projects yet. Start with a novel, a short story or a blank page.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {s.recent.map((p) => (
              <li key={p.id}><Link href={`/studio/${p.id}`} className="block rounded-2xl bg-white p-5 shadow-sm ring-1 ring-lavender transition hover:ring-electric">
                <p className="font-semibold">{p.favorite ? "★ " : ""}{p.title}</p>
                <p className="mt-1 text-sm capitalize text-muted">{typeLabel(p.type)} · {ago(p.updatedAt)}</p>
              </Link></li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
