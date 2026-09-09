"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { emailOtp } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const LENGTH = 6;
const RESEND_SECONDS = 45;

/**
 * Six-box verification code entry for email + password sign-ups.
 * Google accounts never reach this screen: the provider has already confirmed
 * the address, so those sign-ins go straight through.
 */
export function OtpForm({ email }: { email: string }) {
  const router = useRouter();
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  async function verify(code: string) {
    if (code.length !== LENGTH) return;

    setBusy(true);
    setError(null);
    try {
      const { error: verifyError } = await emailOtp.verifyEmail({ email, otp: code });

      if (verifyError) {
        setError(verifyError.message ?? "That code did not work. Check it and try again.");
        setDigits(Array(LENGTH).fill(""));
        inputs.current[0]?.focus();
        return;
      }

      toast.success("Email confirmed. Welcome to YourNote.");
      router.push("/notes");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function setDigit(index: number, value: string) {
    const clean = value.replace(/\D/g, "").slice(-1);

    const next = [...digits];
    next[index] = clean;
    setDigits(next);
    setError(null);

    if (clean && index < LENGTH - 1) inputs.current[index + 1]?.focus();

    const code = next.join("");
    if (code.length === LENGTH && !next.includes("")) void verify(code);
  }

  function onKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
    if (event.key === "ArrowLeft" && index > 0) inputs.current[index - 1]?.focus();
    if (event.key === "ArrowRight" && index < LENGTH - 1) inputs.current[index + 1]?.focus();
  }

  // Pasting the whole code from the email should just work.
  function onPaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, LENGTH);
    if (!pasted) return;

    const next = Array(LENGTH).fill("");
    for (let index = 0; index < pasted.length; index += 1) next[index] = pasted[index];

    setDigits(next);
    inputs.current[Math.min(pasted.length, LENGTH - 1)]?.focus();
    if (pasted.length === LENGTH) void verify(pasted);
  }

  async function resend() {
    setBusy(true);
    try {
      const { error: sendError } = await emailOtp.sendVerificationOtp({
        email,
        type: "email-verification",
      });

      if (sendError) {
        toast.error(sendError.message ?? "Could not resend the code.");
        return;
      }
      toast.success("A new code is on its way.");
      setCooldown(RESEND_SECONDS);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <MailCheck className="size-6" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Check your email</h1>
          <p className="text-sm text-muted-foreground">
            We sent a 6-digit code to{" "}
            <span className="font-medium text-foreground">{email}</span>. Enter it
            below to finish creating your account.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between gap-2" onPaste={onPaste}>
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={(element) => {
                inputs.current[index] = element;
              }}
              value={digit}
              onChange={(event) => setDigit(index, event.target.value)}
              onKeyDown={(event) => onKeyDown(index, event)}
              inputMode="numeric"
              autoComplete={index === 0 ? "one-time-code" : "off"}
              maxLength={1}
              aria-label={`Digit ${index + 1}`}
              disabled={busy}
              className={cn(
                "h-14 w-full rounded-xl border bg-surface text-center text-xl font-semibold",
                "transition-all duration-200 outline-none",
                "focus:border-primary focus:ring-4 focus:ring-primary/12",
                "disabled:opacity-60",
                error ? "border-danger" : digit ? "border-primary/50" : "border-border",
              )}
            />
          ))}
        </div>

        {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}
      </div>

      <Button
        className="w-full"
        size="lg"
        loading={busy}
        disabled={digits.includes("")}
        onClick={() => void verify(digits.join(""))}
      >
        Verify email
      </Button>

      <div className="space-y-3 text-center text-sm">
        <p className="text-muted-foreground">
          Did not get it?{" "}
          {cooldown > 0 ? (
            <span className="tabular-nums">Resend in {cooldown}s</span>
          ) : (
            <button
              type="button"
              onClick={() => void resend()}
              disabled={busy}
              className="font-medium text-primary hover:underline"
            >
              Send a new code
            </button>
          )}
        </p>

        <p className="text-muted-foreground">
          Wrong address?{" "}
          <Link href="/sign-up" className="font-medium text-primary hover:underline">
            Start over
          </Link>
        </p>
      </div>
    </div>
  );
}
