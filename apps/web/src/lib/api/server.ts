import "server-only";

import { headers } from "next/headers";

import {
  ApiError,
  request,
  requestData,
  requestList,
  type RequestOptions,
} from "@/lib/api/http";
import type {
  AdminComment,
  AdminStats,
  AdminUser,
  AuditEntry,
  Comment,
  Note,
  Paginated,
  Profile,
  Report,
  TagCount,
} from "@/types/api";

/**
 * Server-side API access for React Server Components.
 *
 * The browser's Better Auth cookie is forwarded verbatim so the Go API sees the
 * same session it would on a direct call. Reads are never cached: a note page
 * has to reflect the viewer's own reactions and bookmarks.
 */
async function authed(options: RequestOptions = {}): Promise<RequestOptions> {
  const cookie = (await headers()).get("cookie") ?? "";

  return {
    ...options,
    cache: "no-store",
    headers: { ...(options.headers ?? {}), ...(cookie ? { cookie } : {}) },
  };
}

type ListQuery = Record<string, string | number | undefined>;

export const serverApi = {
  async notes(query: ListQuery = {}): Promise<Paginated<Note>> {
    return requestList<Note>("/notes", await authed({ query }));
  },

  async note(slug: string): Promise<Note | null> {
    try {
      return await requestData<Note>(`/notes/${encodeURIComponent(slug)}`, await authed());
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },

  async noteForEdit(id: string): Promise<Note | null> {
    try {
      return await requestData<Note>(`/notes/${encodeURIComponent(id)}/edit`, await authed());
    } catch (error) {
      if (error instanceof ApiError && [401, 403, 404].includes(error.status)) return null;
      throw error;
    }
  },

  async comments(noteId: string): Promise<Comment[]> {
    return requestData<Comment[]>(
      `/notes/${encodeURIComponent(noteId)}/comments`,
      await authed(),
    );
  },

  async myNotes(query: ListQuery = {}): Promise<Paginated<Note>> {
    return requestList<Note>("/me/notes", await authed({ query }));
  },

  async myBookmarks(query: ListQuery = {}): Promise<Paginated<Note>> {
    return requestList<Note>("/me/bookmarks", await authed({ query }));
  },

  async profile(id: string): Promise<Profile | null> {
    try {
      return await requestData<Profile>(`/users/${encodeURIComponent(id)}`, await authed());
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },

  async tags(): Promise<TagCount[]> {
    return requestData<TagCount[]>("/tags", await authed());
  },

  async subjects(): Promise<string[]> {
    return requestData<string[]>("/subjects", await authed());
  },

  // ---- admin ------------------------------------------------------------
  async adminStats(): Promise<AdminStats> {
    return requestData<AdminStats>("/admin/stats", await authed());
  },

  async adminUsers(query: ListQuery = {}): Promise<Paginated<AdminUser>> {
    return requestList<AdminUser>("/admin/users", await authed({ query }));
  },

  async adminNotes(query: ListQuery = {}): Promise<Paginated<Note>> {
    return requestList<Note>("/admin/notes", await authed({ query }));
  },

  async adminComments(query: ListQuery = {}): Promise<Paginated<AdminComment>> {
    return requestList<AdminComment>("/admin/comments", await authed({ query }));
  },

  async adminReports(query: ListQuery = {}): Promise<Paginated<Report>> {
    return requestList<Report>("/admin/reports", await authed({ query }));
  },

  async adminActivity(query: ListQuery = {}): Promise<Paginated<AuditEntry>> {
    return requestList<AuditEntry>("/admin/activity", await authed({ query }));
  },
};

/** Re-exported so server components can narrow on API failures. */
export { ApiError, request };
