import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { BrowserStore } from "../src/store/browser-store.js";
import { createHttpReceiver } from "../src/transport/http-receiver.js";
import { createWsReceiver } from "../src/transport/ws-receiver.js";
import { getConnectorScript } from "../src/transport/connector-script.js";
import { createFullPayload } from "./fixtures.js";
import WebSocket, { type WebSocketServer } from "ws";
import type http from "node:http";

const HTTP_PORT = 23400 + Math.floor(Math.random() * 100);
const WS_PORT = HTTP_PORT + 1;

describe("Transport Layer", () => {
  let store: BrowserStore;
  let httpServer: http.Server;
  let wsServer: WebSocketServer;

  beforeAll(async () => {
    process.env.MCP_BROWSER_LENS_STORE_PATH = "/tmp/browser-lens-transport-test-" + Date.now() + ".json";
    store = new BrowserStore();
    store.clear();
    httpServer = createHttpReceiver(store, HTTP_PORT, WS_PORT);
    wsServer = createWsReceiver(store, WS_PORT);
    await new Promise((r) => setTimeout(r, 300));
  });

  afterAll(() => {
    httpServer.close();
    wsServer.close();
    store.clear();
  });

  describe("HTTP endpoints", () => {
    it("GET / returns connector page HTML", async () => {
      const res = await fetch(`http://localhost:${HTTP_PORT}/`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("text/html");
      const html = await res.text();
      expect(html).toContain("Browser Lens");
      expect(html).toContain("__MCP_BROWSER_LENS__");
      expect(html).toContain("bookmarklet");
    });

    it("GET /health returns status JSON", async () => {
      const res = await fetch(`http://localhost:${HTTP_PORT}/health`);
      expect(res.status).toBe(200);
      const data = await res.json() as Record<string, unknown>;
      expect(data.status).toBe("ok");
      expect(data.httpPort).toBe(HTTP_PORT);
      expect(data.wsPort).toBe(WS_PORT);
      expect(typeof data.uptime).toBe("number");
      expect(data.connectorUrl).toBe(`http://localhost:${HTTP_PORT}`);
    });

    it("GET /connector.js returns JavaScript", async () => {
      const res = await fetch(`http://localhost:${HTTP_PORT}/connector.js`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("application/javascript");
      const js = await res.text();
      expect(js).toContain("html2canvas");
      expect(js).toContain("captureScreenshot");
      expect(js).toContain("fullSync");
      expect(js).toContain("connectWs");
    });

    it("POST /ingest accepts data", async () => {
      const res = await fetch(`http://localhost:${HTTP_PORT}/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timestamp: Date.now(), url: "https://test.com" }),
      });
      expect(res.status).toBe(200);
      const data = await res.json() as Record<string, unknown>;
      expect(data.ok).toBe(true);
    });

    it("POST /ingest rejects missing timestamp", async () => {
      const res = await fetch(`http://localhost:${HTTP_PORT}/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://test.com" }),
      });
      expect(res.status).toBe(400);
    });

    it("POST /ingest rejects invalid JSON", async () => {
      const res = await fetch(`http://localhost:${HTTP_PORT}/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json{{{",
      });
      expect(res.status).toBe(400);
    });

    it("GET /nonexistent returns 404", async () => {
      const res = await fetch(`http://localhost:${HTTP_PORT}/nonexistent`);
      expect(res.status).toBe(404);
    });

    it("OPTIONS returns CORS headers", async () => {
      const res = await fetch(`http://localhost:${HTTP_PORT}/`, { method: "OPTIONS" });
      expect(res.status).toBe(204);
      expect(res.headers.get("access-control-allow-origin")).toBe("*");
    });
  });

  describe("WebSocket ingestion", () => {
    it("accepts connection and ingests data", async () => {
      store.clear();
      const ws = new WebSocket(`ws://localhost:${WS_PORT}`);
      await new Promise<void>((resolve, reject) => { ws.on("open", resolve); ws.on("error", reject); });

      ws.send(JSON.stringify(createFullPayload()));
      await new Promise((r) => setTimeout(r, 200));

      const info = store.getPageInfo();
      expect(info.hasDom).toBe(true);
      expect(info.totalElements).toBe(2);
      expect(info.screenshotCount).toBe(1);
      expect(info.url).toBe("https://app.test.com/dashboard");

      ws.close();
      await new Promise((r) => setTimeout(r, 100));
    });

    it("returns acknowledgment on valid message", async () => {
      const ws = new WebSocket(`ws://localhost:${WS_PORT}`);
      await new Promise<void>((resolve, reject) => { ws.on("open", resolve); ws.on("error", reject); });

      const response = await new Promise<string>((resolve) => {
        ws.on("message", (data) => resolve(data.toString()));
        ws.send(JSON.stringify({ timestamp: Date.now() }));
      });

      const parsed = JSON.parse(response);
      expect(parsed.ok).toBe(true);
      ws.close();
    });

    it("returns error on invalid JSON", async () => {
      const ws = new WebSocket(`ws://localhost:${WS_PORT}`);
      await new Promise<void>((resolve, reject) => { ws.on("open", resolve); ws.on("error", reject); });

      const response = await new Promise<string>((resolve) => {
        ws.on("message", (data) => resolve(data.toString()));
        ws.send("not-json{{{");
      });

      const parsed = JSON.parse(response);
      expect(parsed.error).toBe("Invalid JSON");
      ws.close();
    });
  });

  describe("Connector script generation", () => {
    it("generates valid JavaScript", () => {
      const script = getConnectorScript(3300, 3301);
      expect(script).toContain("(function(){");
      expect(script).toContain("ws://localhost:");
      expect(script).toContain("3301");
      expect(script).toContain("http://localhost:");
      expect(script).toContain("3300");
    });

    it("includes all capture functions", () => {
      const script = getConnectorScript(3300, 3301);
      const requiredFunctions = [
        "captureDom", "captureElementDetail", "captureTopElements",
        "captureCssVars", "captureTypography", "captureColors",
        "captureAccessibility", "captureResponsive", "captureSpacing",
        "captureScreenshot", "fullSync",
      ];
      for (const fn of requiredFunctions) {
        expect(script).toContain(fn);
      }
    });

    it("uses html2canvas for screenshots", () => {
      const script = getConnectorScript(3300, 3301);
      expect(script).toContain("html2canvas");
      expect(script).toContain("cdnjs.cloudflare.com");
      expect(script).not.toContain("XMLSerializer");
      expect(script).not.toContain("new XMLSerializer");
    });

    it("has tainted canvas protection", () => {
      const script = getConnectorScript(3300, 3301);
      expect(script).toContain("allowTaint:false");
      expect(script).toContain("ignoreElements");
      expect(script).toContain("_ssFailing");
    });

    it("has error logging", () => {
      const script = getConnectorScript(3300, 3301);
      expect(script).toContain("[BrowserLens]");
      expect(script).toContain("console.error");
    });

    it("has WebSocket reconnection", () => {
      const script = getConnectorScript(3300, 3301);
      expect(script).toContain("reconnecting in 5s");
      expect(script).toContain("setTimeout(connectWs,5000)");
    });

    it("has MutationObserver", () => {
      const script = getConnectorScript(3300, 3301);
      expect(script).toContain("MutationObserver");
      expect(script).toContain("childList:true");
      expect(script).toContain("attributes:true");
    });

    it("prevents double-load", () => {
      const script = getConnectorScript(3300, 3301);
      expect(script).toContain("__MCP_BROWSER_LENS__");
      expect(script).toContain("Already active");
    });
  });
});
