"use client";

import { useState } from "react";
import { toast } from "sonner";

import { signIn } from "@/lib/auth-client";

/**
 * Google sign-in. Google has already verified the address, so these accounts
 * are created pre-verified and never see the OTP step - which is exactly the
 * behaviour the email + password flow does require.
 */
export function GoogleButton({
  callbackURL = "/notes",
  label = "Continue with Google",
  disabled,
}: {
  callbackURL?: string;
  label?: string;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    try {
      // On success the browser is redirected by Better Auth, so there is no
      // success branch to handle here.
      const { error } = await signIn.social({ provider: "google", callbackURL });
      if (error) {
        toast.error(error.message ?? "Could not start Google sign-in.");
        setBusy(false);
      }
    } catch {
      toast.error("Could not reach Google. Please try again.");
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={disabled || busy}
      className="flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-border bg-surface text-sm font-medium text-foreground transition-all duration-200 hover:border-border-strong hover:bg-muted active:scale-[0.99] disabled:pointer-events-none disabled:opacity-60"
    >
      {busy ? (
        <span
          aria-hidden
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : (
        <svg viewBox="0 0 24 24" className="size-[18px]" aria-hidden>
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z"
          />
          <path
            fill="#EA4335"
            d="M12 4.75c1.62 0 3.06.56 4.21 1.65l3.15-3.15C17.45 1.46 14.97.5 12 .5A11 11 0 0 0 2.18 7.05l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z"
          />
        </svg>
      )}
      {busy ? "Redirecting..." : label}
    </button>
  );
}

/** "or" divider used between the social and password options. */
export function AuthDivider({ label = "or" }: { label?: string }) {
  return (
    <div className="relative py-1">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t border-border" />
      </div>
      <div className="relative flex justify-center">
        <span className="bg-background px-3 text-xs text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}
