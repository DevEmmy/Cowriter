import LegalPage from "@/components/LegalPage";
export const metadata = { title: "Terms · Co Writer" };
export default function Page() {
  return (
    <LegalPage title="Terms of Use">
      <h2>Your writing is yours</h2>
      <p>You own everything you write or import. We only store and process it to run the service for you. AI suggestions are suggestions: you decide what goes into your work, and you are responsible for what you publish.</p>
      <h2>Using the service</h2>
      <ul>
        <li>Keep your password private and use the service lawfully.</li>
        <li>Only upload writing you have the right to use.</li>
        <li>Do not try to break, overload or get around the limits of the service. Free AI use is capped per person per day.</li>
        <li>We may suspend accounts that abuse the service.</li>
      </ul>
      <h2>No guarantees</h2>
      <p>Co Writer is provided as is, without promises of constant availability. AI output and any AI-detector scores can be wrong; they are guidance, not proof about your work. Keep your own backups by downloading your manuscripts.</p>
      <h2>Ending your account</h2>
      <p>You can delete your account at any time in Settings. Deleting it permanently erases your data.</p>
      <h2>Changes</h2>
      <p>We may update these terms; continuing to use the service means you accept the update.</p>
      <p className="text-sm text-muted">This page is a plain-language summary, not legal advice. The owner should have it reviewed before offering the service commercially.</p>
    </LegalPage>
  );
}
