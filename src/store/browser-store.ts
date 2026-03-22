import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  StoreData,
  IngestPayload,
  DOMSnapshot,
  ElementDetail,
  ComputedStyleData,
  LayoutInfo,
  ScreenshotData,
  CSSVariablesData,
  TypographyData,
  ColorPaletteData,
  AccessibilityInfo,
  ResponsiveInfo,
  DOMMutation,
  SpacingAnalysis,
  ComparisonResult,
  ElementSnapshot,
  ViewportInfo,
} from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MAX_SCREENSHOTS = 20;
const MAX_MUTATIONS = 500;
const MAX_ELEMENTS = 1000;
const MAX_COMPARISONS = 50;

function getStoreFilePath(): string {
  const customPath = process.env.MCP_BROWSER_LENS_STORE_PATH;
  if (customPath) return customPath;
  const packageRoot = path.resolve(__dirname, "..", "..", "..");
  const storeDir = path.join(packageRoot, ".store");
  if (!fs.existsSync(storeDir)) fs.mkdirSync(storeDir, { recursive: true });
  return path.join(storeDir, "browser.json");
}

function emptyData(): StoreData {
  return {
    timestamp: 0,
    url: undefined,
    userAgent: undefined,
    dom: null,
    elements: {},
    styles: {},
    layout: {},
    screenshots: [],
    cssVariables: null,
    typography: null,
    colors: null,
    accessibility: null,
    responsive: null,
    mutations: [],
    spacing: null,
    comparisons: [],
  };
}

export class BrowserStore {
  private filePath: string;

  constructor() {
    this.filePath = getStoreFilePath();
  }

  private read(): StoreData {
    try {
      if (!fs.existsSync(this.filePath)) return emptyData();
      const raw = fs.readFileSync(this.filePath, "utf-8");
      const data = JSON.parse(raw) as StoreData;
      data.elements = data.elements ?? {};
      data.styles = data.styles ?? {};
      data.layout = data.layout ?? {};
      data.screenshots = data.screenshots ?? [];
      data.mutations = data.mutations ?? [];
      data.comparisons = data.comparisons ?? [];
      return data;
    } catch {
      return emptyData();
    }
  }

  private write(data: StoreData): void {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(data), "utf-8");
    } catch {
      process.stderr.write(
        `[mcp-browser-lens] Failed to write store: ${this.filePath}\n`,
      );
    }
  }

  private enforce(data: StoreData): void {
    if (data.screenshots.length > MAX_SCREENSHOTS) {
      data.screenshots = data.screenshots.slice(-MAX_SCREENSHOTS);
    }
    if (data.mutations.length > MAX_MUTATIONS) {
      data.mutations = data.mutations.slice(-MAX_MUTATIONS);
    }
    const elementKeys = Object.keys(data.elements);
    if (elementKeys.length > MAX_ELEMENTS) {
      const toRemove = elementKeys.slice(
        0,
        elementKeys.length - MAX_ELEMENTS,
      );
      for (const key of toRemove) {
        delete data.elements[key];
        delete data.styles[key];
        delete data.layout[key];
      }
    }
    if (data.comparisons.length > MAX_COMPARISONS) {
      data.comparisons = data.comparisons.slice(-MAX_COMPARISONS);
    }
  }

  ingest(payload: IngestPayload): void {
    const data = this.read();
    data.timestamp = payload.timestamp;
    if (payload.url) data.url = payload.url;
    if (payload.userAgent) data.userAgent = payload.userAgent;
    if (payload.dom) data.dom = payload.dom;

    if (payload.elements) {
      for (const [sel, detail] of Object.entries(payload.elements)) {
        data.elements[sel] = detail;
      }
    }

    if (payload.styles) {
      for (const [sel, style] of Object.entries(payload.styles)) {
        data.styles[sel] = style;
      }
    }

    if (payload.layout) {
      for (const [sel, info] of Object.entries(payload.layout)) {
        data.layout[sel] = info;
      }
    }

    if (payload.screenshots) {
      data.screenshots.push(...payload.screenshots);
    }

    if (payload.cssVariables) data.cssVariables = payload.cssVariables;
    if (payload.typography) data.typography = payload.typography;
    if (payload.colors) data.colors = payload.colors;
    if (payload.accessibility) data.accessibility = payload.accessibility;
    if (payload.responsive) data.responsive = payload.responsive;
    if (payload.spacing) data.spacing = payload.spacing;

    if (payload.mutations) {
      data.mutations.push(...payload.mutations);
    }

    this.enforce(data);
    this.write(data);
  }

  getDom(): DOMSnapshot | null {
    return this.read().dom;
  }

  getElement(selector: string): ElementDetail | undefined {
    return this.read().elements[selector];
  }

  getElements(): Record<string, ElementDetail> {
    return this.read().elements;
  }

  getComputedStyle(selector: string): ComputedStyleData | undefined {
    const data = this.read();
    return data.styles[selector] ?? data.elements[selector]?.computedStyle;
  }

  getLayout(selector: string): LayoutInfo | undefined {
    const data = this.read();
    return data.layout[selector] ?? data.elements[selector]?.layout;
  }

  getScreenshots(): ScreenshotData[] {
    return this.read().screenshots;
  }

  getLatestScreenshot(): ScreenshotData | null {
    const shots = this.read().screenshots;
    return shots.length > 0 ? shots[shots.length - 1] : null;
  }

  getCssVariables(): CSSVariablesData | null {
    return this.read().cssVariables;
  }

  getTypography(): TypographyData | null {
    return this.read().typography;
  }

  getColors(): ColorPaletteData | null {
    return this.read().colors;
  }

  getAccessibility(): AccessibilityInfo | null {
    return this.read().accessibility;
  }

  getResponsive(): ResponsiveInfo | null {
    return this.read().responsive;
  }

  getMutations(since?: number): DOMMutation[] {
    let mutations = this.read().mutations;
    if (since) mutations = mutations.filter((m) => m.timestamp >= since);
    return mutations.sort((a, b) => b.timestamp - a.timestamp);
  }

  getSpacing(): SpacingAnalysis | null {
    return this.read().spacing;
  }

  getComparisons(): ComparisonResult[] {
    return this.read().comparisons;
  }

  addComparison(result: ComparisonResult): void {
    const data = this.read();
    data.comparisons.push(result);
    this.enforce(data);
    this.write(data);
  }

  getPageInfo(): {
    url?: string;
    title?: string;
    viewport?: ViewportInfo;
    totalElements: number;
    screenshotCount: number;
    hasDom: boolean;
    hasCssVariables: boolean;
    hasTypography: boolean;
    hasColors: boolean;
    hasAccessibility: boolean;
    hasResponsive: boolean;
    hasSpacing: boolean;
    mutationCount: number;
    comparisonCount: number;
  } {
    const data = this.read();
    return {
      url: data.url,
      title: data.dom?.title,
      viewport: data.dom?.viewport ?? data.responsive?.viewport,
      totalElements: Object.keys(data.elements).length,
      screenshotCount: data.screenshots.length,
      hasDom: !!data.dom,
      hasCssVariables: !!data.cssVariables,
      hasTypography: !!data.typography,
      hasColors: !!data.colors,
      hasAccessibility: !!data.accessibility,
      hasResponsive: !!data.responsive,
      hasSpacing: !!data.spacing,
      mutationCount: data.mutations.length,
      comparisonCount: data.comparisons.length,
    };
  }

  querySelector(selector: string): ElementSnapshot[] {
    const dom = this.read().dom;
    if (!dom) return [];
    const results: ElementSnapshot[] = [];
    const search = (node: ElementSnapshot) => {
      const matches =
        (selector.startsWith(".") &&
          node.classNames.includes(selector.slice(1))) ||
        (selector.startsWith("#") && node.id === selector.slice(1)) ||
        node.tagName.toLowerCase() === selector.toLowerCase() ||
        node.selector === selector;
      if (matches) results.push(node);
      if (node.children) {
        for (const child of node.children) search(child);
      }
    };
    search(dom.rootElement);
    return results;
  }

  clear(): void {
    this.write(emptyData());
  }

  getElementCount(): number {
    return Object.keys(this.read().elements).length;
  }
}
