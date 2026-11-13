"use client";
import { useRouter } from "next/navigation";
export default function LogoutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); router.push("/"); router.refresh(); }}
      className="text-sm text-slate-600 hover:text-slate-900"
    >Log out</button>
  );
}
