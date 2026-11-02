import type { Metadata } from "next";

import { LegalPage, LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "What StarsTask stores, who can see it, how long it is kept, and how to exercise your privacy choices.",
  alternates: { canonical: "/privacy" },
};

const UPDATED = "31 October 2026";

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy"
      summary="StarsTask is a class workspace for university students. This page explains the data the platform stores, why it is needed, who can see it, and the choices you have."
      updated={UPDATED}
    >
      <LegalSection heading="Who operates this deployment">
        <p>
          StarsTask is open-source software. The person or team that deploys it
          is the operator of this instance and decides how it is run. This page
          describes the behaviour of the software itself. Your institution does
          not automatically receive your data.
        </p>
      </LegalSection>

      <LegalSection heading="Data we store">
        <p>
          We store only what the features you use require. Depending on how you
          use StarsTask, that can include:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong className="text-foreground">Account data</strong> from
            Google sign-in: your Google account identifier, name, email address,
            and avatar URL.
          </li>
          <li>
            <strong className="text-foreground">Profile data</strong> you add:
            display name, avatar, student ID number (NIM), declared position
            (student or class representative), and biography.
          </li>
          <li>
            <strong className="text-foreground">Class data</strong>: class
            memberships, admin roles, invitations you create or accept, and the
            class metadata you enter.
          </li>
          <li>
            <strong className="text-foreground">Academic content</strong>:
            assignments and announcements, submissions and their attachments,
            revision history, reports, session RSVPs, attendance records, leave
            requests with supporting evidence, document-reader output, and
            class-representative verification material.
          </li>
          <li>
            <strong className="text-foreground">Notification data</strong>:
            notification preferences, inbox read state, delivery records, and
            browser push endpoints and keys for devices you enable.
          </li>
          <li>
            <strong className="text-foreground">Optional calendar data</strong>:
            encrypted Google Calendar tokens and event identifiers when you
            connect a calendar, and a hashed token for your personal calendar
            feed.
          </li>
          <li>
            <strong className="text-foreground">Operational data</strong>: audit
            records, sanitised error events, sign-in activity, and rate-limit
            counters.
          </li>
        </ul>
        <p>
          Session cookies keep you signed in. Local browser storage remembers
          small interface preferences, such as whether the sidebar is collapsed.
        </p>
      </LegalSection>

      <LegalSection heading="Who can see it">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong className="text-foreground">Public visitors</strong> can see
            active class directory metadata: class name, code, course,
            institution, lecturer name, semester, and academic year.
          </li>
          <li>
            <strong className="text-foreground">Signed-in users</strong> can see
            approved assignment briefs and their attachments. Browsing
            assignments requires a session.
          </li>
          <li>
            <strong className="text-foreground">
              Class members and class admins
            </strong>{" "}
            can see the class roster, published class content, sessions, and
            attendance. Class admins can also review submissions and leave
            requests for their own class.
          </li>
          <li>
            <strong className="text-foreground">Platform administrators</strong>{" "}
            can moderate published content, review class applications and
            representative verification, and read the audit trail.
          </li>
          <li>
            <strong className="text-foreground">No one else</strong> can read
            your email address, student ID number, leave details, evidence
            files, document-reader output, push endpoints, calendar tokens, or
            precise check-in coordinates through the application. Published
            class metadata never includes personal contact details.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="Why we use it">
        <p>
          We use this data to sign you in, run your classes, deliver
          notifications you request, keep academic records consistent, protect
          the service from abuse, and investigate failures. We do not sell
          personal data, run advertising, or use third-party analytics or
          session-replay tools.
        </p>
      </LegalSection>

      <LegalSection heading="Service providers">
        <p>
          The deployment relies on infrastructure providers to store data and
          deliver the service: Supabase for authentication, database, and
          private file storage; Google for sign-in and, only if you connect it,
          calendar access; the hosting provider for serving the application; and
          browser push services for delivering notifications. These providers
          process data on the operator&apos;s behalf.
        </p>
      </LegalSection>

      <LegalSection heading="Retention">
        <p>
          Check-in coordinates are removed by a scheduled job after the
          configured retention window while attendance status and distance are
          kept for review. Notification delivery records may also be purged on a
          schedule. Other records are kept while the related class or account is
          active, because they are academic history, and are removed through
          normal deletion flows or a verified request.
        </p>
        <p>
          StarsTask does not yet offer self-service account deletion. Ask the
          operator to delete your account and explain which records must be
          retained. Backups may keep copies for a limited period before they
          rotate out.
        </p>
      </LegalSection>

      <LegalSection heading="Your choices">
        <ul className="list-disc space-y-1 pl-5">
          <li>Edit your profile at any time from Settings.</li>
          <li>
            Disable browser push or disconnect Google Calendar from Settings;
            this deletes the stored subscription or tokens.
          </li>
          <li>
            Ask for a copy, correction, or deletion of your personal data. Some
            academic records may need to be retained, and we will explain why.
          </li>
          <li>
            Raise a concern with the operator. You may also have rights under
            the law that applies where you live.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="Security">
        <p>
          Access is enforced on the server and in the database with row-level
          security. Evidence and attachments live in private storage and are
          served through short-lived signed links. Service credentials stay on
          the server and are never sent to the browser. No system is perfectly
          secure; report a suspected issue to the operator promptly.
        </p>
      </LegalSection>

      <LegalSection heading="Students and minors">
        <p>
          StarsTask is intended for university students and is not directed at
          children. Do not create an account if you are below the minimum age
          required by your institution or local law.
        </p>
      </LegalSection>

      <LegalSection heading="Changes">
        <p>
          We will update this page when the data practices change. The date at
          the top shows the latest revision.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
