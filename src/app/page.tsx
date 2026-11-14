import Link from "next/link";
import { getUserId } from "@/lib/auth";

const features = [
  ["A real manuscript editor", "Books, chapters and scenes with rich formatting, word counts, and version history you can restore."],
  ["Autosave you can trust", "Every keystroke is saved to the cloud, with a local backup if your connection drops."],
  ["Goals and streaks", "Set a daily word goal and watch your progress build over the week."],
  ["Your story stays yours", "Your manuscripts are private to your account, and nothing is replaced without your confirmation."],
];

export default async function Home() {
  const signedIn = !!(await getUserId().catch(() => null));
  return (
    <div>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="bg-gradient-to-r from-electric to-coral bg-clip-text text-xl font-bold text-transparent">Co Writer</span>
        <nav className="flex items-center gap-3 text-sm">
          {signedIn ? <Link href="/dashboard" className="rounded-xl bg-electric px-4 py-2 font-semibold text-white hover:bg-electric-dark">Open dashboard</Link> : (
            <>
              <Link href="/login" className="px-3 py-2 text-muted hover:text-ink">Log in</Link>
              <Link href="/signup" className="rounded-xl bg-electric px-4 py-2 font-semibold text-white hover:bg-electric-dark">Get started</Link>
            </>
          )}
        </nav>
      </header>
      <main>
        <section className="mx-auto max-w-4xl px-6 pb-20 pt-16 text-center">
          <p className="inline-block rounded-full bg-lavender px-4 py-1 text-sm font-medium text-electric">Your Ideas. Your Voice. A Better Story.</p>
          <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-6xl">A writing studio that<br />keeps <span className="bg-gradient-to-r from-electric to-coral bg-clip-text text-transparent">your voice</span>.</h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted">Write, organise and protect your manuscript in one calm place, built for novels, short stories, screenplays and more.</p>
          <Link href={signedIn ? "/dashboard" : "/signup"} className="mt-9 inline-block rounded-2xl bg-gradient-to-r from-electric to-coral px-8 py-4 font-semibold text-white shadow-lg shadow-electric/25 hover:brightness-110">Start writing</Link>
        </section>
        <section className="mx-auto grid max-w-6xl gap-5 px-6 pb-24 sm:grid-cols-2">
          {features.map(([t, d]) => (
            <div key={t} className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-lavender"><h2 className="font-semibold">{t}</h2><p className="mt-2 text-sm leading-6 text-muted">{d}</p></div>
          ))}
        </section>
      </main>
      <footer className="border-t border-lavender py-8 text-center text-sm text-muted">© {new Date().getFullYear()} Co Writer · <Link className="underline" href="/privacy">Privacy</Link> · <Link className="underline" href="/terms">Terms</Link></footer>
    </div>
  );
}
