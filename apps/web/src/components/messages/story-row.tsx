"use client";

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
  const [stories, setStories] = useState<Story[]>([]);
  const [active, setActive] = useState<Story | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase
      .from("dm_stories" as any)
      .select("id, user_id, mime, path, caption")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => setStories((data ?? []) as unknown as Story[]));
  }, []);

  async function upload(file: File) {
    const supabase = createSupabaseBrowserClient();
    const { data: userData } = await supabase.auth.getUser();
    const me = userData.user?.id;
    if (!me) return;
    // Story media NOT E2EE in v1 (public to authenticated, 24h) — caption only metadata
    const path = `${me}/${crypto.randomUUID()}`;
    const { error } = await supabase.storage
      .from("dm-media")
      .upload(path, file, { contentType: file.type });
    if (error) return;
    await supabase.from("dm_stories" as any).insert({
      user_id: me,
      mime: file.type,
      path,
      caption: null,
    });
    window.location.reload();
  }

  return (
    <div className="mb-4">
      <div className="flex gap-3 overflow-x-auto pb-2">
        <label className="flex flex-col items-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed text-xl">
            +
          </span>
          <span className="mt-1 text-xs">Your story</span>
          <input
            type="file"
            accept="image/*,video/*"
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
            className="flex flex-col items-center"
            onClick={() => setActive(s)}
          >
            <span className="h-14 w-14 rounded-full bg-gradient-to-tr from-pink-500 to-yellow-400 p-[2px]">
              <span className="flex h-full w-full items-center justify-center rounded-full bg-muted text-xl">
                👤
              </span>
            </span>
          </button>
        ))}
      </div>
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
