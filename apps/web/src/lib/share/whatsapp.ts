import { formatDeadline } from "@starstask/shared";

/**
 * Builds the WhatsApp share message for an assignment.
 *
 * Only the public brief facts are included: title, deadline, and the canonical
 * assignment link. The contributor's name, the description, and any attachment
 * stay out of the message, so a share cannot leak more than the page itself.
 */
export type WhatsAppShareInput = {
  title: string;
  deadline: string | null;
  url: string;
};

export function buildWhatsAppShareText({
  title,
  deadline,
  url,
}: WhatsAppShareInput): string {
  const lines = [title.trim()];

  if (deadline) {
    const formatted = formatDeadline(deadline);

    if (formatted !== "Invalid date") {
      lines.push(`Deadline: ${formatted}`);
    }
  }

  lines.push(url);

  return lines.join("\n");
}

export function buildWhatsAppShareUrl(input: WhatsAppShareInput): string {
  return `https://wa.me/?text=${encodeURIComponent(
    buildWhatsAppShareText(input),
  )}`;
}
