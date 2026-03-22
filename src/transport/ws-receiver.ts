import { WebSocketServer, type WebSocket } from "ws";
import type { BrowserStore } from "../store/browser-store.js";
import type { IngestPayload } from "../store/types.js";

export interface WsCommandChannel {
  wss: WebSocketServer;
  sendCommand: (action: string, params?: Record<string, unknown>) => boolean;
  requestScreenshot: () => Promise<boolean>;
  requestElementScreenshot: (selector: string) => Promise<boolean>;
}

export function createWsReceiver(
  store: BrowserStore,
  port: number,
): WsCommandChannel {
  const wss = new WebSocketServer({ port });
  let screenshotResolve: ((ok: boolean) => void) | null = null;

  function getActiveClient(): WebSocket | null {
    for (const client of wss.clients) {
      if (client.readyState === 1) return client;
    }
    return null;
  }

  function sendCommand(
    action: string,
    params?: Record<string, unknown>,
  ): boolean {
    const client = getActiveClient();
    if (!client) return false;
    try {
      client.send(JSON.stringify({ type: "command", action, ...params }));
      return true;
    } catch {
      return false;
    }
  }

  function requestScreenshot(): Promise<boolean> {
    return new Promise((resolve) => {
      const client = getActiveClient();
      if (!client) {
        resolve(false);
        return;
      }
      screenshotResolve = resolve;
      try {
        client.send(
          JSON.stringify({ type: "command", action: "screenshot" }),
        );
      } catch {
        screenshotResolve = null;
        resolve(false);
        return;
      }
      setTimeout(() => {
        if (screenshotResolve === resolve) {
          screenshotResolve = null;
          resolve(false);
        }
      }, 15000);
    });
  }

  function requestElementScreenshot(selector: string): Promise<boolean> {
    return new Promise((resolve) => {
      const client = getActiveClient();
      if (!client) {
        resolve(false);
        return;
      }
      screenshotResolve = resolve;
      try {
        client.send(
          JSON.stringify({
            type: "command",
            action: "element_screenshot",
            selector,
          }),
        );
      } catch {
        screenshotResolve = null;
        resolve(false);
        return;
      }
      setTimeout(() => {
        if (screenshotResolve === resolve) {
          screenshotResolve = null;
          resolve(false);
        }
      }, 15000);
    });
  }

  wss.on("connection", (ws) => {
    process.stderr.write(
      `[mcp-browser-lens] Browser connected (total: ${wss.clients.size})\n`,
    );

    ws.on("message", (raw) => {
      try {
        const payload = JSON.parse(raw.toString()) as IngestPayload;
        if (payload.timestamp) {
          store.ingest(payload);
          if (payload.screenshots && payload.screenshots.length > 0) {
            process.stderr.write(
              `[mcp-browser-lens] Screenshot received (${payload.screenshots[0].width}x${payload.screenshots[0].height})\n`,
            );
            if (screenshotResolve) {
              screenshotResolve(true);
              screenshotResolve = null;
            }
          }
        }
        ws.send(
          JSON.stringify({
            ok: true,
            elements: store.getElementCount(),
            screenshots: store.getScreenshots().length,
          }),
        );
      } catch {
        ws.send(JSON.stringify({ error: "Invalid JSON" }));
      }
    });

    ws.on("close", () => {
      process.stderr.write(
        `[mcp-browser-lens] Browser disconnected (remaining: ${wss.clients.size})\n`,
      );
      if (wss.clients.size === 0) {
        store.clear();
        process.stderr.write(
          `[mcp-browser-lens] All disconnected — store cleared.\n`,
        );
      }
    });
  });

  wss.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      process.stderr.write(
        `[mcp-browser-lens] WS port ${port} in use — disabled.\n`,
      );
    } else {
      process.stderr.write(
        `[mcp-browser-lens] WS error: ${err.message}\n`,
      );
    }
  });

  wss.on("listening", () => {
    process.stderr.write(
      `[mcp-browser-lens] WebSocket listening on port ${port}\n`,
    );
  });

  return { wss, sendCommand, requestScreenshot, requestElementScreenshot };
}
