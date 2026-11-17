"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { Reveal } from "@/components/landing/reveal";
import { cn } from "@/lib/utils/cn";

const FAQS = [
  {
    id: "what-is-starstask",
    question: "What is StarsTask?",
    answer:
      "A shared archive of university assignment briefs published by students.",
  },
  {
    id: "need-account",
    question: "Do I need an account to browse?",
    answer:
      "Class pages are public, while full assignment briefs require Google sign-in.",
  },
  {
    id: "how-to-contribute",
    question: "How do I contribute?",
    answer:
      "Sign in with Google and submit a brief. Class submissions are reviewed by a class admin first.",
  },
  {
    id: "sign-in-methods",
    question: "Which sign-in methods work?",
    answer:
      "Google sign-in only. Only your name and avatar appear on your contributor profile.",
  },
  {
    id: "edit-delete",
    question: "Can I edit or delete my briefs?",
    answer: "Yes. You can edit or remove your own contributions at any time.",
  },
] as const;

export function FaqSection() {
  const [openId, setOpenId] = useState<string | null>(FAQS[0].id);

  return (
    <section
      id="faq"
      aria-labelledby="faq-heading"
      className="scroll-mt-20"
    >
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.4fr)] lg:gap-14 lg:py-20">
        <Reveal className="lg:sticky lg:top-24 lg:self-start">
          <p className="text-accent font-mono text-xs font-semibold tracking-wider uppercase">
            FAQ
          </p>
          <h2
            id="faq-heading"
            className="text-foreground mt-2 text-3xl font-semibold tracking-tight sm:text-4xl"
          >
            Common questions
          </h2>
        </Reveal>

        <Reveal delay={60}>
          <div className="border-border border-t">
            {FAQS.map((faq) => {
              const isOpen = openId === faq.id;

              return (
                <div
                  key={faq.id}
                  className="border-border border-b"
                >
                  <h3>
                    <button
                      type="button"
                      id={`faq-trigger-${faq.id}`}
                      aria-expanded={isOpen}
                      aria-controls={`faq-panel-${faq.id}`}
                      onClick={() => setOpenId(isOpen ? null : faq.id)}
                      className="focus-visible:outline-accent flex w-full cursor-pointer items-center justify-between gap-4 py-4.5 text-left text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 sm:text-base"
                    >
                      <span>{faq.question}</span>
                      <ChevronDown
                        aria-hidden="true"
                        className={cn(
                          "text-muted-foreground h-4 w-4 shrink-0 transition-transform duration-200",
                          isOpen && "rotate-180",
                        )}
                      />
                    </button>
                  </h3>

                  <div
                    id={`faq-panel-${faq.id}`}
                    role="region"
                    aria-labelledby={`faq-trigger-${faq.id}`}
                    className={cn(
                      "grid transition-[grid-template-rows] duration-250 ease-out",
                      isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                    )}
                  >
                    <div className="overflow-hidden">
                      <p className="text-muted-foreground pr-8 pb-4.5 text-sm leading-relaxed">
                        {faq.answer}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
