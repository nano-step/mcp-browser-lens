import { describe, it, expect, beforeEach } from "vitest";
import { BrowserStore } from "../src/store/browser-store.js";
import { createFullPayload, createScreenshotPayload } from "./fixtures.js";

describe("BrowserStore", () => {
  let store: BrowserStore;

  beforeEach(() => {
    process.env.MCP_BROWSER_LENS_STORE_PATH = "/tmp/browser-lens-test-" + Date.now() + ".json";
    store = new BrowserStore();
    store.clear();
  });

  describe("empty state", () => {
    it("returns null/empty for all getters", () => {
      expect(store.getDom()).toBeNull();
      expect(store.getElements()).toEqual({});
      expect(store.getScreenshots()).toEqual([]);
      expect(store.getLatestScreenshot()).toBeNull();
      expect(store.getCssVariables()).toBeNull();
      expect(store.getTypography()).toBeNull();
      expect(store.getColors()).toBeNull();
      expect(store.getAccessibility()).toBeNull();
      expect(store.getResponsive()).toBeNull();
      expect(store.getSpacing()).toBeNull();
      expect(store.getMutations()).toEqual([]);
      expect(store.getComparisons()).toEqual([]);
      expect(store.getElementCount()).toBe(0);
    });

    it("getPageInfo returns all false/zero", () => {
      const info = store.getPageInfo();
      expect(info.hasDom).toBe(false);
      expect(info.totalElements).toBe(0);
      expect(info.screenshotCount).toBe(0);
      expect(info.hasCssVariables).toBe(false);
      expect(info.hasTypography).toBe(false);
      expect(info.hasColors).toBe(false);
      expect(info.hasAccessibility).toBe(false);
      expect(info.hasResponsive).toBe(false);
      expect(info.hasSpacing).toBe(false);
    });

    it("querySelector returns empty array", () => {
      expect(store.querySelector("div")).toEqual([]);
    });
  });

  describe("ingest", () => {
    it("stores full payload correctly", () => {
      store.ingest(createFullPayload());
      const info = store.getPageInfo();
      expect(info.url).toBe("https://app.test.com/dashboard");
      expect(info.title).toBe("Test Dashboard");
      expect(info.hasDom).toBe(true);
      expect(info.totalElements).toBe(2);
      expect(info.screenshotCount).toBe(1);
      expect(info.hasCssVariables).toBe(true);
      expect(info.hasTypography).toBe(true);
      expect(info.hasColors).toBe(true);
      expect(info.hasAccessibility).toBe(true);
      expect(info.hasResponsive).toBe(true);
      expect(info.hasSpacing).toBe(true);
    });

    it("merges multiple ingestions", () => {
      store.ingest(createFullPayload());
      store.ingest(createScreenshotPayload());
      expect(store.getScreenshots().length).toBe(2);
      expect(store.getPageInfo().hasDom).toBe(true);
    });
  });

  describe("DOM queries", () => {
    beforeEach(() => store.ingest(createFullPayload()));

    it("getDom returns full tree", () => {
      const dom = store.getDom();
      expect(dom).not.toBeNull();
      expect(dom!.totalElements).toBe(250);
      expect(dom!.title).toBe("Test Dashboard");
      expect(dom!.viewport.width).toBe(1440);
    });

    it("querySelector finds by tag name", () => {
      const results = store.querySelector("header");
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].tagName).toBe("header");
    });

    it("querySelector finds by class", () => {
      const results = store.querySelector(".sidebar");
      expect(results.length).toBe(1);
      expect(results[0].classNames).toContain("sidebar");
    });

    it("querySelector returns empty for non-existent", () => {
      expect(store.querySelector(".nonexistent")).toEqual([]);
    });

    it("semantic structure is captured", () => {
      const dom = store.getDom()!;
      expect(dom.semanticStructure.length).toBe(4);
      expect(dom.semanticStructure[0].tag).toBe("header");
    });
  });

  describe("element details", () => {
    beforeEach(() => store.ingest(createFullPayload()));

    it("getElement returns element by selector", () => {
      const el = store.getElement(".hero-btn");
      expect(el).toBeDefined();
      expect(el!.snapshot.tagName).toBe("button");
      expect(el!.snapshot.textContent).toBe("Get Started");
    });

    it("getElement returns undefined for missing", () => {
      expect(store.getElement(".nonexistent")).toBeUndefined();
    });

    it("getElements returns all", () => {
      const els = store.getElements();
      expect(Object.keys(els).length).toBe(2);
      expect(els["header.app-header"]).toBeDefined();
      expect(els[".hero-btn"]).toBeDefined();
    });

    it("getElementCount matches", () => {
      expect(store.getElementCount()).toBe(2);
    });
  });

  describe("CSS data", () => {
    beforeEach(() => store.ingest(createFullPayload()));

    it("getComputedStyle returns styles for element", () => {
      const style = store.getComputedStyle(".hero-btn");
      expect(style).toBeDefined();
      expect(style!.styles.fontSize).toBe("16px");
      expect(style!.styles.backgroundColor).toBe("rgb(139, 92, 246)");
      expect(style!.appliedClasses).toContain("hero-btn");
    });

    it("getCssVariables returns all variables", () => {
      const vars = store.getCssVariables();
      expect(vars).not.toBeNull();
      expect(vars!.totalCount).toBe(12);
      expect(vars!.variables["--primary"]).toBe("#8b5cf6");
      expect(vars!.variables["--bg"]).toBe("#09090b");
    });

    it("getTypography returns font analysis", () => {
      const typo = store.getTypography();
      expect(typo).not.toBeNull();
      expect(typo!.fonts.length).toBe(3);
      expect(typo!.fonts[0].family).toContain("Inter");
      expect(typo!.fonts[0].count).toBe(120);
    });

    it("getColors returns palette", () => {
      const colors = store.getColors();
      expect(colors).not.toBeNull();
      expect(colors!.totalUniqueColors).toBe(8);
      expect(colors!.colors.length).toBe(2);
      expect(colors!.backgroundColors.length).toBe(3);
    });
  });

  describe("layout", () => {
    beforeEach(() => store.ingest(createFullPayload()));

    it("getLayout returns box model", () => {
      const layout = store.getLayout(".hero-btn");
      expect(layout).toBeDefined();
      expect(layout!.box.width).toBe(180);
      expect(layout!.box.height).toBe(48);
      expect(layout!.display).toBe("inline-flex");
    });

    it("getLayout returns flexInfo when display is flex", () => {
      const layout = store.getLayout("header.app-header");
      expect(layout).toBeDefined();
      expect(layout!.flexInfo).toBeDefined();
      expect(layout!.flexInfo!.direction).toBe("row");
      expect(layout!.flexInfo!.gap).toBe("16px");
    });

    it("getSpacing returns spacing scale", () => {
      const spacing = store.getSpacing();
      expect(spacing).not.toBeNull();
      expect(spacing!.spacingScale).toContain("16px");
      expect(spacing!.elements.length).toBe(1);
    });

    it("getResponsive returns viewport + breakpoints", () => {
      const resp = store.getResponsive();
      expect(resp).not.toBeNull();
      expect(resp!.viewport.width).toBe(1440);
      expect(resp!.viewport.devicePixelRatio).toBe(2);
      expect(resp!.activeMediaQueries.length).toBeGreaterThan(0);
    });
  });

  describe("screenshots", () => {
    beforeEach(() => store.ingest(createFullPayload()));

    it("getScreenshots returns all", () => {
      expect(store.getScreenshots().length).toBe(1);
    });

    it("getLatestScreenshot returns last", () => {
      const shot = store.getLatestScreenshot();
      expect(shot).not.toBeNull();
      expect(shot!.width).toBe(1440);
      expect(shot!.height).toBe(900);
      expect(shot!.type).toBe("viewport");
      expect(shot!.dataUrl).toContain("data:image/png;base64,");
    });

    it("accumulates screenshots", () => {
      store.ingest(createScreenshotPayload());
      expect(store.getScreenshots().length).toBe(2);
    });
  });

  describe("accessibility", () => {
    beforeEach(() => store.ingest(createFullPayload()));

    it("getAccessibility returns audit", () => {
      const acc = store.getAccessibility();
      expect(acc).not.toBeNull();
      expect(acc!.summary.totalInteractive).toBe(15);
      expect(acc!.summary.withLabels).toBe(12);
      expect(acc!.summary.withoutLabels).toBe(3);
      expect(acc!.summary.issues.length).toBe(2);
      expect(acc!.summary.landmarks).toContain("banner");
    });
  });

  describe("mutations", () => {
    it("stores and retrieves mutations", () => {
      store.ingest({
        timestamp: Date.now(),
        mutations: [
          { timestamp: 1000, type: "attributes", target: ".btn", attributeName: "class", oldValue: "btn", newValue: "btn active" },
          { timestamp: 2000, type: "childList", target: ".list", addedNodes: ["li.new"], removedNodes: [] },
        ],
      });
      const muts = store.getMutations();
      expect(muts.length).toBe(2);
    });

    it("filters mutations by timestamp", () => {
      store.ingest({
        timestamp: Date.now(),
        mutations: [
          { timestamp: 1000, type: "attributes", target: ".a" },
          { timestamp: 2000, type: "attributes", target: ".b" },
          { timestamp: 3000, type: "attributes", target: ".c" },
        ],
      });
      expect(store.getMutations(2000).length).toBe(2);
      expect(store.getMutations(3000).length).toBe(1);
    });
  });

  describe("comparisons", () => {
    it("addComparison stores result", () => {
      store.addComparison({
        timestamp: Date.now(), selector: ".btn", score: 85, status: "minor-diff",
        differences: [{ property: "fontSize", expected: "14px", actual: "16px", severity: "minor", suggestion: "Change fontSize" }],
        suggestions: ["Change fontSize"], summary: "Score 85",
      });
      expect(store.getComparisons().length).toBe(1);
      expect(store.getComparisons()[0].score).toBe(85);
    });
  });

  describe("limits enforcement", () => {
    it("enforces MAX_SCREENSHOTS = 20", () => {
      for (let i = 0; i < 25; i++) {
        store.ingest(createScreenshotPayload());
      }
      expect(store.getScreenshots().length).toBeLessThanOrEqual(20);
    });

    it("enforces MAX_COMPARISONS = 50", () => {
      for (let i = 0; i < 55; i++) {
        store.addComparison({
          timestamp: Date.now(), selector: `.el-${i}`, score: 50, status: "major-diff",
          differences: [], suggestions: [], summary: "",
        });
      }
      expect(store.getComparisons().length).toBeLessThanOrEqual(50);
    });
  });

  describe("clear", () => {
    it("resets all data", () => {
      store.ingest(createFullPayload());
      expect(store.getPageInfo().hasDom).toBe(true);
      store.clear();
      expect(store.getPageInfo().hasDom).toBe(false);
      expect(store.getElementCount()).toBe(0);
      expect(store.getScreenshots()).toEqual([]);
    });
  });
});
