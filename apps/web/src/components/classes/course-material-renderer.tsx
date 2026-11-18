"use client";

import { ExternalLink, FileCode2, FileText } from "lucide-react";
import Image from "next/image";
import * as React from "react";

import { isSafeHttpUrl, type CourseMaterialView } from "@starstask/contracts";

function renderInlineMarkdown(text: string): React.ReactNode[] {
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g);

  return tokens.map((token, index) => {
    if (token.startsWith("**") && token.endsWith("**") && token.length > 4) {
      return <strong key={index}>{token.slice(2, -2)}</strong>;
    }

    if (token.startsWith("`") && token.endsWith("`") && token.length > 2) {
      return (
        <code
          key={index}
          className="bg-muted rounded px-1 py-0.5 font-mono text-xs"
        >
          {token.slice(1, -1)}
        </code>
      );
    }

    const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);

    if (linkMatch) {
      const [, label = "", href = ""] = linkMatch;

      if (isSafeHttpUrl(href)) {
        return (
          <a
            key={index}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline underline-offset-2"
          >
            {label}
          </a>
        );
      }
    }

    return token;
  });
}

function SafeMarkdownBody({ content }: { content: string }) {
  const lines = content.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let codeLines: string[] | null = null;
  let listItems: string[] = [];

  const flushList = (key: string) => {
    if (listItems.length === 0) {
      return;
    }

    blocks.push(
      <ul
        key={key}
        className="list-disc space-y-1 pl-5 text-sm"
      >
        {listItems.map((item, idx) => (
          <li key={idx}>{renderInlineMarkdown(item)}</li>
        ))}
      </ul>,
    );
    listItems = [];
  };

  lines.forEach((line, index) => {
    if (line.trim().startsWith("```")) {
      flushList(`list-before-${index}`);

      if (codeLines === null) {
        codeLines = [];
      } else {
        blocks.push(
          <pre
            key={`code-${index}`}
            className="border-border bg-subtle overflow-x-auto rounded-lg border p-3 font-mono text-xs"
          >
            <code>{codeLines.join("\n")}</code>
          </pre>,
        );
        codeLines = null;
      }

      return;
    }

    if (codeLines !== null) {
      codeLines.push(line);
      return;
    }

    if (line.startsWith("- ") || line.startsWith("* ")) {
      listItems.push(line.slice(2));
      return;
    }

    flushList(`list-${index}`);

    if (line.startsWith("### ")) {
      blocks.push(
        <h4
          key={index}
          className="text-foreground text-sm font-semibold"
        >
          {renderInlineMarkdown(line.slice(4))}
        </h4>,
      );
      return;
    }

    if (line.startsWith("## ") || line.startsWith("# ")) {
      const heading = line.replace(/^#{1,2}\s+/, "");

      blocks.push(
        <h3
          key={index}
          className="text-foreground text-base font-semibold"
        >
          {renderInlineMarkdown(heading)}
        </h3>,
      );
      return;
    }

    if (line.trim() === "") {
      return;
    }

    blocks.push(
      <p
        key={index}
        className="text-muted-foreground text-sm leading-relaxed"
      >
        {renderInlineMarkdown(line)}
      </p>,
    );
  });

  flushList("list-end");

  return <div className="space-y-2">{blocks}</div>;
}

export function CourseMaterialRenderer({
  material,
}: {
  material: CourseMaterialView;
}) {
  const [showFilePreview, setShowFilePreview] = React.useState(
    material.file_mime === "application/pdf" ||
      material.file_mime === "text/html" ||
      Boolean(material.file_mime?.startsWith("image/")),
  );

  const isPdf = material.file_mime === "application/pdf";
  const isHtmlFile = material.file_mime === "text/html";
  const isImage = Boolean(material.file_mime?.startsWith("image/"));

  return (
    <div className="space-y-3">
      {material.description ? (
        material.content_format === "html" ? (
          <iframe
            sandbox=""
            srcDoc={material.description}
            title={material.title}
            className="border-border h-56 w-full rounded-lg border bg-white"
          />
        ) : material.content_format === "markdown" ? (
          <SafeMarkdownBody content={material.description} />
        ) : (
          <p className="text-muted-foreground text-sm whitespace-pre-wrap leading-relaxed">
            {material.description}
          </p>
        )
      ) : null}

      {material.signed_url ? (
        <div className="border-border bg-subtle rounded-lg border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-foreground inline-flex min-w-0 items-center gap-2 text-xs font-medium">
              {isHtmlFile ? (
                <FileCode2
                  aria-hidden="true"
                  className="text-accent h-4 w-4 shrink-0"
                />
              ) : (
                <FileText
                  aria-hidden="true"
                  className="text-accent h-4 w-4 shrink-0"
                />
              )}
              <span className="truncate">
                {material.file_name ?? "Attachment"}
              </span>
            </span>

            <div className="flex items-center gap-2">
              {isPdf || isHtmlFile || isImage ? (
                <button
                  type="button"
                  onClick={() => setShowFilePreview((prev) => !prev)}
                  className="text-accent min-h-[36px] px-2 text-xs font-medium hover:underline"
                >
                  {showFilePreview ? "Hide preview" : "Preview"}
                </button>
              ) : null}
              <a
                href={material.signed_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent inline-flex min-h-[36px] items-center gap-1 px-2 text-xs font-medium hover:underline"
              >
                Open
                <ExternalLink
                  aria-hidden="true"
                  className="h-3.5 w-3.5"
                />
              </a>
            </div>
          </div>

          {showFilePreview && isPdf ? (
            <iframe
              src={material.signed_url}
              title={material.file_name ?? material.title}
              className="border-border mt-3 h-[360px] w-full rounded-md border bg-white sm:h-[440px]"
            />
          ) : null}

          {showFilePreview && isHtmlFile ? (
            <iframe
              sandbox=""
              src={material.signed_url}
              title={material.file_name ?? material.title}
              className="border-border mt-3 h-72 w-full rounded-md border bg-white"
            />
          ) : null}

          {showFilePreview && isImage ? (
            <Image
              src={material.signed_url}
              alt={material.file_name ?? material.title}
              width={800}
              height={450}
              unoptimized
              className="border-border mt-3 max-h-80 w-auto rounded-md border object-contain"
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
