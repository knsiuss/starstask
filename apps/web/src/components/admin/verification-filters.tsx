import Link from "next/link";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  VERIFICATION_QUEUE_STATUSES,
  VERIFICATION_SEARCH_MAX,
  VERIFICATION_STATUS_LABELS,
  type VerificationQueueStatus,
} from "@starstask/contracts";

type VerificationFiltersProps = {
  values: {
    search?: string;
    status: VerificationQueueStatus;
    classId?: string;
    semester?: string;
  };
  classes: { id: string; name: string }[];
  semesters: string[];
};

/**
 * Queue filters submitted as a GET form, so every filtered view is a real URL
 * that can be bookmarked and rendered on the server.
 */
export function VerificationFilters({
  values,
  classes,
  semesters,
}: VerificationFiltersProps) {
  return (
    <form
      action="/admin/verifications"
      method="get"
      className="border-border bg-surface grid gap-3 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-6"
    >
      <div className="lg:col-span-2">
        <Label htmlFor="verification-search">Student</Label>
        <Input
          id="verification-search"
          name="search"
          type="search"
          placeholder="Display name"
          maxLength={VERIFICATION_SEARCH_MAX}
          defaultValue={values.search ?? ""}
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="verification-status">Status</Label>
        <Select
          id="verification-status"
          name="status"
          defaultValue={values.status}
          className="mt-1"
        >
          {VERIFICATION_QUEUE_STATUSES.map((status) => (
            <option
              key={status}
              value={status}
            >
              {status === "all"
                ? "All statuses"
                : VERIFICATION_STATUS_LABELS[status]}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label htmlFor="verification-class-filter">Class</Label>
        <Select
          id="verification-class-filter"
          name="class"
          defaultValue={values.classId ?? ""}
          className="mt-1"
        >
          <option value="">All classes</option>
          {classes.map((item) => (
            <option
              key={item.id}
              value={item.id}
            >
              {item.name}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label htmlFor="verification-semester">Semester</Label>
        <Select
          id="verification-semester"
          name="semester"
          defaultValue={values.semester ?? ""}
          className="mt-1"
        >
          <option value="">All semesters</option>
          {semesters.map((semester) => (
            <option
              key={semester}
              value={semester}
            >
              {semester}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex items-end gap-2">
        <button
          type="submit"
          className="bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:ring-ring h-10 rounded-md px-4 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none"
        >
          Apply
        </button>
        <Link
          href="/admin/verifications"
          className="text-muted-foreground hover:text-foreground flex h-10 items-center text-sm underline-offset-4 hover:underline"
        >
          Reset
        </Link>
      </div>
    </form>
  );
}
