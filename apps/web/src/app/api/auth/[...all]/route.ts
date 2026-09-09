import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth";

/**
 * The only API route in the Next.js app: Better Auth's own handler.
 * Everything else - notes, comments, reactions, uploads, moderation - is served
 * by the Go API.
 */
export const { GET, POST } = toNextJsHandler(auth.handler);
