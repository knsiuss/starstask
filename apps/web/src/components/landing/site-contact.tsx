import { CONTACT_EMAIL } from "@/lib/config/site";

/** Plain mailto line for the footer. Hidden unless NEXT_PUBLIC_CONTACT_EMAIL is set. */
export function SiteContact({ className }: { className?: string }) {
  if (!CONTACT_EMAIL) {
    return null;
  }

  return (
    <a
      href={`mailto:${CONTACT_EMAIL}`}
      className={
        className ??
        "text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
      }
    >
      {CONTACT_EMAIL}
    </a>
  );
}
