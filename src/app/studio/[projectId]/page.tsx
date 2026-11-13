import { notFound, redirect } from "next/navigation";
import { getUserId } from "@/lib/auth";
import { chaptersOf, ownedChapter, ownedProject } from "@/lib/manuscript";
import Studio from "@/components/Studio";

export const dynamic = "force-dynamic";

export default async function StudioPage({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<{ chapter?: string }> }) {
  const userId = await getUserId();
  if (!userId) redirect("/login");
  const { projectId } = await params;
  const project = await ownedProject(userId, projectId);
  if (!project) notFound();
  const chapters = await chaptersOf(projectId);
  const { chapter } = await searchParams;
  const wanted = chapters.find((c) => c.id === chapter) ?? chapters[0];
  const current = wanted ? await ownedChapter(userId, wanted.id) : null;
  return (
    <Studio
      key={current?.id ?? "none"}
      project={{ id: project.id, title: project.title, type: project.type }}
      chapters={chapters}
      chapter={current ? { id: current.id, title: current.title, content: current.content, revision: current.revision, wordCount: current.wordCount } : null}
    />
  );
}
