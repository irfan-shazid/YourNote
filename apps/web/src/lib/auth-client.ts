"use client";

import { createAuthClient } from "better-auth/react";
import { adminClient, emailOTPClient, inferAdditionalFields } from "better-auth/client/plugins";

import type { auth } from "@/lib/auth";

/**
 * Browser-side Better Auth client. The plugin list mirrors the server so the
 * generated methods and inferred types line up exactly.
 *
 * Method-to-endpoint mapping (verified against better-auth 1.7):
 *   signUp.email                 -> POST /sign-up/email
 *   signIn.email                 -> POST /sign-in/email
 *   signIn.social                -> POST /sign-in/social
 *   emailOtp.sendVerificationOtp -> POST /email-otp/send-verification-otp
 *   emailOtp.verifyEmail         -> POST /email-otp/verify-email
 *   requestPasswordReset         -> POST /request-password-reset
 *   resetPassword                -> POST /reset-password
 */
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  plugins: [emailOTPClient(), adminClient(), inferAdditionalFields<typeof auth>()],
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  emailOtp,
  requestPasswordReset,
  resetPassword,
} = authClient;

export type ClientSession = typeof authClient.$Infer.Session;
