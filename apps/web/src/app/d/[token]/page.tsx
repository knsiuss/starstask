import { Download, FileText } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getDriveSubmissionByToken } from "@/lib/db/drive-submissions";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Submission",
    robots: { index: false, follow: false },
  };
}

/**
 * Lecturer view: no StarsTask account needed. The share token in the URL
 * is the only credential. Safe to forward over WhatsApp or email.
 */
export default async function LecturerSubmissionPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const submission = await getDriveSubmissionByToken(token);

  if (!submission) {
    notFound();
  }

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-10 sm:px-6">
      <Card className="p-6">
        <div className="flex items-start gap-3">
          <span className="bg-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
            <FileText
              aria-hidden="true"
              className="h-5 w-5"
            />
          </span>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold break-words">
              {submission.drive_file_name}
            </h1>
            <p className="text-muted-foreground mt-1 text-xs">
              Submitted via StarsTask ·{" "}
              {new Date(submission.created_at).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
        </div>

        <Button
          asChild
          className="mt-5 w-full"
        >
          <a href={`/api/d/${submission.share_token}/download`}>
            <Download
              aria-hidden="true"
              className="h-4 w-4"
            />
            Download file
          </a>
        </Button>

        <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
          This is a copy made at submission time. Editing the original file in
          Google Drive afterwards does not change what you see here.
        </p>
      </Card>
    </main>
  );
}
