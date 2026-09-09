"use client";

import {
  FileText,
  Flag,
  LayoutDashboard,
  MessageSquare,
  ScrollText,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const links = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/notes", label: "Notes", icon: FileText },
  { href: "/admin/comments", label: "Comments", icon: MessageSquare },
  { href: "/admin/reports", label: "Reports", icon: Flag },
  { href: "/admin/activity", label: "Audit log", icon: ScrollText },
];

export function AdminSidebar({ openReports }: { openReports: number }) {
  const pathname = usePathname();

  return (
    <nav
      className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible"
      aria-label="Admin sections"
    >
      {links.map((link) => {
        const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary/12 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <link.icon className="size-4" />
            {link.label}

            {link.href === "/admin/reports" && openReports > 0 ? (
              <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white tabular-nums">
                {openReports > 9 ? "9+" : openReports}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
