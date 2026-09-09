"use client";

import { FileText, ImageIcon, Loader2, Paperclip, Upload, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { uploadToCloudinary } from "@/lib/api/client";
import { cn, formatBytes } from "@/lib/utils";
import type { AttachmentInput } from "@/types/api";

const MAX_FILES = 12;
const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB
const ACCEPTED = ".pdf,.png,.jpg,.jpeg,.webp,.gif,.avif";

type Uploading = {
  id: string;
  name: string;
  size: number;
  progress: number;
};

/**
 * Drag-and-drop uploader. Files go straight from the browser to Cloudinary
 * using a signature minted by the Go API, so neither server handles the bytes.
 */
export function AttachmentUploader({
  value,
  onChange,
  disabled,
}: {
  value: AttachmentInput[];
  onChange: (attachments: AttachmentInput[]) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState<Uploading[]>([]);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      const incoming = Array.from(files);
      const room = MAX_FILES - value.length - uploading.length;

      if (room <= 0) {
        toast.error(`You can attach up to ${MAX_FILES} files to one note.`);
        return;
      }

      const accepted: File[] = [];
      for (const file of incoming.slice(0, room)) {
        if (file.size > MAX_FILE_BYTES) {
          toast.error(`${file.name} is larger than ${formatBytes(MAX_FILE_BYTES)}.`);
          continue;
        }
        accepted.push(file);
      }
      if (incoming.length > room) {
        toast.info(`Only the first ${room} file${room > 1 ? "s were" : " was"} added.`);
      }

      // Uploads run in parallel; each tracks its own progress row.
      await Promise.all(
        accepted.map(async (file) => {
          const id = `${file.name}-${file.size}-${Date.now()}-${Math.random()}`;
          setUploading((current) => [
            ...current,
            { id, name: file.name, size: file.size, progress: 0 },
          ]);

          try {
            const attachment = await uploadToCloudinary(file, (progress) => {
              setUploading((current) =>
                current.map((item) => (item.id === id ? { ...item, progress } : item)),
              );
            });
            onChange([...value, attachment]);
          } catch (error) {
            toast.error(error instanceof Error ? error.message : `Could not upload ${file.name}.`);
          } finally {
            setUploading((current) => current.filter((item) => item.id !== id));
          }
        }),
      );
    },
    [onChange, uploading.length, value],
  );

  function remove(publicId: string) {
    onChange(value.filter((file) => file.publicId !== publicId));
  }

  const busy = uploading.length > 0;
  const full = value.length + uploading.length >= MAX_FILES;

  return (
    <div className="space-y-3">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!disabled) void handleFiles(event.dataTransfer.files);
        }}
        className={cn(
          "relative rounded-2xl border-2 border-dashed p-6 text-center transition-all duration-200",
          dragging
            ? "border-primary bg-primary/6"
            : "border-border-strong bg-surface hover:border-primary/45",
          (disabled || full) && "pointer-events-none opacity-60",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          multiple
          className="sr-only"
          disabled={disabled || full}
          onChange={(event) => {
            void handleFiles(event.target.files);
            event.target.value = "";
          }}
        />

        <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Upload className="size-5" />
        </div>

        <p className="text-sm font-medium text-foreground">
          Drop PDFs or images here
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Up to {MAX_FILES} files, {formatBytes(MAX_FILE_BYTES)} each
        </p>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || full}
        >
          <Paperclip className="size-4" />
          Choose files
        </Button>
      </div>

      {(value.length > 0 || busy) && (
        <ul className="space-y-2">
          {value.map((file) => {
            const pdf = file.format === "pdf";

            return (
              <li
                key={file.publicId}
                className="surface-card flex animate-fade-in items-center gap-3 p-2.5"
              >
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-lg",
                    pdf ? "bg-danger/12 text-danger" : "bg-highlight/12 text-highlight",
                  )}
                >
                  {pdf ? <FileText className="size-4" /> : <ImageIcon className="size-4" />}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {file.originalName ?? file.publicId}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(file.format ?? "file").toUpperCase()} - {formatBytes(file.bytes)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => remove(file.publicId)}
                  disabled={disabled}
                  aria-label={`Remove ${file.originalName ?? "attachment"}`}
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
                >
                  <X className="size-4" />
                </button>
              </li>
            );
          })}

          {uploading.map((item) => (
            <li key={item.id} className="surface-card animate-fade-in space-y-2 p-2.5">
              <div className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Uploading - {item.progress}%
                  </p>
                </div>
              </div>

              <div className="h-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-200"
                  style={{ width: `${item.progress}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
