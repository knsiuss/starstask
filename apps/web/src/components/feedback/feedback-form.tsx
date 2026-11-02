"use client";

import { Loader2, Send } from "lucide-react";
import { usePathname } from "next/navigation";
import * as React from "react";

import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_CATEGORY_LABELS,
  FEEDBACK_MESSAGE_MAX,
  FEEDBACK_MESSAGE_MIN,
  feedbackSubmissionSchema,
  toFieldErrors,
  type FeedbackCategory,
} from "@starstask/contracts";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type SubmitState =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent" }
  | { kind: "error"; message: string; fieldErrors?: Record<string, string> };

export function FeedbackForm() {
  const pathname = usePathname();
  const [category, setCategory] = React.useState<FeedbackCategory>("bug");
  const [message, setMessage] = React.useState("");
  const [state, setState] = React.useState<SubmitState>({ kind: "idle" });

  const trimmed = message.trim();
  const tooShort = trimmed.length < FEEDBACK_MESSAGE_MIN;
  const tooLong = trimmed.length > FEEDBACK_MESSAGE_MAX;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = feedbackSubmissionSchema.safeParse({
      category,
      message,
      pagePath: pathname,
    });

    if (!parsed.success) {
      setState({
        kind: "error",
        message: "Please check the message before sending it.",
        fieldErrors: toFieldErrors(parsed.error),
      });

      return;
    }

    setState({ kind: "sending" });

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      if (!response.ok) {
        setState({
          kind: "error",
          message:
            response.status === 429
              ? "You have sent several notes recently. Try again later."
              : "The note could not be sent. Try again in a moment.",
        });

        return;
      }

      setMessage("");
      setState({ kind: "sent" });
    } catch {
      setState({
        kind: "error",
        message: "The note could not be sent. Check your connection.",
      });
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="grid gap-4"
    >
      {state.kind === "sent" ? (
        <Alert variant="success">
          Thank you — your note was received. Replies are not sent from here; a
          platform admin reads every entry.
        </Alert>
      ) : null}

      {state.kind === "error" ? (
        <Alert variant="error">{state.message}</Alert>
      ) : null}

      <div className="grid gap-1.5">
        <Label htmlFor="feedback-category">What is this about?</Label>
        <Select
          id="feedback-category"
          value={category}
          onChange={(event) => {
            const next = FEEDBACK_CATEGORIES.find(
              (item) => item === event.target.value,
            );

            if (next) {
              setCategory(next);
            }
          }}
          disabled={state.kind === "sending"}
        >
          {FEEDBACK_CATEGORIES.map((value) => (
            <option
              key={value}
              value={value}
            >
              {FEEDBACK_CATEGORY_LABELS[value]}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="feedback-message">Your message</Label>
        <Textarea
          id="feedback-message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={6}
          maxLength={FEEDBACK_MESSAGE_MAX}
          placeholder="Describe what happened or what would help. Do not include passwords, tokens, or personal data about other people."
          disabled={state.kind === "sending"}
          aria-describedby="feedback-message-help"
          aria-invalid={state.kind === "error" ? true : undefined}
        />
        <p
          id="feedback-message-help"
          className="text-muted-foreground text-xs"
        >
          {FEEDBACK_MESSAGE_MIN}–{FEEDBACK_MESSAGE_MAX} characters. The page you
          are on is included; its query string is not.
        </p>

        {state.kind === "error" && state.fieldErrors?.message ? (
          <p className="text-danger text-xs">{state.fieldErrors.message}</p>
        ) : null}
      </div>

      <div>
        <Button
          type="submit"
          disabled={state.kind === "sending" || tooShort || tooLong}
        >
          {state.kind === "sending" ? (
            <Loader2
              aria-hidden="true"
              className="h-4 w-4 animate-spin"
            />
          ) : (
            <Send
              aria-hidden="true"
              className="h-4 w-4"
            />
          )}
          Send feedback
        </Button>
      </div>
    </form>
  );
}
