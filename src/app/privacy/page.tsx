import LegalPage from "@/components/LegalPage";
export const metadata = { title: "Privacy · Co Writer" };
export default function Page() {
  return (
    <LegalPage title="Privacy Policy">
      <p>Co Writer is a writing studio. Your writing belongs to you. This page explains what we keep and who else sees it.</p>
      <h2>What we store</h2>
      <ul>
        <li>Your account: email, name (optional) and a scrambled (hashed) password. We cannot read your password.</li>
        <li>Your work: projects, chapters, version history, story notes, ideas, covers and writing statistics.</li>
        <li>A sign-in cookie that keeps you logged in for up to 14 days.</li>
        <li>Short-lived counters (by account, email or network address) used to stop password guessing and abuse.</li>
      </ul>
      <h2>Who else sees your writing</h2>
      <ul>
        <li><strong>AI features.</strong> When you use the writing assistant, Idea Lab, Story Guard, Chapter Analyser or similar tools, the text you ask about is sent to an AI provider (Google Gemini or Groq). Free AI plans may allow the provider to use submitted text to improve its products, and people at the provider may review it. Do not use AI features on text you want kept fully private. Everything else in Co Writer works without AI.</li>
        <li><strong>AI-detector checks.</strong> Only if you press the button, the text you submit goes to the detector company (GPTZero or Originality.ai) if the site owner has enabled it.</li>
        <li><strong>Hosting.</strong> Your data is stored in a database (Supabase) and served by a web host (Vercel or similar). Emails (password reset, confirmation) are sent through an email provider (Resend or Brevo).</li>
        <li>We do not sell your data and we do not show ads.</li>
      </ul>
      <h2>Your choices</h2>
      <ul>
        <li>Download your manuscripts any time from My Library (Word, PDF or text).</li>
        <li>Delete your account in Settings. This permanently erases your account and everything in it.</li>
        <li>You can change your password in Settings, or reset it from the log-in page.</li>
      </ul>
      <h2>Backups and limits</h2>
      <p>This is an early service. Keep your own copy of anything important by downloading it regularly.</p>
      <p className="text-sm text-muted">This page is a plain-language summary, not legal advice. The owner should have it reviewed before offering the service commercially.</p>
    </LegalPage>
  );
}
