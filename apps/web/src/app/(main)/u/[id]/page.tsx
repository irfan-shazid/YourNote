import { Calendar, Eye, FileText, Shield, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { NoteGrid } from "@/components/notes/note-grid";
import { ProfileEditor } from "@/components/shared/profile-editor";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { serverApi } from "@/lib/api/server";
import { getCurrentUser } from "@/lib/session";
import { formatCount } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const profile = await serverApi.profile(id);

  return profile
    ? { title: profile.name, description: profile.bio ?? `Notes shared by ${profile.name}.` }
    : { title: "Profile not found" };
}

export default async function ProfilePage({ params }: Props) {
  const { id } = await params;

  const [profile, viewer] = await Promise.all([serverApi.profile(id), getCurrentUser()]);
  if (!profile) notFound();

  const { items } = await serverApi.notes({ authorId: profile.id, pageSize: 24 });
  const isSelf = viewer?.id === profile.id;

  const joined = new Date(profile.createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
  });

  const stats = [
    { label: "Notes", value: profile.noteCount, icon: FileText },
    { label: "Reactions", value: profile.reactionsReceived, icon: Sparkles },
    { label: "Views", value: profile.viewsReceived, icon: Eye },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="surface-card relative overflow-hidden p-6 sm:p-8">
        <div className="grid-backdrop absolute inset-0 opacity-40" />

        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start">
          <Avatar
            name={profile.name}
            src={profile.image}
            size="xl"
            ring={profile.role === "admin"}
          />

          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{profile.name}</h1>
              {profile.role === "admin" ? (
                <Badge tone="primary">
                  <Shield className="size-3" />
                  Admin
                </Badge>
              ) : null}
            </div>

            {profile.bio ? (
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {profile.bio}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                {isSelf ? "Add a bio so people know what you write about." : "No bio yet."}
              </p>
            )}

            <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="size-3.5" />
              Joined {joined}
            </p>

            <div className="flex flex-wrap gap-5 pt-1">
              {stats.map((stat) => (
                <div key={stat.label} className="flex items-center gap-2">
                  <stat.icon className="size-4 text-primary" />
                  <span className="text-sm">
                    <span className="font-semibold tabular-nums">{formatCount(stat.value)}</span>{" "}
                    <span className="text-muted-foreground">{stat.label.toLowerCase()}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {isSelf ? (
            <div className="shrink-0">
              <ProfileEditor name={profile.name} bio={profile.bio} />
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-10 space-y-5">
        <h2 className="text-lg font-semibold tracking-tight">
          {isSelf ? "Your notes" : `Notes by ${profile.name}`}
        </h2>

        <NoteGrid
          notes={items}
          emptyTitle={isSelf ? "You have not published anything yet" : "No notes yet"}
          emptyDescription={
            isSelf
              ? "Your published notes will appear here."
              : "This person has not shared a public note yet."
          }
        />
      </div>
    </div>
  );
}
