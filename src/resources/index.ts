import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { BrowserStore } from "../store/browser-store.js";

function jsonResource(uri: URL, data: unknown) {
  return {
    contents: [
      {
        uri: uri.href,
        mimeType: "application/json" as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

export function registerResources(
  server: McpServer,
  store: BrowserStore,
): void {
  server.resource("dom-snapshot", "dom://snapshot", (uri: URL) =>
    jsonResource(
      uri,
      store.getDom() ?? { message: "No DOM data captured yet." },
    ),
  );

  server.resource("dom-elements", "dom://elements", (uri: URL) => {
    const elements = store.getElements();
    return jsonResource(uri, {
      total: Object.keys(elements).length,
      selectors: Object.keys(elements),
    });
  });

  server.resource("css-variables", "css://variables", (uri: URL) =>
    jsonResource(
      uri,
      store.getCssVariables() ?? { message: "No CSS variable data captured." },
    ),
  );

  server.resource("css-typography", "css://typography", (uri: URL) =>
    jsonResource(
      uri,
      store.getTypography() ?? { message: "No typography data captured." },
    ),
  );

  server.resource("css-colors", "css://colors", (uri: URL) =>
    jsonResource(
      uri,
      store.getColors() ?? { message: "No color data captured." },
    ),
  );

  server.resource("layout-responsive", "layout://responsive", (uri: URL) =>
    jsonResource(
      uri,
      store.getResponsive() ?? { message: "No responsive data captured." },
    ),
  );

  server.resource("layout-spacing", "layout://spacing", (uri: URL) =>
    jsonResource(
      uri,
      store.getSpacing() ?? { message: "No spacing data captured." },
    ),
  );

  server.resource("visual-screenshots", "visual://screenshots", (uri: URL) => {
    const shots = store.getScreenshots();
    return jsonResource(uri, {
      total: shots.length,
      screenshots: shots.map((s, i) => ({
        index: i,
        type: s.type,
        width: s.width,
        height: s.height,
        timestamp: s.timestamp,
      })),
    });
  });

  server.resource("accessibility-info", "a11y://audit", (uri: URL) =>
    jsonResource(
      uri,
      store.getAccessibility() ?? {
        message: "No accessibility data captured.",
      },
    ),
  );

  server.resource("mutations-log", "dom://mutations", (uri: URL) => {
    const mutations = store.getMutations();
    return jsonResource(uri, {
      total: mutations.length,
      mutations: mutations.slice(0, 50),
    });
  });

  server.resource("comparison-results", "figma://comparisons", (uri: URL) => {
    const comparisons = store.getComparisons();
    return jsonResource(uri, {
      total: comparisons.length,
      comparisons: comparisons.map((c) => ({
        selector: c.selector,
        score: c.score,
        status: c.status,
        diffCount: c.differences.length,
        timestamp: c.timestamp,
      })),
    });
  });

  server.resource("page-info", "browser://page", (uri: URL) =>
    jsonResource(uri, store.getPageInfo()),
  );
}
