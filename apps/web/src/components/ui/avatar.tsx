"use client";

import Image from "next/image";
import { useState } from "react";

import { cn, initials } from "@/lib/utils";

const sizes = {
  xs: "size-6 text-[10px]",
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-14 text-lg",
  xl: "size-20 text-2xl",
} as const;

export type AvatarProps = {
  name: string;
  src?: string | null;
  size?: keyof typeof sizes;
  className?: string;
  /** Shows a ring, used to mark note authors and admins. */
  ring?: boolean;
};

export function Avatar({ name, src, size = "md", className, ring = false }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full",
        "bg-gradient-to-br from-primary to-accent font-semibold text-white",
        ring && "ring-2 ring-primary/35 ring-offset-2 ring-offset-background",
        sizes[size],
        className,
      )}
      title={name}
    >
      {showImage ? (
        <Image
          src={src as string}
          alt={name}
          fill
          sizes="80px"
          className="object-cover"
          onError={() => setFailed(true)}
          unoptimized
        />
      ) : (
        <span aria-hidden>{initials(name)}</span>
      )}
      <span className="sr-only">{name}</span>
    </span>
  );
}
