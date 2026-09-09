import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SignUpForm } from "@/components/auth/sign-up-form";
import { isGoogleConfigured } from "@/lib/env";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Create your account",
  description: "Join YourNote to publish notes, react and discuss.",
};

export default async function SignUpPage() {
  const user = await getCurrentUser();
  if (user) redirect("/notes");

  return <SignUpForm googleEnabled={isGoogleConfigured} />;
}
