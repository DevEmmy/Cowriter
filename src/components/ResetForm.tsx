"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
export default function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const [valid, setValid] = useState<boolean | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  useEffect(() => { fetch(`/api/auth/reset?token=${encodeURIComponent(token)}`).then((r) => r.json()).then((d) => setValid(!!d.valid)).catch(() => setValid(false)); }, [token]);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError("");
    const f = new FormData(e.currentTarget); const password = String(f.get("password"));
    if (password !== f.get("confirm")) { setError("The two passwords do not match."); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/auth/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error ?? "Something went wrong."); setBusy(false); return; }
      router.push("/dashboard"); router.refresh();
    } catch { setError("Could not reach the server. Check your connection."); setBusy(false); }
  }
  if (valid === null) return <p className="text-sm text-muted" role="status">Checking your link…</p>;
  if (!valid) return (<div className="space-y-4"><p role="alert" className="msg-err">This reset link has expired or was already used.</p><Link href="/forgot" className="btn btn-primary w-full">Get a new link</Link></div>);
  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block text-sm font-medium">New password (8+ characters)<input name="password" type="password" required minLength={8} autoComplete="new-password" className="field mt-1 w-full" /></label>
      <label className="block text-sm font-medium">Type it again<input name="confirm" type="password" required minLength={8} autoComplete="new-password" className="field mt-1 w-full" /></label>
      <div aria-live="polite">{error && <p role="alert" className="msg-err">{error}</p>}</div>
      <button disabled={busy} className="btn btn-primary w-full">{busy ? "Saving…" : "Save new password"}</button>
    </form>
  );
}
