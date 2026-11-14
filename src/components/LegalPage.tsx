import Link from "next/link";
export default function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  const contact = process.env.CONTACT_EMAIL;
  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <Link href="/" className="font-semibold text-electric">← Co Writer</Link>
      <h1 className="mt-4 text-3xl font-bold">{title}</h1>
      <p className="mt-1 text-sm text-muted">Last updated: November 2026</p>
      <div className="mt-6 space-y-4 leading-relaxed [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:pl-6 [&_li]:mt-1">{children}</div>
      <p className="mt-8 rounded-xl bg-lavender p-4 text-sm">{contact ? <>Questions or requests: <a className="underline" href={`mailto:${contact}`}>{contact}</a>.</> : "Questions or requests: contact the person who runs this site."}</p>
    </main>
  );
}
