import puppeteer from "puppeteer-core";

const CDP_PORT = parseInt(
  process.env.MCP_BROWSER_LENS_CDP_PORT ?? "9222",
  10,
);

const CANDIDATE_PORTS = [CDP_PORT, 9222, 9229, 9333];

async function findBrowserEndpoint(): Promise<string | null> {
  for (const port of [...new Set(CANDIDATE_PORTS)]) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`, {
        signal: AbortSignal.timeout(2000),
      });
      const data = (await res.json()) as {
        webSocketDebuggerUrl?: string;
        Browser?: string;
      };
      if (data.webSocketDebuggerUrl) {
        process.stderr.write(
          `[mcp-browser-lens] CDP found on :${port} (${data.Browser ?? "unknown"})\n`,
        );
        return data.webSocketDebuggerUrl;
      }
    } catch {
      continue;
    }
  }
  return null;
}

export async function cdpCaptureScreenshot(
  selector?: string,
): Promise<{ dataUrl: string; width: number; height: number } | null> {
  const endpoint = await findBrowserEndpoint();
  if (!endpoint) {
    process.stderr.write(
      `[mcp-browser-lens] CDP not available. Launch browser with --remote-debugging-port=9222\n`,
    );
    return null;
  }

  let browser;
  try {
    browser = await puppeteer.connect({
      browserWSEndpoint: endpoint,
      defaultViewport: null,
    });
    const pages = await browser.pages();
    if (pages.length === 0) {
      process.stderr.write(`[mcp-browser-lens] CDP: no pages open\n`);
      return null;
    }

    const page = pages[pages.length - 1];
    process.stderr.write(
      `[mcp-browser-lens] CDP: capturing ${selector ?? "viewport"} from ${page.url()}\n`,
    );

    if (selector) {
      const el = await page.$(selector);
      if (!el) {
        process.stderr.write(
          `[mcp-browser-lens] CDP: element '${selector}' not found\n`,
        );
        return null;
      }
      const buf = (await el.screenshot({ type: "png" })) as Buffer | Uint8Array;
      const box = await el.boundingBox();
      const b64 = Buffer.from(buf).toString("base64");
      process.stderr.write(
        `[mcp-browser-lens] CDP: element screenshot ${box?.width ?? 0}x${box?.height ?? 0} (${b64.length} bytes b64)\n`,
      );
      return {
        dataUrl: "data:image/png;base64," + b64,
        width: Math.round(box?.width ?? 0),
        height: Math.round(box?.height ?? 0),
      };
    }

    const buf = (await page.screenshot({
      type: "png",
      fullPage: false,
    })) as Buffer | Uint8Array;
    const b64 = Buffer.from(buf).toString("base64");

    const metrics = await page.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight,
    }));

    process.stderr.write(
      `[mcp-browser-lens] CDP: viewport screenshot ${metrics.width}x${metrics.height} (${b64.length} bytes b64)\n`,
    );

    return {
      dataUrl: "data:image/png;base64," + b64,
      width: metrics.width,
      height: metrics.height,
    };
  } catch (e) {
    process.stderr.write(
      `[mcp-browser-lens] CDP screenshot error: ${e instanceof Error ? e.message : String(e)}\n`,
    );
    return null;
  } finally {
    if (browser) {
      try {
        browser.disconnect();
      } catch { /* already disconnected */ }
    }
  }
}

export async function isCdpAvailable(): Promise<boolean> {
  return (await findBrowserEndpoint()) !== null;
}
