import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage, LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Terms",
  description:
    "The rules for using StarsTask, including acceptable use, academic integrity, content ownership, and account responsibilities.",
  alternates: { canonical: "/terms" },
};

const UPDATED = "31 October 2026";

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of use"
      summary="These terms apply when you sign in to StarsTask or use the service. By continuing, you agree to them."
      updated={UPDATED}
    >
      <LegalSection heading="The service">
        <p>
          StarsTask is a class workspace where students share assignment briefs,
          manage classes, record attendance, and handle leave requests. It is
          not an official university system. Class admins are students, there
          are no lecturer accounts, and published content may be incomplete or
          wrong. Always confirm deadlines and instructions with your course.
        </p>
      </LegalSection>

      <LegalSection heading="Your account">
        <p>
          You sign in with Google. Keep access to that account secure and do not
          share your session. You are responsible for activity performed through
          your account. Provide accurate profile and class information;
          impersonating another person is not allowed.
        </p>
      </LegalSection>

      <LegalSection heading="Acceptable use">
        <ul className="list-disc space-y-1 pl-5">
          <li>Do not break the law or your institution&apos;s rules.</li>
          <li>
            Do not harass, threaten, dox, or discriminate against anyone, and do
            not upload another person&apos;s private data without permission.
          </li>
          <li>
            Do not attempt to bypass access controls, scrape the service at
            scale, probe other accounts, or disrupt availability.
          </li>
          <li>
            Do not upload malware or content you do not have the right to share.
          </li>
          <li>
            Do not use the service to submit work that is not yours or to help
            someone else cheat.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="Academic integrity">
        <p>
          Shared briefs and materials are for study and reference. You remain
          responsible for following your institution&apos;s academic-integrity
          rules. StarsTask does not verify the accuracy of a brief and does not
          grade work.
        </p>
      </LegalSection>

      <LegalSection heading="Your content">
        <p>
          You keep ownership of the content you upload. You grant the operator a
          limited licence to store, display, and back up that content so the
          service can work. You confirm that you have the rights needed to share
          it. Class admins and platform administrators may moderate or remove
          content that violates these terms or class rules.
        </p>
      </LegalSection>

      <LegalSection heading="Class admins">
        <p>
          Class admins manage their own class: members, invitations, published
          content, attendance, and leave review. They must use private data only
          for legitimate class administration, must not export or share it
          outside the class, and must follow the same acceptable-use rules.
          Admin powers are limited to their own class unless the operator grants
          a platform role.
        </p>
      </LegalSection>

      <LegalSection heading="Privacy">
        <p>
          Our{" "}
          <Link
            href="/privacy"
            className="text-accent font-medium underline underline-offset-2"
          >
            Privacy page
          </Link>{" "}
          explains what is stored, who can see it, and how to exercise your
          choices.
        </p>
      </LegalSection>

      <LegalSection heading="Availability and changes">
        <p>
          The service is provided as-is, without a warranty of uninterrupted or
          error-free operation. Features may change, and the operator may
          suspend an account or remove content to protect users, the service, or
          the law. Where liability cannot be excluded, it is limited to the
          extent the applicable law allows.
        </p>
      </LegalSection>

      <LegalSection heading="Ending use">
        <p>
          You may stop using the service at any time. The operator may end
          access for a serious or repeated breach of these terms. Provisions
          that by their nature should survive termination, such as content
          ownership and liability limits, continue to apply.
        </p>
      </LegalSection>

      <LegalSection heading="Changes to these terms">
        <p>
          We will update this page when the rules change. The date at the top
          shows the latest revision. Continuing to use the service after a
          change means you accept the updated terms.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
