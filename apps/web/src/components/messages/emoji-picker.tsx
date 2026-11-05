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
    <div className="absolute bottom-full left-0 mb-2 flex max-w-[calc(100vw-2rem)] flex-wrap gap-1 rounded-lg border bg-background p-2 shadow-lg">
      {EMOJIS.map((e) => (
        <button
          key={e}
          type="button"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded p-1 text-xl hover:bg-muted"
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
