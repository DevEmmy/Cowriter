import { desc, eq } from "drizzle-orm";
import { getUser } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import VoiceForm from "@/components/VoiceForm";

export const dynamic = "force-dynamic";

export default async function Voice() {
  const u = (await getUser())!;
  const projects = await db().select({ id: schema.projects.id, title: schema.projects.title }).from(schema.projects).where(eq(schema.projects.userId, u.id)).orderBy(desc(schema.projects.updatedAt));
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">My Writing Voice</h1>
      <p className="mt-1 text-muted">Paste samples of your own writing and set your standing rules. Co Writer follows them whenever it chats, improves or expands your text.</p>
      <VoiceForm projects={projects} />
    </div>
  );
}
