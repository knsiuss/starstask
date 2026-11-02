"use client";

import { Check, Copy } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

type CopyLinkButtonProps = {
  url: string;
  className?: string;
};

/**
 * Copies the assignment's canonical link to the clipboard.
 *
 * Uses the async Clipboard API when available and falls back to a temporary
 * textarea so copying still works on non-secure origins (plain http) where
 * `navigator.clipboard` is undefined.
 */
async function copyText(text: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);

    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();

  const succeeded = document.execCommand("copy");
  document.body.removeChild(textarea);

  if (!succeeded) {
    throw new Error("Copy command failed");
  }
}

export function CopyLinkButton({ url, className }: CopyLinkButtonProps) {
  const { toast } = useToast();
  const [copied, setCopied] = React.useState(false);
  const resetTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (resetTimer.current) {
        clearTimeout(resetTimer.current);
      }
    };
  }, []);

  const handleCopy = async () => {
    try {
      await copyText(url);
      setCopied(true);
      toast({ variant: "success", title: "Link copied" });

      if (resetTimer.current) {
        clearTimeout(resetTimer.current);
      }

      resetTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        variant: "error",
        title: "Could not copy the link",
        description: "Copy the address from your browser instead.",
      });
    }
  };

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={() => void handleCopy()}
      className={className}
      aria-live="polite"
    >
      {copied ? (
        <Check
          aria-hidden="true"
          className="h-3.5 w-3.5"
        />
      ) : (
        <Copy
          aria-hidden="true"
          className="h-3.5 w-3.5"
        />
      )}
      {copied ? "Copied" : "Copy link"}
    </Button>
  );
}
