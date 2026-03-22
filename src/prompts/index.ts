import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { BrowserStore } from "../store/browser-store.js";

function userMsg(t: string) {
  return {
    messages: [
      { role: "user" as const, content: { type: "text" as const, text: t } },
    ],
  };
}

export function registerPrompts(server: McpServer, store: BrowserStore): void {
  server.registerPrompt(
    "compare_with_figma",
    {
      title: "Compare with Figma Design",
      description:
        "Compare the current browser page with Figma design specs — identify visual differences and suggest CSS fixes",
    },
    () => {
      const dom = store.getDom();
      const colors = store.getColors();
      const typo = store.getTypography();
      const elements = store.getElements();
      const comparisons = store.getComparisons();

      if (!dom) return userMsg("No browser data captured. Click the bookmarklet on your app first.");

      const elList = Object.keys(elements).slice(0, 15).map((k) => {
        const el = elements[k];
        return `- ${k}: ${el.layout?.display ?? "?"} ${Math.round(el.layout?.box.width ?? 0)}x${Math.round(el.layout?.box.height ?? 0)}, bg=${el.computedStyle?.styles.backgroundColor ?? "?"}, color=${el.computedStyle?.styles.color ?? "?"}`;
      });

      return userMsg([
        "Compare this browser page with the Figma design. Here's the current state:\n",
        `## Page: ${dom.title}`,
        `URL: ${dom.url}`,
        `Viewport: ${dom.viewport.width}x${dom.viewport.height}\n`,
        "## Captured Elements\n" + elList.join("\n") + "\n",
        colors ? `## Colors\nText: ${colors.colors.slice(0, 5).map((c) => c.hex).join(", ")}\nBackground: ${colors.backgroundColors.slice(0, 5).map((c) => c.hex).join(", ")}\n` : "",
        typo ? `## Typography\n${typo.fonts.slice(0, 5).map((f) => `- ${f.family} ${f.weight} ${f.size}`).join("\n")}\n` : "",
        comparisons.length > 0 ? `## Previous Comparisons\n${comparisons.slice(-3).map((c) => `- ${c.selector}: ${c.score}/100 (${c.status})`).join("\n")}\n` : "",
        "\n## Instructions",
        "1. Use the `compare_with_figma` tool to compare specific elements",
        "2. Provide Figma specs (width, height, colors, fonts, spacing) for each element",
        "3. Review the diff report — focus on critical and major differences first",
        "4. Use `suggest_css_fixes` to get copy-paste CSS fixes",
        "5. After fixing, re-compare to verify the score improved",
        "6. Target: 95+ score for all key elements",
      ].join("\n"));
    },
  );

  server.registerPrompt(
    "audit_ui",
    {
      title: "UI Design Audit",
      description:
        "Comprehensive audit of the page UI: colors, typography, spacing, accessibility, responsiveness",
    },
    () => {
      const dom = store.getDom();
      const colors = store.getColors();
      const typo = store.getTypography();
      const spacing = store.getSpacing();
      const acc = store.getAccessibility();
      const resp = store.getResponsive();

      if (!dom) return userMsg("No browser data captured. Click the bookmarklet on your app first.");

      return userMsg([
        "Perform a comprehensive UI audit on this page:\n",
        `## Page: ${dom.title} (${dom.totalElements} elements)\n`,
        colors ? `## Colors (${colors.totalUniqueColors} unique)\nText: ${colors.colors.slice(0, 5).map((c) => `${c.hex} (${c.count}x)`).join(", ")}\nBackgrounds: ${colors.backgroundColors.slice(0, 5).map((c) => `${c.hex} (${c.count}x)`).join(", ")}\nBorders: ${colors.borderColors.slice(0, 3).map((c) => `${c.hex} (${c.count}x)`).join(", ")}\n` : "",
        typo ? `## Typography (${typo.fonts.length} combinations)\n${typo.fonts.slice(0, 8).map((f) => `- ${f.family} ${f.weight} ${f.size}/${f.lineHeight} — ${f.count} uses`).join("\n")}\n` : "",
        spacing ? `## Spacing Scale: ${spacing.spacingScale.join(", ")}\nElements analyzed: ${spacing.elements.length}\n${spacing.inconsistencies.length > 0 ? "Inconsistencies: " + spacing.inconsistencies.length : "No inconsistencies detected"}\n` : "",
        acc ? `## Accessibility\nInteractive: ${acc.summary.totalInteractive} (${acc.summary.withLabels} labeled)\nImages: ${acc.summary.imagesWithAlt + acc.summary.imagesWithoutAlt} total (${acc.summary.imagesWithoutAlt} missing alt)\nIssues: ${acc.summary.issues.length}\n${acc.summary.issues.slice(0, 5).map((i) => "- " + i).join("\n")}\n` : "",
        resp ? `## Responsive\nViewport: ${resp.viewport.width}x${resp.viewport.height}\nDPR: ${resp.viewport.devicePixelRatio}\nActive: ${resp.activeMediaQueries.join(", ") || "none"}\n` : "",
        "\n## Instructions",
        "1. Rate the overall design quality (1-10) with justification",
        "2. Check color consistency — are there too many unique colors?",
        "3. Check typography consistency — too many font size/weight combos?",
        "4. Check spacing — does it follow a consistent scale (4px, 8px, 16px...)?",
        "5. Flag accessibility issues with specific fix suggestions",
        "6. Note responsive readiness",
        "7. Provide prioritized list of improvements",
      ].join("\n"));
    },
  );

  server.registerPrompt(
    "describe_page",
    {
      title: "Describe Page",
      description:
        "Generate a detailed description of the page UI that an AI can use to understand and modify the design",
    },
    () => {
      const dom = store.getDom();
      if (!dom) return userMsg("No browser data captured. Click the bookmarklet on your app first.");

      const elements = store.getElements();
      const elSummary = Object.keys(elements).slice(0, 20).map((k) => {
        const el = elements[k];
        const s = el.computedStyle?.styles ?? {};
        return `- ${k}: ${el.layout?.display ?? "block"} | ${Math.round(el.layout?.box.width ?? 0)}x${Math.round(el.layout?.box.height ?? 0)} | bg:${s.backgroundColor ?? "none"} | color:${s.color ?? "inherit"} | font:${s.fontSize ?? "?"}`;
      });

      return userMsg([
        "Describe this page's UI in detail for a developer who needs to modify it:\n",
        `## Page: ${dom.title}`,
        `URL: ${dom.url}`,
        `Elements: ${dom.totalElements}`,
        `Viewport: ${dom.viewport.width}x${dom.viewport.height}\n`,
        "## Semantic Structure",
        dom.semanticStructure.map((n) => `- <${n.tag}> ${n.label ?? ""} → ${n.selector}`).join("\n"),
        "\n## Key Elements",
        elSummary.join("\n"),
        "\n## Instructions",
        "1. Describe the page layout in natural language (header, sidebar, content area, footer)",
        "2. Identify the design system cues (spacing patterns, color palette, typography)",
        "3. Note interactive elements and their states",
        "4. Describe the visual hierarchy (what draws attention first)",
        "5. Identify any design patterns (cards, lists, forms, navigation)",
        "6. Output a structured description the IDE can reference when making CSS changes",
      ].join("\n"));
    },
  );

  server.registerPrompt(
    "suggest_fixes",
    {
      title: "Suggest UI Fixes",
      description:
        "Based on captured data, suggest specific CSS/HTML fixes to improve the design",
    },
    () => {
      const comparisons = store.getComparisons();
      const acc = store.getAccessibility();
      const spacing = store.getSpacing();

      const issues: string[] = [];

      if (comparisons.length > 0) {
        const failing = comparisons.filter((c) => c.score < 90);
        if (failing.length > 0) {
          issues.push("## Figma Comparison Failures");
          for (const c of failing.slice(0, 5)) {
            issues.push(`\n### ${c.selector} (${c.score}/100)`);
            for (const d of c.differences) {
              issues.push(`- ${d.property}: ${d.actual} → ${d.expected} (${d.severity})`);
            }
          }
        }
      }

      if (acc && acc.summary.issues.length > 0) {
        issues.push("\n## Accessibility Issues");
        for (const i of acc.summary.issues.slice(0, 10)) {
          issues.push(`- ${i}`);
        }
      }

      if (spacing && spacing.inconsistencies.length > 0) {
        issues.push("\n## Spacing Inconsistencies");
        for (const i of spacing.inconsistencies.slice(0, 5)) {
          issues.push(`- ${i.property}: ${i.values.join(", ")} → Suggested: ${i.suggestion}`);
        }
      }

      if (issues.length === 0) {
        return userMsg("No issues found. The page looks good! Use compare_with_figma to check specific elements.");
      }

      return userMsg([
        "Fix these UI issues in priority order:\n",
        ...issues,
        "\n## Instructions",
        "1. Fix Figma comparison failures first (highest visual impact)",
        "2. Then accessibility issues (functional impact)",
        "3. Then spacing inconsistencies (polish)",
        "4. For each fix, provide the exact CSS change",
        "5. After applying fixes, use compare_with_figma to verify improvement",
      ].join("\n"));
    },
  );

  server.registerPrompt(
    "visual_qa",
    {
      title: "Visual QA Check",
      description:
        "Run a visual QA check: take screenshot, verify against Figma, report pass/fail with details",
    },
    () => {
      const shot = store.getLatestScreenshot();
      const dom = store.getDom();
      const comparisons = store.getComparisons();

      if (!dom) return userMsg("No browser data captured. Click the bookmarklet first.");

      const compSummary = comparisons.length > 0
        ? comparisons.map((c) => `- ${c.selector}: ${c.score}/100 (${c.status})`).join("\n")
        : "No comparisons run yet.";

      return userMsg([
        "Perform a visual QA check on this page:\n",
        `## Page: ${dom.title}`,
        `URL: ${dom.url}`,
        `Screenshot available: ${shot ? "Yes" : "No"}`,
        `Elements captured: ${Object.keys(store.getElements()).length}\n`,
        "## Comparison Results",
        compSummary,
        "\n## Instructions",
        "1. Use get_page_screenshot to see the current page state",
        "2. Compare key UI elements with Figma specs using compare_with_figma",
        "3. Check for visual regressions: broken layouts, overflow, missing content",
        "4. Verify responsive behavior with get_responsive_info",
        "5. Rate: PASS (all >90 score), NEEDS_WORK (some <90), FAIL (any <50)",
        "6. Output a structured QA report with pass/fail per element",
      ].join("\n"));
    },
  );
}
