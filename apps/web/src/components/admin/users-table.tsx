"use client";

import { Ban, Mail, Search, Shield, ShieldOff, Trash2, UserCog } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Dropdown, DropdownItem, DropdownSeparator } from "@/components/ui/dropdown";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/http";
import type { AdminUser, Paginated, PaginationMeta } from "@/types/api";

type PendingAction =
  | { kind: "ban"; user: AdminUser }
  | { kind: "unban"; user: AdminUser }
  | { kind: "role"; user: AdminUser; role: "user" | "admin" }
  | { kind: "delete"; user: AdminUser };

const statusOptions = [
  { value: "", label: "All users" },
  { value: "online", label: "Signed in now" },
  { value: "verified", label: "Verified" },
  { value: "unverified", label: "Unverified" },
  { value: "banned", label: "Banned" },
];

const roleOptions = [
  { value: "", label: "Any role" },
  { value: "user", label: "Members" },
  { value: "admin", label: "Admins" },
];

export function UsersTable({
  initial,
  currentUserId,
}: {
  initial: Paginated<AdminUser>;
  currentUserId: string;
}) {
  const [users, setUsers] = useState(initial.items);
  const [meta, setMeta] = useState<PaginationMeta>(initial.meta);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [role, setRole] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const [pending, setPending] = useState<PendingAction | null>(null);
  const [reason, setReason] = useState("");
  const [banDays, setBanDays] = useState("0");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.admin.users({
        page,
        pageSize: 20,
        search: search || undefined,
        status: status || undefined,
        role: role || undefined,
      });
      setUsers(result.items);
      setMeta(result.meta);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not load users.");
    } finally {
      setLoading(false);
    }
  }, [page, search, status, role]);

  // Debounced so typing in the search box does not fire a request per key.
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 300);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function applyAction() {
    if (!pending) return;

    setBusy(true);
    try {
      switch (pending.kind) {
        case "ban":
          await api.admin.updateUser(pending.user.id, {
            banned: true,
            banReason: reason.trim() || null,
            banDays: Number(banDays) || null,
          });
          toast.success(`${pending.user.name} has been suspended.`);
          break;

        case "unban":
          await api.admin.updateUser(pending.user.id, { banned: false });
          toast.success(`${pending.user.name} can sign in again.`);
          break;

        case "role":
          await api.admin.updateUser(pending.user.id, { role: pending.role });
          toast.success(
            pending.role === "admin"
              ? `${pending.user.name} is now an admin.`
              : `${pending.user.name} is now a member.`,
          );
          break;

        case "delete":
          await api.admin.deleteUser(pending.user.id, reason.trim() || undefined);
          toast.success("Account deleted.");
          break;
      }

      setPending(null);
      setReason("");
      setBanDays("0");
      await load();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not apply that change.");
    } finally {
      setBusy(false);
    }
  }

  const dialogCopy = {
    ban: {
      title: "Suspend this account?",
      description:
        "They are signed out everywhere immediately and cannot post, comment or react until the ban is lifted.",
      confirm: "Suspend account",
    },
    unban: {
      title: "Lift this suspension?",
      description: "They will be able to sign in and post again.",
      confirm: "Lift suspension",
    },
    role: {
      title: "Change this role?",
      description:
        "Admins can moderate every note and comment, and can see the whole admin panel.",
      confirm: "Change role",
    },
    delete: {
      title: "Delete this account?",
      description:
        "Their notes, comments and reactions are removed permanently. This cannot be undone.",
      confirm: "Delete permanently",
    },
  } as const;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search by name or email..."
            aria-label="Search users"
            className="h-11 w-full rounded-xl border border-border bg-surface pr-3 pl-10 text-sm outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/12"
          />
        </div>

        <div className="flex gap-2">
          <Select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            options={statusOptions}
            aria-label="Filter by status"
            className="w-40"
          />
          <Select
            value={role}
            onChange={(event) => {
              setRole(event.target.value);
              setPage(1);
            }}
            options={roleOptions}
            aria-label="Filter by role"
            className="w-36"
          />
        </div>
      </div>

      <div className="surface-card overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-12" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <EmptyState
            icon={<UserCog className="size-6" />}
            title="No users match those filters"
            className="border-0"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-3xl text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs tracking-wide text-muted-foreground uppercase">
                  <th className="p-4 font-medium">User</th>
                  <th className="p-4 font-medium">Status</th>
                  <th className="p-4 font-medium">Sign-in</th>
                  <th className="p-4 text-right font-medium">Notes</th>
                  <th className="p-4 text-right font-medium">Comments</th>
                  <th className="p-4 font-medium">Joined</th>
                  <th className="p-4" />
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {users.map((user) => {
                  const isSelf = user.id === currentUserId;

                  return (
                    <tr key={user.id} className="transition-colors hover:bg-muted/40">
                      <td className="p-4">
                        <Link href={`/u/${user.id}`} className="flex items-center gap-3">
                          <Avatar
                            name={user.name}
                            src={user.image}
                            size="sm"
                            ring={user.role === "admin"}
                          />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">
                              {user.name}
                              {isSelf ? (
                                <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>
                              ) : null}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                          </div>
                        </Link>
                      </td>

                      <td className="p-4">
                        <div className="flex flex-wrap gap-1">
                          {user.banned ? (
                            <Badge tone="danger">Suspended</Badge>
                          ) : user.activeSession ? (
                            <Badge tone="success">Online</Badge>
                          ) : (
                            <Badge>Offline</Badge>
                          )}
                          {user.role === "admin" ? (
                            <Badge tone="primary">
                              <Shield className="size-3" />
                              Admin
                            </Badge>
                          ) : null}
                          {!user.emailVerified ? (
                            <Badge tone="warning">Unverified</Badge>
                          ) : null}
                        </div>
                      </td>

                      <td className="p-4">
                        <div className="flex flex-wrap gap-1">
                          {user.providers.length === 0 ? (
                            <span className="text-xs text-muted-foreground">-</span>
                          ) : (
                            user.providers.map((provider) => (
                              <Badge key={provider} className="capitalize">
                                {provider === "credential" ? (
                                  <>
                                    <Mail className="size-3" />
                                    Email
                                  </>
                                ) : (
                                  provider
                                )}
                              </Badge>
                            ))
                          )}
                        </div>
                      </td>

                      <td className="p-4 text-right tabular-nums">{user.noteCount}</td>
                      <td className="p-4 text-right tabular-nums">{user.commentCount}</td>

                      <td className="p-4 text-xs whitespace-nowrap text-muted-foreground">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>

                      <td className="p-4 text-right">
                        {isSelf ? (
                          <span className="text-xs text-muted-foreground">-</span>
                        ) : (
                          <Dropdown
                            trigger={({ toggle }) => (
                              <button
                                type="button"
                                onClick={toggle}
                                aria-label={`Actions for ${user.name}`}
                                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                              >
                                <UserCog className="size-4" />
                              </button>
                            )}
                          >
                            {({ close }) => (
                              <>
                                <DropdownItem
                                  onClick={() => {
                                    close();
                                    setPending({
                                      kind: "role",
                                      user,
                                      role: user.role === "admin" ? "user" : "admin",
                                    });
                                  }}
                                >
                                  <Shield className="size-4" />
                                  {user.role === "admin" ? "Make a member" : "Make an admin"}
                                </DropdownItem>

                                {user.banned ? (
                                  <DropdownItem
                                    onClick={() => {
                                      close();
                                      setPending({ kind: "unban", user });
                                    }}
                                  >
                                    <ShieldOff className="size-4" />
                                    Lift suspension
                                  </DropdownItem>
                                ) : (
                                  <DropdownItem
                                    onClick={() => {
                                      close();
                                      setReason("");
                                      setBanDays("0");
                                      setPending({ kind: "ban", user });
                                    }}
                                  >
                                    <Ban className="size-4" />
                                    Suspend account
                                  </DropdownItem>
                                )}

                                <DropdownSeparator />

                                <DropdownItem
                                  tone="danger"
                                  onClick={() => {
                                    close();
                                    setReason("");
                                    setPending({ kind: "delete", user });
                                  }}
                                >
                                  <Trash2 className="size-4" />
                                  Delete account
                                </DropdownItem>
                              </>
                            )}
                          </Dropdown>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pagination meta={meta} onChange={setPage} />

      <Dialog
        open={Boolean(pending)}
        onClose={() => setPending(null)}
        title={pending ? dialogCopy[pending.kind].title : ""}
        description={pending ? dialogCopy[pending.kind].description : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPending(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant={
                pending?.kind === "delete" || pending?.kind === "ban" ? "danger" : "primary"
              }
              onClick={() => void applyAction()}
              loading={busy}
            >
              {pending ? dialogCopy[pending.kind].confirm : ""}
            </Button>
          </>
        }
      >
        {pending ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl bg-muted p-3">
              <Avatar name={pending.user.name} src={pending.user.image} size="sm" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{pending.user.name}</p>
                <p className="truncate text-xs text-muted-foreground">{pending.user.email}</p>
              </div>
            </div>

            {pending.kind === "ban" ? (
              <>
                <Input
                  label="Reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Repeated spam, harassment..."
                  maxLength={300}
                  hint="Shown to the user when they try to act."
                />
                <Select
                  label="Duration"
                  value={banDays}
                  onChange={(event) => setBanDays(event.target.value)}
                  options={[
                    { value: "0", label: "Permanent" },
                    { value: "1", label: "1 day" },
                    { value: "7", label: "7 days" },
                    { value: "30", label: "30 days" },
                    { value: "90", label: "90 days" },
                  ]}
                />
              </>
            ) : null}

            {pending.kind === "delete" ? (
              <Input
                label="Reason (optional)"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={300}
              />
            ) : null}
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
