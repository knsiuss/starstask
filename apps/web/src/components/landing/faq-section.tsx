import { ChevronDown } from "lucide-react";

const FAQS = [
  {
    question: "What is StarsTask?",
    answer:
      "A shared archive of university assignment briefs. Students publish the assignments they receive so that other signed-in students can read what a task actually asks for before they start it.",
  },
  {
    question: "Do I need an account to browse?",
    answer:
      "Yes. Sign in with Google to search and read assignments. Approved class pages remain public, but their assignments are only available after signing in.",
  },
  {
    question: "How can I contribute an assignment?",
    answer:
      "Sign in with Google, then use the submit form to add the brief. If you submit inside a class, a class admin reviews it and confirms it may be published before it appears publicly.",
  },
  {
    question: "Which sign-in methods are supported?",
    answer:
      "Google is the only sign-in method. We receive your name, avatar, and email address from Google, and only your name and avatar appear on your public contributor profile.",
  },
  {
    question: "Can I edit or delete what I contributed?",
    answer:
      "Yes. You can edit or delete your own contributions at any time from your account. Nobody else can change them.",
  },
];

export function FaqSection() {
  return (
    <section
      id="faq"
      aria-labelledby="faq-heading"
      className="scroll-mt-20"
    >
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:py-20">
        <div className="max-w-2xl">
          <p className="text-accent text-xs font-semibold tracking-wide uppercase">
            Questions
          </p>
          <h2
            id="faq-heading"
            className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl"
          >
            Frequently asked questions
          </h2>
        </div>

        <div className="border-border mt-8 border-t">
          {FAQS.map((faq) => (
            <details
              key={faq.question}
              className="group border-border border-b"
            >
              <summary className="focus-visible:outline-accent flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 [&::-webkit-details-marker]:hidden">
                {faq.question}
                <ChevronDown
                  aria-hidden="true"
                  className="text-muted-foreground h-4 w-4 shrink-0 transition-transform group-open:rotate-180"
                />
              </summary>
              <p className="text-muted-foreground pr-8 pb-4 text-sm leading-relaxed">
                {faq.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
