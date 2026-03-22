import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { BrowserStore } from "../store/browser-store.js";
import type { FigmaSpec, ComparisonDifference, ComparisonResult } from "../store/types.js";

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

export function registerTools(server: McpServer, store: BrowserStore): void {
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
}
