"use client";

import {
  ImagePlus,
  Loader2,
  MessageSquare,
  Send,
  Smile,
  ThumbsUp,
  Trash2,
  X,
} from "lucide-react";
import Image from "next/image";
import * as React from "react";

import {
  COURSE_COMMENT_EMOJIS,
  type CourseCommentView,
} from "@starstask/contracts";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  classSlug: string;
  courseId: string;
  meetingNumber: number | null;
  currentUserId: string;
  comments: CourseCommentView[];
  onCommentsChange: (next: CourseCommentView[]) => void;
};

function formatTimeAgo(iso: string): string {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function CourseDiscussionThread({
  classSlug,
  courseId,
  meetingNumber,
  currentUserId,
  comments,
  onCommentsChange,
}: Props) {
  const [body, setBody] = React.useState("");
  const [replyTo, setReplyTo] = React.useState<CourseCommentView | null>(null);
  const [imageFile, setImageFile] = React.useState<File | null>(null);
  const [showEmojis, setShowEmojis] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const previewUrl = React.useMemo(
    () => (imageFile ? URL.createObjectURL(imageFile) : null),
    [imageFile],
  );

  React.useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const topLevel = comments.filter((comment) => comment.parent_id === null);
  const repliesByParent = new Map<string, CourseCommentView[]>();

  for (const comment of comments) {
    if (comment.parent_id) {
      const list = repliesByParent.get(comment.parent_id) ?? [];

      list.push(comment);
      repliesByParent.set(comment.parent_id, list);
    }
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (busy || !body.trim()) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const formData = new FormData();

      formData.set("body", body.trim());

      if (meetingNumber !== null) {
        formData.set("meetingNumber", String(meetingNumber));
      }

      if (replyTo) {
        formData.set("parentId", replyTo.id);
      }

      if (imageFile) {
        formData.set("image", imageFile);
      }

      const response = await fetch(
        `/api/classes/${classSlug}/courses/${courseId}/comments`,
        {
          method: "POST",
          body: formData,
        },
      );
      const payload = (await response.json().catch(() => null)) as {
        data?: { comments?: CourseCommentView[] };
        error?: { message?: string };
      } | null;

      if (!response.ok || !payload?.data?.comments) {
        setError(payload?.error?.message ?? "Could not post comment.");
        return;
      }

      onCommentsChange(payload.data.comments);
      setBody("");
      setReplyTo(null);
      setImageFile(null);
      setShowEmojis(false);
    } catch {
      setError("Network error while posting comment.");
    } finally {
      setBusy(false);
    }
  };

  const toggleReaction = async (commentId: string, emoji: string) => {
    setError(null);

    try {
      const response = await fetch(
        `/api/classes/${classSlug}/courses/${courseId}/comments/${commentId}/reactions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emoji }),
        },
      );
      const payload = (await response.json().catch(() => null)) as {
        data?: { reactions?: Record<string, string[]> };
        error?: { message?: string };
      } | null;

      if (!response.ok || !payload?.data?.reactions) {
        setError(payload?.error?.message ?? "Could not update reaction.");
        return;
      }

      const updatedReactions = payload.data.reactions;

      onCommentsChange(
        comments.map((item) =>
          item.id === commentId
            ? { ...item, reactions: updatedReactions }
            : item,
        ),
      );
    } catch {
      setError("Network error while updating reaction.");
    }
  };

  const removeComment = async (commentId: string) => {
    setError(null);

    try {
      const response = await fetch(
        `/api/classes/${classSlug}/courses/${courseId}/comments/${commentId}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        setError("Could not delete comment.");
        return;
      }

      onCommentsChange(
        comments.filter(
          (item) => item.id !== commentId && item.parent_id !== commentId,
        ),
      );
    } catch {
      setError("Network error while deleting comment.");
    }
  };

  const renderComment = (comment: CourseCommentView, isReply = false) => (
    <div
      key={comment.id}
      className={isReply ? "border-border ml-6 border-l pl-3 sm:ml-8" : ""}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-foreground text-xs font-semibold">
              {comment.author_name}
            </span>
            <span className="text-muted-foreground text-[11px]">
              {formatTimeAgo(comment.created_at)}
            </span>
          </div>
          <p className="text-foreground mt-1 text-sm whitespace-pre-wrap break-words">
            {comment.body}
          </p>
          {comment.image_url ? (
            <Image
              src={comment.image_url}
              alt="Comment attachment"
              width={640}
              height={360}
              unoptimized
              className="border-border mt-2 max-h-56 w-auto rounded-lg border object-contain"
            />
          ) : null}

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {COURSE_COMMENT_EMOJIS.map((emoji) => {
              const users = comment.reactions[emoji] ?? [];
              const active = users.includes(currentUserId);

              if (users.length === 0 && !active) {
                return null;
              }

              return (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => void toggleReaction(comment.id, emoji)}
                  className={
                    active
                      ? "border-accent bg-accent-soft text-accent inline-flex min-h-[28px] items-center gap-1 rounded-full border px-2 text-xs font-medium"
                      : "border-border bg-subtle text-muted-foreground hover:text-foreground inline-flex min-h-[28px] items-center gap-1 rounded-full border px-2 text-xs"
                  }
                >
                  <span>{emoji}</span>
                  <span className="tabular-nums">{users.length}</span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => void toggleReaction(comment.id, "👍")}
              className="text-muted-foreground hover:text-foreground inline-flex min-h-[28px] items-center px-1.5 text-xs"
              aria-label="Like comment"
            >
              <ThumbsUp
                aria-hidden="true"
                className="h-3.5 w-3.5"
              />
            </button>

            {!isReply ? (
              <button
                type="button"
                onClick={() => setReplyTo(comment)}
                className="text-muted-foreground hover:text-foreground min-h-[28px] px-1.5 text-xs font-medium"
              >
                Reply
              </button>
            ) : null}
          </div>
        </div>

        {comment.can_delete ? (
          <button
            type="button"
            onClick={() => void removeComment(comment.id)}
            aria-label="Delete comment"
            className="text-muted-foreground hover:text-danger flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
          >
            <Trash2
              aria-hidden="true"
              className="h-3.5 w-3.5"
            />
          </button>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="border-border mt-4 border-t pt-4">
      <p className="text-foreground flex items-center gap-1.5 text-xs font-semibold">
        <MessageSquare
          aria-hidden="true"
          className="text-muted-foreground h-3.5 w-3.5"
        />
        Discussion ({comments.length})
      </p>

      {topLevel.length > 0 ? (
        <div className="mt-3 space-y-3">
          {topLevel.map((comment) => (
            <div
              key={comment.id}
              className="space-y-2.5"
            >
              {renderComment(comment)}
              {(repliesByParent.get(comment.id) ?? []).map((reply) =>
                renderComment(reply, true),
              )}
            </div>
          ))}
        </div>
      ) : null}

      <form
        onSubmit={(event) => void submit(event)}
        className="mt-3 space-y-2"
      >
        {replyTo ? (
          <div className="bg-subtle text-muted-foreground flex items-center justify-between rounded-md px-2.5 py-1 text-xs">
            <span>Replying to {replyTo.author_name}</span>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              aria-label="Cancel reply"
              className="p-0.5 hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}

        <Textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Add a comment or question..."
          rows={2}
          maxLength={2000}
          className="min-h-[68px]"
        />

        {previewUrl ? (
          <div className="relative inline-block">
            <Image
              src={previewUrl}
              alt="Selected upload"
              width={320}
              height={180}
              unoptimized
              className="border-border max-h-32 w-auto rounded-lg border object-contain"
            />
            <button
              type="button"
              onClick={() => setImageFile(null)}
              aria-label="Remove image"
              className="bg-surface border-border absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full border"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}

        {showEmojis ? (
          <div className="border-border bg-subtle flex flex-wrap gap-1 rounded-lg border p-1.5">
            {COURSE_COMMENT_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setBody((prev) => `${prev}${emoji}`)}
                className="hover:bg-surface flex h-8 w-8 items-center justify-center rounded text-base"
              >
                {emoji}
              </button>
            ))}
          </div>
        ) : null}

        {error ? <p className="text-danger text-xs">{error}</p> : null}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(event) =>
                setImageFile(event.target.files?.[0] ?? null)
              }
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-[36px]"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagePlus
                aria-hidden="true"
                className="h-4 w-4"
              />
              Image
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-[36px]"
              onClick={() => setShowEmojis((prev) => !prev)}
            >
              <Smile
                aria-hidden="true"
                className="h-4 w-4"
              />
              Emoji
            </Button>
          </div>

          <Button
            type="submit"
            size="sm"
            disabled={busy || !body.trim()}
            className="min-h-[36px]"
          >
            {busy ? (
              <Loader2
                aria-hidden="true"
                className="h-3.5 w-3.5 animate-spin"
              />
            ) : (
              <Send
                aria-hidden="true"
                className="h-3.5 w-3.5"
              />
            )}
            Comment
          </Button>
        </div>
      </form>
    </div>
  );
}
