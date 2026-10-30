import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  ADMIN_ONBOARDING_STATES,
  ADMIN_SEARCH_MAX,
  ADMIN_USER_ROLES,
  type AdminOnboardingState,
  type AdminUserRole,
} from "@starstask/contracts";

type AdminUserFiltersProps = {
  values: {
    search?: string;
    role: AdminUserRole;
    onboarding: AdminOnboardingState;
  };
};

export function AdminUserFilters({ values }: AdminUserFiltersProps) {
  return (
    <form
      action="/admin/users"
      method="get"
      role="search"
      className="border-border bg-surface grid gap-3 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-12"
    >
      <div className="lg:col-span-5">
        <Label htmlFor="admin-user-search">Search</Label>
        <Input
          id="admin-user-search"
          name="search"
          type="search"
          placeholder="Display name"
          maxLength={ADMIN_SEARCH_MAX}
          defaultValue={values.search ?? ""}
          className="mt-1"
        />
      </div>

      <div className="lg:col-span-3">
        <Label htmlFor="admin-user-role">Access</Label>
        <Select
          id="admin-user-role"
          name="role"
          defaultValue={values.role}
          className="mt-1"
        >
          {ADMIN_USER_ROLES.map((role) => (
            <option
              key={role}
              value={role}
            >
              {role === "all" ? "All accounts" : "Platform admins"}
            </option>
          ))}
        </Select>
      </div>

      <div className="lg:col-span-2">
        <Label htmlFor="admin-user-onboarding">Onboarding</Label>
        <Select
          id="admin-user-onboarding"
          name="onboarding"
          defaultValue={values.onboarding}
          className="mt-1"
        >
          {ADMIN_ONBOARDING_STATES.map((state) => (
            <option
              key={state}
              value={state}
            >
              {state === "all"
                ? "Any state"
                : state === "complete"
                  ? "Complete"
                  : "Not complete"}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex items-end gap-2 lg:col-span-2">
        <Button
          type="submit"
          className="h-10"
        >
          Apply
        </Button>
        <Link
          href="/admin/users"
          className="text-muted-foreground hover:text-foreground flex h-10 items-center text-sm underline-offset-4 hover:underline"
        >
          Reset
        </Link>
      </div>
    </form>
  );
}
