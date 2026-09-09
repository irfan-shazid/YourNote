"use client";

import { Check, Flag, Link2, MoreHorizontal, Pencil, ShieldOff, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Dropdown, DropdownItem, DropdownSeparator } from "@/components/ui/dropdown";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/http";
import type { Note } from "@/types/api";

/** Owner and moderator actions for a single note. */
export function NoteActions({
  note,
  signedIn,
  isAdmin,
}: {
  note: Note;
  signedIn: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/notes/${note.slug}`);
      setCopied(true);
      toast.success("Link copied.");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy the link.");
    }
  }

  async function deleteNote() {
    setBusy(true);
    try {
      await api.deleteNote(note.id);
      toast.success("Note deleted.");
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not delete this note.");
      setBusy(false);
    }
  }

  async function moderate() {
    setBusy(true);
    try {
      const next = note.status === "removed" ? "published" : "removed";
      await api.admin.setNoteStatus(note.id, next, reason.trim() || undefined);
      toast.success(next === "removed" ? "Note removed from public view." : "Note restored.");
      setConfirmRemove(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not update this note.");
    } finally {
      setBusy(false);
    }
  }

  async function report() {
    if (!reason.trim()) {
      toast.error("Tell us what is wrong with this note.");
      return;
    }

    setBusy(true);
    try {
      await api.report({
        targetType: "note",
        targetId: note.id,
        reason: reason.trim(),
        details: details.trim() || null,
      });
      toast.success("Thanks - our moderators will take a look.");
      setReporting(false);
      setReason("");
      setDetails("");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not send that report.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => void copyLink()}>
          {copied ? <Check className="size-4 text-success" /> : <Link2 className="size-4" />}
          <span className="hidden sm:inline">{copied ? "Copied" : "Share"}</span>
        </Button>

        <Dropdown
          trigger={({ toggle }) => (
            <button
              type="button"
              onClick={toggle}
              aria-label="More actions"
              className="flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <MoreHorizontal className="size-4" />
            </button>
          )}
        >
          {({ close }) => (
            <>
              {note.viewer.canEdit ? (
                <DropdownItem href={`/notes/${note.slug}/edit`}>
                  <Pencil className="size-4" />
                  Edit note
                </DropdownItem>
              ) : null}

              {signedIn && !note.viewer.canEdit ? (
                <DropdownItem
                  onClick={() => {
                    close();
                    setReporting(true);
                  }}
                >
                  <Flag className="size-4" />
                  Report note
                </DropdownItem>
              ) : null}

              {isAdmin ? (
                <>
                  <DropdownSeparator />
                  <DropdownItem
                    onClick={() => {
                      close();
                      setReason("");
                      setConfirmRemove(true);
                    }}
                  >
                    <ShieldOff className="size-4" />
                    {note.status === "removed" ? "Restore note" : "Remove from public view"}
                  </DropdownItem>
                </>
              ) : null}

              {note.viewer.canEdit ? (
                <>
                  <DropdownSeparator />
                  <DropdownItem
                    tone="danger"
                    onClick={() => {
                      close();
                      setConfirmDelete(true);
                    }}
                  >
                    <Trash2 className="size-4" />
                    Delete note
                  </DropdownItem>
                </>
              ) : null}
            </>
          )}
        </Dropdown>
      </div>

      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this note?"
        description="The note, its attachments, comments and reactions are removed permanently. This cannot be undone."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void deleteNote()} loading={busy}>
              Delete permanently
            </Button>
          </>
        }
      />

      <Dialog
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        title={note.status === "removed" ? "Restore this note?" : "Remove this note?"}
        description={
          note.status === "removed"
            ? "The note becomes visible to readers again."
            : "The note is hidden from readers. The author keeps their copy and the action is logged."
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmRemove(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant={note.status === "removed" ? "primary" : "danger"}
              onClick={() => void moderate()}
              loading={busy}
            >
              {note.status === "removed" ? "Restore note" : "Remove note"}
            </Button>
          </>
        }
      >
        {note.status !== "removed" ? (
          <Input
            label="Reason (optional)"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Plagiarism, spam, wrong information..."
            maxLength={300}
          />
        ) : null}
      </Dialog>

      <Dialog
        open={reporting}
        onClose={() => setReporting(false)}
        title="Report this note"
        description="Moderators review every report."
        footer={
          <>
            <Button variant="ghost" onClick={() => setReporting(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void report()} loading={busy}>
              Send report
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            label="What is wrong?"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Plagiarism, spam, misinformation..."
            maxLength={120}
          />
          <Textarea
            label="Anything else? (optional)"
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            rows={3}
            maxLength={500}
          />
        </div>
      </Dialog>
    </>
  );
}
