import { Trash2 } from "lucide-react";
import { notFound } from "next/navigation";

import { ClassSettingsPanel } from "@/components/classes/class-settings-panel";
import { ClassStatusControl } from "@/components/classes/class-status-control";
import { DeleteClassButton } from "@/components/classes/delete-class-button";
import {
  getClassDependencies,
  getClassJoinPolicy,
  type ClassSummary,
} from "@/lib/db/classes";

type ManageSettingsTabProps = {
  classSummary: ClassSummary;
  platformAdmin: boolean;
};

export async function ManageSettingsTab({
  classSummary,
  platformAdmin,
}: ManageSettingsTabProps) {
  const [joinPolicy, dependencies] = await Promise.all([
    getClassJoinPolicy(classSummary.id),
    getClassDependencies(classSummary.id),
  ]);

  if (!dependencies) {
    notFound();
  }

  const base = `/app/classes/${classSummary.slug}/manage`;

  return (
    <div className="mt-6 space-y-6">
      <ClassSettingsPanel
        classSlug={classSummary.slug}
        classId={classSummary.id}
        archived={classSummary.status === "archived"}
        initialValues={{
          name: classSummary.name,
          classCode: classSummary.class_code ?? "",
          description: classSummary.description,
          courseName: classSummary.course_name,
          institution: classSummary.institution ?? "",
          lecturerName: classSummary.lecturer_name ?? "",
          semester: classSummary.semester,
          academicYear: classSummary.academic_year,
          joinPolicy: joinPolicy ?? "invitation",
        }}
      />

      <section
        aria-labelledby="class-lifecycle"
        className="border-border bg-surface rounded-2xl border p-5"
      >
        <h2
          id="class-lifecycle"
          className="text-base font-semibold tracking-tight"
        >
          Class lifecycle
        </h2>
        <p className="text-muted-foreground mt-0.5 text-xs">
          {platformAdmin
            ? "As a platform admin you may change the lifecycle of any class."
            : "Archive hides the class while keeping all data."}
        </p>

        <div className="mt-4">
          <ClassStatusControl
            classSlug={classSummary.slug}
            status={classSummary.status}
            redirectTo={`${base}?tab=settings`}
          />
        </div>

        <dl className="border-border mt-4 grid grid-cols-3 gap-3 border-t pt-3 text-xs">
          <Detail
            label="Members"
            value={String(dependencies.memberCount)}
          />
          <Detail
            label="Assignments"
            value={String(dependencies.assignmentCount)}
          />
          <Detail
            label="Submissions"
            value={String(dependencies.submissionCount)}
          />
        </dl>
      </section>

      <section
        aria-labelledby="danger-zone"
        className="border-danger/30 bg-danger-soft/30 rounded-2xl border p-5"
      >
        <h2
          id="danger-zone"
          className="text-danger inline-flex items-center gap-2 text-base font-semibold tracking-tight"
        >
          <Trash2
            aria-hidden="true"
            className="h-4 w-4"
          />
          Danger zone
        </h2>
        <p className="text-muted-foreground mt-1 max-w-2xl text-xs leading-relaxed">
          Permanent deletion is only possible when a class has no academic
          records. When history exists, archive it instead.
        </p>
        <div className="mt-4">
          <DeleteClassButton
            classSlug={classSummary.slug}
            name={classSummary.name}
            classCode={classSummary.class_code}
            academicYear={classSummary.academic_year}
            semester={classSummary.semester}
            dependencies={dependencies}
          />
        </div>
      </section>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-0.5 font-semibold">{value}</dd>
    </div>
  );
}
