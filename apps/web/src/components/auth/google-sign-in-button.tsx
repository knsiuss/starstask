"use client";

import { Loader2 } from "lucide-react";
import * as React from "react";

import { Alert } from "@/components/ui/alert";
import { Button, type ButtonProps } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";

type GoogleSignInButtonProps = {
  nextPath: string;
  /**
   * Presentation only. The defaults reproduce the original full-width button
   * on the sign-in page, so every other placement opts in explicitly.
   */
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
  className?: string;
  wrapperClassName?: string;
};

export function GoogleSignInButton({
  nextPath,
  size = "lg",
  variant = "primary",
  className,
  wrapperClassName,
}: GoogleSignInButtonProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleClick = async () => {
    setError(null);
    setIsLoading(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(
        nextPath,
      )}`;

      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: { prompt: "select_account" },
        },
      });

      if (oauthError) {
        setError("Could not start Google sign-in. Please try again.");
        setIsLoading(false);
      }
      // On success the browser navigates to Google; keep the loading state.
    } catch {
      setError(
        "Authentication is not configured correctly. Check the setup guide.",
      );
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("space-y-3", wrapperClassName)}>
      <Button
        type="button"
        size={size}
        variant={variant}
        className={cn("w-full", className)}
        onClick={handleClick}
        disabled={isLoading}
        aria-busy={isLoading}
      >
        {isLoading ? (
          <Loader2
            aria-hidden="true"
            className="h-4 w-4 animate-spin"
          />
        ) : (
          <GoogleGlyph />
        )}
        {isLoading ? "Redirecting to Google..." : "Continue with Google"}
      </Button>
      <p
        aria-live="polite"
        className="sr-only"
      >
        {isLoading ? "Opening Google sign-in." : ""}
      </p>
      {error ? <Alert variant="error">{error}</Alert> : null}
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
    >
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.86c2.26-2.09 3.56-5.17 3.56-8.87Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58V6.62H1.29a12 12 0 0 0 0 10.76l3.98-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}
