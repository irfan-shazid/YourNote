import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SignInForm } from "@/components/auth/sign-in-form";
import { isGoogleConfigured } from "@/lib/env";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to YourNote with your email or your Google account.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await getCurrentUser();
  const { next } = await searchParams;

  // Only relative paths are accepted, so ?next= cannot bounce anyone off-site.
  const destination = next && next.startsWith("/") && !next.startsWith("//") ? next : "/notes";

  if (user) redirect(destination);

  return <SignInForm googleEnabled={isGoogleConfigured} next={destination} />;
}
