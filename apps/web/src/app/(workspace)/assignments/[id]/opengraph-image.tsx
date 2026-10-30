import { ImageResponse } from "next/og";

import { getSessionUser } from "@/lib/auth/session";
import { getAssignmentDetail } from "@/lib/db/assignments";
import { isSupabaseConfigured } from "@/lib/env/public";
import { assignmentIdSchema } from "@starstask/contracts";
import { formatDeadline } from "@starstask/shared";

export const alt = "StarsTask assignment";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#18181b";
const MUTED = "#71717a";
const ACCENT = "#45639e";
const ACCENT_SOFT = "#e8edfa";
const SURFACE = "#fafaf8";

type OgImageProps = {
  params: Promise<{ id: string }>;
};

export default async function AssignmentOpengraphImage({
  params,
}: OgImageProps) {
  const { id } = await params;
  const parsedId = assignmentIdSchema.safeParse(id);
  const session = isSupabaseConfigured() ? await getSessionUser() : null;
  const assignment =
    session && parsedId.success
      ? await getAssignmentDetail(parsedId.data)
      : null;
  const isPublished = assignment?.status === "published";

  const courseLine = isPublished
    ? assignment.course_code
      ? `${assignment.course_code} · ${assignment.course_name}`
      : assignment.course_name
    : "Sign in to view assignments";

  const title = isPublished ? assignment.title : "StarsTask";

  const subtitle = isPublished
    ? assignment.deadline
      ? `Due ${formatDeadline(assignment.deadline)}`
      : "No deadline provided"
    : "Find the brief before the group chat does.";

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: SURFACE,
        padding: 72,
        color: INK,
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 44,
              height: 44,
              borderRadius: 12,
              background: ACCENT,
              color: "#ffffff",
              fontSize: 24,
              fontWeight: 700,
            }}
          >
            S
          </div>
          <div style={{ display: "flex", fontSize: 28, fontWeight: 700 }}>
            StarsTask
          </div>
        </div>

        <div
          style={{
            display: "flex",
            maxWidth: 620,
            borderRadius: 999,
            background: ACCENT_SOFT,
            color: ACCENT,
            padding: "10px 22px",
            fontSize: 22,
            fontWeight: 600,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {courseLine}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div
          style={{
            display: "flex",
            fontSize: isPublished && title.length > 68 ? 54 : 66,
            fontWeight: 700,
            lineHeight: 1.15,
            letterSpacing: -1.5,
          }}
        >
          {title.length > 120 ? `${title.slice(0, 117)}…` : title}
        </div>

        <div style={{ display: "flex", fontSize: 28, color: MUTED }}>
          {subtitle}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderTop: "2px solid #e4e4e7",
          paddingTop: 28,
          fontSize: 22,
          color: MUTED,
        }}
      >
        <div style={{ display: "flex" }}>
          A private archive for signed-in university students
        </div>
        {isPublished && assignment.deadline ? (
          <div style={{ display: "flex", color: ACCENT, fontWeight: 600 }}>
            Deadline
          </div>
        ) : null}
      </div>
    </div>,
    { ...size },
  );
}
