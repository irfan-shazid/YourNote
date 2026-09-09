import Link from "next/link";

import { cn } from "@/lib/utils";

export function Logo({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link
      href={href}
      className={cn("group inline-flex items-center gap-2.5", className)}
      aria-label="YourNote home"
    >
      <span className="relative flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary via-accent to-highlight shadow-lg shadow-primary/25 transition-transform duration-300 group-hover:scale-105">
        <svg viewBox="0 0 24 24" fill="none" className="size-5 text-white" aria-hidden>
          <path
            d="M6 3.5h8.5L19 8v12.5H6z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path d="M14 3.5V8h5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path
            d="M9 12.5h7M9 16h4.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <span className="text-[17px] font-bold tracking-tight text-foreground">
        Your<span className="gradient-text">Note</span>
      </span>
    </Link>
  );
}
