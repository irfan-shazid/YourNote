"use client";

import { forwardRef, useId, type TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  error?: string;
  hint?: string;
  /** Shows a live "used / limit" counter under the field. */
  counter?: { value: number; max: number };
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, label, error, hint, counter, id, ...props },
  ref,
) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const over = counter ? counter.value > counter.max : false;

  return (
    <div className="w-full space-y-1.5">
      {label ? (
        <label htmlFor={fieldId} className="block text-sm font-medium text-foreground">
          {label}
        </label>
      ) : null}

      <textarea
        ref={ref}
        id={fieldId}
        aria-invalid={error ? true : undefined}
        className={cn(
          "w-full resize-y rounded-xl border bg-surface px-3.5 py-3 text-sm text-foreground",
          "placeholder:text-muted-foreground/70",
          "transition-all duration-200 outline-none",
          "focus:border-primary focus:ring-4 focus:ring-primary/12",
          "disabled:cursor-not-allowed disabled:opacity-60",
          error ? "border-danger focus:border-danger focus:ring-danger/12" : "border-border",
          className,
        )}
        {...props}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {error ? (
            <p className="text-xs font-medium text-danger">{error}</p>
          ) : hint ? (
            <p className="text-xs text-muted-foreground">{hint}</p>
          ) : null}
        </div>

        {counter ? (
          <span
            className={cn(
              "shrink-0 text-xs tabular-nums",
              over ? "font-medium text-danger" : "text-muted-foreground",
            )}
          >
            {counter.value} / {counter.max}
          </span>
        ) : null}
      </div>
    </div>
  );
});
