import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserId } from "@/lib/auth";
import UploadFlow from "@/components/UploadFlow";

export default async function NewPage() {
  if (!(await getUserId())) redirect("/login");
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link href="/dashboard" className="text-sm text-slate-600 hover:text-slate-900">← Dashboard</Link>
      <h1 className="mb-8 mt-4 text-2xl font-semibold text-slate-900">New presentation</h1>
      <UploadFlow />
    </main>
  );
}
