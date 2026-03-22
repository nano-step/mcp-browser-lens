import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { BrowserStore } from "./store/browser-store.js";
import type { WsCommandChannel } from "./transport/ws-receiver.js";
import { registerResources } from "./resources/index.js";
import { registerTools } from "./tools/index.js";
import { registerPrompts } from "./prompts/index.js";

export function createMcpServer(
  store: BrowserStore,
  wsChannel?: WsCommandChannel,
): McpServer {
  const server = new McpServer({
    name: "mcp-browser-lens",
    version: "1.0.0",
  });

  registerResources(server, store);
  registerTools(server, store, wsChannel);
  registerPrompts(server, store);

  return server;
}
