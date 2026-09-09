import type { PaginationMeta } from "@/types/api";

/** Base URL of the Go API. Every product request goes through it. */
export const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"
).replace(/\/+$/, "");

const API_PREFIX = "/api/v1";

/** The error envelope the Go API returns on failure. */
export type ApiErrorBody = {
  code: string;
  message: string;
  fields?: Record<string, string>;
};

/** Thrown by every request helper when the API responds with an error. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: Record<string, string>;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.name = "ApiError";
    this.status = status;
    this.code = body.code;
    this.fields = body.fields ?? {};
  }

  /** True when the user simply is not signed in. */
  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  /** True when the API rejected the payload field by field. */
  get isValidation(): boolean {
    return this.status === 422;
  }
}

type Envelope<T> = {
  data: T;
  meta?: PaginationMeta;
};

export type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Extra headers; the server helper uses this to forward the session cookie. */
  headers?: Record<string, string>;
  /** Next.js caching hints, used only from server components. */
  cache?: RequestCache;
  next?: { revalidate?: number | false; tags?: string[] };
  signal?: AbortSignal;
};

/** Build a full API URL, dropping empty query values. */
export function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = new URL(`${API_URL}${API_PREFIX}${path}`);

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

/**
 * Perform one API call and unwrap the response envelope.
 *
 * `credentials: "include"` matters in both runtimes: the browser has to attach
 * the Better Auth cookie to a cross-origin call, and the server helper passes
 * the same cookie through explicitly.
 */
export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<{ data: T; meta?: PaginationMeta }> {
  const { method = "GET", body, query, headers = {}, cache, next, signal } = options;

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
      ...(cache ? { cache } : {}),
      ...(next ? { next } : {}),
    });
  } catch {
    // A network-level failure is not an HTTP status, so it is normalised into
    // the same error shape the rest of the app already handles.
    throw new ApiError(0, {
      code: "network_error",
      message: "Could not reach the server. Check your connection and try again.",
    });
  }

  if (response.status === 204) {
    return { data: undefined as T };
  }

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const errorBody =
      payload && typeof payload === "object" && "error" in payload
        ? ((payload as { error: ApiErrorBody }).error)
        : { code: "unknown_error", message: "Something went wrong. Please try again." };
    throw new ApiError(response.status, errorBody);
  }

  const envelope = (payload ?? { data: null }) as Envelope<T>;
  return { data: envelope.data, meta: envelope.meta };
}

/** Convenience wrapper for endpoints that return a bare value. */
export async function requestData<T>(path: string, options?: RequestOptions): Promise<T> {
  const { data } = await request<T>(path, options);
  return data;
}

/** Convenience wrapper for list endpoints, which always carry pagination meta. */
export async function requestList<T>(
  path: string,
  options?: RequestOptions,
): Promise<{ items: T[]; meta: PaginationMeta }> {
  const { data, meta } = await request<T[]>(path, options);
  return {
    items: data ?? [],
    meta: meta ?? { page: 1, pageSize: 0, total: 0, totalPages: 0, hasMore: false },
  };
}
