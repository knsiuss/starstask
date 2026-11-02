import { Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  buildWhatsAppShareText,
  buildWhatsAppShareUrl,
} from "@/lib/share/whatsapp";

type WhatsAppShareCardProps = {
  title: string;
  deadline: string | null;
  url: string;
};

/**
 * Shares a published assignment to WhatsApp.
 *
 * The message is built on the server so it contains exactly the title, the
 * deadline, and the canonical link. No contributor identity or description is
 * copied into the message.
 */
export function WhatsAppShareCard({
  title,
  deadline,
  url,
}: WhatsAppShareCardProps) {
  const shareUrl = buildWhatsAppShareUrl({ title, deadline, url });
  const preview = buildWhatsAppShareText({ title, deadline, url });

  return (
    <Card>
      <h2 className="text-sm font-semibold">Share with your class</h2>
      <p className="text-muted-foreground mt-1 text-xs">
        Opens WhatsApp with this message. Only the title, deadline, and link are
        included.
      </p>
      <pre className="bg-subtle text-muted-foreground mt-3 rounded-md p-3 text-xs leading-relaxed whitespace-pre-wrap">
        {preview}
      </pre>
      <Button
        asChild
        variant="secondary"
        size="sm"
        className="mt-3"
      >
        <a
          href={shareUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Share2
            aria-hidden="true"
            className="h-3.5 w-3.5"
          />
          Share on WhatsApp
        </a>
      </Button>
    </Card>
  );
}
