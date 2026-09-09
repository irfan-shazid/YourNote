"use client";

import { Lock, Mail, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { AuthDivider, GoogleButton } from "@/components/auth/google-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { emailOtp, signUp } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { passwordStrength, signUpSchema } from "@/lib/validators/auth";

const strengthColors = [
  "bg-border",
  "bg-danger",
  "bg-warning",
  "bg-highlight",
  "bg-success",
] as const;

export function SignUpForm({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter();

  const [values, setValues] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const strength = passwordStrength(values.password);

  function update(field: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
  }

  async function handleSubmit() {
    const parsed = signUpSchema.safeParse(values);

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
      const { error } = await signUp.email({
        name: parsed.data.name,
        email: parsed.data.email,
        password: parsed.data.password,
      });

      if (error) {
        // The most common failure by far is an address that already exists.
        const message = error.message ?? "Could not create your account.";
        setErrors({ email: message });
        toast.error(message);
        return;
      }

      // Password accounts must confirm ownership of the address before they can
      // sign in, so the verification code is sent right away.
      const { error: otpError } = await emailOtp.sendVerificationOtp({
        email: parsed.data.email,
        type: "email-verification",
      });

      if (otpError) {
        toast.error("Account created, but we could not send the code. Try resending it.");
      } else {
        toast.success("Check your email for a 6-digit code.");
      }

      router.push(`/verify-email?email=${encodeURIComponent(parsed.data.email)}`);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
        <p className="text-sm text-muted-foreground">
          Start sharing your notes in a couple of minutes.
        </p>
      </div>

      {googleEnabled ? (
        <>
          <GoogleButton label="Sign up with Google" disabled={busy} />
          <AuthDivider label="or sign up with email" />
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
          label="Name"
          value={values.name}
          onChange={(event) => update("name", event.target.value)}
          placeholder="Ada Lovelace"
          error={errors.name}
          icon={<User className="size-4" />}
          autoComplete="name"
          disabled={busy}
        />

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

        <div className="space-y-2">
          <Input
            label="Password"
            type="password"
            value={values.password}
            onChange={(event) => update("password", event.target.value)}
            placeholder="At least 8 characters"
            error={errors.password}
            icon={<Lock className="size-4" />}
            autoComplete="new-password"
            disabled={busy}
          />

          {values.password ? (
            <div className="flex items-center gap-2">
              <div className="flex flex-1 gap-1">
                {[0, 1, 2, 3].map((index) => (
                  <span
                    key={index}
                    className={cn(
                      "h-1 flex-1 rounded-full transition-colors duration-300",
                      index < strength.score ? strengthColors[strength.score] : "bg-border",
                    )}
                  />
                ))}
              </div>
              <span className="w-14 text-right text-[11px] text-muted-foreground">
                {strength.label}
              </span>
            </div>
          ) : null}
        </div>

        <Input
          label="Confirm password"
          type="password"
          value={values.confirmPassword}
          onChange={(event) => update("confirmPassword", event.target.value)}
          placeholder="Type it again"
          error={errors.confirmPassword}
          icon={<Lock className="size-4" />}
          autoComplete="new-password"
          disabled={busy}
        />

        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Create account
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
