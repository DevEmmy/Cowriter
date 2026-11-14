"use client";
import { useState } from "react";
import Link from "next/link";
export default function VerifyForm({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done">("idle"); const [error, setError] = useState("");
  async function go() {
    setState("busy"); setError("");
    try {
      const r = await fetch("/api/auth/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error ?? "Something went wrong."); setState("idle"); return; }
      setState("done");
    } catch { setError("Could not reach the server."); setState("idle"); }
  }
  if (state === "done") return (<div className="space-y-4"><p className="msg-ok" role="status">Your email is confirmed. Thank you.</p><Link href="/dashboard" className="btn btn-primary w-full">Continue to Co Writer</Link></div>);
  return (<div className="space-y-4"><p className="text-sm text-muted">Press the button to confirm this email address.</p><div aria-live="polite">{error && <p role="alert" className="msg-err">{error}</p>}</div><button onClick={go} disabled={state === "busy"} className="btn btn-primary w-full">{state === "busy" ? "Confirming…" : "Confirm my email"}</button></div>);
}
