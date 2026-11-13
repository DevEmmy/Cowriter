"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const signup = mode === "signup";

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    const res = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(f)),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Something went wrong. Please try again.");
      setBusy(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  const input = "w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20";
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <Link href="/" className="text-lg font-semibold tracking-tight text-slate-900">Cowriter</Link>
        <h1 className="text-xl font-semibold text-slate-900">{signup ? "Create your account" : "Welcome back"}</h1>
        {signup && (
          <label className="block text-sm text-slate-700">Name
            <input name="name" autoComplete="name" className={input + " mt-1"} />
          </label>
        )}
        <label className="block text-sm text-slate-700">Email
          <input name="email" type="email" required autoComplete="email" className={input + " mt-1"} />
        </label>
        <label className="block text-sm text-slate-700">Password
          <input name="password" type="password" required minLength={signup ? 8 : 1} autoComplete={signup ? "new-password" : "current-password"} className={input + " mt-1"} />
        </label>
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button disabled={busy} className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
          {busy ? "Please wait…" : signup ? "Sign up" : "Log in"}
        </button>
        <p className="text-center text-sm text-slate-600">
          {signup ? <>Already have an account? <Link className="text-indigo-600" href="/login">Log in</Link></> : <>New here? <Link className="text-indigo-600" href="/signup">Create an account</Link></>}
        </p>
      </form>
    </main>
  );
}
