"use client";

import { CheckCircle2, Lock, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestPasswordReset, resetPassword } from "@/lib/auth-client";
import { emailSchema, resetPasswordSchema } from "@/lib/validators/auth";

/** Step one: ask for the address and send a reset link. */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const parsed = emailSchema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      return;
    }

    setError(undefined);
    setBusy(true);
    try {
      await requestPasswordReset({
        email: parsed.data.email,
        redirectTo: "/reset-password",
      });
      // The response is deliberately identical whether or not the address
      // exists, so this screen never confirms who has an account.
      setSent(true);
    } catch {
      toast.error("Could not send the reset email. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-success/12 text-success">
          <CheckCircle2 className="size-6" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Check your inbox</h1>
          <p className="text-sm text-muted-foreground">
            If an account exists for{" "}
            <span className="font-medium text-foreground">{email}</span>, a reset
            link is on its way. It expires in an hour.
          </p>
        </div>

        <Button asChild variant="outline" className="w-full">
          <Link href="/sign-in">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Reset your password</h1>
        <p className="text-sm text-muted-foreground">
          Enter your email and we will send you a link to choose a new one.
        </p>
      </div>

      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@university.edu"
          error={error}
          icon={<Mail className="size-4" />}
          autoComplete="email"
          disabled={busy}
        />

        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Send reset link
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link href="/sign-in" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

/** Step two: the link lands here with a token in the query string. */
export function ResetPasswordForm({ token }: { token: string | null }) {
  const router = useRouter();
  const [values, setValues] = useState({ password: "", confirmPassword: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!token) {
      toast.error("This reset link is invalid. Request a new one.");
      return;
    }

    const parsed = resetPasswordSchema.safeParse(values);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        fieldErrors[key] ??= issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setBusy(true);
    try {
      const { error } = await resetPassword({ newPassword: parsed.data.password, token });

      if (error) {
        toast.error(error.message ?? "This reset link has expired. Request a new one.");
        return;
      }

      toast.success("Password updated. You can sign in now.");
      router.push("/sign-in");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <div className="space-y-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight">This link is not valid</h1>
        <p className="text-sm text-muted-foreground">
          The reset link is missing its token, or it has already been used.
        </p>
        <Button asChild className="w-full">
          <Link href="/forgot-password">Request a new link</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Choose a new password</h1>
        <p className="text-sm text-muted-foreground">
          Make it at least 8 characters, with an uppercase letter and a number.
        </p>
      </div>

      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Input
          label="New password"
          type="password"
          value={values.password}
          onChange={(event) => setValues((v) => ({ ...v, password: event.target.value }))}
          error={errors.password}
          icon={<Lock className="size-4" />}
          autoComplete="new-password"
          disabled={busy}
        />

        <Input
          label="Confirm new password"
          type="password"
          value={values.confirmPassword}
          onChange={(event) => setValues((v) => ({ ...v, confirmPassword: event.target.value }))}
          error={errors.confirmPassword}
          icon={<Lock className="size-4" />}
          autoComplete="new-password"
          disabled={busy}
        />

        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Update password
        </Button>
      </form>
    </div>
  );
}
