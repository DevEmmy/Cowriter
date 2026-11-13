import { getUser } from "@/lib/auth";
import SettingsForm from "@/components/SettingsForm";

export default async function Settings() {
  const u = (await getUser())!;
  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-bold">Settings</h1>
      <SettingsForm name={u.name} dailyGoal={u.dailyGoal} email={u.email} />
    </div>
  );
}
