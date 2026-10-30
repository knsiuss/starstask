import Image from "next/image";

export function AdminUserCell({
  displayName,
  avatarUrl,
}: {
  displayName: string;
  avatarUrl: string | null;
}) {
  const initials = displayName
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <span className="flex min-w-0 items-center gap-2.5">
      {avatarUrl ? (
        <Image
          src={avatarUrl}
          alt=""
          width={28}
          height={28}
          className="h-7 w-7 shrink-0 rounded-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span
          aria-hidden="true"
          className="bg-accent-soft text-accent flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
        >
          {initials || "ST"}
        </span>
      )}
      <span className="truncate font-medium">{displayName}</span>
    </span>
  );
}
