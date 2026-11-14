import AuthCard from "@/components/AuthCard";
import ResetForm from "@/components/ResetForm";
export const metadata = { title: "Choose a new password · Co Writer", referrer: "no-referrer" };
export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string }> }) { const token = (await searchParams).token ?? ""; return <AuthCard title="Choose a new password"><ResetForm token={token} /></AuthCard>; }
