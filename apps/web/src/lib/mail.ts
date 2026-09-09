import "server-only";

import nodemailer, { type Transporter } from "nodemailer";

import { env, isMailConfigured } from "@/lib/env";

/**
 * Transactional email. When SMTP is not configured - which is the normal state
 * in local development - messages are printed to the server console instead, so
 * the sign-up flow stays testable without a mail provider.
 */

let cachedTransport: Transporter | null = null;

function transport(): Transporter | null {
  if (!isMailConfigured) return null;
  if (cachedTransport) return cachedTransport;

  cachedTransport = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.port === 465,
    auth: { user: env.smtp.user, pass: env.smtp.password },
  });
  return cachedTransport;
}

type Message = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

async function send({ to, subject, html, text }: Message): Promise<void> {
  const mailer = transport();

  if (!mailer) {
    console.info(
      [
        "",
        "-------------------------------------------------------------",
        " Email not sent: SMTP is not configured.",
        ` To:      ${to}`,
        ` Subject: ${subject}`,
        "",
        text,
        "-------------------------------------------------------------",
        "",
      ].join("\n"),
    );
    return;
  }

  await mailer.sendMail({ from: env.smtp.from, to, subject, html, text });
}

/** Shared shell so every email looks like it came from the same product. */
function layout(heading: string, body: string): string {
  return `
  <div style="margin:0;padding:32px 16px;background:#0b0a12;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;">
    <div style="max-width:520px;margin:0 auto;background:#141221;border:1px solid #262238;border-radius:18px;overflow:hidden;">
      <div style="padding:26px 32px;background:linear-gradient(135deg,#7c3aed,#c026d3 55%,#0891b2);">
        <span style="font-size:19px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">YourNote</span>
      </div>
      <div style="padding:32px;">
        <h1 style="margin:0 0 14px;font-size:21px;line-height:1.3;color:#f4f2ff;font-weight:650;">${heading}</h1>
        <div style="font-size:15px;line-height:1.65;color:#b3add0;">${body}</div>
      </div>
      <div style="padding:18px 32px;border-top:1px solid #262238;font-size:12px;color:#6f6a8f;">
        You received this because someone used this address on YourNote.
        If that was not you, you can safely ignore this email.
      </div>
    </div>
  </div>`;
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;margin:22px 0 6px;padding:12px 22px;border-radius:10px;background:linear-gradient(135deg,#7c3aed,#c026d3);color:#ffffff;font-weight:600;font-size:15px;text-decoration:none;">${label}</a>`;
}

type OtpType = "sign-in" | "email-verification" | "forget-password" | "change-email";

const otpCopy: Record<OtpType, { subject: string; heading: string; intro: string }> = {
  "email-verification": {
    subject: "Confirm your email address",
    heading: "Confirm your email address",
    intro: "Enter this code in the app to finish creating your account.",
  },
  "sign-in": {
    subject: "Your sign-in code",
    heading: "Your sign-in code",
    intro: "Enter this code to sign in.",
  },
  "forget-password": {
    subject: "Your password reset code",
    heading: "Reset your password",
    intro: "Enter this code to choose a new password.",
  },
  "change-email": {
    subject: "Confirm your new email address",
    heading: "Confirm your new email address",
    intro: "Enter this code to finish moving your account to this address.",
  },
};

/** One-time code used to verify a password sign-up. Google never sends one. */
export async function sendOtpEmail({
  to,
  otp,
  type,
}: {
  to: string;
  otp: string;
  type: OtpType;
}): Promise<void> {
  const copy = otpCopy[type] ?? otpCopy["email-verification"];

  await send({
    to,
    subject: `${copy.subject} - YourNote`,
    text: `${copy.intro}\n\n${otp}\n\nThis code expires in 10 minutes.`,
    html: layout(
      copy.heading,
      `<p style="margin:0 0 10px;">${copy.intro}</p>
       <div style="margin:20px 0;padding:18px;border-radius:14px;background:#1c1930;border:1px solid #302a4a;text-align:center;">
         <span style="font-size:32px;letter-spacing:10px;font-weight:700;color:#ffffff;">${otp}</span>
       </div>
       <p style="margin:0;font-size:13px;color:#8b85ad;">This code expires in 10 minutes.</p>`,
    ),
  });
}

/** Link-based password reset, sent by Better Auth's forgot-password flow. */
export async function sendPasswordResetEmail({
  to,
  name,
  url,
}: {
  to: string;
  name: string;
  url: string;
}): Promise<void> {
  await send({
    to,
    subject: "Reset your YourNote password",
    text: `Hi ${name},\n\nUse this link to choose a new password:\n${url}\n\nThe link expires in one hour.`,
    html: layout(
      "Reset your password",
      `<p style="margin:0 0 6px;">Hi ${name}, we received a request to reset your password.</p>
       ${button(url, "Choose a new password")}
       <p style="margin:14px 0 0;font-size:13px;color:#8b85ad;">This link expires in one hour.</p>`,
    ),
  });
}

/** Sent once, right after an account is created. */
export async function sendWelcomeEmail({
  to,
  name,
}: {
  to: string;
  name: string;
}): Promise<void> {
  await send({
    to,
    subject: "Welcome to YourNote",
    text: `Hi ${name},\n\nWelcome to YourNote. Publish your first note, attach your PDFs and let people react and discuss.`,
    html: layout(
      `Welcome, ${name}`,
      `<p style="margin:0 0 6px;">YourNote is where study notes get shared, reacted to and argued about - in a good way.</p>
       <p style="margin:0;">Publish a note, attach the PDF or the diagrams, and let people react and comment.</p>
       ${button(`${env.appUrl}/notes/new`, "Publish your first note")}`,
    ),
  });
}
