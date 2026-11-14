"use client";
import { useState } from "react";
import Link from "next/link";
export default function ForgotForm() {
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(""); const [error, setError] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError(""); setMsg("");
    const email = String(new FormData(e.currentTarget).get("email"));
    try {
      const r = await fetch("/api/auth/forgot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setError(d.error ?? "Something went wrong. Please try again."); else setMsg(d.message);
    } catch { setError("Could not reach the server. Check your connection."); }
    setBusy(false);
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-muted">Enter the email you signed up with and we will send you a link to choose a new password.</p>
      <label className="block text-sm font-medium">Email<input name="email" type="email" required autoComplete="email" className="field mt-1 w-full" /></label>
      <div aria-live="polite">{msg && <p className="msg-ok">{msg}</p>}{error && <p role="alert" className="msg-err">{error}</p>}</div>
      <button disabled={busy} className="btn btn-primary w-full">{busy ? "Sending…" : "Send reset link"}</button>
      <p className="text-center text-sm"><Link className="inline-flex min-h-[44px] items-center text-electric underline" href="/login">Back to log in</Link></p>
    </form>
  );
}
