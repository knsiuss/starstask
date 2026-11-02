import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/** WCAG 2.0, 2.1, and 2.2 rules at levels A and AA. */
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/**
 * Fails with the rule, impact, and element targets of every violation.
 *
 * Only the WCAG tags are enabled; axe's best-practice heuristics are
 * opinionated and are not part of the accessibility target the app commits to.
 */
export async function expectNoAccessibilityViolations(
  page: Page,
  label = page.url(),
): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();

  const violations = results.violations.map((violation) => ({
    rule: violation.id,
    impact: violation.impact,
    help: violation.help,
    targets: violation.nodes.map((node) => ({
      target: node.target.join(" "),
      html: node.html,
      summary: node.failureSummary,
    })),
  }));

  expect(
    violations,
    `${label}\n${JSON.stringify(violations, null, 2)}`,
  ).toEqual([]);
}
