type PublicationSectionHeaderProps = {
  number: number;
  id: string;
  heading: string;
  supporting: string;
};

/**
 * Numbered section header for the assignment publication request form.
 */
export function PublicationSectionHeader({
  number,
  id,
  heading,
  supporting,
}: PublicationSectionHeaderProps) {
  return (
    <div className="flex items-start gap-3">
      <span
        aria-hidden="true"
        className="bg-accent text-accent-foreground flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums"
      >
        {number}
      </span>
      <div className="min-w-0">
        <h3
          id={id}
          className="text-foreground text-base font-semibold tracking-tight"
        >
          {heading}
        </h3>
        <p className="text-muted-foreground mt-0.5 text-sm">{supporting}</p>
      </div>
    </div>
  );
}
