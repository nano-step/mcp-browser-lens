// ─── Element & DOM Types ───────────────────────────────────────────────

export interface ElementSnapshot {
  selector: string;
  tagName: string;
  id: string;
  classNames: string[];
  attributes: Record<string, string>;
  textContent: string;
  innerHTML: string;
  outerHTML: string;
  childCount: number;
  children: ElementSnapshot[];
  depth: number;
}

export interface DOMSnapshot {
  timestamp: number;
  url: string;
  title: string;
  doctype: string;
  charset: string;
  viewport: ViewportInfo;
  rootElement: ElementSnapshot;
  totalElements: number;
  semanticStructure: SemanticNode[];
}

export interface SemanticNode {
  tag: string;
  role?: string;
  label?: string;
  level?: number;
  selector: string;
  children: SemanticNode[];
}

// ─── CSS & Style Types ────────────────────────────────────────────────

export interface ComputedStyleData {
  selector: string;
  tagName: string;
  styles: Record<string, string>;
  pseudoStyles?: {
    before?: Record<string, string>;
    after?: Record<string, string>;
  };
  matchedRules: MatchedCSSRule[];
  appliedClasses: string[];
}

export interface MatchedCSSRule {
  selector: string;
  properties: Record<string, string>;
  source: string;
  specificity: string;
}

export interface CSSVariablesData {
  timestamp: number;
  variables: Record<string, string>;
  totalCount: number;
}

export interface TypographyData {
  timestamp: number;
  fonts: FontUsage[];
  fontFaces: FontFaceInfo[];
}

export interface FontUsage {
  family: string;
  size: string;
  weight: string;
  lineHeight: string;
  color: string;
  selector: string;
  count: number;
}

export interface FontFaceInfo {
  family: string;
  src: string;
  weight: string;
  style: string;
}

export interface ColorPaletteData {
  timestamp: number;
  colors: ColorUsage[];
  backgroundColors: ColorUsage[];
  borderColors: ColorUsage[];
  totalUniqueColors: number;
}

export interface ColorUsage {
  value: string;
  hex: string;
  count: number;
  elements: string[];
}

// ─── Layout Types ─────────────────────────────────────────────────────

export interface LayoutInfo {
  selector: string;
  tagName: string;
  box: BoxModel;
  position: PositionInfo;
  display: string;
  flexInfo?: FlexInfo;
  gridInfo?: GridInfo;
  overflow: { x: string; y: string };
  zIndex: string;
  transform: string;
  opacity: string;
  visibility: string;
}

export interface BoxModel {
  width: number;
  height: number;
  padding: SpacingValues;
  margin: SpacingValues;
  border: SpacingValues;
  contentWidth: number;
  contentHeight: number;
}

export interface SpacingValues {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface PositionInfo {
  type: string;
  top: number;
  left: number;
  right: number;
  bottom: number;
  offsetParent: string;
  boundingRect: { x: number; y: number; width: number; height: number };
}

export interface FlexInfo {
  direction: string;
  wrap: string;
  justifyContent: string;
  alignItems: string;
  gap: string;
  children: FlexChildInfo[];
}

export interface FlexChildInfo {
  selector: string;
  order: number;
  flexGrow: number;
  flexShrink: number;
  flexBasis: string;
  alignSelf: string;
}

export interface GridInfo {
  templateColumns: string;
  templateRows: string;
  gap: string;
  areas: string;
  children: GridChildInfo[];
}

export interface GridChildInfo {
  selector: string;
  column: string;
  row: string;
  area: string;
}

// ─── Screenshot Types ─────────────────────────────────────────────────

export interface ScreenshotData {
  timestamp: number;
  type: "viewport" | "fullpage" | "element";
  selector?: string;
  width: number;
  height: number;
  dataUrl: string;
  format: "png" | "jpeg";
}

// ─── Viewport & Responsive Types ──────────────────────────────────────

export interface ViewportInfo {
  width: number;
  height: number;
  scrollX: number;
  scrollY: number;
  devicePixelRatio: number;
  scrollWidth: number;
  scrollHeight: number;
}

export interface ResponsiveInfo {
  viewport: ViewportInfo;
  activeMediaQueries: string[];
  breakpoints: BreakpointInfo[];
}

export interface BreakpointInfo {
  query: string;
  matches: boolean;
}

// ─── Accessibility Types ──────────────────────────────────────────────

export interface AccessibilityInfo {
  timestamp: number;
  elements: AccessibilityElement[];
  summary: AccessibilitySummary;
}

export interface AccessibilityElement {
  selector: string;
  tagName: string;
  role?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  ariaHidden?: boolean;
  tabIndex?: number;
  altText?: string;
  hasLabel: boolean;
  issues: string[];
}

export interface AccessibilitySummary {
  totalInteractive: number;
  withLabels: number;
  withoutLabels: number;
  imagesWithAlt: number;
  imagesWithoutAlt: number;
  headingLevels: Record<string, number>;
  landmarks: string[];
  issues: string[];
}

// ─── Comparison Types ─────────────────────────────────────────────────

export interface FigmaSpec {
  width?: number;
  height?: number;
  padding?: SpacingValues;
  margin?: SpacingValues;
  backgroundColor?: string;
  color?: string;
  fontSize?: string;
  fontWeight?: string;
  fontFamily?: string;
  lineHeight?: string;
  letterSpacing?: string;
  borderRadius?: string;
  borderWidth?: string;
  borderColor?: string;
  opacity?: number;
  gap?: string;
  display?: string;
  justifyContent?: string;
  alignItems?: string;
  boxShadow?: string;
  textAlign?: string;
  textDecoration?: string;
  textTransform?: string;
  overflow?: string;
  [key: string]: unknown;
}

export interface ComparisonResult {
  timestamp: number;
  selector: string;
  score: number;
  status: "match" | "minor-diff" | "major-diff" | "mismatch";
  differences: ComparisonDifference[];
  suggestions: string[];
  summary: string;
}

export interface ComparisonDifference {
  property: string;
  expected: string;
  actual: string;
  severity: "critical" | "major" | "minor" | "info";
  suggestion: string;
}

// ─── DOM Mutation Types ───────────────────────────────────────────────

export interface DOMMutation {
  timestamp: number;
  type: "childList" | "attributes" | "characterData";
  target: string;
  attributeName?: string;
  oldValue?: string;
  newValue?: string;
  addedNodes?: string[];
  removedNodes?: string[];
}

// ─── Spacing Analysis ─────────────────────────────────────────────────

export interface SpacingAnalysis {
  timestamp: number;
  elements: SpacingEntry[];
  inconsistencies: SpacingInconsistency[];
  spacingScale: string[];
}

export interface SpacingEntry {
  selector: string;
  margin: SpacingValues;
  padding: SpacingValues;
  gap?: string;
}

export interface SpacingInconsistency {
  property: string;
  values: string[];
  suggestion: string;
  elements: string[];
}

// ─── Ingest & Store Types ─────────────────────────────────────────────

export interface IngestPayload {
  timestamp: number;
  url?: string;
  userAgent?: string;
  dom?: DOMSnapshot;
  elements?: Record<string, ElementDetail>;
  styles?: Record<string, ComputedStyleData>;
  layout?: Record<string, LayoutInfo>;
  screenshots?: ScreenshotData[];
  cssVariables?: CSSVariablesData;
  typography?: TypographyData;
  colors?: ColorPaletteData;
  accessibility?: AccessibilityInfo;
  responsive?: ResponsiveInfo;
  mutations?: DOMMutation[];
  spacing?: SpacingAnalysis;
}

export interface ElementDetail {
  snapshot: ElementSnapshot;
  computedStyle: ComputedStyleData;
  layout: LayoutInfo;
  accessibility?: AccessibilityElement;
}

export interface StoreData {
  timestamp: number;
  url?: string;
  userAgent?: string;
  dom: DOMSnapshot | null;
  elements: Record<string, ElementDetail>;
  styles: Record<string, ComputedStyleData>;
  layout: Record<string, LayoutInfo>;
  screenshots: ScreenshotData[];
  cssVariables: CSSVariablesData | null;
  typography: TypographyData | null;
  colors: ColorPaletteData | null;
  accessibility: AccessibilityInfo | null;
  responsive: ResponsiveInfo | null;
  mutations: DOMMutation[];
  spacing: SpacingAnalysis | null;
  comparisons: ComparisonResult[];
}

// ─── Page Description ─────────────────────────────────────────────────

export interface PageDescription {
  url: string;
  title: string;
  viewport: ViewportInfo;
  structure: string;
  keyElements: string[];
  colorScheme: string;
  typography: string;
  layout: string;
  interactiveElements: number;
  images: number;
  forms: number;
}
