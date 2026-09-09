"use client";

import { X } from "lucide-react";
import { useState, type KeyboardEvent } from "react";

import { normaliseTags } from "@/lib/validators/note";
import { cn } from "@/lib/utils";

const MAX_TAGS = 8;

/**
 * Chip-style tag entry. Enter, Tab or a comma commits the current word;
 * Backspace on an empty field removes the previous chip.
 */
export function TagInput({
  value,
  onChange,
  suggestions = [],
  disabled,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState("");

  function commit(raw: string) {
    const [tag] = normaliseTags([raw]);
    if (!tag) return;
    if (value.includes(tag) || value.length >= MAX_TAGS) {
      setDraft("");
      return;
    }
    onChange([...value, tag]);
    setDraft("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === "," || event.key === "Tab") {
      if (draft.trim()) {
        event.preventDefault();
        commit(draft);
      }
      return;
    }
    if (event.key === "Backspace" && draft === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  const available = suggestions
    .filter((tag) => !value.includes(tag))
    .slice(0, 6);

  return (
    <div className="space-y-2">
      <label htmlFor="tag-input" className="block text-sm font-medium text-foreground">
        Tags
      </label>

      <div
        className={cn(
          "flex min-h-11 flex-wrap items-center gap-1.5 rounded-xl border border-border bg-surface p-2",
          "transition-all duration-200 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/12",
          disabled && "opacity-60",
        )}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex animate-scale-in items-center gap-1 rounded-lg bg-primary/12 py-1 pr-1 pl-2 text-xs font-medium text-primary"
          >
            #{tag}
            <button
              type="button"
              onClick={() => onChange(value.filter((item) => item !== tag))}
              disabled={disabled}
              aria-label={`Remove tag ${tag}`}
              className="rounded p-0.5 transition-colors hover:bg-primary/20"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}

        <input
          id="tag-input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => draft.trim() && commit(draft)}
          disabled={disabled || value.length >= MAX_TAGS}
          placeholder={
            value.length >= MAX_TAGS
              ? "Tag limit reached"
              : value.length === 0
                ? "calculus, exam-prep..."
                : "Add another"
          }
          className="min-w-32 flex-1 bg-transparent px-1.5 text-sm outline-none placeholder:text-muted-foreground/70"
        />
      </div>

      {available.length > 0 && value.length < MAX_TAGS ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Popular:</span>
          {available.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => commit(tag)}
              disabled={disabled}
              className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-primary/12 hover:text-primary"
            >
              #{tag}
            </button>
          ))}
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground">
        {value.length}/{MAX_TAGS} tags - press Enter or comma to add one.
      </p>
    </div>
  );
}
