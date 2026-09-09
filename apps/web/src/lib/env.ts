/**
 * Environment access in one place, so a missing variable fails loudly at boot
 * instead of surfacing as a confusing runtime error deep inside a request.
 */

function required(name: string, value: string | undefined): string {
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing required environment variable ${name}. Copy .env.example to .env and fill it in.`,
    );
  }
  return value.trim();
}

function optional(value: string | undefined, fallback = ""): string {
  return value?.trim() ?? fallback;
}

const isProduction = process.env.NODE_ENV === "production";

export const env = {
  isProduction,

  /** Public URL of the Next.js app, used as the Better Auth base URL. */
  appUrl: optional(process.env.NEXT_PUBLIC_APP_URL, "http://localhost:3000"),

  /** Shared secret. The Go API uses the same value to verify session cookies. */
  authSecret: required("BETTER_AUTH_SECRET", process.env.BETTER_AUTH_SECRET),

  /** Optional parent domain so api.example.com receives the session cookie. */
  cookieDomain: optional(process.env.COOKIE_DOMAIN) || undefined,

  google: {
    clientId: optional(process.env.GOOGLE_CLIENT_ID),
    clientSecret: optional(process.env.GOOGLE_CLIENT_SECRET),
  },

  /** Addresses that are granted the admin role the moment they sign up. */
  adminEmails: optional(process.env.ADMIN_EMAILS)
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),

  smtp: {
    host: optional(process.env.SMTP_HOST),
    port: Number(optional(process.env.SMTP_PORT, "587")),
    user: optional(process.env.SMTP_USER),
    password: optional(process.env.SMTP_PASSWORD),
    from: optional(process.env.EMAIL_FROM, "YourNote <no-reply@yournote.app>"),
  },
} as const;

/** True when SMTP is configured; otherwise emails are logged to the console. */
export const isMailConfigured = Boolean(env.smtp.host && env.smtp.user && env.smtp.password);

/** True when Google sign-in should be offered in the UI. */
export const isGoogleConfigured = Boolean(env.google.clientId && env.google.clientSecret);
