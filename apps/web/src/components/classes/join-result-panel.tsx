import { CheckCircle2 } from "lucide-react";
import Link from "next/link";

import type { ClassJoinResult } from "@starstask/contracts";

import { Alert } from "@/components/ui/alert";

export type JoinOutcome = ClassJoinResult & { autoCreated?: boolean };

export function JoinResultPanel({
  result,
  onPickCandidate,
  onUseLink,
}: {
  result: JoinOutcome;
  onPickCandidate: (slug: string) => void;
  onUseLink: () => void;
}) {
  if (result.status === "joined" || result.status === "already_member") {
    const joined = result.status === "joined";
    let heading = `You are already in ${result.name}`;

    if (joined) {
      heading = result.autoCreated
        ? `Created and joined ${result.name}`
        : `You joined ${result.name}`;
    }

    return (
      <div className="message-in mt-4">
        <Alert variant="success">
          <p className="inline-flex items-center gap-1.5 font-medium">
            <CheckCircle2
              aria-hidden="true"
              className="h-4 w-4"
            />
            {heading}
          </p>
          {result.autoCreated ? (
            <p className="mt-1 text-sm">
              This class did not exist yet, so it was created for your cohort.
              Classmates entering the same code, semester, and academic year
              will join this class automatically.
            </p>
          ) : null}
          <p className="mt-2">
            <Link
              href={`/classes/${encodeURIComponent(result.slug)}`}
              className="text-accent font-medium hover:underline"
            >
              Open the class
            </Link>
          </p>
        </Alert>
      </div>
    );
  }

  if (result.status === "blocked_by_policy") {
    return (
      <div className="message-in mt-4">
        <Alert variant="warning">
          <p className="font-medium">{result.name} requires an invitation</p>
          <p className="mt-1">
            This class does not accept open joining. Ask a class admin for an
            invitation link, then paste it in the{" "}
            <button
              type="button"
              onClick={onUseLink}
              className="font-medium underline underline-offset-4"
            >
              Invitation link
            </button>{" "}
            tab.
          </p>
        </Alert>
      </div>
    );
  }

  if (result.status === "ambiguous") {
    return (
      <div className="message-in mt-4">
        <Alert variant="info">
          <p className="font-medium">More than one class matches</p>
          <p className="mt-1">Pick the one you are enrolled in.</p>
          <ul className="mt-2 space-y-1">
            {result.candidates.map((candidate) => (
              <li key={candidate.id}>
                <button
                  type="button"
                  onClick={() => onPickCandidate(candidate.slug)}
                  className="text-accent text-sm font-medium underline-offset-4 hover:underline"
                >
                  {candidate.name}
                </button>
              </li>
            ))}
          </ul>
        </Alert>
      </div>
    );
  }

  return (
    <div className="message-in mt-4">
      <Alert variant="error">
        <p className="font-medium">No class found</p>
        <p className="mt-1">
          Check the spelling, or ask a class admin for an invitation link.
        </p>
      </Alert>
    </div>
  );
}
