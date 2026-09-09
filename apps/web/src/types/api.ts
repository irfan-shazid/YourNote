/**
 * Wire types for the Go API. These mirror the JSON produced by
 * apps/api/internal/models, and are the single definition the whole web app
 * codes against.
 */

export type Role = "user" | "admin";

export type Visibility = "public" | "unlisted" | "private";
export type NoteStatus = "published" | "draft" | "removed";

export const REACTION_TYPES = ["like", "love", "fire", "insightful", "clap", "wow"] as const;
export type ReactionType = (typeof REACTION_TYPES)[number];

export type UserSummary = {
  id: string;
  name: string;
  image: string | null;
  role: Role;
};

export type Attachment = {
  id: string;
  noteId: string;
  url: string;
  secureUrl: string;
  publicId: string;
  resourceType: "image" | "video" | "raw";
  format: string | null;
  originalName: string | null;
  bytes: number;
  width: number | null;
  height: number | null;
  pages: number | null;
  position: number;
  createdAt: string;
};

export type NoteStats = {
  views: number;
  comments: number;
  reactions: number;
  bookmarks: number;
  reactionCounts: Partial<Record<ReactionType, number>>;
};

export type NoteViewer = {
  reactions: ReactionType[];
  bookmarked: boolean;
  canEdit: boolean;
};

export type Note = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  content?: string;
  subject: string | null;
  tags: string[];
  coverImage: string | null;
  visibility: Visibility;
  status: NoteStatus;
  createdAt: string;
  updatedAt: string;
  author: UserSummary;
  attachments: Attachment[];
  stats: NoteStats;
  viewer: NoteViewer;
};

export type Comment = {
  id: string;
  noteId: string;
  parentId: string | null;
  content: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  author: UserSummary;
  replies: Comment[];
  canEdit: boolean;
  canDelete: boolean;
};

export type AdminComment = Comment & {
  noteTitle: string;
  noteSlug: string;
};

export type Profile = {
  id: string;
  name: string;
  image: string | null;
  bio: string | null;
  role: Role;
  createdAt: string;
  noteCount: number;
  reactionsReceived: number;
  viewsReceived: number;
};

export type Identity = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  bio: string | null;
  role: Role;
  emailVerified: boolean;
  banned: boolean;
  banReason?: string | null;
  banExpires?: string | null;
};

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: Role;
  emailVerified: boolean;
  banned: boolean;
  banReason: string | null;
  banExpires: string | null;
  providers: string[];
  noteCount: number;
  commentCount: number;
  activeSession: boolean;
  lastSeenAt: string | null;
  createdAt: string;
};

export type DayCount = {
  date: string;
  count: number;
};

export type AdminStats = {
  totalUsers: number;
  verifiedUsers: number;
  bannedUsers: number;
  adminUsers: number;
  newUsersToday: number;
  newUsersThisWeek: number;
  loggedInUsers: number;
  activeSessions: number;
  totalNotes: number;
  publicNotes: number;
  draftNotes: number;
  removedNotes: number;
  totalComments: number;
  hiddenComments: number;
  totalReactions: number;
  totalViews: number;
  attachments: number;
  storageBytes: number;
  openReports: number;
  signupTrend: DayCount[];
  noteTrend: DayCount[];
  topNotes: Note[];
  recentUsers: AdminUser[];
};

export type Report = {
  id: string;
  targetType: "note" | "comment";
  targetId: string;
  reason: string;
  details: string | null;
  status: "open" | "resolved" | "dismissed";
  createdAt: string;
  resolvedAt: string | null;
  reporter: UserSummary;
  preview: string | null;
  link: string | null;
};

export type AuditEntry = {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  reason: string | null;
  createdAt: string;
  admin: UserSummary;
};

export type TagCount = {
  tag: string;
  count: number;
};

export type ReactionResult = {
  reacted: boolean;
  type: ReactionType;
  total: number;
  reactionCounts: Partial<Record<ReactionType, number>>;
  viewerReactions: ReactionType[];
};

export type BookmarkResult = {
  bookmarked: boolean;
  total: number;
};

export type UploadSignature = {
  timestamp: number;
  signature: string;
  apiKey: string;
  cloudName: string;
  folder: string;
  uploadUrl: string;
};

export type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
};

export type Paginated<T> = {
  items: T[];
  meta: PaginationMeta;
};

/** Payload accepted by POST /notes and PUT /notes/{id}. */
export type NoteInput = {
  title: string;
  summary: string | null;
  content: string;
  subject: string | null;
  tags: string[];
  coverImage: string | null;
  visibility: Visibility;
  status: Exclude<NoteStatus, "removed">;
  attachments: AttachmentInput[];
};

export type AttachmentInput = {
  url: string;
  secureUrl: string;
  publicId: string;
  resourceType: "image" | "video" | "raw";
  format: string | null;
  originalName: string | null;
  bytes: number;
  width: number | null;
  height: number | null;
  pages: number | null;
};
