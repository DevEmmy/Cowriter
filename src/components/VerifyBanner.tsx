"use client";
import { useState } from "react";
export default function VerifyBanner({ email }: { email: string }) {
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");
  const [error, setError] = useState("");
  async function send() {
    setState("busy"); setError("");
    const r = await fetch("/api/auth/verify", { method: "PUT" }); const d = await r.json().catch(() => ({}));
    if (!r.ok) { setError(d.error ?? "Could not send the email."); setState("idle"); return; }
    setState("sent");
  }
  return (
    <div role="status" className="mx-auto mb-5 flex max-w-5xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-warn/40 bg-peach/60 px-4 py-3 text-sm">
      <p>{state === "sent" ? `We sent a confirmation link to ${email}. Check your inbox and spam folder.` : <>Please confirm your email <strong>{email}</strong> so you can recover your account if you forget your password.</>}</p>
      {state !== "sent" && <button onClick={send} disabled={state === "busy"} className="btn btn-secondary">{state === "busy" ? "Sending…" : "Send confirmation email"}</button>}
      {error && <p role="alert" className="w-full text-danger">{error}</p>}
    </div>
  );
}
