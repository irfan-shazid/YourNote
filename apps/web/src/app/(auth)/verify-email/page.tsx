import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { OtpForm } from "@/components/auth/otp-form";

export const metadata: Metadata = {
  title: "Confirm your email",
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  // Without an address there is nothing to verify, so start the flow again.
  if (!email) redirect("/sign-up");

  return <OtpForm email={email} />;
}
