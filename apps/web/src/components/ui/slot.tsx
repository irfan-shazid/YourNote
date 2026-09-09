import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Minimal `asChild` implementation: merges the parent's props onto its single
 * child element, so a Button can render a Next.js <Link> while keeping the
 * button styling without pulling in a headless UI dependency.
 *
 * Deliberately not a client component. Server components render Buttons too,
 * and a client Slot would receive its children as a serialised RSC payload
 * where `Children.only` throws instead of seeing one element.
 */
export function Slot({
  children,
  className,
  ...props
}: { children?: ReactNode; className?: string } & Record<string, unknown>) {
  // toArray drops nulls and the whitespace JSX leaves behind, so the real
  // element is found whether it arrived directly or through an RSC payload.
  const child = Children.toArray(children).find(isValidElement) as
    | ReactElement<Record<string, unknown>>
    | undefined;

  if (!child) return <>{children}</>;

  const childProps = child.props;

  return cloneElement(child, {
    ...props,
    ...childProps,
    className: cn(className, childProps.className as string | undefined),
  });
}
