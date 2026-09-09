"use client";

import { Lock, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { AuthDivider, GoogleButton } from "@/components/auth/google-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { emailOtp, signIn } from "@/lib/auth-client";
import { signInSchema } from "@/lib/validators/auth";

export function SignInForm({
  googleEnabled,
  next = "/notes",
}: {
  googleEnabled: boolean;
  next?: string;
}) {
  const router = useRouter();

  const [values, setValues] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  function update(field: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
  }

  async function handleSubmit() {
    const parsed = signInSchema.safeParse(values);

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        fieldErrors[key] ??= issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setBusy(true);
    try {
      const { error } = await signIn.email({
        email: parsed.data.email,
        password: parsed.data.password,
      });

      if (error) {
        // An unverified password account cannot sign in yet, so the user is
        // sent back to the code screen with a fresh code instead of a dead end.
        if (error.status === 403 || /verif/i.test(error.message ?? "")) {
          await emailOtp
            .sendVerificationOtp({ email: parsed.data.email, type: "email-verification" })
            .catch(() => undefined);

          toast.info("Confirm your email first - we sent you a new code.");
          router.push(`/verify-email?email=${encodeURIComponent(parsed.data.email)}`);
          return;
        }

        const message = error.message ?? "Those details did not work.";
        setErrors({ password: message });
        toast.error(message);
        return;
      }

      toast.success("Welcome back.");
      router.push(next);
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">
          Sign in to publish, react and join the discussion.
        </p>
      </div>

      {googleEnabled ? (
        <>
          <GoogleButton callbackURL={next} disabled={busy} />
          <AuthDivider label="or sign in with email" />
        </>
      ) : null}

      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        <Input
          label="Email"
          type="email"
          value={values.email}
          onChange={(event) => update("email", event.target.value)}
          placeholder="you@university.edu"
          error={errors.email}
          icon={<Mail className="size-4" />}
          autoComplete="email"
          disabled={busy}
        />

        <div className="space-y-1.5">
          <Input
            label="Password"
            type="password"
            value={values.password}
            onChange={(event) => update("password", event.target.value)}
            placeholder="Your password"
            error={errors.password}
            icon={<Lock className="size-4" />}
            autoComplete="current-password"
            disabled={busy}
          />

          <div className="flex justify-end">
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-primary hover:underline"
            >
              Forgot your password?
            </Link>
          </div>
        </div>

        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Sign in
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link href="/sign-up" className="font-medium text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
