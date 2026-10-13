// Builds the Supabase sign-in email templates in Utilo's style, into
// supabase/email-templates/. Supabase sends these emails itself, so after
// changing the wording here: run
//   npx tsx --conditions=react-server scripts/build-auth-emails.ts
// then paste each file into Supabase > Authentication > Email Templates.
// Keep {{ .ConfirmationURL }} and {{ .Email }}: Supabase fills them in.
import { writeFileSync } from "fs";
import { renderEmail } from "../lib/email";
import { button, note } from "../lib/emailParts";

const link = "{{ .ConfirmationURL }}";
const fallback = note(`Button not working? Copy this link into your browser:<br><a href="${link}" style="color:#0d6f78;word-break:break-all;">${link}</a>`);
const ignore = `<p style="margin:16px 0 0;font-size:13px;color:#5f6b82;">Didn't ask for this? You can safely ignore this email. Nobody can sign in without this link.</p>`;

const templates: Record<string, { subject: string; title: string; body: string }> = {
  "magic-link": {
    subject: "Your Utilo sign-in link",
    title: "Here's your sign-in link",
    body: `<p>Tap the button to open your Utilo dashboard as <strong>{{ .Email }}</strong>. The link works once and expires in an hour.</p>
      ${button("Sign in to Utilo", link, "8px 0 20px")}${fallback}${ignore}`,
  },
  "confirm-signup": {
    subject: "Confirm your email to open your Utilo dashboard",
    title: "One tap and you're in",
    body: `<p>Confirm <strong>{{ .Email }}</strong> and we'll take you straight to your dashboard, where your result and membership are waiting.</p>
      ${button("Confirm and sign in", link, "8px 0 20px")}${fallback}${ignore}`,
  },
};

for (const [name, t] of Object.entries(templates)) {
  writeFileSync(`supabase/email-templates/${name}.html`, renderEmail({ title: t.title, bodyHtml: t.body, preheader: t.subject }));
  writeFileSync(`supabase/email-templates/${name}.subject.txt`, t.subject + "\n");
}
console.log("Written to supabase/email-templates/");
