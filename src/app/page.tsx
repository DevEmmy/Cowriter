import Link from "next/link";
import { getUserId } from "@/lib/auth";

const features = [
  ["Nothing gets lost", "Cowriter changes how information is presented, not the information. Long explanations become several slides, not three vague bullets."],
  ["Every slide is traceable", "Each element links back to its source page and section, and AI-added material is clearly labelled."],
  ["Honest coverage report", "See exactly which parts of your document are represented, which are not, and what needs review."],
  ["Real, editable exports", "Download a genuinely editable PowerPoint file or a PDF. No screenshots pasted into slides."],
];
const steps = ["Upload your document", "Cowriter plans and designs the slides", "Review, edit and verify against the source", "Download PPTX or PDF"];

export default async function Home() {
  const signedIn = !!(await getUserId().catch(() => null));
  return (
    <div className="bg-white text-slate-900">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="text-lg font-semibold tracking-tight">Cowriter</span>
        <nav className="flex items-center gap-3 text-sm">
          {signedIn ? (
            <Link href="/dashboard" className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700">Dashboard</Link>
          ) : (
            <>
              <Link href="/login" className="px-3 py-2 text-slate-600 hover:text-slate-900">Log in</Link>
              <Link href="/signup" className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700">Get started</Link>
            </>
          )}
        </nav>
      </header>
      <main>
        <section className="mx-auto max-w-4xl px-6 pb-20 pt-16 text-center">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">Turn long documents into presentations that keep every detail.</h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">Upload a PDF, Word file or scanned document. Cowriter structures it into a professionally designed deck, and shows you what came from your document and what didn&apos;t.</p>
          <Link href={signedIn ? "/dashboard" : "/signup"} className="mt-9 inline-block rounded-xl bg-indigo-600 px-7 py-3.5 font-medium text-white shadow-sm hover:bg-indigo-700">Upload a document</Link>
        </section>
        <section className="mx-auto grid max-w-6xl gap-5 px-6 pb-20 sm:grid-cols-2">
          {features.map(([t, d]) => (
            <div key={t} className="rounded-2xl border border-slate-200 p-6">
              <h2 className="font-semibold">{t}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{d}</p>
            </div>
          ))}
        </section>
        <section className="bg-slate-50 py-20">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-center text-2xl font-semibold">How it works</h2>
            <ol className="mt-10 grid gap-5 sm:grid-cols-4">
              {steps.map((s, i) => (
                <li key={s} className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
                  <span className="text-sm font-semibold text-indigo-600">Step {i + 1}</span>
                  <p className="mt-2 text-sm text-slate-700">{s}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>
      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-500">© {new Date().getFullYear()} Cowriter</footer>
    </div>
  );
}
