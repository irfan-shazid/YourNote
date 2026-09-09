"use client";

import {
  BookMarked,
  LayoutDashboard,
  LogOut,
  Menu,
  PenLine,
  Search,
  Shield,
  User as UserIcon,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dropdown,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
} from "@/components/ui/dropdown";
import { signOut, useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/notes", label: "Browse" },
  { href: "/dashboard", label: "My notes", private: true },
  { href: "/bookmarks", label: "Saved", private: true },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const user = session?.user;
  const isAdmin = user?.role === "admin";

  // The bar gains a border and blur once the page scrolls, so it separates
  // from the hero without being heavy at rest.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setMobileOpen(false), [pathname]);

  async function handleSignOut() {
    await signOut();
    toast.success("Signed out");
    router.push("/");
    router.refresh();
  }

  const links = navigation.filter((item) => !item.private || Boolean(user));

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-all duration-300",
        scrolled ? "glass border-b" : "border-b border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Logo />

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
                {active ? (
                  <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-primary to-accent" />
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <Link
            href="/notes"
            aria-label="Search notes"
            className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:hidden"
          >
            <Search className="size-[18px]" />
          </Link>

          <ThemeToggle />

          {isPending ? (
            <div className="size-9 animate-pulse rounded-full bg-muted" />
          ) : user ? (
            <>
              <Button asChild size="sm" className="hidden sm:inline-flex">
                <Link href="/notes/new">
                  <PenLine className="size-4" />
                  Write
                </Link>
              </Button>

              <Dropdown
                trigger={({ toggle }) => (
                  <button
                    type="button"
                    onClick={toggle}
                    className="ml-0.5 rounded-full transition-transform hover:scale-105"
                    aria-label="Account menu"
                  >
                    <Avatar name={user.name} src={user.image} size="sm" ring={isAdmin} />
                  </button>
                )}
              >
                {({ close }) => (
                  <>
                    <DropdownLabel>{user.email}</DropdownLabel>

                    <DropdownItem href={`/u/${user.id}`}>
                      <UserIcon className="size-4" />
                      Profile
                    </DropdownItem>
                    <DropdownItem href="/dashboard">
                      <LayoutDashboard className="size-4" />
                      My notes
                    </DropdownItem>
                    <DropdownItem href="/bookmarks">
                      <BookMarked className="size-4" />
                      Saved notes
                    </DropdownItem>

                    {isAdmin ? (
                      <>
                        <DropdownSeparator />
                        <DropdownItem href="/admin">
                          <Shield className="size-4 text-primary" />
                          Admin panel
                        </DropdownItem>
                      </>
                    ) : null}

                    <DropdownSeparator />
                    <DropdownItem
                      tone="danger"
                      onClick={() => {
                        close();
                        void handleSignOut();
                      }}
                    >
                      <LogOut className="size-4" />
                      Sign out
                    </DropdownItem>
                  </>
                )}
              </Dropdown>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/sign-in">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/sign-up">Get started</Link>
              </Button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setMobileOpen((value) => !value)}
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
            className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <div className="glass animate-fade-in border-t md:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3">
            {links.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                {item.label}
              </Link>
            ))}

            {user ? (
              <Link
                href="/notes/new"
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-muted"
              >
                Write a note
              </Link>
            ) : (
              <Link
                href="/sign-in"
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                Sign in
              </Link>
            )}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
