import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function DeveloperAccessDenied({
  status,
}: {
  status: "denied" | "unconfigured";
}) {
  const unconfigured = status === "unconfigured";

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg items-center px-4 py-16">
      <Card className="w-full">
        <CardHeader>
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Internal operations
          </p>
          <CardTitle>
            {unconfigured
              ? "Developer monitoring is not configured"
              : "Developer access required"}
          </CardTitle>
          <CardDescription>
            {unconfigured
              ? "This deployment has no valid developer allowlist. Access stays closed until a server-side operator configures one and redeploys."
              : "Your signed-in email is not on the developer allowlist. Application roles do not grant access here."}
          </CardDescription>
        </CardHeader>
        <Button
          asChild
          variant="secondary"
          size="sm"
        >
          <Link href="/dashboard">Return to the workspace</Link>
        </Button>
      </Card>
    </div>
  );
}
