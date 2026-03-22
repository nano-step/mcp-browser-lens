import puppeteer from "puppeteer-core";

const CDP_PORT = parseInt(
  process.env.MCP_BROWSER_LENS_CDP_PORT ?? "9222",
  10,
);

async function findBrowserEndpoint(): Promise<string | null> {
  try {
    const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
    const data = (await res.json()) as { webSocketDebuggerUrl?: string };
    return data.webSocketDebuggerUrl ?? null;
  } catch {
    return null;
  }
}

export async function cdpCaptureScreenshot(
  selector?: string,
): Promise<{ dataUrl: string; width: number; height: number } | null> {
  const endpoint = await findBrowserEndpoint();
  if (!endpoint) return null;

  let browser;
  try {
    browser = await puppeteer.connect({ browserWSEndpoint: endpoint });
    const pages = await browser.pages();
    if (pages.length === 0) return null;

    const page = pages[pages.length - 1];

    if (selector) {
      const el = await page.$(selector);
      if (!el) return null;
      const buf = await el.screenshot({ type: "png" });
      const box = await el.boundingBox();
      return {
        dataUrl:
          "data:image/png;base64," + Buffer.from(buf).toString("base64"),
        width: Math.round(box?.width ?? 0),
        height: Math.round(box?.height ?? 0),
      };
    }

    const buf = await page.screenshot({ type: "png", fullPage: false });
    const viewport = page.viewport();
    return {
      dataUrl: "data:image/png;base64," + Buffer.from(buf).toString("base64"),
      width: viewport?.width ?? 1440,
      height: viewport?.height ?? 900,
    };
  } catch (e) {
    process.stderr.write(
      `[mcp-browser-lens] CDP screenshot failed: ${e instanceof Error ? e.message : String(e)}\n`,
    );
    return null;
  } finally {
    if (browser) browser.disconnect();
  }
}

export async function isCdpAvailable(): Promise<boolean> {
  return (await findBrowserEndpoint()) !== null;
}
