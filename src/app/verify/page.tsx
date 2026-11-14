import AuthCard from "@/components/AuthCard";
import VerifyForm from "@/components/VerifyForm";
export const metadata = { title: "Confirm your email · Co Writer", referrer: "no-referrer" };
export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string }> }) { const token = (await searchParams).token ?? ""; return <AuthCard title="Confirm your email"><VerifyForm token={token} /></AuthCard>; }
