import Link from "next/link";
export default function AuthCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-cream px-4">
      <div className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-line">
        <Link href="/" className="text-lg font-semibold tracking-tight">Co Writer</Link>
        <h1 className="text-xl font-semibold">{title}</h1>
        {children}
      </div>
    </main>
  );
}
