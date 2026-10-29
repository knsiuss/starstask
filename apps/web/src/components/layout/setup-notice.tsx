import { Alert } from "@/components/ui/alert";

export function SetupNotice() {
  return (
    <Alert
      variant="warning"
      className="mx-auto max-w-3xl"
    >
      <p className="font-medium">Supabase is not configured yet.</p>
      <p className="mt-1">
        Add <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
        and{" "}
        <code className="font-mono text-xs">
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
        </code>{" "}
        to <code className="font-mono text-xs">apps/web/.env.local</code>, then
        apply the SQL migrations in{" "}
        <code className="font-mono text-xs">supabase/migrations</code>. See{" "}
        <code className="font-mono text-xs">docs/DEPLOYMENT.md</code>.
      </p>
    </Alert>
  );
}
