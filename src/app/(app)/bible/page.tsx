import { getUser } from "@/lib/auth";
import { projectsFor } from "@/lib/pageProject";
import ProjectPicker from "@/components/ProjectPicker";
import BibleManager from "@/components/BibleManager";
import Empty from "@/components/Empty";

export const dynamic = "force-dynamic";

export default async function Bible({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const u = (await getUser())!;
  const { projects, current } = await projectsFor(u.id, (await searchParams).project);
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold">Story Bible</h1>
      <p className="mt-1 text-muted">Everything you have established about your story, in your words. Co Writer reads it, and Story Guard checks chapters against it.</p>
      {!current ? <Empty title="No projects yet" hint="Create a project, then record its characters, places and rules here." /> : (
        <div className="mt-5 space-y-6"><ProjectPicker projects={projects} value={current.id} /><BibleManager key={current.id} projectId={current.id} /></div>
      )}
    </div>
  );
}
