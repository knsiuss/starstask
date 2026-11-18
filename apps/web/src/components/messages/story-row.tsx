"use client";

import { User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Story = {
  id: string;
  user_id: string;
  mime: string;
  path: string;
  caption: string | null;
};

/** IG-like story row: circles, 24h expiry, tap to view. */
export function StoryRow() {
  const router = useRouter();
  const [stories, setStories] = useState<Story[]>([]);
  const [active, setActive] = useState<Story | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase
      .from("dm_stories")
      .select("id, user_id, mime, path, caption")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data, error: fetchError }) => {
        if (fetchError) {
          setError("Could not load stories.");
          return;
        }

        setStories(data ?? []);
      });
  }, []);

  async function upload(file: File) {
    setUploading(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: userData } = await supabase.auth.getUser();
      const me = userData.user?.id;
      if (!me) {
        setError("Sign in to post a story.");
        return;
      }

      // Story media NOT E2EE in v1 (public to authenticated, 24h) — caption only metadata
      const path = `${me}/${crypto.randomUUID()}`;
      const { error: uploadError } = await supabase.storage
        .from("dm-media")
        .upload(path, file, { contentType: file.type });

      if (uploadError) {
        setError("Could not upload story.");
        return;
      }

      const { data: inserted, error: insertError } = await supabase
        .from("dm_stories")
        .insert({
          user_id: me,
          mime: file.type,
          path,
          caption: null,
        })
        .select("id, user_id, mime, path, caption")
        .single();

      if (insertError) {
        setError("Could not save story.");
        return;
      }

      if (inserted) {
        setStories((current) => [inserted, ...current]);
      }

      router.refresh();
    } catch {
      setError("Could not upload story.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mb-4">
      <div className="flex gap-3 overflow-x-auto pb-2">
        <label className="flex flex-col items-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed text-xl">
            {uploading ? "…" : "+"}
          </span>
          <span className="mt-1 text-xs">
            {uploading ? "Uploading…" : "Your story"}
          </span>
          <input
            type="file"
            accept="image/*,video/*"
            disabled={uploading}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
            }}
          />
        </label>
        {stories.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-label="View story"
            className="flex flex-col items-center"
            onClick={() => setActive(s)}
          >
            <span className="bg-accent h-14 w-14 rounded-full p-[2px]">
              <span className="bg-muted flex h-full w-full items-center justify-center rounded-full">
                <User
                  aria-hidden="true"
                  className="text-muted-foreground h-6 w-6"
                />
              </span>
            </span>
          </button>
        ))}
      </div>
      {error ? (
        <p
          role="alert"
          className="text-danger mt-1 text-xs"
        >
          {error}
        </p>
      ) : null}
      {active ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="max-w-md">
            <p className="mb-2 text-center text-sm text-white">
              {active.caption ?? "Story"}
            </p>
            <button
              type="button"
              className="text-sm text-white underline"
              onClick={() => setActive(null)}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
