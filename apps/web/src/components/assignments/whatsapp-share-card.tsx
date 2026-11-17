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
    <Card className="p-4 sm:p-5">
      <h2 className="text-foreground text-sm font-semibold tracking-tight">
        Share with your class
      </h2>
      <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
        Opens WhatsApp with this message. Only the title, deadline, and link are
        included.
      </p>
      <pre className="border-border/60 bg-subtle text-muted-foreground mt-3 overflow-x-auto rounded-lg border p-3 text-xs leading-relaxed break-words whitespace-pre-wrap">
        {preview}
      </pre>
      <Button
        asChild
        variant="secondary"
        size="sm"
        className="mt-3 min-h-[44px] w-full sm:min-h-8 sm:w-auto"
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
