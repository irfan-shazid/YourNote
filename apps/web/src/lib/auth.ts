import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { admin as adminPlugin, emailOTP } from "better-auth/plugins";

import { prisma } from "@/lib/prisma";
import { sendOtpEmail, sendPasswordResetEmail, sendWelcomeEmail } from "@/lib/mail";
import { env } from "@/lib/env";

/**
 * Better Auth is the only piece of the backend that is not Go: it is a
 * TypeScript library, so it runs inside the Next.js app and writes its sessions
 * to the same Neon database. The Go API reads those sessions to authenticate
 * every request, which keeps a single source of truth for identity.
 *
 * Verification policy:
 *  - Email + password sign-up must confirm a 6-digit OTP before signing in.
 *  - Google sign-in never asks for an OTP: Google has already verified the
 *    address, so the account is created pre-verified.
 */
export const auth = betterAuth({
  appName: "YourNote",
  baseURL: env.appUrl,
  secret: env.authSecret,

  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: false,
    // Password accounts have to prove they own the address first.
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail({ to: user.email, name: user.name, url });
    },
  },

  socialProviders: {
    google: {
      clientId: env.google.clientId,
      clientSecret: env.google.clientSecret,
      // Google asserts the address, so the account starts verified and the OTP
      // step is skipped entirely for social sign-in.
      mapProfileToUser: (profile) => ({
        name: profile.name,
        image: profile.picture,
        emailVerified: profile.email_verified ?? true,
      }),
    },
  },

  account: {
    accountLinking: {
      enabled: true,
      // Linking a Google login onto an existing password account is safe only
      // because Google has verified the same address.
      trustedProviders: ["google"],
    },
  },

  user: {
    additionalFields: {
      bio: {
        type: "string",
        required: false,
        input: true,
      },
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh the session at most once a day
  },

  advanced: {
    // The Go API reads this cookie, so keep the default Better Auth name.
    useSecureCookies: env.isProduction,
    ...(env.cookieDomain
      ? { crossSubDomainCookies: { enabled: true, domain: env.cookieDomain } }
      : {}),
  },

  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          // Seed the first administrators from the environment so a fresh
          // deployment always has someone who can open the admin panel.
          const isAdmin = env.adminEmails.includes(user.email.toLowerCase());
          return { data: { ...user, role: isAdmin ? "admin" : "user" } };
        },
        after: async (user) => {
          // A welcome email is a nicety: never let it break sign-up.
          void sendWelcomeEmail({ to: user.email, name: user.name }).catch(() => undefined);
        },
      },
    },
  },

  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 60 * 10, // 10 minutes
      allowedAttempts: 5,
      sendVerificationOTP: async ({ email, otp, type }) => {
        await sendOtpEmail({ to: email, otp, type });
      },
    }),
    adminPlugin({
      defaultRole: "user",
      adminRoles: ["admin"],
    }),
    // Must stay last: it forwards Better Auth cookies through Next.js.
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
export type SessionUser = Session["user"];
