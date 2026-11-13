import { redirect } from "next/navigation";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { getUser } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import LogoutButton from "@/components/LogoutButton";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const user = await getUser();
  if (!user) redirect("/login");
  const projects = await db().select().from(schema.projects).where(eq(schema.projects.userId, user.id)).orderBy(desc(schema.projects.updatedAt));
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Welcome{user.name ? `, ${user.name}` : ""}</h1>
        <LogoutButton />
      </div>
      <Link href="/new" className="mt-8 inline-block rounded-xl bg-indigo-600 px-5 py-3 text-sm font-medium text-white hover:bg-indigo-700">New presentation</Link>
      <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-slate-500">Your projects</h2>
      {projects.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-500">No projects yet. Upload a document to create your first presentation.</p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-200 rounded-2xl border border-slate-200">
          {projects.map((p) => (
            <li key={p.id}>
              <Link href={`/project/${p.id}`} className="flex items-center justify-between px-5 py-4 hover:bg-slate-50">
                <span className="font-medium text-slate-900">{p.title}</span>
                <span className="text-sm capitalize text-slate-500">{p.status}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
