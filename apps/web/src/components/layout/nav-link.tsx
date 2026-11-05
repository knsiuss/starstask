"use client";

import { Loader2 } from "lucide-react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils/cn";

type NavLinkProps = {
  href: string;
  children: React.ReactNode;
  onClick?: () => void;
};

export function NavLink({ href, children, onClick }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(`${href}/`);
  const { pending } = useLinkStatus();

  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
        isActive
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {pending && !isActive ? (
        <Loader2
          aria-hidden="true"
          className="h-4 w-4 shrink-0 animate-spin"
        />
      ) : null}
      {children}
    </Link>
  );
}
