import { getUser } from "@/lib/auth";
import { chaptersFor, projectsFor } from "@/lib/pageProject";
import ProjectPicker from "@/components/ProjectPicker";
import AnalyserPanel from "@/components/AnalyserPanel";
import Empty from "@/components/Empty";

export const dynamic = "force-dynamic";

export default async function Analyser({ searchParams }: { searchParams: Promise<{ project?: string; chapter?: string }> }) {
  const u = (await getUser())!;
  const sp = await searchParams;
  const { projects, current } = await projectsFor(u.id, sp.project);
  const { chapters, current: chapter } = current ? await chaptersFor(u.id, current.id, sp.chapter) : { chapters: [], current: null };
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold">Chapter Analyser</h1>
      <p className="mt-1 text-muted">Measures how a chapter reads (rhythm, dialogue, repetition, readability) and, when AI is set up, gives editor-style feedback. It never changes your text.</p>
      {!current || !chapter ? <Empty title="Nothing to analyse yet" hint="Create a project and write a chapter first." /> : (
        <div className="mt-5 space-y-5"><ProjectPicker projects={projects} value={current.id} /><AnalyserPanel key={chapter.id} projectId={current.id} chapters={chapters} chapterId={chapter.id} /></div>
      )}
    </div>
  );
}
