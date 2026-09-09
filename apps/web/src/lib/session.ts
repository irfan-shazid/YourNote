import "server-only";

import { headers } from "next/headers";
import { cache } from "react";

import { auth } from "@/lib/auth";

/**
 * Server-side session access. Wrapped in React's cache so several server
 * components in one render share a single lookup.
 */
export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

/** The signed-in user, or null. */
export async function getCurrentUser() {
  const session = await getSession();
  return session?.user ?? null;
}

/** True when the caller holds the admin role. */
export async function isAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.role === "admin";
}
