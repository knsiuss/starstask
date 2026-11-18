export type AccountLifecycleState = "active" | "deactivated" | "deleted";

type LifecycleProfile = {
  account_status?: string | null;
  deactivated_at?: string | null;
  deleted_at?: string | null;
} | null;

/**
 * Collapses the stored profile flags into a single lifecycle state.
 *
 * A tombstoned account always wins over a deactivated one: once the row is
 * marked deleted the account must never read as merely deactivated.
 */
export function resolveAccountLifecycleState(
  profile: LifecycleProfile,
): AccountLifecycleState {
  if (!profile) {
    return "active";
  }

  if (profile.account_status === "deleted" || profile.deleted_at) {
    return "deleted";
  }

  if (profile.account_status === "deactivated" || profile.deactivated_at) {
    return "deactivated";
  }

  return "active";
}
