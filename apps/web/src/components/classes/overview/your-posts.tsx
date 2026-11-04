import { ArrowRight, Megaphone, Plus } from "lucide-react";
import { FolderOpen } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { OverviewPost } from "@/lib/db/class-overview";
import { formatDate } from "@starstask/shared";

type Props = {
  posts: OverviewPost[];
  viewAllHref: string;
  canManage: boolean;
  createPostHref: string;
};

/**
 * Class announcements (published `class_announcement` rows). Students read
 * them; class admins can create posts and keep managing them through the
 * existing class review/moderation flows.
 */
export function YourPosts({
  posts,
  viewAllHref,
  canManage,
  createPostHref,
}: Props) {
  return (
    <section
      aria-labelledby="your-posts"
      className="border-border bg-surface overflow-hidden rounded-xl border"
    >
      <div className="flex items-center justify-between gap-2 px-5 py-4">
        <h2
          id="your-posts"
          className="text-accent inline-flex items-center gap-2 text-base font-semibold tracking-tight"
        >
          <Megaphone
            aria-hidden="true"
            className="h-5 w-5"
          />
          Your Posts
        </h2>
        <Link
          href={viewAllHref}
          className="text-accent hover:text-accent-hover inline-flex items-center gap-1 text-xs font-semibold transition-colors"
        >
          View all
          <ArrowRight
            aria-hidden="true"
            className="h-3.5 w-3.5"
          />
        </Link>
      </div>

      {posts.length === 0 ? (
        <div className="flex flex-wrap items-center justify-center gap-5 px-5 py-10 text-center sm:text-left">
          <span
            aria-hidden="true"
            className="bg-accent-soft text-accent flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl"
          >
            <FolderOpen className="h-8 w-8" />
          </span>
          <div className="min-w-0">
            <p className="text-foreground font-semibold">No posts yet.</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Share class announcements, materials, or important updates.
            </p>
          </div>
          {canManage ? (
            <Button
              asChild
              variant="secondary"
              className="sm:ml-auto"
            >
              <Link href={createPostHref}>
                <Plus
                  aria-hidden="true"
                  className="h-4 w-4"
                />
                Create Post
              </Link>
            </Button>
          ) : null}
        </div>
      ) : (
        <ul className="divide-border divide-y">
          {posts.map((post) => (
            <li
              key={post.id}
              className="flex items-start gap-3 px-5 py-4"
            >
              <span
                aria-hidden="true"
                className="bg-accent-soft text-accent mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
              >
                <Megaphone className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/assignments/${post.id}`}
                  className="hover:text-accent text-foreground block truncate text-sm font-semibold tracking-tight focus-visible:outline-accent rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  {post.title}
                </Link>
                <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs leading-relaxed">
                  {post.description}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {post.author_name} · published{" "}
                  {formatDate(post.published_at ?? post.created_at)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
