"use client";

import { requestData, requestList } from "@/lib/api/http";
import type {
  AdminComment,
  AdminUser,
  AttachmentInput,
  BookmarkResult,
  Comment,
  Note,
  NoteInput,
  Paginated,
  Profile,
  ReactionResult,
  ReactionType,
  Report,
  UploadSignature,
} from "@/types/api";

/**
 * Browser-side API access. Every call carries the Better Auth cookie, so the Go
 * service authenticates and authorises it exactly as it would a server call.
 */
type ListQuery = Record<string, string | number | undefined>;

export const api = {
  notes(query: ListQuery = {}): Promise<Paginated<Note>> {
    return requestList<Note>("/notes", { query });
  },

  note(slug: string): Promise<Note> {
    return requestData<Note>(`/notes/${encodeURIComponent(slug)}`);
  },

  createNote(input: NoteInput): Promise<Note> {
    return requestData<Note>("/notes", { method: "POST", body: input });
  },

  updateNote(id: string, input: NoteInput): Promise<Note> {
    return requestData<Note>(`/notes/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: input,
    });
  },

  deleteNote(id: string): Promise<void> {
    return requestData<void>(`/notes/${encodeURIComponent(id)}`, { method: "DELETE" });
  },

  registerView(noteId: string): Promise<void> {
    return requestData<void>(`/notes/${encodeURIComponent(noteId)}/view`, { method: "POST" });
  },

  // ---- engagement -------------------------------------------------------
  react(noteId: string, type: ReactionType): Promise<ReactionResult> {
    return requestData<ReactionResult>(`/notes/${encodeURIComponent(noteId)}/reactions`, {
      method: "POST",
      body: { type },
    });
  },

  toggleBookmark(noteId: string): Promise<BookmarkResult> {
    return requestData<BookmarkResult>(`/notes/${encodeURIComponent(noteId)}/bookmark`, {
      method: "POST",
    });
  },

  // ---- discussion -------------------------------------------------------
  comments(noteId: string): Promise<Comment[]> {
    return requestData<Comment[]>(`/notes/${encodeURIComponent(noteId)}/comments`);
  },

  addComment(noteId: string, content: string, parentId?: string | null): Promise<Comment> {
    return requestData<Comment>(`/notes/${encodeURIComponent(noteId)}/comments`, {
      method: "POST",
      body: { content, parentId: parentId ?? null },
    });
  },

  editComment(commentId: string, content: string): Promise<Comment> {
    return requestData<Comment>(`/comments/${encodeURIComponent(commentId)}`, {
      method: "PATCH",
      body: { content, parentId: null },
    });
  },

  deleteComment(commentId: string, reason?: string): Promise<void> {
    return requestData<void>(`/comments/${encodeURIComponent(commentId)}`, {
      method: "DELETE",
      query: reason ? { reason } : undefined,
    });
  },

  report(input: {
    targetType: "note" | "comment";
    targetId: string;
    reason: string;
    details?: string | null;
  }): Promise<void> {
    return requestData<void>("/reports", {
      method: "POST",
      body: { ...input, details: input.details ?? null },
    });
  },

  // ---- account ----------------------------------------------------------
  updateProfile(input: { name: string; bio: string | null }): Promise<Profile> {
    return requestData<Profile>("/me", { method: "PATCH", body: input });
  },

  uploadSignature(): Promise<UploadSignature> {
    return requestData<UploadSignature>("/uploads/signature", { method: "POST" });
  },

  // ---- admin ------------------------------------------------------------
  admin: {
    users(query: ListQuery = {}): Promise<Paginated<AdminUser>> {
      return requestList<AdminUser>("/admin/users", { query });
    },

    updateUser(
      id: string,
      input: {
        role?: "user" | "admin";
        banned?: boolean;
        banReason?: string | null;
        banDays?: number | null;
      },
    ): Promise<void> {
      return requestData<void>(`/admin/users/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: input,
      });
    },

    deleteUser(id: string, reason?: string): Promise<void> {
      return requestData<void>(`/admin/users/${encodeURIComponent(id)}`, {
        method: "DELETE",
        query: reason ? { reason } : undefined,
      });
    },

    notes(query: ListQuery = {}): Promise<Paginated<Note>> {
      return requestList<Note>("/admin/notes", { query });
    },

    setNoteStatus(id: string, status: "removed" | "published", reason?: string): Promise<void> {
      return requestData<void>(`/admin/notes/${encodeURIComponent(id)}/status`, {
        method: "PATCH",
        body: { status, reason: reason ?? null },
      });
    },

    deleteNote(id: string): Promise<void> {
      return requestData<void>(`/admin/notes/${encodeURIComponent(id)}`, { method: "DELETE" });
    },

    comments(query: ListQuery = {}): Promise<Paginated<AdminComment>> {
      return requestList<AdminComment>("/admin/comments", { query });
    },

    removeComment(id: string, reason?: string): Promise<void> {
      return requestData<void>(`/admin/comments/${encodeURIComponent(id)}`, {
        method: "DELETE",
        query: reason ? { reason } : undefined,
      });
    },

    restoreComment(id: string): Promise<void> {
      return requestData<void>(`/admin/comments/${encodeURIComponent(id)}/restore`, {
        method: "POST",
      });
    },

    purgeComment(id: string, reason?: string): Promise<void> {
      return requestData<void>(`/admin/comments/${encodeURIComponent(id)}/purge`, {
        method: "DELETE",
        query: reason ? { reason } : undefined,
      });
    },

    reports(query: ListQuery = {}): Promise<Paginated<Report>> {
      return requestList<Report>("/admin/reports", { query });
    },

    resolveReport(id: string, status: "resolved" | "dismissed" | "open"): Promise<void> {
      return requestData<void>(`/admin/reports/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: { status },
      });
    },
  },
};

/**
 * Upload one file straight to Cloudinary using a signature minted by the Go
 * API. The file never passes through Next.js or the API, which keeps large
 * PDF uploads off both servers.
 */
export async function uploadToCloudinary(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<AttachmentInput> {
  const signature = await api.uploadSignature();

  const form = new FormData();
  form.append("file", file);
  form.append("api_key", signature.apiKey);
  form.append("timestamp", String(signature.timestamp));
  form.append("signature", signature.signature);
  form.append("folder", signature.folder);

  const payload = await new Promise<Record<string, unknown>>((resolve, reject) => {
    // XMLHttpRequest is used instead of fetch purely for upload progress,
    // which matters for multi-megabyte lecture PDFs.
    const xhr = new XMLHttpRequest();
    xhr.open("POST", signature.uploadUrl);

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      try {
        const parsed = JSON.parse(xhr.responseText) as Record<string, unknown>;
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(parsed);
          return;
        }
        const error = parsed.error as { message?: string } | undefined;
        reject(new Error(error?.message ?? "Cloudinary rejected the upload."));
      } catch {
        reject(new Error("Cloudinary returned an unexpected response."));
      }
    });

    xhr.addEventListener("error", () => reject(new Error("The upload failed. Check your connection.")));
    xhr.addEventListener("abort", () => reject(new Error("The upload was cancelled.")));

    xhr.send(form);
  });

  return {
    url: String(payload.url ?? ""),
    secureUrl: String(payload.secure_url ?? ""),
    publicId: String(payload.public_id ?? ""),
    resourceType: (payload.resource_type as AttachmentInput["resourceType"]) ?? "image",
    format: (payload.format as string | undefined) ?? null,
    originalName: file.name,
    bytes: Number(payload.bytes ?? file.size),
    width: (payload.width as number | undefined) ?? null,
    height: (payload.height as number | undefined) ?? null,
    pages: (payload.pages as number | undefined) ?? null,
  };
}
