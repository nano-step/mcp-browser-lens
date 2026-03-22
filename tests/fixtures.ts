import type { IngestPayload } from "../src/store/types.js";

const PNG_1X1 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIAMCbHYQAAAABJRU5ErkJggg==";

export function createFullPayload(): IngestPayload {
  return {
    timestamp: Date.now(),
    url: "https://app.test.com/dashboard",
    userAgent: "TestAgent/1.0",
    dom: {
      timestamp: Date.now(),
      url: "https://app.test.com/dashboard",
      title: "Test Dashboard",
      doctype: "html",
      charset: "UTF-8",
      viewport: { width: 1440, height: 900, scrollX: 0, scrollY: 0, devicePixelRatio: 2, scrollWidth: 1440, scrollHeight: 2500 },
      rootElement: {
        selector: "html", tagName: "html", id: "", classNames: [], attributes: { lang: "en" },
        textContent: "", innerHTML: "", outerHTML: "", childCount: 2, depth: 0,
        children: [
          {
            selector: "body", tagName: "body", id: "", classNames: ["dark"], attributes: {},
            textContent: "", innerHTML: "", outerHTML: "", childCount: 3, depth: 1,
            children: [
              { selector: "header.app-header", tagName: "header", id: "", classNames: ["app-header"], attributes: { role: "banner" }, textContent: "Dashboard", innerHTML: "", outerHTML: "", childCount: 2, depth: 2, children: [] },
              { selector: "nav.sidebar", tagName: "nav", id: "", classNames: ["sidebar"], attributes: {}, textContent: "Home Settings", innerHTML: "", outerHTML: "", childCount: 2, depth: 2, children: [] },
              { selector: "main.content", tagName: "main", id: "", classNames: ["content"], attributes: { role: "main" }, textContent: "", innerHTML: "", outerHTML: "", childCount: 5, depth: 2, children: [] },
            ],
          },
        ],
      },
      totalElements: 250,
      semanticStructure: [
        { tag: "header", role: "banner", label: "", selector: "header.app-header", children: [] },
        { tag: "nav", label: "Sidebar", selector: "nav.sidebar", children: [] },
        { tag: "main", role: "main", label: "", selector: "main.content", children: [] },
        { tag: "h1", level: 1, label: "Dashboard", selector: "h1.title", children: [] },
      ],
    },
    elements: {
      "header.app-header": {
        snapshot: { selector: "header.app-header", tagName: "header", id: "", classNames: ["app-header"], attributes: { role: "banner" }, textContent: "Dashboard", innerHTML: "", outerHTML: "", childCount: 2, children: [], depth: 1 },
        computedStyle: { selector: "header.app-header", tagName: "header", styles: { backgroundColor: "rgb(24, 24, 27)", color: "rgb(250, 250, 250)", fontSize: "14px", fontWeight: "400", fontFamily: "Inter, sans-serif", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0px 24px", gap: "16px", borderRadius: "0px" }, appliedClasses: ["app-header"], matchedRules: [] },
        layout: { selector: "header.app-header", tagName: "header", box: { width: 1440, height: 64, padding: { top: 0, right: 24, bottom: 0, left: 24 }, margin: { top: 0, right: 0, bottom: 0, left: 0 }, border: { top: 0, right: 0, bottom: 1, left: 0 }, contentWidth: 1392, contentHeight: 63 }, position: { type: "sticky", top: 0, left: 0, right: 1440, bottom: 64, offsetParent: "body", boundingRect: { x: 0, y: 0, width: 1440, height: 64 } }, display: "flex", overflow: { x: "hidden", y: "hidden" }, zIndex: "100", transform: "none", opacity: "1", visibility: "visible", flexInfo: { direction: "row", wrap: "nowrap", justifyContent: "space-between", alignItems: "center", gap: "16px", children: [] } },
      },
      ".hero-btn": {
        snapshot: { selector: ".hero-btn", tagName: "button", id: "", classNames: ["hero-btn", "btn-primary"], attributes: { type: "button" }, textContent: "Get Started", innerHTML: "", outerHTML: "", childCount: 0, children: [], depth: 3 },
        computedStyle: { selector: ".hero-btn", tagName: "button", styles: { backgroundColor: "rgb(139, 92, 246)", color: "rgb(255, 255, 255)", fontSize: "16px", fontWeight: "600", fontFamily: "Inter, sans-serif", lineHeight: "24px", borderRadius: "8px", padding: "12px 24px", display: "inline-flex", justifyContent: "center", alignItems: "center", opacity: "1", gap: "8px" }, appliedClasses: ["hero-btn", "btn-primary"], matchedRules: [] },
        layout: { selector: ".hero-btn", tagName: "button", box: { width: 180, height: 48, padding: { top: 12, right: 24, bottom: 12, left: 24 }, margin: { top: 0, right: 0, bottom: 0, left: 0 }, border: { top: 0, right: 0, bottom: 0, left: 0 }, contentWidth: 132, contentHeight: 24 }, position: { type: "relative", top: 400, left: 300, right: 480, bottom: 448, offsetParent: ".hero", boundingRect: { x: 300, y: 400, width: 180, height: 48 } }, display: "inline-flex", overflow: { x: "visible", y: "visible" }, zIndex: "auto", transform: "none", opacity: "1", visibility: "visible" },
      },
    },
    cssVariables: { timestamp: Date.now(), variables: { "--primary": "#8b5cf6", "--primary-hover": "#7c3aed", "--bg": "#09090b", "--surface": "#18181b", "--border": "#27272a", "--text": "#fafafa", "--muted": "#a1a1aa", "--radius": "8px", "--font-sans": "Inter, sans-serif", "--space-1": "4px", "--space-2": "8px", "--space-4": "16px" }, totalCount: 12 },
    typography: { timestamp: Date.now(), fonts: [{ family: "Inter, sans-serif", size: "14px", weight: "400", lineHeight: "20px", color: "rgb(250, 250, 250)", selector: "body", count: 120 }, { family: "Inter, sans-serif", size: "16px", weight: "600", lineHeight: "24px", color: "rgb(255, 255, 255)", selector: ".btn", count: 8 }, { family: "Inter, sans-serif", size: "24px", weight: "700", lineHeight: "32px", color: "rgb(250, 250, 250)", selector: "h2", count: 4 }], fontFaces: [] },
    colors: { timestamp: Date.now(), colors: [{ value: "rgb(250,250,250)", hex: "#fafafa", count: 180, elements: ["body"] }, { value: "rgb(161,161,170)", hex: "#a1a1aa", count: 45, elements: [".muted"] }], backgroundColors: [{ value: "rgb(9,9,11)", hex: "#09090b", count: 1, elements: ["body"] }, { value: "rgb(24,24,27)", hex: "#18181b", count: 30, elements: [".card"] }, { value: "rgb(139,92,246)", hex: "#8b5cf6", count: 5, elements: [".btn"] }], borderColors: [{ value: "rgb(39,39,42)", hex: "#27272a", count: 20, elements: [".card"] }], totalUniqueColors: 8 },
    accessibility: { timestamp: Date.now(), elements: [{ selector: ".hero-btn", tagName: "button", role: "button", ariaLabel: "Get Started", tabIndex: 0, hasLabel: true, issues: [] }], summary: { totalInteractive: 15, withLabels: 12, withoutLabels: 3, imagesWithAlt: 8, imagesWithoutAlt: 2, headingLevels: { H1: 1, H2: 4, H3: 2 }, landmarks: ["banner", "navigation", "main"], issues: ["Missing label: .search-input", "Image without alt: .logo-img"] } },
    responsive: { viewport: { width: 1440, height: 900, scrollX: 0, scrollY: 0, devicePixelRatio: 2, scrollWidth: 1440, scrollHeight: 2500 }, activeMediaQueries: ["(min-width: 1280px) and (max-width: 1439px)"], breakpoints: [{ query: "(min-width: 1280px) and (max-width: 1439px)", matches: true }] },
    spacing: { timestamp: Date.now(), elements: [{ selector: ".card", margin: { top: 0, right: 0, bottom: 16, left: 0 }, padding: { top: 24, right: 24, bottom: 24, left: 24 } }], inconsistencies: [], spacingScale: ["4px", "8px", "16px", "24px"] },
    screenshots: [{ timestamp: Date.now(), type: "viewport" as const, width: 1440, height: 900, dataUrl: PNG_1X1, format: "png" as const }],
  };
}

export function createScreenshotPayload(): IngestPayload {
  return {
    timestamp: Date.now(),
    screenshots: [{ timestamp: Date.now(), type: "viewport" as const, width: 1440, height: 900, dataUrl: PNG_1X1, format: "png" as const }],
  };
}

export const PNG_DATA_URL = PNG_1X1;
