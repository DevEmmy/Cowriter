import PromptTool from "@/components/PromptTool";

export const dynamic = "force-dynamic";

export default function Tools() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">Writing Tools</h1>
      <p className="mt-1 text-muted">Build a clear, structured prompt for any scene. Fields you leave empty are left out, never invented.</p>
      <PromptTool />
    </div>
  );
}
