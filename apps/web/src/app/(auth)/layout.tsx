import Link from "next/link";
import type { ReactNode } from "react";

import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";

/**
 * Split layout for every authentication screen: the form on the left, a quiet
 * marketing panel on the right that collapses away on small screens.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-dvh lg:grid lg:grid-cols-2">
      <div className="aurora lg:hidden" />

      <div className="flex min-h-dvh flex-col px-4 py-6 sm:px-8">
        <div className="flex items-center justify-between">
          <Logo />
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm animate-fade-up">{children}</div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          By continuing you agree to keep this a useful place to learn.
        </p>
      </div>

      <div className="relative hidden overflow-hidden border-l border-border bg-gradient-to-br from-primary/12 via-accent/8 to-highlight/12 lg:block">
        <div className="aurora" />
        <div className="grid-backdrop absolute inset-0 opacity-50" />

        <div className="relative flex h-full flex-col justify-center px-14">
          <blockquote className="max-w-md">
            <p className="text-3xl leading-tight font-bold tracking-tight">
              The best notes are the ones
              <span className="gradient-text"> someone else can use</span>.
            </p>
            <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
              Publish your write-ups with the PDFs attached, collect reactions
              from people they actually helped, and answer their questions in
              the comments.
            </p>
          </blockquote>

          <div className="mt-10 flex flex-wrap gap-3">
            {["PDF and image uploads", "Six reactions", "Threaded comments", "Saved library"].map(
              (feature) => (
                <span
                  key={feature}
                  className="rounded-full border border-border bg-surface/60 px-3 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur"
                >
                  {feature}
                </span>
              ),
            )}
          </div>

          <Link
            href="/notes"
            className="mt-10 text-sm font-medium text-primary transition-opacity hover:opacity-80"
          >
            Browse notes without an account
          </Link>
        </div>
      </div>
    </div>
  );
}
