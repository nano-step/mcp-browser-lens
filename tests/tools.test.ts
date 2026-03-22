import { describe, it, expect, beforeAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { BrowserStore } from "../src/store/browser-store.js";
import { createMcpServer } from "../src/server.js";
import { createFullPayload, createScreenshotPayload } from "./fixtures.js";

describe("MCP Tools Integration", () => {
  let client: Client;
  let store: BrowserStore;

  beforeAll(async () => {
    process.env.MCP_BROWSER_LENS_STORE_PATH = "/tmp/browser-lens-tools-test-" + Date.now() + ".json";
    store = new BrowserStore();
    store.clear();

    const mcpServer = createMcpServer(store);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await mcpServer.connect(serverTransport);
    client = new Client({ name: "test-client", version: "1.0.0" });
    await client.connect(clientTransport);

    store.ingest(createFullPayload());
    store.ingest(createScreenshotPayload());
  });

  async function callTool(name: string, args: Record<string, unknown> = {}) {
    const result = await client.callTool({ name, arguments: args });
    return result;
  }

  function parseText(result: Awaited<ReturnType<typeof callTool>>): unknown {
    const textContent = (result.content as Array<{ type: string; text?: string }>).find((c) => c.type === "text");
    return textContent?.text ? JSON.parse(textContent.text) : null;
  }

  function hasImage(result: Awaited<ReturnType<typeof callTool>>): boolean {
    return (result.content as Array<{ type: string }>).some((c) => c.type === "image");
  }

  describe("DOM tools", () => {
    it("get_page_info returns connection status", async () => {
      const result = parseText(await callTool("get_page_info")) as Record<string, unknown>;
      expect(result.url).toBe("https://app.test.com/dashboard");
      expect(result.hasDom).toBe(true);
      expect(result.totalElements).toBe(2);
      expect(result.screenshotCount).toBe(2);
    });

    it("get_dom_tree returns full DOM", async () => {
      const result = parseText(await callTool("get_dom_tree")) as Record<string, unknown>;
      expect(result.url).toBe("https://app.test.com/dashboard");
      expect(result.totalElements).toBe(250);
      expect(result.rootElement).toBeDefined();
      expect((result.semanticStructure as unknown[]).length).toBe(4);
    });

    it("get_dom_tree respects maxDepth", async () => {
      const result = parseText(await callTool("get_dom_tree", { maxDepth: 0 })) as Record<string, unknown>;
      const root = result.rootElement as Record<string, unknown>;
      expect((root.children as unknown[]).length).toBe(0);
    });

    it("inspect_element returns full details", async () => {
      const result = parseText(await callTool("inspect_element", { selector: ".hero-btn" })) as Record<string, unknown>;
      expect(result.snapshot).toBeDefined();
      expect(result.computedStyle).toBeDefined();
      expect(result.layout).toBeDefined();
    });

    it("inspect_element returns error for missing element", async () => {
      const result = parseText(await callTool("inspect_element", { selector: ".nonexistent" })) as Record<string, unknown>;
      expect(result.error).toContain("not found");
    });

    it("query_selector finds elements", async () => {
      const result = parseText(await callTool("query_selector", { selector: "header" })) as Record<string, unknown>;
      expect(result.totalMatches).toBeGreaterThanOrEqual(1);
      expect((result.elements as unknown[]).length).toBeGreaterThanOrEqual(1);
    });

    it("get_element_hierarchy finds path", async () => {
      const result = parseText(await callTool("get_element_hierarchy", { selector: "header" })) as Record<string, unknown>;
      expect(result.depth).toBeGreaterThan(0);
      expect((result.hierarchy as unknown[]).length).toBeGreaterThan(0);
    });

    it("get_elements_summary lists all captured", async () => {
      const result = parseText(await callTool("get_elements_summary")) as Record<string, unknown>;
      expect(result.totalCaptured).toBe(2);
    });
  });

  describe("CSS tools", () => {
    it("get_computed_styles returns styles", async () => {
      const result = parseText(await callTool("get_computed_styles", { selector: ".hero-btn" })) as Record<string, unknown>;
      const styles = result.styles as Record<string, string>;
      expect(styles.fontSize).toBe("16px");
      expect(styles.backgroundColor).toBe("rgb(139, 92, 246)");
    });

    it("get_computed_styles filters by properties", async () => {
      const result = parseText(await callTool("get_computed_styles", { selector: ".hero-btn", properties: ["fontSize", "color"] })) as Record<string, unknown>;
      const styles = result.styles as Record<string, string>;
      expect(Object.keys(styles).length).toBeLessThanOrEqual(2);
    });

    it("get_css_variables returns all vars", async () => {
      const result = parseText(await callTool("get_css_variables")) as Record<string, unknown>;
      expect(result.totalCount).toBe(12);
      const vars = result.variables as Record<string, string>;
      expect(vars["--primary"]).toBe("#8b5cf6");
    });

    it("get_css_variables filters by search", async () => {
      const result = parseText(await callTool("get_css_variables", { search: "primary" })) as Record<string, unknown>;
      expect(result.totalMatches).toBeGreaterThanOrEqual(1);
    });

    it("get_typography returns fonts", async () => {
      const result = parseText(await callTool("get_typography")) as Record<string, unknown>;
      expect((result.fonts as unknown[]).length).toBe(3);
    });

    it("get_color_palette returns colors", async () => {
      const result = parseText(await callTool("get_color_palette")) as Record<string, unknown>;
      expect(result.totalUniqueColors).toBe(8);
    });
  });

  describe("Layout tools", () => {
    it("get_layout_info returns box model", async () => {
      const result = parseText(await callTool("get_layout_info", { selector: ".hero-btn" })) as Record<string, unknown>;
      const box = result.box as Record<string, unknown>;
      expect(box.width).toBe(180);
      expect(box.height).toBe(48);
    });

    it("get_spacing_analysis returns scale", async () => {
      const result = parseText(await callTool("get_spacing_analysis")) as Record<string, unknown>;
      expect((result.spacingScale as string[]).length).toBeGreaterThan(0);
    });

    it("get_responsive_info returns viewport", async () => {
      const result = parseText(await callTool("get_responsive_info")) as Record<string, unknown>;
      const vp = result.viewport as Record<string, unknown>;
      expect(vp.width).toBe(1440);
      expect(vp.devicePixelRatio).toBe(2);
    });
  });

  describe("Visual tools", () => {
    it("get_page_screenshot returns image", async () => {
      const result = await callTool("get_page_screenshot");
      expect(hasImage(result)).toBe(true);
    });

    it("get_all_screenshots lists metadata", async () => {
      const result = parseText(await callTool("get_all_screenshots")) as Record<string, unknown>;
      expect(result.total).toBe(2);
    });

    it("describe_ui returns text description", async () => {
      const result = await callTool("describe_ui");
      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(text).toContain("Test Dashboard");
      expect(text).toContain("Page Structure");
    });

    it("capture_screenshot_with_analysis returns image + text", async () => {
      const result = await callTool("capture_screenshot_with_analysis");
      expect(hasImage(result)).toBe(true);
      const textPart = (result.content as Array<{ type: string; text?: string }>).find((c) => c.type === "text");
      expect(textPart?.text).toContain("Screenshot Analysis");
    });
  });

  describe("Comparison tools", () => {
    it("compare_with_figma computes diff", async () => {
      const result = parseText(await callTool("compare_with_figma", {
        selector: ".hero-btn",
        figmaSpec: { width: 200, fontSize: "14px", borderRadius: "12px", backgroundColor: "rgb(139, 92, 246)" },
      })) as Record<string, unknown>;
      expect(result.score).toBeDefined();
      expect(typeof result.score).toBe("number");
      expect((result.score as number)).toBeLessThan(100);
      expect((result.differences as unknown[]).length).toBeGreaterThan(0);
      expect(result.status).toBeDefined();
      expect(result.summary).toBeDefined();
    });

    it("compare_with_figma returns 100 for perfect match", async () => {
      const result = parseText(await callTool("compare_with_figma", {
        selector: ".hero-btn",
        figmaSpec: { fontSize: "16px", backgroundColor: "rgb(139, 92, 246)" },
      })) as Record<string, unknown>;
      expect(result.score).toBe(100);
      expect(result.status).toBe("match");
    });

    it("get_comparison_history returns stored", async () => {
      const result = parseText(await callTool("get_comparison_history")) as Record<string, unknown>;
      expect((result.total as number)).toBeGreaterThanOrEqual(2);
    });

    it("suggest_css_fixes generates CSS code", async () => {
      const result = await callTool("suggest_css_fixes", { selector: ".hero-btn" });
      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(text).toContain("CSS Fix");
      expect(text).toContain(".hero-btn");
    });

    it("get_visual_diff_report aggregates results", async () => {
      const result = await callTool("get_visual_diff_report");
      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(text).toContain("Visual Diff Report");
      expect(text).toContain("Overall Score");
    });
  });

  describe("General tools", () => {
    it("get_connection_status shows connected", async () => {
      const result = parseText(await callTool("get_connection_status")) as Record<string, unknown>;
      expect(result.connected).toBe(true);
      expect(result.connectorUrl).toContain("localhost");
    });

    it("get_dom_mutations returns array", async () => {
      const result = parseText(await callTool("get_dom_mutations")) as Record<string, unknown>;
      expect(result.total).toBeDefined();
    });

    it("get_accessibility_info returns audit", async () => {
      const result = parseText(await callTool("get_accessibility_info")) as Record<string, unknown>;
      const summary = result.summary as Record<string, unknown>;
      expect(summary.totalInteractive).toBe(15);
    });

    it("get_full_page_analysis returns markdown", async () => {
      const result = await callTool("get_full_page_analysis");
      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(text).toContain("Full Page Analysis");
      expect(text).toContain("Semantic Structure");
      expect(text).toContain("Design Tokens");
    });

    it("get_design_tokens extracts tokens", async () => {
      const result = parseText(await callTool("get_design_tokens")) as Record<string, unknown>;
      expect(result.cssVariables).toBeDefined();
      expect(result.colorPalette).toBeDefined();
      expect(result.fontStacks).toBeDefined();
    });

    it("inspect_feature_area inspects area", async () => {
      const result = await callTool("inspect_feature_area", { selector: "header.app-header" });
      const content = result.content as Array<{ type: string; text?: string }>;
      const textPart = content.find((c) => c.type === "text");
      expect(textPart?.text).toContain("Feature Area");
    });

    it("clear_data resets store", async () => {
      const result = parseText(await callTool("clear_data")) as Record<string, unknown>;
      expect(result.remaining).toBe(0);
      const info = parseText(await callTool("get_page_info")) as Record<string, unknown>;
      expect(info.hasDom).toBe(false);
    });
  });

  describe("MCP resources", () => {
    it("lists resources", async () => {
      const resources = await client.listResources();
      expect(resources.resources.length).toBe(12);
    });

    it("lists prompts", async () => {
      const prompts = await client.listPrompts();
      expect(prompts.prompts.length).toBe(5);
    });

    it("lists tools", async () => {
      const tools = await client.listTools();
      expect(tools.tools.length).toBe(28);
    });
  });
});
