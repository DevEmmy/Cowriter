import Link from "next/link";
export default function Empty({ title, hint, href = "/projects", cta = "Create a project" }: { title: string; hint: string; href?: string; cta?: string }) {
  return (
    <div className="card mt-6 text-center">
      <p className="text-lg font-semibold">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-muted">{hint}</p>
      <Link href={href} className="btn btn-primary mt-4">{cta}</Link>
    </div>
  );
}
