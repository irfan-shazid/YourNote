import { FileQuestion } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <div className="aurora" />

      <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <FileQuestion className="size-8" />
      </div>

      <h1 className="mt-6 text-4xl font-bold tracking-tight">404</h1>
      <p className="mt-2 max-w-md text-muted-foreground">
        We could not find that page. It may have been removed, or the link is wrong.
      </p>

      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Button asChild>
          <Link href="/notes">Browse notes</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Go home</Link>
        </Button>
      </div>
    </div>
  );
}
