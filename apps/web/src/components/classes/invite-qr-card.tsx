"use client";

import { Check, Copy, Download } from "lucide-react";
import QRCode from "qrcode";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type InviteQrCardProps = {
  url: string;
  label?: string;
};

/**
 * Renders a high-contrast scannable QR code (white quiet zone even in dark
 * mode) plus copy and PNG download actions for an invitation link.
 */
export function InviteQrCard({
  url,
  label = "Invite QR code",
}: InviteQrCardProps) {
  const [dataUrl, setDataUrl] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    let active = true;

    QRCode.toDataURL(url, {
      width: 220,
      margin: 2,
      errorCorrectionLevel: "M",
      color: {
        dark: "#16203a",
        light: "#ffffff",
      },
    })
      .then((nextUrl) => {
        if (active) {
          setDataUrl(nextUrl);
        }
      })
      .catch(() => {
        if (active) {
          setDataUrl(null);
        }
      });

    return () => {
      active = false;
    };
  }, [url]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2_000);
    } catch {
      // Clipboard can be blocked; user can still copy from the read-only input.
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        {dataUrl ? (
          <div className="border-border inline-flex rounded-xl border bg-white p-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- data: URL generated client-side by qrcode */}
            <img
              src={dataUrl}
              alt={label}
              width={200}
              height={200}
              className="h-[200px] w-[200px]"
            />
          </div>
        ) : (
          <div className="skeleton h-[226px] w-[226px] rounded-xl" />
        )}
      </div>

      <Input
        readOnly
        value={url}
        aria-label="Invitation link"
        className="bg-subtle h-9 text-xs"
        onFocus={(event) => event.currentTarget.select()}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => void copy()}
          className="flex-1"
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

        {dataUrl ? (
          <Button
            asChild
            size="sm"
            variant="secondary"
            className="flex-1"
          >
            <a
              href={dataUrl}
              download="starstask-invite-qr.png"
            >
              <Download
                aria-hidden="true"
                className="h-3.5 w-3.5"
              />
              Download QR
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
