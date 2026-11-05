import Link from "next/link";

import {
  ProfileRow,
  ProfileSection,
} from "@/components/profile/profile-section";

type JoinedClass = {
  id: string;
  slug: string;
  name: string;
  semester: string;
  academic_year: string;
  status: string;
};

type ProfileAcademicProps = {
  nim: string | null;
  university: string | null;
  declaredClassName: string | null;
  classes: JoinedClass[];
};

/**
 * Academic details, shown read-only.
 *
 * NIM and university are institutional identifiers recorded at onboarding, so
 * this section has no edit affordance at all. Membership figures are derived
 * from the classes the student actually belongs to.
 */
export function ProfileAcademic({
  nim,
  university,
  declaredClassName,
  classes,
}: ProfileAcademicProps) {
  const activeClasses = classes.filter((item) => item.status === "active");

  const membership =
    classes.length === 0
      ? "No classes yet"
      : `${activeClasses.length} active · ${classes.length} joined`;

  return (
    <ProfileSection
      id="academic-information"
      title="Academic information"
    >
      <dl className="border-border divide-border divide-y border-t">
        <ProfileRow
          label="Student ID"
          muted={!nim}
        >
          {nim ?? "Not set"}
        </ProfileRow>

        <ProfileRow
          label="University"
          muted={!university}
        >
          {university ?? "Not set"}
        </ProfileRow>

        <ProfileRow
          label="Declared class"
          muted={!declaredClassName}
        >
          {declaredClassName ?? "Not set"}
        </ProfileRow>

        <ProfileRow
          label="Membership"
          muted={classes.length === 0}
        >
          {membership}
        </ProfileRow>

        <ProfileRow
          label="Joined classes"
          muted={classes.length === 0}
        >
          {classes.length === 0 ? (
            "None yet"
          ) : (
            <ul className="flex flex-wrap gap-2">
              {classes.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/app/classes/${item.slug}`}
                    className="bg-muted text-foreground hover:bg-hover focus-visible:outline-accent inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    {item.name}
                    {item.status === "active" ? null : (
                      <span className="text-muted-foreground">
                        · {item.status}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </ProfileRow>
      </dl>
    </ProfileSection>
  );
}
