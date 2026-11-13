import Link from "next/link";
import { getUser } from "@/lib/auth";
import { analyticsFor } from "@/lib/stats";
import Empty from "@/components/Empty";

export const dynamic = "force-dynamic";

export default async function Analytics() {
  const u = (await getUser())!;
  const a = await analyticsFor(u.id, u.dailyGoal);
  const max = Math.max(1, ...a.days.map((d) => d.words)), maxP = Math.max(1, ...a.perProject.map((p) => p.words));
  const cards: Array<[string, string]> = [["Words (30 days)", a.total30.toLocaleString()], ["Active days", `${a.activeDays} of 30`], ["Average on a writing day", a.avgPerActiveDay.toLocaleString()], ["Days you hit your goal", `${a.goalDays}`], ["Current streak", `${a.streak} day${a.streak === 1 ? "" : "s"}`], ["Longest streak (year)", `${a.longestStreak} day${a.longestStreak === 1 ? "" : "s"}`], ["Best day", a.best.words ? `${a.best.words.toLocaleString()} (${a.best.label})` : "None yet"], ["All-time words", a.totalWords.toLocaleString()]];
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header><h1 className="text-2xl font-bold">Writing Analytics</h1><p className="mt-1 text-muted">Your writing habit over the last 30 days. Counts only increase when you add words, so editing and deleting never lowers your totals.</p></header>
      {a.totalWords === 0 && a.total30 === 0 ? <Empty title="No writing recorded yet" hint="Write in the studio and your numbers will appear here." href="/studio" cta="Start writing" /> : (<>
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Summary">{cards.map(([l, v]) => <div key={l} className="card !p-4"><p className="text-xs text-muted">{l}</p><p className="mt-1 text-xl font-bold">{v}</p></div>)}</section>
        <section className="card" aria-label="Words per day">
          <h2 className="font-semibold">Words per day</h2>
          <div role="img" aria-label={`Bar chart of words written each day over 30 days. Best day ${a.best.words} words.`} className="mt-4 flex h-40 items-end gap-1">
            {a.days.map((d) => <div key={d.day} title={`${d.label}: ${d.words} words`} className="min-w-[4px] flex-1 rounded-t bg-gradient-to-t from-electric to-peach" style={{ height: `${Math.max(3, (d.words / max) * 100)}%`, opacity: d.words ? 1 : 0.25 }} />)}
          </div>
          <div className="mt-1 flex justify-between text-xs text-muted"><span>{a.days[0].label}</span><span>{a.days[29].label}</span></div>
          <details className="mt-3"><summary className="cursor-pointer text-sm font-medium text-electric-dark">View as a table</summary>
            <table className="mt-2 w-full text-left text-sm"><thead><tr><th className="py-1">Day</th><th>Words</th></tr></thead><tbody>{a.days.filter((d) => d.words).map((d) => <tr key={d.day} className="border-t border-line"><td className="py-1">{d.label}</td><td>{d.words.toLocaleString()}</td></tr>)}</tbody></table></details>
        </section>
        <section className="card" aria-label="Words per project">
          <h2 className="font-semibold">By project</h2>
          <ul className="mt-3 space-y-3">{a.perProject.map((p) => (
            <li key={p.id}><div className="flex items-baseline justify-between gap-3"><Link href={`/studio/${p.id}`} className="min-w-0 truncate font-medium hover:underline">{p.title}</Link><span className="shrink-0 text-sm text-muted">{p.words.toLocaleString()} words · {p.chapters} chapter{p.chapters === 1 ? "" : "s"}</span></div>
              <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-lavender"><div className="h-full rounded-full bg-electric" style={{ width: `${(p.words / maxP) * 100}%` }} /></div></li>))}</ul>
        </section></>)}
    </div>
  );
}
