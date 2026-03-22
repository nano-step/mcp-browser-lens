#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { BrowserStore } from "./store/browser-store.js";
import { createMcpServer } from "./server.js";
import { createHttpReceiver } from "./transport/http-receiver.js";
import { createWsReceiver } from "./transport/ws-receiver.js";

const HTTP_PORT = parseInt(process.env.MCP_BROWSER_LENS_PORT ?? "3202", 10);
const WS_PORT = parseInt(process.env.MCP_BROWSER_LENS_WS_PORT ?? "3203", 10);

const store = new BrowserStore();
const mcpServer = createMcpServer(store);

createHttpReceiver(store, HTTP_PORT, WS_PORT);
createWsReceiver(store, WS_PORT);

const transport = new StdioServerTransport();
mcpServer.connect(transport).then(() => {
  process.stderr.write(`[mcp-browser-lens] MCP server connected via stdio\n`);
});

process.on("SIGINT", async () => {
  await mcpServer.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await mcpServer.close();
  process.exit(0);
});
