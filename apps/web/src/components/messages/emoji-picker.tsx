"use client";

const EMOJIS = ["❤️", "👍", "😂", "😮", "😢", "😡", "🔥", "🎉", "👏", "🙏"];

export function EmojiPicker({
  onPick,
  onClose,
}: {
  onPick: (emoji: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute right-0 bottom-full mb-2 flex gap-1 rounded-lg border bg-background p-2 shadow-lg">
      {EMOJIS.map((e) => (
        <button
          key={e}
          type="button"
          className="rounded p-1 text-xl hover:bg-muted"
          onClick={() => {
            onPick(e);
            onClose();
          }}
        >
          {e}
        </button>
      ))}
    </div>
  );
}
