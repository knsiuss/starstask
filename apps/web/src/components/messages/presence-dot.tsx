export function PresenceDot({ online }: { online: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={
        online
          ? "border-surface bg-success absolute right-0 bottom-0 h-3 w-3 rounded-full border-2"
          : "border-surface bg-muted-foreground/40 absolute right-0 bottom-0 h-3 w-3 rounded-full border-2"
      }
    />
  );
}
