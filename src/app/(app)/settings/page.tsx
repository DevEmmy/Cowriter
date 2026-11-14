import { getUser } from "@/lib/auth";
import SettingsForm from "@/components/SettingsForm";
import AccountSecurity from "@/components/AccountSecurity";
import Link from "next/link";

export default async function Settings() {
  const u = (await getUser())!;
  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-bold">Settings</h1>
      <SettingsForm name={u.name} dailyGoal={u.dailyGoal} email={u.email} />
      <AccountSecurity />
      <p className="mt-6 text-sm text-muted"><Link className="underline" href="/privacy">Privacy</Link> · <Link className="underline" href="/terms">Terms</Link></p>
    </div>
  );
}
