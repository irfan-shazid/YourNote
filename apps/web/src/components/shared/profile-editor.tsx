"use client";

import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/http";
import { profileSchema } from "@/lib/validators/note";

/** Lets a signed-in user edit their own display name and bio. */
export function ProfileEditor({
  name: initialName,
  bio: initialBio,
}: {
  name: string;
  bio: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initialName);
  const [bio, setBio] = useState(initialBio ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function save() {
    const parsed = profileSchema.safeParse({ name, bio: bio.trim() || undefined });

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        fieldErrors[key] ??= issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setBusy(true);
    try {
      await api.updateProfile({ name: parsed.data.name, bio: parsed.data.bio ?? null });
      toast.success("Profile updated.");
      setOpen(false);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError && error.isValidation) setErrors(error.fields);
      toast.error(error instanceof ApiError ? error.message : "Could not save your profile.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="size-4" />
        Edit profile
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Edit your profile"
        description="This is what other readers see next to your notes."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void save()} loading={busy}>
              Save changes
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Display name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            error={errors.name}
            maxLength={60}
          />
          <Textarea
            label="Bio"
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            placeholder="What do you study or write about?"
            rows={3}
            error={errors.bio}
            counter={{ value: bio.length, max: 280 }}
          />
        </div>
      </Dialog>
    </>
  );
}
