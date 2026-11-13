"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SettingsForm({ name, dailyGoal, email }: { name: string; dailyGoal: number; email: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const r = await fetch("/api/me", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: f.get("name"), dailyGoal: Number(f.get("goal")) }) });
    const d = await r.json().catch(() => ({}));
    setMsg(r.ok ? { ok: true, text: "Saved." } : { ok: false, text: d.error ?? "Could not save." });
    if (r.ok) router.refresh();
  }
  const input = "mt-1 w-full rounded-xl border border-lavender bg-white px-3.5 py-2.5 outline-none focus:border-electric";
  return (
    <form onSubmit={save} className="mt-6 space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-lavender">
      <p className="text-sm text-muted">Signed in as {email}</p>
      <label className="block text-sm font-medium">Name<input name="name" defaultValue={name} maxLength={80} className={input} /></label>
      <label className="block text-sm font-medium">Daily word goal<input name="goal" type="number" min={50} max={50000} defaultValue={dailyGoal} className={input} /></label>
      {msg && <p role="status" className={`text-sm ${msg.ok ? "text-green-700" : "text-red-700"}`}>{msg.text}</p>}
      <button className="rounded-xl bg-electric px-5 py-2 text-sm font-semibold text-white hover:bg-electric-dark">Save changes</button>
    </form>
  );
}
