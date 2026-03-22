import * as http from "node:http";
import type { BrowserStore } from "../store/browser-store.js";
import type { IngestPayload } from "../store/types.js";
import { getConnectorScript } from "./connector-script.js";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

function jsonResponse(
  res: http.ServerResponse,
  status: number,
  data: unknown,
): void {
  res.writeHead(status, {
    ...CORS_HEADERS,
    "Content-Type": "application/json",
  });
  res.end(JSON.stringify(data));
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

function getConnectorPage(httpPort: number, wsPort: number): string {
  const script = getConnectorScript(httpPort, wsPort);
  const bookmarklet = `javascript:${encodeURIComponent(script)}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Browser Lens — MCP Visual Inspector</title>
<style>
:root{--bg:#0a0a0a;--surface:#18181b;--surface2:#27272a;--border:#3f3f46;--text:#fafafa;--muted:#a1a1aa;--dim:#71717a;--accent:#8b5cf6;--accent2:#7c3aed;--green:#22c55e;--green-bg:#052e16;--green-b:#14532d;--amber:#f59e0b;--red:#ef4444;--cyan:#06b6d4}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:var(--bg);color:var(--text);min-height:100vh;padding:40px 20px}
.wrap{max-width:720px;margin:0 auto}
.header{text-align:center;margin-bottom:48px}
.header h1{font-size:28px;font-weight:800;margin-bottom:8px;letter-spacing:-0.02em;background:linear-gradient(135deg,#8b5cf6,#06b6d4);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.header p{color:var(--muted);font-size:15px}
.server-status{display:flex;gap:16px;margin-bottom:40px}
.status-card{flex:1;padding:16px;background:var(--surface);border:1px solid var(--green-b);border-radius:10px;display:flex;align-items:center;gap:10px}
.status-dot{width:10px;height:10px;border-radius:50%;background:var(--green);flex-shrink:0;animation:pulse 2s infinite}
.status-dot.off{background:var(--red);animation:none}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
.status-label{font-size:12px;color:var(--dim);text-transform:uppercase;letter-spacing:.05em}
.status-value{font-size:14px;font-weight:600;font-family:'SF Mono',Monaco,Consolas,monospace}
.section{margin-bottom:40px}
.section-title{font-size:18px;font-weight:700;margin-bottom:20px;display:flex;align-items:center;gap:8px}
.tag{display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;background:#8b5cf622;color:var(--accent);border:1px solid #8b5cf644}
.steps{display:flex;flex-direction:column;gap:2px}
.step{display:flex;gap:16px;padding:20px;background:var(--surface);border:1px solid #27272a}
.step:first-child{border-radius:10px 10px 0 0}
.step:last-child{border-radius:0 0 10px 10px}
.step-num{width:28px;height:28px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0;color:#fff}
.step-body h3{font-size:14px;font-weight:600;margin-bottom:6px}
.step-body p{font-size:13px;color:var(--muted);line-height:1.6;margin-bottom:10px}
.bm-zone{padding:20px;background:var(--bg);border:2px dashed var(--border);border-radius:8px;text-align:center;margin:12px 0}
.bm-zone p{font-size:12px;color:var(--dim);margin-bottom:12px}
.bm-btn{display:inline-block;padding:10px 24px;background:linear-gradient(135deg,#8b5cf6,#06b6d4);color:#fff;border-radius:8px;text-decoration:none;font-size:14px;font-weight:700;cursor:grab;transition:all .15s;box-shadow:0 2px 8px #8b5cf644}
.bm-btn:hover{transform:translateY(-1px);box-shadow:0 4px 12px #8b5cf666}
.snippet-box{position:relative;margin:8px 0}
.snippet-box pre{padding:14px;background:var(--bg);border:1px solid var(--border);border-radius:8px;font-family:'SF Mono',Monaco,Consolas,monospace;font-size:12px;color:var(--muted);overflow-x:auto;white-space:pre-wrap;word-break:break-all;max-height:80px;overflow-y:auto;line-height:1.5}
.live-status{margin-top:32px;padding:16px 20px;border-radius:10px;font-size:13px;line-height:1.6}
.live-status.waiting{background:#1c1917;border:1px solid #44403c;color:var(--amber)}
.live-status.connected{background:var(--green-bg);border:1px solid var(--green-b);color:var(--green)}
.live-status strong{display:block;margin-bottom:4px;font-size:14px}
.captures{margin-top:24px;display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
.cap{padding:12px;background:var(--surface);border:1px solid #27272a;border-radius:8px;font-size:12px}
.cap strong{display:block;font-size:13px;margin-bottom:4px}
.cap span{color:var(--dim)}
.footer{text-align:center;margin-top:48px;padding-top:24px;border-top:1px solid #27272a;font-size:12px;color:var(--dim)}
.footer a{color:var(--accent);text-decoration:none}
</style>
</head>
<body>
<div class="wrap">
<div class="header">
<h1>Browser Lens</h1>
<p>Real-time DOM, CSS & visual inspection for your IDE's AI agent.</p>
</div>
<div class="server-status">
<div class="status-card"><span class="status-dot"></span><div><div class="status-label">HTTP</div><div class="status-value">:${httpPort}</div></div></div>
<div class="status-card"><span class="status-dot"></span><div><div class="status-label">WebSocket</div><div class="status-value">:${wsPort}</div></div></div>
<div class="status-card"><span class="status-dot off" id="app-dot"></span><div><div class="status-label">Browser</div><div class="status-value" id="app-status">Not connected</div></div></div>
</div>
<div class="section">
<div class="section-title">Setup <span class="tag">Zero Code</span></div>
<div class="steps">
<div class="step"><div class="step-num">1</div><div class="step-body">
<h3>Drag bookmarklet to your Bookmarks Bar</h3>
<div class="bm-zone">
<p>Click and drag to your bookmarks bar:</p>
<a class="bm-btn" href="${bookmarklet}" onclick="event.preventDefault();alert('Drag this to your bookmarks bar, then click it on any page.')" title="Drag to bookmarks bar">Browser Lens</a>
</div>
</div></div>
<div class="step"><div class="step-num">2</div><div class="step-body">
<h3>Open any web page and click the bookmarklet</h3>
<p>Navigate to any web app. Click <strong>"Browser Lens"</strong> in your bookmarks bar.</p>
<div class="snippet-box"><pre style="color:var(--green);background:var(--green-bg);border-color:var(--green-b)">[Browser Lens] WebSocket connected
[Browser Lens] Connected! DOM, CSS, layout, and visual data streaming to IDE.</pre></div>
</div></div>
<div class="step"><div class="step-num">3</div><div class="step-body">
<h3>Ask your IDE's AI agent</h3>
<div class="snippet-box"><pre><span style="color:var(--accent);font-weight:600">@browser-lens</span> <span style="color:#86efac">Describe this page's UI layout</span>
<span style="color:var(--accent);font-weight:600">@browser-lens</span> <span style="color:#86efac">Compare this button with Figma specs</span>
<span style="color:var(--accent);font-weight:600">@browser-lens</span> <span style="color:#86efac">Take a screenshot and audit the design</span>
<span style="color:var(--accent);font-weight:600">@browser-lens</span> <span style="color:#86efac">What CSS variables are defined?</span></pre></div>
</div></div>
</div>
</div>
<div class="captures">
<div class="cap"><strong>DOM Tree</strong><span>Full structure with semantic analysis</span></div>
<div class="cap"><strong>Computed Styles</strong><span>Every CSS property for any element</span></div>
<div class="cap"><strong>Layout & Box Model</strong><span>Flex, grid, positioning, spacing</span></div>
<div class="cap"><strong>Screenshots</strong><span>Viewport & element capture as PNG</span></div>
<div class="cap"><strong>Typography</strong><span>Fonts, sizes, weights, line-heights</span></div>
<div class="cap"><strong>Color Palette</strong><span>All colors with usage counts</span></div>
<div class="cap"><strong>CSS Variables</strong><span>Custom properties from :root</span></div>
<div class="cap"><strong>Accessibility</strong><span>ARIA, roles, labels, contrast</span></div>
</div>
<div id="live-status" class="live-status waiting">
<strong>Waiting for browser connection...</strong>
Open any web page and click the bookmarklet.
</div>
<div class="footer">
<p>Browser Lens by <strong>nano-step</strong> &middot; <a href="https://github.com/nano-step/mcp-browser-lens">GitHub</a> &middot; MIT License</p>
</div>
</div>
<script>
setInterval(function(){
  fetch('/health').then(function(r){return r.json()}).then(function(d){
    var el=document.getElementById('live-status');
    var dot=document.getElementById('app-dot');
    var st=document.getElementById('app-status');
    if(d.elements>0||d.hasDom){
      el.className='live-status connected';
      el.innerHTML='<strong>Connected! '+d.elements+' elements captured.</strong>Your IDE can now inspect the page via MCP protocol.';
      dot.className='status-dot';
      st.textContent=d.elements+' elements';
    }
  }).catch(function(){});
},3000);
</script>
</body>
</html>`;
}

export function createHttpReceiver(
  store: BrowserStore,
  port: number,
  wsPort?: number,
): http.Server {
  const effectiveWsPort = wsPort ?? port + 1;

  const server = http.createServer(async (req, res) => {
    if (req.method === "OPTIONS") {
      res.writeHead(204, CORS_HEADERS);
      res.end();
      return;
    }

    const url = new URL(req.url ?? "/", `http://localhost:${port}`);

    if (req.method === "GET" && url.pathname === "/") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(getConnectorPage(port, effectiveWsPort));
      return;
    }

    if (req.method === "GET" && url.pathname === "/connector.js") {
      res.writeHead(200, {
        ...CORS_HEADERS,
        "Content-Type": "application/javascript",
      });
      res.end(getConnectorScript(port, effectiveWsPort));
      return;
    }

    if (req.method === "GET" && url.pathname === "/health") {
      const info = store.getPageInfo();
      jsonResponse(res, 200, {
        status: "ok",
        elements: info.totalElements,
        hasDom: info.hasDom,
        screenshots: info.screenshotCount,
        uptime: process.uptime(),
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/ingest") {
      try {
        const body = await readBody(req);
        const payload = JSON.parse(body) as IngestPayload;
        if (!payload.timestamp) {
          jsonResponse(res, 400, { error: "Missing timestamp" });
          return;
        }
        store.ingest(payload);
        jsonResponse(res, 200, {
          ok: true,
          elements: store.getElementCount(),
        });
      } catch {
        jsonResponse(res, 400, { error: "Invalid JSON payload" });
      }
      return;
    }

    jsonResponse(res, 404, { error: "Not found" });
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      process.stderr.write(
        `[mcp-browser-lens] Port ${port} already in use — HTTP disabled.\n`,
      );
    } else {
      process.stderr.write(
        `[mcp-browser-lens] HTTP error: ${err.message}\n`,
      );
    }
  });

  server.listen(port, () => {
    process.stderr.write(
      `[mcp-browser-lens] HTTP listening on port ${port}\n`,
    );
  });

  return server;
}
