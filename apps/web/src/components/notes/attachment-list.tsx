"use client";

import { Download, ExternalLink, FileText, Maximize2, X } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn, formatBytes } from "@/lib/utils";
import type { Attachment } from "@/types/api";

/**
 * Cloudinary stores PDFs as image-type assets, so a first-page JPEG thumbnail
 * can be derived from the same URL with a delivery transformation.
 */
function pdfThumbnail(url: string): string {
  return url.replace("/upload/", "/upload/f_jpg,pg_1,w_640,q_auto/");
}

/** Force a download rather than an inline render. */
function downloadUrl(url: string, filename: string | null): string {
  const suffix = filename ? `fl_attachment:${encodeURIComponent(filename.replace(/\.[^.]+$/, ""))}` : "fl_attachment";
  return url.replace("/upload/", `/upload/${suffix}/`);
}

function isPdf(file: Attachment): boolean {
  return file.format === "pdf";
}

function isImage(file: Attachment): boolean {
  return file.resourceType === "image" && file.format !== "pdf";
}

export function AttachmentList({ attachments }: { attachments: Attachment[] }) {
  const [lightbox, setLightbox] = useState<Attachment | null>(null);
  const [expandedPdf, setExpandedPdf] = useState<string | null>(null);

  if (attachments.length === 0) return null;

  const pdfs = attachments.filter(isPdf);
  const images = attachments.filter(isImage);
  const others = attachments.filter((file) => !isPdf(file) && !isImage(file));

  return (
    <section className="space-y-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        Attachments
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] tabular-nums">
          {attachments.length}
        </span>
      </h2>

      {pdfs.length > 0 ? (
        <div className="space-y-3">
          {pdfs.map((file) => {
            const open = expandedPdf === file.id;

            return (
              <div key={file.id} className="surface-card overflow-hidden">
                <div className="flex items-center gap-3 p-3">
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                    <Image
                      src={pdfThumbnail(file.secureUrl)}
                      alt=""
                      fill
                      sizes="56px"
                      className="object-cover"
                      unoptimized
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {file.originalName ?? "Document.pdf"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      PDF
                      {file.pages ? ` - ${file.pages} page${file.pages > 1 ? "s" : ""}` : ""}
                      {file.bytes ? ` - ${formatBytes(file.bytes)}` : ""}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setExpandedPdf(open ? null : file.id)}
                      aria-expanded={open}
                    >
                      <Maximize2 className="size-3.5" />
                      <span className="hidden sm:inline">{open ? "Hide" : "Preview"}</span>
                    </Button>
                    <Button asChild variant="ghost" size="icon" aria-label="Download PDF">
                      <a href={downloadUrl(file.secureUrl, file.originalName)} download>
                        <Download className="size-4" />
                      </a>
                    </Button>
                  </div>
                </div>

                {open ? (
                  <div className="animate-fade-in border-t border-border bg-muted/40">
                    <iframe
                      src={file.secureUrl}
                      title={file.originalName ?? "PDF preview"}
                      className="h-[70vh] w-full"
                    />
                    <div className="flex justify-end p-2">
                      <Button asChild variant="ghost" size="sm">
                        <a href={file.secureUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="size-3.5" />
                          Open in a new tab
                        </a>
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {images.length > 0 ? (
        <div
          className={cn(
            "grid gap-3",
            images.length === 1 ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-3",
          )}
        >
          {images.map((file) => (
            <button
              key={file.id}
              type="button"
              onClick={() => setLightbox(file)}
              className="group surface-card relative aspect-4/3 overflow-hidden p-0"
              aria-label={`View ${file.originalName ?? "image"}`}
            >
              <Image
                src={file.secureUrl}
                alt={file.originalName ?? ""}
                fill
                sizes="(max-width: 640px) 50vw, 320px"
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                unoptimized
              />
              <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-200 group-hover:bg-black/40 group-hover:opacity-100">
                <Maximize2 className="size-5 text-white" />
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {others.length > 0 ? (
        <ul className="space-y-2">
          {others.map((file) => (
            <li key={file.id}>
              <a
                href={file.secureUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="surface-card flex items-center gap-3 p-3 transition-colors hover:bg-muted"
              >
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-sm">
                  {file.originalName ?? file.publicId}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatBytes(file.bytes)}
                </span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}

      {lightbox ? (
        <div
          className="fixed inset-0 z-100 flex animate-fade-in items-center justify-center bg-black/85 p-4"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
          aria-label={lightbox.originalName ?? "Image preview"}
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            aria-label="Close preview"
            className="absolute top-4 right-4 rounded-lg bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
          >
            <X className="size-5" />
          </button>

          <div className="relative max-h-full max-w-5xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightbox.secureUrl}
              alt={lightbox.originalName ?? ""}
              className="max-h-[85vh] w-auto rounded-xl object-contain"
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
