import { getUser } from "@/lib/auth";
import { projectsFor } from "@/lib/pageProject";
import ProjectPicker from "@/components/ProjectPicker";
import CoverStudio from "@/components/CoverStudio";
import Empty from "@/components/Empty";

export const dynamic = "force-dynamic";

export default async function Covers({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const u = (await getUser())!;
  const { projects, current } = await projectsFor(u.id, (await searchParams).project);
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-bold">Cover Studio</h1>
      <p className="mt-1 text-muted">Design a book cover and download it as a PNG or SVG. Co Writer can suggest a layout and tagline, and draws the cover itself.</p>
      {!current ? <Empty title="No projects yet" hint="Create a project first, then design its cover." /> : (
        <div className="mt-5 space-y-5"><ProjectPicker projects={projects} value={current.id} /><CoverStudio key={current.id} projectId={current.id} title={current.title} author={u.name} /></div>)}
    </div>
  );
}
