import { redirect } from "next/navigation";

type ClassAttendanceRedirectProps = {
  params: Promise<{ slug: string }>;
};

/** Attendance now lives in the class workspace as a tab; keep old links working. */
export default async function ClassAttendanceRedirect({
  params,
}: ClassAttendanceRedirectProps) {
  const { slug } = await params;

  redirect(`/dashboard/classes/${slug}?tab=attendance`);
}
