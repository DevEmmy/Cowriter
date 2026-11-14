"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Msg = { ok: boolean; text: string } | null;
export default function AccountSecurity() {
  const router = useRouter();
  const [pw, setPw] = useState<Msg>(null); const [del, setDel] = useState<Msg>(null);
  const [busy, setBusy] = useState(false); const [confirming, setConfirming] = useState(false);

  async function changePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget; const f = new FormData(form); setPw(null);
    if (f.get("next") !== f.get("again")) { setPw({ ok: false, text: "The two new passwords do not match." }); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/me/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ current: f.get("current"), next: f.get("next") }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { setPw({ ok: true, text: "Password changed. Other devices have been signed out." }); form.reset(); } else setPw({ ok: false, text: d.error ?? "Could not change the password." });
    } catch { setPw({ ok: false, text: "Could not reach the server." }); }
    setBusy(false);
  }
  async function deleteAccount(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget); setDel(null); setBusy(true);
    try {
      const r = await fetch("/api/me", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: f.get("password") }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { router.push("/"); router.refresh(); return; }
      setDel({ ok: false, text: d.error ?? "Could not delete the account." });
    } catch { setDel({ ok: false, text: "Could not reach the server." }); }
    setBusy(false);
  }
  return (
    <>
      <form onSubmit={changePassword} className="card mt-6 space-y-4">
        <h2 className="text-lg font-semibold">Change password</h2>
        <label className="block text-sm font-medium">Current password<input name="current" type="password" required autoComplete="current-password" className="field mt-1 w-full" /></label>
        <label className="block text-sm font-medium">New password (8+ characters)<input name="next" type="password" required minLength={8} autoComplete="new-password" className="field mt-1 w-full" /></label>
        <label className="block text-sm font-medium">New password again<input name="again" type="password" required minLength={8} autoComplete="new-password" className="field mt-1 w-full" /></label>
        <div aria-live="polite">{pw && <p role={pw.ok ? "status" : "alert"} className={pw.ok ? "msg-ok" : "msg-err"}>{pw.text}</p>}</div>
        <button disabled={busy} className="btn btn-primary">Change password</button>
      </form>
      <section className="card mt-6 space-y-3 border-danger/40">
        <h2 className="text-lg font-semibold">Delete my account</h2>
        <p className="text-sm text-muted">This permanently erases your account and all your projects, chapters, notes and covers. It cannot be undone. Download your manuscripts from My Library first.</p>
        {!confirming ? <button type="button" onClick={() => setConfirming(true)} className="btn btn-danger">Delete my account…</button> : (
          <form onSubmit={deleteAccount} className="space-y-3">
            <label className="block text-sm font-medium">Type your password to confirm<input name="password" type="password" required autoComplete="current-password" className="field mt-1 w-full" /></label>
            <div aria-live="polite">{del && <p role="alert" className="msg-err">{del.text}</p>}</div>
            <div className="flex gap-3"><button disabled={busy} className="btn btn-danger">Yes, delete everything</button><button type="button" onClick={() => setConfirming(false)} className="btn btn-secondary">Keep my account</button></div>
          </form>)}
      </section>
    </>
  );
}
