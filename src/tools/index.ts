import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { BrowserStore } from "../store/browser-store.js";
import type { FigmaSpec, ComparisonDifference, ComparisonResult } from "../store/types.js";
import type { WsCommandChannel } from "../transport/ws-receiver.js";
import { cdpCaptureScreenshot, isCdpAvailable } from "../transport/cdp-capture.js";

function text(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function imageContent(dataUrl: string, altText: string) {
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");
  return {
    content: [
      {
        type: "image" as const,
        data: base64,
        mimeType: "image/png" as const,
      },
      { type: "text" as const, text: altText },
    ],
  };
}

function compareValues(
  property: string,
  expected: string | number | undefined,
  actual: string,
): ComparisonDifference | null {
  if (expected === undefined || expected === null) return null;
  const expStr = String(expected).toLowerCase().trim();
  const actStr = actual.toLowerCase().trim();
  if (expStr === actStr) return null;

  const expNum = parseFloat(expStr);
  const actNum = parseFloat(actStr);
  if (!isNaN(expNum) && !isNaN(actNum)) {
    const diff = Math.abs(expNum - actNum);
    if (diff <= 1) return null;
    const severity = diff > 10 ? "major" : diff > 4 ? "minor" : "info";
    return {
      property,
      expected: String(expected),
      actual,
      severity: severity as ComparisonDifference["severity"],
      suggestion: `Change ${property} from ${actual} to ${expected}`,
    };
  }

  return {
    property,
    expected: String(expected),
    actual,
    severity: "major",
    suggestion: `Change ${property} from "${actual}" to "${expected}"`,
  };
}

export function registerTools(server: McpServer, store: BrowserStore, wsChannel?: WsCommandChannel): void {
  server.registerTool(
    "get_page_info",
    {
      title: "Page Info",
      description:
        "Get connected page URL, viewport size, element count, and data availability summary",
    },
    () => text(store.getPageInfo()),
  );

  server.registerTool(
    "get_dom_tree",
    {
      title: "DOM Tree",
      description:
        "Get the full DOM tree structure of the connected page with semantic analysis",
      inputSchema: {
        maxDepth: z.number().optional().describe("Max depth to return (default: all)"),
      },
    },
    (args) => {
      const dom = store.getDom();
      if (!dom) return text({ message: "No DOM data captured. Click the bookmarklet on your app first." });
      const result: Record<string, unknown> = {
        url: dom.url,
        title: dom.title,
        totalElements: dom.totalElements,
        viewport: dom.viewport,
        semanticStructure: dom.semanticStructure,
      };
      if (args.maxDepth !== undefined) {
        const trim = (node: Record<string, unknown>, depth: number): Record<string, unknown> => {
          if (depth >= (args.maxDepth ?? 999)) return { ...node, children: [] };
          const children = (node.children as Record<string, unknown>[]) ?? [];
          return { ...node, children: children.map((c) => trim(c, depth + 1)) };
        };
        result.rootElement = trim(dom.rootElement as unknown as Record<string, unknown>, 0);
      } else {
        result.rootElement = dom.rootElement;
      }
      return text(result);
    },
  );

  server.registerTool(
    "inspect_element",
    {
      title: "Inspect Element",
      description:
        "Get full details of a specific element: DOM, computed styles, layout, box model, accessibility",
      inputSchema: {
        selector: z.string().describe("CSS selector of the element to inspect"),
      },
    },
    (args) => {
      const el = store.getElement(args.selector);
      if (!el) {
        const found = store.querySelector(args.selector);
        if (found.length > 0) {
          return text({
            message: `Element found in DOM tree but not in detail cache. Found ${found.length} matching element(s).`,
            matches: found.map((f) => ({ selector: f.selector, tagName: f.tagName, id: f.id, classes: f.classNames })),
          });
        }
        return text({ error: `Element '${args.selector}' not found. Use query_selector to search.` });
      }
      return text(el);
    },
  );

  server.registerTool(
    "query_selector",
    {
      title: "Query Selector",
      description:
        "Search the DOM tree for elements matching a tag name, class, or ID",
      inputSchema: {
        selector: z.string().describe("CSS selector, tag name, .class, or #id"),
        limit: z.number().optional().describe("Max results (default: 20)"),
      },
    },
    (args) => {
      const results = store.querySelector(args.selector);
      const limit = args.limit ?? 20;
      return text({
        query: args.selector,
        totalMatches: results.length,
        elements: results.slice(0, limit).map((e) => ({
          selector: e.selector,
          tagName: e.tagName,
          id: e.id,
          classes: e.classNames,
          text: e.textContent.slice(0, 100),
          childCount: e.childCount,
        })),
      });
    },
  );

  server.registerTool(
    "get_computed_styles",
    {
      title: "Computed Styles",
      description:
        "Get all computed CSS styles for a specific element including applied classes and matched rules",
      inputSchema: {
        selector: z.string().describe("CSS selector of the element"),
        properties: z.array(z.string()).optional().describe("Specific CSS properties to return (default: all)"),
      },
    },
    (args) => {
      const style = store.getComputedStyle(args.selector);
      if (!style) return text({ error: `No style data for '${args.selector}'` });
      if (args.properties) {
        const filtered: Record<string, string> = {};
        for (const p of args.properties) {
          const camel = p.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
          if (style.styles[p]) filtered[p] = style.styles[p];
          else if (style.styles[camel]) filtered[camel] = style.styles[camel];
        }
        return text({ selector: args.selector, styles: filtered, appliedClasses: style.appliedClasses });
      }
      return text(style);
    },
  );

  server.registerTool(
    "get_layout_info",
    {
      title: "Layout Info",
      description:
        "Get box model, positioning, flex/grid info, and dimensions for an element",
      inputSchema: {
        selector: z.string().describe("CSS selector of the element"),
      },
    },
    (args) => {
      const layout = store.getLayout(args.selector);
      if (!layout) return text({ error: `No layout data for '${args.selector}'` });
      return text(layout);
    },
  );

  server.registerTool(
    "get_page_screenshot",
    {
      title: "Page Screenshot",
      description:
        "Get the latest screenshot of the page viewport as a PNG image",
    },
    () => {
      const shot = store.getLatestScreenshot();
      if (!shot) return text({ message: "No screenshots captured yet." });
      return imageContent(
        shot.dataUrl,
        `Page screenshot (${shot.width}x${shot.height}) captured at ${new Date(shot.timestamp).toISOString()}`,
      );
    },
  );

  server.registerTool(
    "get_all_screenshots",
    {
      title: "All Screenshots",
      description: "List all captured screenshots with metadata",
    },
    () => {
      const shots = store.getScreenshots();
      if (shots.length === 0) return text({ message: "No screenshots captured." });
      return text({
        total: shots.length,
        screenshots: shots.map((s, i) => ({
          index: i,
          type: s.type,
          selector: s.selector,
          width: s.width,
          height: s.height,
          timestamp: new Date(s.timestamp).toISOString(),
          hasData: !!s.dataUrl,
        })),
      });
    },
  );

  server.registerTool(
    "get_css_variables",
    {
      title: "CSS Variables",
      description:
        "Get all CSS custom properties (--*) defined in the page with their values",
      inputSchema: {
        search: z.string().optional().describe("Filter variables by name"),
      },
    },
    (args) => {
      const vars = store.getCssVariables();
      if (!vars) return text({ message: "No CSS variable data captured." });
      if (args.search) {
        const filtered: Record<string, string> = {};
        const q = args.search.toLowerCase();
        for (const [k, v] of Object.entries(vars.variables)) {
          if (k.toLowerCase().includes(q)) filtered[k] = v;
        }
        return text({ search: args.search, totalMatches: Object.keys(filtered).length, variables: filtered });
      }
      return text(vars);
    },
  );

  server.registerTool(
    "get_typography",
    {
      title: "Typography Analysis",
      description:
        "Analyze all font families, sizes, weights, and line-heights used on the page",
    },
    () => {
      const typo = store.getTypography();
      if (!typo) return text({ message: "No typography data captured." });
      return text(typo);
    },
  );

  server.registerTool(
    "get_color_palette",
    {
      title: "Color Palette",
      description:
        "Extract all colors (text, background, border) used on the page with usage counts",
    },
    () => {
      const colors = store.getColors();
      if (!colors) return text({ message: "No color data captured." });
      return text(colors);
    },
  );

  server.registerTool(
    "get_accessibility_info",
    {
      title: "Accessibility Audit",
      description:
        "Check interactive elements for ARIA labels, roles, alt text, headings, and landmarks",
    },
    () => {
      const acc = store.getAccessibility();
      if (!acc) return text({ message: "No accessibility data captured." });
      return text(acc);
    },
  );

  server.registerTool(
    "get_responsive_info",
    {
      title: "Responsive Info",
      description:
        "Get viewport dimensions, device pixel ratio, active media queries, and breakpoint status",
    },
    () => {
      const resp = store.getResponsive();
      if (!resp) return text({ message: "No responsive data captured." });
      return text(resp);
    },
  );

  server.registerTool(
    "get_spacing_analysis",
    {
      title: "Spacing Analysis",
      description:
        "Analyze margins, paddings, and gaps across elements to find inconsistencies and spacing scale",
    },
    () => {
      const spacing = store.getSpacing();
      if (!spacing) return text({ message: "No spacing data captured." });
      return text(spacing);
    },
  );

  server.registerTool(
    "get_dom_mutations",
    {
      title: "DOM Mutations",
      description:
        "Get recent DOM changes (attribute changes, added/removed nodes)",
      inputSchema: {
        since: z.number().optional().describe("Only mutations after this timestamp"),
        limit: z.number().optional().describe("Max mutations to return (default: 50)"),
      },
    },
    (args) => {
      const mutations = store.getMutations(args.since);
      const limit = args.limit ?? 50;
      return text({
        total: mutations.length,
        mutations: mutations.slice(0, limit),
      });
    },
  );

  server.registerTool(
    "compare_with_figma",
    {
      title: "Compare with Figma",
      description:
        "Compare a browser element against Figma design specifications. Provide the expected CSS values from Figma and get a detailed diff report with fix suggestions.",
      inputSchema: {
        selector: z.string().describe("CSS selector of the element to compare"),
        figmaSpec: z.object({
          width: z.number().optional(),
          height: z.number().optional(),
          backgroundColor: z.string().optional(),
          color: z.string().optional(),
          fontSize: z.string().optional(),
          fontWeight: z.string().optional(),
          fontFamily: z.string().optional(),
          lineHeight: z.string().optional(),
          letterSpacing: z.string().optional(),
          borderRadius: z.string().optional(),
          borderWidth: z.string().optional(),
          borderColor: z.string().optional(),
          opacity: z.number().optional(),
          gap: z.string().optional(),
          padding: z.string().optional(),
          margin: z.string().optional(),
          boxShadow: z.string().optional(),
          textAlign: z.string().optional(),
          display: z.string().optional(),
          justifyContent: z.string().optional(),
          alignItems: z.string().optional(),
        }).describe("Expected CSS properties from Figma design"),
      },
    },
    (args) => {
      const element = store.getElement(args.selector);
      if (!element) return text({ error: `Element '${args.selector}' not found` });

      const styles = element.computedStyle.styles;
      const layout = element.layout;
      const differences: ComparisonDifference[] = [];
      const spec = args.figmaSpec as FigmaSpec;

      if (spec.width !== undefined) {
        const d = compareValues("width", spec.width + "px", layout.box.width + "px");
        if (d) differences.push(d);
      }
      if (spec.height !== undefined) {
        const d = compareValues("height", spec.height + "px", layout.box.height + "px");
        if (d) differences.push(d);
      }

      const styleProps = [
        "backgroundColor", "color", "fontSize", "fontWeight", "fontFamily",
        "lineHeight", "letterSpacing", "borderRadius", "borderWidth",
        "borderColor", "gap", "padding", "margin", "boxShadow", "textAlign",
        "display", "justifyContent", "alignItems",
      ];

      for (const prop of styleProps) {
        const expected = spec[prop];
        if (expected === undefined) continue;
        const camelProp = prop;
        const actual = styles[camelProp] ?? "";
        const d = compareValues(prop, String(expected), actual);
        if (d) differences.push(d);
      }

      if (spec.opacity !== undefined) {
        const d = compareValues("opacity", String(spec.opacity), styles.opacity ?? "1");
        if (d) differences.push(d);
      }

      const criticalCount = differences.filter((d) => d.severity === "critical").length;
      const majorCount = differences.filter((d) => d.severity === "major").length;
      const totalDiffs = differences.length;
      const score = totalDiffs === 0 ? 100 : Math.max(0, 100 - criticalCount * 25 - majorCount * 10 - (totalDiffs - criticalCount - majorCount) * 3);
      const status = score >= 95 ? "match" : score >= 80 ? "minor-diff" : score >= 50 ? "major-diff" : "mismatch";

      const suggestions = differences.map((d) => d.suggestion);
      const summary =
        totalDiffs === 0
          ? `Perfect match! Element matches Figma spec exactly.`
          : `Found ${totalDiffs} difference(s): ${criticalCount} critical, ${majorCount} major. Score: ${score}/100. ${status === "minor-diff" ? "Close to Figma spec with minor adjustments needed." : "Significant differences from Figma spec — fixes recommended."}`;

      const result: ComparisonResult = {
        timestamp: Date.now(),
        selector: args.selector,
        score,
        status,
        differences,
        suggestions,
        summary,
      };

      store.addComparison(result);
      return text(result);
    },
  );

  server.registerTool(
    "get_comparison_history",
    {
      title: "Comparison History",
      description: "Get all previous Figma comparison results",
    },
    () => {
      const comparisons = store.getComparisons();
      if (comparisons.length === 0) return text({ message: "No comparisons done yet. Use compare_with_figma first." });
      return text({
        total: comparisons.length,
        comparisons: comparisons.map((c) => ({
          selector: c.selector,
          score: c.score,
          status: c.status,
          diffCount: c.differences.length,
          timestamp: new Date(c.timestamp).toISOString(),
        })),
      });
    },
  );

  server.registerTool(
    "describe_ui",
    {
      title: "Describe Page UI",
      description:
        "Generate a comprehensive AI-friendly description of the current page layout, colors, typography, and interactive elements",
    },
    () => {
      const dom = store.getDom();
      const colors = store.getColors();
      const typo = store.getTypography();
      const resp = store.getResponsive();
      const acc = store.getAccessibility();

      if (!dom) return text({ message: "No page data. Connect browser first." });

      const lines: string[] = [];
      lines.push(`# Page: ${dom.title}`);
      lines.push(`URL: ${dom.url}`);
      lines.push(`Viewport: ${dom.viewport.width}x${dom.viewport.height} (${dom.viewport.devicePixelRatio}x DPR)`);
      lines.push(`Total elements: ${dom.totalElements}`);
      lines.push("");

      if (dom.semanticStructure.length > 0) {
        lines.push("## Page Structure");
        for (const node of dom.semanticStructure) {
          const indent = node.level ? "  ".repeat(node.level - 1) : "";
          lines.push(`${indent}- <${node.tag}>${node.label ? ` "${node.label}"` : ""} → ${node.selector}`);
        }
        lines.push("");
      }

      if (colors) {
        lines.push("## Color Scheme");
        lines.push(`Unique colors: ${colors.totalUniqueColors}`);
        const topBg = colors.backgroundColors.slice(0, 3).map((c) => c.hex).join(", ");
        const topText = colors.colors.slice(0, 3).map((c) => c.hex).join(", ");
        if (topBg) lines.push(`Primary backgrounds: ${topBg}`);
        if (topText) lines.push(`Primary text colors: ${topText}`);
        lines.push("");
      }

      if (typo) {
        lines.push("## Typography");
        for (const f of typo.fonts.slice(0, 5)) {
          lines.push(`- ${f.family} ${f.weight} ${f.size}/${f.lineHeight} (${f.count} uses)`);
        }
        lines.push("");
      }

      if (acc) {
        lines.push("## Accessibility Summary");
        lines.push(`Interactive elements: ${acc.summary.totalInteractive} (${acc.summary.withLabels} labeled, ${acc.summary.withoutLabels} unlabeled)`);
        lines.push(`Images: ${acc.summary.imagesWithAlt} with alt, ${acc.summary.imagesWithoutAlt} without`);
        if (acc.summary.landmarks.length > 0) lines.push(`Landmarks: ${acc.summary.landmarks.join(", ")}`);
        if (acc.summary.issues.length > 0) {
          lines.push(`Issues: ${acc.summary.issues.length}`);
          for (const issue of acc.summary.issues.slice(0, 5)) lines.push(`  - ${issue}`);
        }
        lines.push("");
      }

      if (resp) {
        lines.push("## Responsive");
        lines.push(`Active breakpoints: ${resp.activeMediaQueries.join(", ") || "none matched"}`);
      }

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    },
  );

  server.registerTool(
    "suggest_css_fixes",
    {
      title: "Suggest CSS Fixes",
      description:
        "Based on the latest Figma comparison, suggest specific CSS changes to match the design",
      inputSchema: {
        selector: z.string().optional().describe("Specific element selector (default: latest comparison)"),
      },
    },
    (args) => {
      const comparisons = store.getComparisons();
      if (comparisons.length === 0) return text({ message: "No comparisons available. Use compare_with_figma first." });

      const comp = args.selector
        ? comparisons.find((c) => c.selector === args.selector)
        : comparisons[comparisons.length - 1];

      if (!comp) return text({ error: `No comparison found for '${args.selector}'` });

      if (comp.differences.length === 0) {
        return text({ message: `Element '${comp.selector}' perfectly matches Figma spec. No fixes needed.` });
      }

      const cssLines: string[] = [];
      cssLines.push(`/* Fix for ${comp.selector} — Score: ${comp.score}/100 */`);
      cssLines.push(`${comp.selector} {`);
      for (const diff of comp.differences) {
        const cssProp = diff.property.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
        cssLines.push(`  ${cssProp}: ${diff.expected}; /* was: ${diff.actual} */`);
      }
      cssLines.push("}");

      return {
        content: [{
          type: "text" as const,
          text: [
            `## CSS Fix for ${comp.selector}`,
            `Score: ${comp.score}/100 (${comp.status})`,
            `Differences: ${comp.differences.length}`,
            "",
            "```css",
            ...cssLines,
            "```",
            "",
            "### Changes:",
            ...comp.differences.map((d) => `- **${d.property}**: \`${d.actual}\` → \`${d.expected}\` (${d.severity})`),
          ].join("\n"),
        }],
      };
    },
  );

  server.registerTool(
    "get_element_hierarchy",
    {
      title: "Element Hierarchy",
      description:
        "Show parent-child relationships for a specific element in the DOM tree",
      inputSchema: {
        selector: z.string().describe("CSS selector to find in the tree"),
      },
    },
    (args) => {
      const dom = store.getDom();
      if (!dom) return text({ message: "No DOM data captured." });

      const path: string[] = [];
      const find = (node: Record<string, unknown>, trail: string[]): boolean => {
        const sel = node.selector as string;
        const currentTrail = [...trail, sel];
        if (sel === args.selector || (node.tagName as string)?.toLowerCase() === args.selector.toLowerCase()) {
          path.push(...currentTrail);
          return true;
        }
        const children = (node.children as Record<string, unknown>[]) ?? [];
        for (const child of children) {
          if (find(child, currentTrail)) return true;
        }
        return false;
      };

      find(dom.rootElement as unknown as Record<string, unknown>, []);

      if (path.length === 0) return text({ error: `Element '${args.selector}' not found in DOM tree.` });

      return text({
        selector: args.selector,
        depth: path.length,
        hierarchy: path.map((p, i) => ({ depth: i, selector: p })),
      });
    },
  );

  server.registerTool(
    "get_elements_summary",
    {
      title: "Elements Summary",
      description: "Get a summary of all captured element details with their selectors",
    },
    () => {
      const elements = store.getElements();
      const keys = Object.keys(elements);
      if (keys.length === 0) return text({ message: "No element details captured." });
      return text({
        totalCaptured: keys.length,
        elements: keys.map((k) => ({
          selector: k,
          tagName: elements[k].snapshot?.tagName,
          display: elements[k].layout?.display,
          size: elements[k].layout ? `${Math.round(elements[k].layout.box.width)}x${Math.round(elements[k].layout.box.height)}` : "unknown",
          classes: elements[k].computedStyle?.appliedClasses?.join(" ") || "",
        })),
      });
    },
  );

  server.registerTool(
    "clear_data",
    {
      title: "Clear All Data",
      description: "Clear all captured browser data: DOM, styles, screenshots, comparisons",
    },
    () => {
      const count = store.getElementCount();
      store.clear();
      return text({ cleared: count, remaining: 0 });
    },
  );

  server.registerTool(
    "get_connection_status",
    {
      title: "Connection Status",
      description:
        "Check if the browser is connected and what data is available. Use this first to verify the bookmarklet is active.",
    },
    () => {
      const info = store.getPageInfo();
      const connected = info.hasDom || info.totalElements > 0;
      const httpPort = parseInt(process.env.MCP_BROWSER_LENS_PORT ?? "3202", 10);
      return text({
        connected,
        connectorUrl: `http://localhost:${httpPort}`,
        instructions: connected
          ? "Browser connected! Data is available for inspection."
          : "Not connected. Open http://localhost:" + httpPort + " in your browser, drag the bookmarklet to your bookmarks bar, then click it on any page.",
        dataAvailable: {
          dom: info.hasDom,
          elements: info.totalElements,
          screenshots: info.screenshotCount,
          cssVariables: info.hasCssVariables,
          typography: info.hasTypography,
          colors: info.hasColors,
          accessibility: info.hasAccessibility,
          responsive: info.hasResponsive,
          spacing: info.hasSpacing,
          mutations: info.mutationCount,
          comparisons: info.comparisonCount,
        },
        url: info.url,
        title: info.title,
      });
    },
  );

  server.registerTool(
    "get_full_page_analysis",
    {
      title: "Full Page Analysis",
      description:
        "Get a comprehensive analysis of the entire page: structure, design tokens, typography, colors, spacing, accessibility — everything in one call. Best used as a first step after connecting.",
    },
    () => {
      const dom = store.getDom();
      if (!dom) return text({ message: "No browser connected. Use get_connection_status for setup instructions." });

      const colors = store.getColors();
      const typo = store.getTypography();
      const spacing = store.getSpacing();
      const acc = store.getAccessibility();
      const resp = store.getResponsive();
      const vars = store.getCssVariables();
      const elements = store.getElements();

      const sections: string[] = [];
      sections.push(`# Full Page Analysis: ${dom.title}`);
      sections.push(`**URL:** ${dom.url}`);
      sections.push(`**Viewport:** ${dom.viewport.width}x${dom.viewport.height} @${dom.viewport.devicePixelRatio}x`);
      sections.push(`**Total Elements:** ${dom.totalElements}`);
      sections.push(`**Captured Details:** ${Object.keys(elements).length} elements`);
      sections.push("");

      sections.push("## Semantic Structure");
      for (const node of dom.semanticStructure) {
        const prefix = node.level ? "  ".repeat(node.level - 1) + "- " : "- ";
        sections.push(`${prefix}<${node.tag}>${node.label ? ` "${node.label}"` : ""} → \`${node.selector}\``);
      }
      sections.push("");

      if (vars) {
        sections.push(`## Design Tokens (${vars.totalCount} CSS variables)`);
        const grouped: Record<string, string[]> = {};
        for (const [k, v] of Object.entries(vars.variables)) {
          const category = k.includes("color") || k.includes("bg") || v.startsWith("#") || v.startsWith("rgb") ? "Colors"
            : k.includes("font") || k.includes("size") || k.includes("weight") ? "Typography"
            : k.includes("space") || k.includes("gap") || k.includes("radius") || k.includes("padding") || k.includes("margin") ? "Spacing"
            : "Other";
          if (!grouped[category]) grouped[category] = [];
          grouped[category].push(`\`${k}\`: ${v}`);
        }
        for (const [cat, items] of Object.entries(grouped)) {
          sections.push(`### ${cat}`);
          for (const item of items.slice(0, 15)) sections.push(`- ${item}`);
          sections.push("");
        }
      }

      if (typo) {
        sections.push(`## Typography (${typo.fonts.length} combinations)`);
        for (const f of typo.fonts.slice(0, 8)) {
          sections.push(`- **${f.family}** ${f.weight} ${f.size}/${f.lineHeight} — ${f.count} elements`);
        }
        sections.push("");
      }

      if (colors) {
        sections.push(`## Color Palette (${colors.totalUniqueColors} unique colors)`);
        sections.push("### Text Colors");
        for (const c of colors.colors.slice(0, 5)) sections.push(`- \`${c.hex}\` — ${c.count} uses`);
        sections.push("### Background Colors");
        for (const c of colors.backgroundColors.slice(0, 5)) sections.push(`- \`${c.hex}\` — ${c.count} uses`);
        sections.push("### Border Colors");
        for (const c of colors.borderColors.slice(0, 3)) sections.push(`- \`${c.hex}\` — ${c.count} uses`);
        sections.push("");
      }

      if (spacing) {
        sections.push(`## Spacing Scale`);
        sections.push(`Values in use: ${spacing.spacingScale.join(", ")}`);
        if (spacing.inconsistencies.length > 0) {
          sections.push(`⚠️ ${spacing.inconsistencies.length} inconsistencies detected`);
        }
        sections.push("");
      }

      if (acc) {
        sections.push("## Accessibility");
        sections.push(`- Interactive: ${acc.summary.totalInteractive} (${acc.summary.withLabels} with labels)`);
        sections.push(`- Images: ${acc.summary.imagesWithAlt} with alt / ${acc.summary.imagesWithoutAlt} missing`);
        sections.push(`- Headings: ${Object.entries(acc.summary.headingLevels).map(([k, v]) => `${k}:${v}`).join(", ")}`);
        sections.push(`- Landmarks: ${acc.summary.landmarks.join(", ") || "none"}`);
        if (acc.summary.issues.length > 0) {
          sections.push(`### Issues (${acc.summary.issues.length})`);
          for (const i of acc.summary.issues.slice(0, 10)) sections.push(`- ${i}`);
        }
        sections.push("");
      }

      if (resp) {
        sections.push("## Responsive");
        sections.push(`Active: ${resp.activeMediaQueries.join(", ") || "no matched breakpoints"}`);
        sections.push(`Scroll: ${resp.viewport.scrollWidth}x${resp.viewport.scrollHeight}`);
      }

      return { content: [{ type: "text" as const, text: sections.join("\n") }] };
    },
  );

  server.registerTool(
    "get_design_tokens",
    {
      title: "Design Tokens",
      description:
        "Extract design tokens from the page: CSS variables grouped by category (colors, typography, spacing, breakpoints), font stacks, and color palette as a design system reference.",
    },
    () => {
      const vars = store.getCssVariables();
      const colors = store.getColors();
      const typo = store.getTypography();
      const spacing = store.getSpacing();

      if (!vars && !colors && !typo) return text({ message: "No design data captured. Connect browser first." });

      const tokens: Record<string, unknown> = {};

      if (vars) {
        const colorTokens: Record<string, string> = {};
        const typographyTokens: Record<string, string> = {};
        const spacingTokens: Record<string, string> = {};
        const otherTokens: Record<string, string> = {};
        for (const [k, v] of Object.entries(vars.variables)) {
          if (k.includes("color") || k.includes("bg") || v.startsWith("#") || v.startsWith("rgb") || v.startsWith("hsl")) colorTokens[k] = v;
          else if (k.includes("font") || k.includes("size") || k.includes("weight") || k.includes("line-height")) typographyTokens[k] = v;
          else if (k.includes("space") || k.includes("gap") || k.includes("radius") || k.includes("padding") || k.includes("margin")) spacingTokens[k] = v;
          else otherTokens[k] = v;
        }
        tokens.cssVariables = { colors: colorTokens, typography: typographyTokens, spacing: spacingTokens, other: otherTokens };
      }

      if (colors) {
        tokens.colorPalette = {
          text: colors.colors.slice(0, 10).map((c) => ({ hex: c.hex, count: c.count })),
          background: colors.backgroundColors.slice(0, 10).map((c) => ({ hex: c.hex, count: c.count })),
          border: colors.borderColors.slice(0, 5).map((c) => ({ hex: c.hex, count: c.count })),
        };
      }

      if (typo) {
        tokens.fontStacks = typo.fonts.slice(0, 10).map((f) => ({
          family: f.family, size: f.size, weight: f.weight, lineHeight: f.lineHeight, count: f.count,
        }));
      }

      if (spacing) {
        tokens.spacingScale = spacing.spacingScale;
      }

      return text(tokens);
    },
  );

  server.registerTool(
    "get_visual_diff_report",
    {
      title: "Visual Diff Report",
      description:
        "Generate a comprehensive visual diff report comparing the current UI against all previously compared Figma specs. Shows overall score, per-element results, and prioritized fix list.",
    },
    () => {
      const comparisons = store.getComparisons();
      if (comparisons.length === 0) return text({ message: "No comparisons done. Use compare_with_figma first." });

      const scores = comparisons.map((c) => c.score);
      const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
      const passing = comparisons.filter((c) => c.score >= 90).length;
      const failing = comparisons.filter((c) => c.score < 90).length;

      const allDiffs = comparisons.flatMap((c) => c.differences.map((d) => ({ ...d, element: c.selector })));
      const critical = allDiffs.filter((d) => d.severity === "critical");
      const major = allDiffs.filter((d) => d.severity === "major");
      const minor = allDiffs.filter((d) => d.severity === "minor");

      const sections: string[] = [];
      sections.push("# Visual Diff Report");
      sections.push(`**Overall Score:** ${avgScore}/100`);
      sections.push(`**Elements Compared:** ${comparisons.length} (${passing} passing, ${failing} failing)`);
      sections.push(`**Total Differences:** ${allDiffs.length} (${critical.length} critical, ${major.length} major, ${minor.length} minor)`);
      sections.push("");

      sections.push("## Per-Element Results");
      for (const c of comparisons.sort((a, b) => a.score - b.score)) {
        const icon = c.score >= 90 ? "✅" : c.score >= 50 ? "⚠️" : "❌";
        sections.push(`${icon} **${c.selector}** — ${c.score}/100 (${c.status})`);
        if (c.differences.length > 0) {
          for (const d of c.differences) {
            sections.push(`   - ${d.property}: \`${d.actual}\` → \`${d.expected}\` (${d.severity})`);
          }
        }
      }
      sections.push("");

      if (critical.length + major.length > 0) {
        sections.push("## Priority Fixes");
        for (const d of [...critical, ...major]) {
          sections.push(`- **${d.element}** → ${d.property}: ${d.suggestion}`);
        }
      }

      return { content: [{ type: "text" as const, text: sections.join("\n") }] };
    },
  );

  server.registerTool(
    "capture_screenshot_with_analysis",
    {
      title: "Screenshot with Analysis",
      description:
        "Get the latest screenshot AND a detailed analysis of what's visible: layout structure, key elements, colors, text content, interactive components. Returns both the image and a text description.",
    },
    () => {
      const shot = store.getLatestScreenshot();
      const dom = store.getDom();
      const colors = store.getColors();
      const typo = store.getTypography();
      const elements = store.getElements();
      const acc = store.getAccessibility();

      if (!dom) return text({ message: "No browser connected. Use get_connection_status for setup instructions." });

      const analysis: string[] = [];
      analysis.push(`# Screenshot Analysis: ${dom.title}`);
      analysis.push(`**URL:** ${dom.url}`);
      analysis.push(`**Viewport:** ${dom.viewport.width}x${dom.viewport.height}`);
      analysis.push("");

      analysis.push("## Page Layout");
      const layoutElements = Object.entries(elements);
      const byDisplay: Record<string, string[]> = {};
      for (const [sel, el] of layoutElements) {
        const d = el.layout?.display ?? "block";
        if (!byDisplay[d]) byDisplay[d] = [];
        byDisplay[d].push(`${sel} (${Math.round(el.layout?.box.width ?? 0)}x${Math.round(el.layout?.box.height ?? 0)})`);
      }
      for (const [display, items] of Object.entries(byDisplay)) {
        if (items.length > 0) analysis.push(`- **${display}**: ${items.slice(0, 5).join(", ")}${items.length > 5 ? ` +${items.length - 5} more` : ""}`);
      }
      analysis.push("");

      analysis.push("## Visible Elements");
      for (const [sel, el] of layoutElements.slice(0, 15)) {
        const s = el.computedStyle?.styles ?? {};
        const w = Math.round(el.layout?.box.width ?? 0);
        const h = Math.round(el.layout?.box.height ?? 0);
        const bg = s.backgroundColor && s.backgroundColor !== "rgba(0, 0, 0, 0)" ? ` bg:${s.backgroundColor}` : "";
        const color = s.color ? ` text:${s.color}` : "";
        const font = s.fontSize ? ` ${s.fontSize}` : "";
        analysis.push(`- \`${sel}\` — ${w}x${h}${bg}${color}${font}`);
      }
      analysis.push("");

      if (colors) {
        analysis.push("## Dominant Colors");
        analysis.push(`Backgrounds: ${colors.backgroundColors.slice(0, 3).map((c) => c.hex).join(", ")}`);
        analysis.push(`Text: ${colors.colors.slice(0, 3).map((c) => c.hex).join(", ")}`);
        analysis.push("");
      }

      if (typo) {
        analysis.push("## Text Styles");
        for (const f of typo.fonts.slice(0, 4)) {
          analysis.push(`- ${f.family} ${f.weight} ${f.size} — ${f.count} elements`);
        }
        analysis.push("");
      }

      if (acc && acc.summary.issues.length > 0) {
        analysis.push(`## Issues Spotted (${acc.summary.issues.length})`);
        for (const i of acc.summary.issues.slice(0, 5)) analysis.push(`- ${i}`);
      }

      const content: Array<{ type: "text"; text: string } | { type: "image"; data: string; mimeType: "image/png" }> = [];

      if (shot) {
        const base64 = shot.dataUrl.replace(/^data:image\/\w+;base64,/, "");
        content.push({ type: "image" as const, data: base64, mimeType: "image/png" as const });
      }

      content.push({ type: "text" as const, text: analysis.join("\n") });
      return { content };
    },
  );

  server.registerTool(
    "inspect_feature_area",
    {
      title: "Inspect Feature Area",
      description:
        "Inspect a specific feature area of the page by providing a parent selector. Returns screenshot + all child elements with their styles, layout, and a summary of the feature's visual design.",
      inputSchema: {
        selector: z.string().describe("CSS selector of the feature container (e.g. '.hero-section', '#sidebar', 'nav')"),
      },
    },
    (args) => {
      const dom = store.getDom();
      if (!dom) return text({ message: "No browser connected." });

      const elements = store.getElements();
      const matching = Object.entries(elements).filter(([sel]) =>
        sel === args.selector || sel.startsWith(args.selector + " ") || sel.startsWith(args.selector + ".")
      );

      if (matching.length === 0) {
        const domResults = store.querySelector(args.selector);
        if (domResults.length > 0) {
          return text({
            message: `Found ${domResults.length} element(s) in DOM tree but no detailed data. Elements nearby in the capture:`,
            domMatches: domResults.slice(0, 5).map((e) => ({ selector: e.selector, tag: e.tagName, children: e.childCount })),
            allCapturedSelectors: Object.keys(elements).slice(0, 20),
          });
        }
        return text({ error: `No elements matching '${args.selector}'. Available: ${Object.keys(elements).slice(0, 10).join(", ")}` });
      }

      const sections: string[] = [];
      sections.push(`# Feature Area: ${args.selector}`);
      sections.push(`**Elements Found:** ${matching.length}`);
      sections.push("");

      for (const [sel, el] of matching.slice(0, 20)) {
        const s = el.computedStyle?.styles ?? {};
        const l = el.layout;
        sections.push(`## \`${sel}\``);
        sections.push(`- **Tag:** ${el.snapshot?.tagName ?? "?"} | **Display:** ${l?.display ?? "?"} | **Size:** ${Math.round(l?.box.width ?? 0)}x${Math.round(l?.box.height ?? 0)}`);
        if (el.snapshot?.textContent) sections.push(`- **Text:** "${el.snapshot.textContent.slice(0, 100)}"`);
        const keyStyles: string[] = [];
        if (s.backgroundColor && s.backgroundColor !== "rgba(0, 0, 0, 0)") keyStyles.push(`bg: ${s.backgroundColor}`);
        if (s.color) keyStyles.push(`color: ${s.color}`);
        if (s.fontSize) keyStyles.push(`font: ${s.fontSize} ${s.fontWeight ?? ""}`);
        if (s.padding && s.padding !== "0px") keyStyles.push(`padding: ${s.padding}`);
        if (s.gap && s.gap !== "normal") keyStyles.push(`gap: ${s.gap}`);
        if (s.borderRadius && s.borderRadius !== "0px") keyStyles.push(`radius: ${s.borderRadius}`);
        if (keyStyles.length > 0) sections.push(`- **Styles:** ${keyStyles.join(" | ")}`);
        if (el.snapshot?.classNames?.length) sections.push(`- **Classes:** ${el.snapshot.classNames.join(", ")}`);
        sections.push("");
      }

      const content: Array<{ type: "text"; text: string } | { type: "image"; data: string; mimeType: "image/png" }> = [];
      const shot = store.getLatestScreenshot();
      if (shot) {
        const base64 = shot.dataUrl.replace(/^data:image\/\w+;base64,/, "");
        content.push({ type: "image" as const, data: base64, mimeType: "image/png" as const });
      }
      content.push({ type: "text" as const, text: sections.join("\n") });
      return { content };
    },
  );

  server.registerTool(
    "trigger_screenshot",
    {
      title: "Trigger Screenshot",
      description:
        "Take a screenshot of the current browser page. Uses Chrome DevTools Protocol for reliable capture (requires Chrome launched with --remote-debugging-port=9222). Falls back to bookmarklet capture if CDP unavailable.",
    },
    async () => {
      const cdpShot = await cdpCaptureScreenshot();
      if (cdpShot) {
        store.ingest({
          timestamp: Date.now(),
          screenshots: [{ timestamp: Date.now(), type: "viewport", width: cdpShot.width, height: cdpShot.height, dataUrl: cdpShot.dataUrl, format: "png" }],
        });
        return imageContent(cdpShot.dataUrl, `Screenshot via CDP (${cdpShot.width}x${cdpShot.height})`);
      }

      if (wsChannel) {
        const before = store.getScreenshots().length;
        wsChannel.requestScreenshot();
        for (let i = 0; i < 6; i++) {
          await new Promise((r) => setTimeout(r, 2000));
          if (store.getScreenshots().length > before) {
            const shot = store.getLatestScreenshot();
            if (shot) return imageContent(shot.dataUrl, `Screenshot (${shot.width}x${shot.height})`);
          }
        }
      }

      const cached = store.getLatestScreenshot();
      if (cached) return imageContent(cached.dataUrl, `Cached screenshot (${cached.width}x${cached.height})`);

      const cdpReady = await isCdpAvailable();
      return text({
        message: "Screenshot capture failed.",
        cdpAvailable: cdpReady,
        setup: "Launch Chrome with: google-chrome --remote-debugging-port=9222\nOr on Mac: /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222",
        env: "Set MCP_BROWSER_LENS_CDP_PORT if using a different port (default: 9222)",
      });
    },
  );

  server.registerTool(
    "live_query_element",
    {
      title: "Live Query Element",
      description:
        "Query the browser in real-time to inspect ANY element by CSS selector — even deeply nested ones. Sends a command to the browser to capture the element's computed styles, layout, text, and classes. Use this when inspect_element returns 'not found' because the element wasn't in the initial auto-capture.",
      inputSchema: {
        selector: z.string().describe("Any valid CSS selector (e.g. 'header button', '.hero-btn', '#login-form input[type=email]')"),
      },
    },
    async (args) => {
      if (!wsChannel) {
        return text({
          message: "No live browser connection. This tool requires the bookmarklet to be active.",
          fallback: "Use inspect_element or query_selector to search cached data instead.",
        });
      }

      const sent = wsChannel.sendCommand("query_element", { selector: args.selector });
      if (!sent) {
        return text({ message: "Browser not connected. Click the bookmarklet first." });
      }

      await new Promise((r) => setTimeout(r, 2000));

      const el = store.getElement(args.selector);
      if (el) {
        return text({
          selector: args.selector,
          tagName: el.snapshot?.tagName,
          textContent: el.snapshot?.textContent,
          classes: el.computedStyle?.appliedClasses,
          styles: el.computedStyle?.styles,
          layout: {
            width: el.layout?.box.width,
            height: el.layout?.box.height,
            display: el.layout?.display,
            position: el.layout?.position.type,
          },
          accessibility: el.accessibility,
        });
      }

      const dom = store.getDom();
      if (!dom) return text({ error: "No DOM data. Browser may not be connected." });

      const found = store.querySelector(args.selector);
      if (found.length > 0) {
        return text({
          message: `Found ${found.length} match(es) in DOM tree but detailed styles not captured for this depth. Here's what we know:`,
          elements: found.slice(0, 10).map((f) => ({
            selector: f.selector,
            tagName: f.tagName,
            id: f.id,
            classes: f.classNames,
            text: f.textContent.slice(0, 150),
            childCount: f.childCount,
          })),
        });
      }

      return text({
        error: `No element matching '${args.selector}' found.`,
        suggestion: "Try a different selector. Use query_selector to search by tag name or class.",
      });
    },
  );

  server.registerTool(
    "screenshot_element",
    {
      title: "Screenshot Element",
      description:
        "Take a screenshot of a specific UI component/element by CSS selector. Returns the cropped PNG image of just that element. Uses CDP for reliable capture.",
      inputSchema: {
        selector: z.string().describe("CSS selector of the element to screenshot (e.g. 'header', '.hero-btn', '#login-form', 'nav.sidebar')"),
      },
    },
    async (args) => {
      const cdpShot = await cdpCaptureScreenshot(args.selector);
      if (cdpShot) {
        store.ingest({
          timestamp: Date.now(),
          screenshots: [{ timestamp: Date.now(), type: "element", selector: args.selector, width: cdpShot.width, height: cdpShot.height, dataUrl: cdpShot.dataUrl, format: "png" }],
        });
        const el = store.getElement(args.selector);
        const desc: string[] = [`## Element Screenshot: \`${args.selector}\``, `**Size:** ${cdpShot.width}x${cdpShot.height}px`];
        if (el) {
          desc.push(`**Tag:** ${el.snapshot?.tagName ?? "?"}`);
          if (el.snapshot?.textContent) desc.push(`**Text:** "${el.snapshot.textContent.slice(0, 100)}"`);
          desc.push(`**Classes:** ${el.computedStyle?.appliedClasses?.join(", ") ?? "none"}`);
        }
        const base64 = cdpShot.dataUrl.replace(/^data:image\/\w+;base64,/, "");
        return { content: [{ type: "image" as const, data: base64, mimeType: "image/png" as const }, { type: "text" as const, text: desc.join("\n") }] };
      }

      if (!wsChannel) {
        return text({
          message: "No screenshot method available. Launch Chrome with --remote-debugging-port=9222 for CDP screenshots, or connect the bookmarklet.",
        });
      }

      const before = store.getScreenshots().length;
      const ok = await wsChannel.requestElementScreenshot(args.selector);

      if (ok) {
        const shots = store.getScreenshots();
        const elShot = shots.filter((s) => s.type === "element" && s.selector === args.selector).pop()
          ?? shots[shots.length - 1];
        if (elShot) {
          const base64 = elShot.dataUrl.replace(/^data:image\/\w+;base64,/, "");
          const el = store.getElement(args.selector);
          const desc: string[] = [
            `## Element Screenshot: \`${args.selector}\``,
            `**Size:** ${elShot.width}x${elShot.height}px`,
          ];
          if (el) {
            desc.push(`**Tag:** ${el.snapshot?.tagName ?? "?"}`);
            desc.push(`**Text:** "${(el.snapshot?.textContent ?? "").slice(0, 100)}"`);
            desc.push(`**Classes:** ${el.computedStyle?.appliedClasses?.join(", ") ?? "none"}`);
            const s = el.computedStyle?.styles ?? {};
            if (s.backgroundColor && s.backgroundColor !== "rgba(0, 0, 0, 0)") desc.push(`**Background:** ${s.backgroundColor}`);
            if (s.color) desc.push(`**Color:** ${s.color}`);
            if (s.fontSize) desc.push(`**Font:** ${s.fontSize} ${s.fontWeight ?? ""} ${s.fontFamily ?? ""}`);
          }
          return {
            content: [
              { type: "image" as const, data: base64, mimeType: "image/png" as const },
              { type: "text" as const, text: desc.join("\n") },
            ],
          };
        }
      }

      const after = store.getScreenshots().length;
      if (after > before) {
        const shot = store.getLatestScreenshot();
        if (shot) {
          return imageContent(shot.dataUrl, `Screenshot of ${args.selector} (${shot.width}x${shot.height})`);
        }
      }

      return text({
        message: `Could not screenshot '${args.selector}'. The element may not exist, be off-screen, or contain cross-origin content.`,
        suggestion: "Try: 1) Scroll the element into view first, 2) Use a broader selector, 3) Use trigger_screenshot for full page instead.",
      });
    },
  );
}
