/** Sends transactional email through a provider with a free tier. Nothing is faked: with no provider configured, email features say so. */
export function emailProvider(): "resend" | "brevo" | null {
  if (!process.env.EMAIL_FROM) return null;
  if (process.env.RESEND_API_KEY) return "resend";
  if (process.env.BREVO_API_KEY) return "brevo";
  return null;
}
export const emailConfigured = () => emailProvider() !== null;

/** The public address of the site, from config rather than request headers so a forged Host header cannot poison links. */
export function siteUrl(req?: Request): string {
  const s = process.env.SITE_URL ?? process.env.URL ?? process.env.DEPLOY_PRIME_URL;
  if (s) return s.replace(/\/$/, "");
  if (process.env.NODE_ENV !== "production" && req) return new URL(req.url).origin;
  throw new Error("SITE_URL is not set");
}

function parseFrom(from: string) { const m = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/); return m ? { name: m[1].replace(/^"|"$/g, "") || "Co Writer", email: m[2] } : { name: "Co Writer", email: from.trim() }; }

export async function sendEmail(to: string, subject: string, text: string, html: string): Promise<void> {
  const p = emailProvider(); if (!p) throw new Error("Email is not configured");
  const from = process.env.EMAIL_FROM!;
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const res = p === "resend"
      ? await fetch(process.env.RESEND_BASE_URL ?? "https://api.resend.com/emails", { method: "POST", signal: ctl.signal, headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [to], subject, text, html }) })
      : await fetch(process.env.BREVO_BASE_URL ?? "https://api.brevo.com/v3/smtp/email", { method: "POST", signal: ctl.signal, headers: { "api-key": process.env.BREVO_API_KEY!, "Content-Type": "application/json", accept: "application/json" }, body: JSON.stringify({ sender: parseFrom(from), to: [{ email: to }], subject, textContent: text, htmlContent: html }) });
    if (!res.ok) throw new Error(`Email provider ${p} answered ${res.status}`);
  } finally { clearTimeout(timer); }
}

const wrap = (title: string, body: string, link: string, cta: string) => `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;padding:24px;color:#2a1f4a"><h2 style="color:#5b2bd9">Co Writer</h2><p><strong>${title}</strong></p><p>${body}</p><p><a href="${link}" style="display:inline-block;background:#5b2bd9;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none">${cta}</a></p><p style="font-size:13px;color:#574d70">If the button does not work, copy this address into your browser:<br>${link}</p></div>`;
export const resetEmail = (link: string) => ({ subject: "Reset your Co Writer password", text: `Use this link to choose a new password (valid for 1 hour):\n${link}\n\nIf you did not ask for this, you can ignore this email. Your password has not changed.`, html: wrap("Choose a new password", "This link works for 1 hour. If you did not ask for it, ignore this email. Your password has not changed.", link, "Reset password") });
export const verifyEmail = (link: string) => ({ subject: "Confirm your email for Co Writer", text: `Confirm your email address (valid for 24 hours):\n${link}`, html: wrap("Confirm your email", "This link works for 24 hours.", link, "Confirm email") });
