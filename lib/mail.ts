import { siteUrl } from "./site";

/*
  Transactional mail through Brevo's REST API. No SDK: it is one POST.

  Without BREVO_API_KEY this logs and returns, so a dev server or a
  preview deploy never emails a real person. Nothing here throws to the
  caller — a mail failure must never turn a saved profile into an error.
*/

const ENDPOINT = "https://api.brevo.com/v3/smtp/email";

type Mail = {
  to: { email: string; name: string };
  subject: string;
  text: string;
  html: string;
};

async function send(mail: Mail): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!apiKey || !from) {
    console.log(`mail (not sent, no BREVO_API_KEY/MAIL_FROM): "${mail.subject}" → ${mail.to.email}`);
    return;
  }

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: { name: "Gym Rank", email: from },
        replyTo: { email: from },
        to: [mail.to],
        subject: mail.subject,
        textContent: mail.text,
        htmlContent: mail.html,
      }),
    });
    if (!res.ok) {
      console.error("mail: Brevo rejected", res.status, await res.text());
    }
  } catch (err) {
    console.error("mail: send failed", err);
  }
}

/**
 * The one email the app sends: once, when a profile is first created.
 * Not a verification — Google already proved the address. It exists to
 * hand over the two things a new lifter needs and would otherwise have
 * to find: their link, and what co-signing is for.
 */
export async function sendWelcome(params: {
  email: string;
  displayName: string;
  username: string;
  collegeShort: string;
}): Promise<void> {
  const { email, displayName, username, collegeShort } = params;
  const first = displayName.split(/\s+/)[0] || displayName;
  const page = `${siteUrl}/u/${username}`;

  const text = [
    `You're on the ${collegeShort} board, ${first}.`,
    ``,
    `Your page: ${page}`,
    ``,
    `Every number on Gym Rank is self-reported, so each lift starts as "unverified". Send that link to someone at ${collegeShort} who watched your set — one tap from them co-signs it. Get all three co-signed and you're on the global board too.`,
    ``,
    `Your score is adjusted for bodyweight (DOTS), so a 60 kg lifter and a 90 kg lifter are compared fairly. Bodyweight itself is never shown — only your weight class.`,
    ``,
    `This is the only email Gym Rank sends. To delete your account, reply to this message.`,
    ``,
    `— Gym Rank`,
  ].join("\n");

  const html = `
<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:28px 20px;color:#16130f;line-height:1.5">
  <p style="font-size:22px;font-weight:800;letter-spacing:-0.02em;margin:0 0 16px">You're on the ${escape(collegeShort)} board, ${escape(first)}.</p>
  <p style="margin:0 0 20px">
    Your page:<br>
    <a href="${page}" style="color:#16130f;font-weight:700">${escape(page.replace(/^https?:\/\//, ""))}</a>
  </p>
  <p style="margin:0 0 16px">Every number on Gym Rank is self-reported, so each lift starts as <b>unverified</b>. Send that link to someone at ${escape(collegeShort)} who watched your set — one tap from them co-signs it. Get all three co-signed and you're on the global board too.</p>
  <p style="margin:0 0 16px;color:#5a544b">Your score is adjusted for bodyweight (DOTS), so a 60&nbsp;kg lifter and a 90&nbsp;kg lifter are compared fairly. Bodyweight itself is never shown — only your weight class.</p>
  <p style="margin:24px 0 0;font-size:12px;color:#8a8378">This is the only email Gym Rank sends. To delete your account, reply to this message.</p>
</div>`.trim();

  await send({
    to: { email, name: displayName },
    subject: `You're on the ${collegeShort} board`,
    text,
    html,
  });
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
