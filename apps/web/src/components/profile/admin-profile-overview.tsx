import {
  ClipboardCheck,
  GraduationCap,
  LayoutDashboard,
  ShieldCheck,
  Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import type { MyProfile } from "@starstask/contracts";
import { formatDate } from "@starstask/shared";

import { ProfileBioForm } from "@/components/profile/profile-bio-form";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type AdminProfileOverviewProps = {
  profile: MyProfile | null;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  memberSince: string | null;
};

const ADMIN_TOOLS = [
  {
    href: "/admin",
    label: "Overview",
    description: "Pending reviews and platform state at a glance.",
    icon: LayoutDashboard,
  },
  {
    href: "/admin/verifications",
    label: "Verifications",
    description: "Review class representative requests and evidence.",
    icon: ClipboardCheck,
  },
  {
    href: "/admin/users",
    label: "Users",
    description: "Browse registered accounts and their class memberships.",
    icon: Users,
  },
  {
    href: "/admin/classes",
    label: "Classes",
    description: "Inspect classes, course details, and class admins.",
    icon: GraduationCap,
  },
] as const;

export function AdminProfileOverview({
  profile,
  displayName,
  email,
  avatarUrl,
  memberSince,
}: AdminProfileOverviewProps) {
  const initials =
    displayName
      .split(" ")
      .map((part) => part.charAt(0))
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "PA";

  return (
    <div className="space-y-8">
      <header>
        <p className="text-accent text-xs font-medium tracking-wide uppercase">
          Account
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Admin profile
        </h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
          Your platform administrator identity and shortcuts. Administrator
          access is granted outside this page and cannot be changed here.
        </p>
      </header>

      <Card>
        <div className="flex flex-wrap items-center gap-4">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt=""
              width={64}
              height={64}
              className="h-16 w-16 rounded-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span
              aria-hidden="true"
              className="bg-accent-soft text-accent flex h-16 w-16 items-center justify-center rounded-full text-lg font-semibold"
            >
              {initials}
            </span>
          )}

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-lg font-semibold">{displayName}</p>
              <Badge variant="accent">
                <ShieldCheck
                  aria-hidden="true"
                  className="h-3 w-3"
                />
                Platform admin
              </Badge>
            </div>
            {profile?.fullName ? (
              <p className="text-muted-foreground mt-0.5 text-sm">
                {profile.fullName}
              </p>
            ) : null}
          </div>
        </div>

        <dl className="border-border mt-5 grid gap-4 border-t pt-5 sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Email
            </dt>
            <dd className="mt-1 text-sm">{email ?? "Not available"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Member since
            </dt>
            <dd className="mt-1 text-sm">
              {memberSince ? formatDate(memberSince) : "Not available"}
            </dd>
          </div>
        </dl>

        <p className="text-muted-foreground mt-4 text-xs leading-relaxed">
          This is a platform administrator account. Student-only details such as
          NIM, university, and class representative verification do not apply
          here.
        </p>
      </Card>

      <section aria-labelledby="admin-tools-heading">
        <div className="mb-4">
          <h2
            id="admin-tools-heading"
            className="text-xl font-semibold tracking-tight"
          >
            Admin tools
          </h2>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
            Shortcuts for the work only a platform administrator can do.
          </p>
        </div>

        <ul className="grid gap-3 sm:grid-cols-2">
          {ADMIN_TOOLS.map((tool) => (
            <li key={tool.href}>
              <Link
                href={tool.href}
                className="border-border bg-surface hover:bg-muted/60 focus-visible:outline-accent flex items-start gap-3 rounded-lg border p-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <span className="bg-accent-soft text-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
                  <tool.icon
                    aria-hidden="true"
                    className="h-4 w-4"
                  />
                </span>
                <span className="min-w-0">
                  <span className="text-foreground block text-sm font-medium">
                    {tool.label}
                  </span>
                  <span className="text-muted-foreground mt-0.5 block text-xs leading-relaxed">
                    {tool.description}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="admin-bio-heading">
        <div className="mb-4">
          <h2
            id="admin-bio-heading"
            className="text-xl font-semibold tracking-tight"
          >
            Public bio
          </h2>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
            Optional. Visible to members of classes you belong to. Leave it
            empty to hide it.
          </p>
        </div>

        <ProfileBioForm initialBio={profile?.bio ?? ""} />
      </section>
    </div>
  );
}
