import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Lecturer",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Legacy lecturer URL; the teaching console now lives directly at `/lecturer`.
 */
export default function LegacyLecturerRedirect() {
  redirect("/lecturer");
}
