import { getSiteUrl } from "@/lib/env/public";

/**
 * Search-engine structured data for the landing page.
 *
 * Organization: who StarsTask is, with its logo and contact address.
 * FAQPage: the exact five questions rendered by FaqSection, so the
 * rich result always matches the visible answers.
 */
export function LandingStructuredData() {
  const siteUrl = getSiteUrl().replace(/\/$/, "");

  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: "StarsTask",
        url: siteUrl,
        inLanguage: "en",
      },
      {
        "@type": "Organization",
        name: "StarsTask",
        url: siteUrl,
        logo: `${siteUrl}/brand/logo.png`,
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer support",
          email: "aphelionlabss@gmail.com",
        },
      },
      {
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "What is StarsTask?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "A shared archive of university assignment briefs. Students publish the assignments they receive so that other signed-in students can read what a task actually asks for before they start it.",
            },
          },
          {
            "@type": "Question",
            name: "Do I need an account to browse?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Yes. Sign in with Google to search and read assignments. Approved class pages remain public, but their assignments are only available after signing in.",
            },
          },
          {
            "@type": "Question",
            name: "How can I contribute an assignment?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Sign in with Google, then use the submit form to add the brief. If you submit inside a class, a class admin reviews it and confirms it may be published before it appears publicly.",
            },
          },
          {
            "@type": "Question",
            name: "Which sign-in methods are supported?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Google is the only sign-in method. We receive your name, avatar, and email address from Google, and only your name and avatar appear on your public contributor profile.",
            },
          },
          {
            "@type": "Question",
            name: "Can I edit or delete what I contributed?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Yes. You can edit or delete your own contributions at any time from your account. Nobody else can change them.",
            },
          },
        ],
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
