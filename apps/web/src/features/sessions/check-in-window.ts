import "server-only";

import {
  getSessionCheckInWindowState,
  type SessionCheckInWindowState,
} from "@starstask/contracts";

/**
 * The check-in window as of now, for the session page's first paint.
 *
 * Kept out of the component body so the render stays pure; the value is only a
 * hint for the UI, and the database re-checks the same window on submit.
 */
export function getCurrentCheckInWindowState(
  startsAt: string,
  endsAt: string,
): SessionCheckInWindowState {
  return getSessionCheckInWindowState(startsAt, endsAt, Date.now());
}
