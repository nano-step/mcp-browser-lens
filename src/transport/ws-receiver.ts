import { WebSocketServer } from "ws";
import type { BrowserStore } from "../store/browser-store.js";
import type { IngestPayload } from "../store/types.js";

export function createWsReceiver(
  store: BrowserStore,
  port: number,
): WebSocketServer {
  const wss = new WebSocketServer({ port });

  wss.on("connection", (ws) => {
    process.stderr.write(
      `[mcp-browser-lens] WebSocket client connected (total: ${wss.clients.size})\n`,
    );

    ws.on("message", (raw) => {
      try {
        const payload = JSON.parse(raw.toString()) as IngestPayload;
        if (payload.timestamp) {
          store.ingest(payload);
        }
        ws.send(
          JSON.stringify({ ok: true, elements: store.getElementCount() }),
        );
      } catch {
        ws.send(JSON.stringify({ error: "Invalid JSON" }));
      }
    });

    ws.on("close", () => {
      process.stderr.write(
        `[mcp-browser-lens] WebSocket client disconnected (remaining: ${wss.clients.size})\n`,
      );
      if (wss.clients.size === 0) {
        store.clear();
        process.stderr.write(
          `[mcp-browser-lens] All clients disconnected — store cleared.\n`,
        );
      }
    });
  });

  wss.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      process.stderr.write(
        `[mcp-browser-lens] WS port ${port} already in use — disabled.\n`,
      );
    } else {
      process.stderr.write(
        `[mcp-browser-lens] WebSocket error: ${err.message}\n`,
      );
    }
  });

  wss.on("listening", () => {
    process.stderr.write(
      `[mcp-browser-lens] WebSocket listening on port ${port}\n`,
    );
  });

  return wss;
}
