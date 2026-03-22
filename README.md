<div align="center">
  <img src="assets/logo.svg" alt="Browser Lens" width="120" height="120">
  <h1>browser-lens-mcp</h1>
  <p><strong>Your browser's UI, deeply understood by your IDE's AI agent.</strong></p>
  <p>
    <a href="https://www.npmjs.com/package/browser-lens-mcp"><img src="https://img.shields.io/npm/v/browser-lens-mcp?style=flat-square&color=8b5cf6" alt="npm"></a>
    <a href="https://www.npmjs.com/package/browser-lens-mcp"><img src="https://img.shields.io/npm/dm/browser-lens-mcp?style=flat-square&color=8b5cf6" alt="downloads"></a>
    <a href="https://modelcontextprotocol.io"><img src="https://img.shields.io/badge/MCP-Compatible-blue?style=flat-square" alt="MCP"></a>
    <a href="https://nodejs.org"><img src="https://img.shields.io/badge/Node.js-20%2B-green?style=flat-square" alt="Node"></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="License"></a>
  </p>
</div>

---

## How It Works

Browser Lens connects your IDE's AI agent to any running web page. Ask about any UI element and get its exact styles, layout, screenshot, and fix suggestions — with zero code changes.

<div align="center">
  <img src="assets/architecture-flow.svg" alt="Architecture Flow" width="100%">
</div>

**The flow:**

1. **Bookmarklet** runs in your browser, captures DOM, CSS, layout, screenshots
2. **WebSocket** streams data in real-time + receives commands from server
3. **MCP server** stores and indexes everything, exposes 30 tools, 12 resources, 5 prompts
4. **IDE AI agent** queries tools via stdio — inspect any element, take screenshots on demand, compare with Figma

### Key Capabilities

| Capability | How It Works |
|------------|-------------|
| **Deep Element Inspection** | `live_query_element` sends a command to the browser to capture ANY element by CSS selector — even deeply nested ones not in the auto-capture |
| **On-Demand Screenshots** | `trigger_screenshot` tells the browser to take a fresh screenshot NOW and returns the image directly to your IDE |
| **Figma Comparison** | `compare_with_figma` compares live CSS values against design specs, scores 0-100, generates copy-paste CSS fixes |
| **Full Page Analysis** | `get_full_page_analysis` returns structure, design tokens, typography, colors, spacing, accessibility in one call |
| **Feature Area Inspection** | `inspect_feature_area` inspects a specific UI section (header, sidebar, form) with all child details |

---

## What Gets Captured

<div align="center">
  <img src="assets/bookmarklet-capture.svg" alt="Bookmarklet Captures" width="100%">
</div>

| Category | Data | Details |
|----------|------|---------|
| **DOM** | Full tree + element details | Tags, classes, attributes, text, semantic structure |
| **CSS** | Computed styles | Every CSS property for any element via selector |
| **CSS** | Variables | All `--*` custom properties from `:root` and stylesheets |
| **CSS** | Typography | Font families, sizes, weights, line-heights with usage counts |
| **CSS** | Colors | Text, background, border colors with hex values and counts |
| **Layout** | Box model | Width, height, padding, margin, border dimensions |
| **Layout** | Flex & Grid | Direction, wrap, gap, template columns/rows |
| **Layout** | Spacing | Margin/padding analysis, spacing scale, inconsistencies |
| **Visual** | Screenshots | On-demand viewport capture as PNG, returned as image |
| **Visual** | Figma comparison | Compare element against design specs with score + diff |
| **A11y** | Accessibility | ARIA labels, roles, alt text, headings, landmarks |
| **Responsive** | Viewport | Dimensions, DPR, active media queries, breakpoints |
| **Mutations** | DOM changes | Attribute changes, added/removed nodes in real-time |

---

## Quick Start

### Step 1 — Configure your IDE

<details open>
<summary><strong>Cursor</strong></summary>

**File:** `.cursor/mcp.json`

```json
{
  "mcpServers": {
    "browser-lens": {
      "command": "npx",
      "args": ["-y", "browser-lens-mcp@latest"]
    }
  }
}
```
</details>

<details>
<summary><strong>VS Code (Copilot)</strong></summary>

**File:** `.vscode/mcp.json`

```json
{
  "servers": {
    "browser-lens": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "browser-lens-mcp@latest"]
    }
  }
}
```
</details>

<details>
<summary><strong>Claude Code</strong></summary>

```bash
claude mcp add browser-lens npx -y browser-lens-mcp@latest
```
</details>

<details>
<summary><strong>Windsurf</strong></summary>

**File:** `~/.codeium/windsurf/mcp_config.json`

```json
{
  "mcpServers": {
    "browser-lens": {
      "command": "npx",
      "args": ["-y", "browser-lens-mcp@latest"]
    }
  }
}
```
</details>

<details>
<summary><strong>OpenCode</strong></summary>

**File:** `~/.config/opencode/config.json`

```json
{
  "mcpServers": {
    "browser-lens": {
      "type": "local",
      "command": ["npx", "-y", "browser-lens-mcp@latest"]
    }
  }
}
```
</details>

<details>
<summary><strong>Zed</strong></summary>

**File:** `~/.config/zed/settings.json`

```json
{
  "context_servers": {
    "browser-lens": {
      "command": { "path": "npx", "args": ["-y", "browser-lens-mcp@latest"] }
    }
  }
}
```
</details>

**Custom ports** (avoid conflicts):

```json
{
  "mcpServers": {
    "browser-lens": {
      "command": "npx",
      "args": ["-y", "browser-lens-mcp@latest"],
      "env": {
        "MCP_BROWSER_LENS_PORT": "3300",
        "MCP_BROWSER_LENS_WS_PORT": "3301"
      }
    }
  }
}
```

### Step 2 — Connect your browser

**Option A: Chrome Extension** (recommended — persists across page reloads)

```bash
# Find the extension folder
ls node_modules/browser-lens-mcp/extension/
```

1. Open `chrome://extensions` in Chrome/Edge
2. Enable **Developer Mode** (top right)
3. Click **Load unpacked**
4. Select `node_modules/browser-lens-mcp/extension/`
5. Done — auto-connects on every page load, survives reload!

Configure ports via the extension popup icon.

**Option B: Bookmarklet** (zero install, one-time per page)

1. Open **http://localhost:3202** (or your custom port)
2. Drag the **bookmarklet** to your bookmarks bar
3. Navigate to any web app → click the bookmarklet

```
[BrowserLens] WebSocket connected to ws://localhost:3203
[BrowserLens] DOM captured: 250 elements
[BrowserLens] Elements captured: 30
[BrowserLens] CSS vars captured: 12
[BrowserLens] Screenshot OK: 1440x900
[BrowserLens] Sync complete
```

### Step 3 — Ask your AI agent

```
@browser-lens What does the header look like? Show me a screenshot.
@browser-lens What are the 2 buttons in the header? What colors are they?
@browser-lens Compare the hero section with Figma: fontSize 48px, color #ffffff, fontWeight 800
@browser-lens This button looks wrong — find the source file and suggest a fix
@browser-lens Run a full visual QA on this page
```

---

## Figma Design Comparison

<div align="center">
  <img src="assets/figma-comparison-flow.svg" alt="Figma Comparison Flow" width="100%">
</div>

**Scoring:**

| Score | Status | Meaning |
|-------|--------|---------|
| 95–100 | `match` | Pixel-perfect — ship it |
| 80–94 | `minor-diff` | Close — small CSS tweaks needed |
| 50–79 | `major-diff` | Significant gaps — fixes required |
| 0–49 | `mismatch` | Major rework needed |

Works with **any design tool** — Figma, Sketch, Adobe XD, Zeplin. Just provide CSS values.

---

## MCP Tools (30)

### Live Browser Commands (2 tools) ⚡
| Tool | Description |
|------|-------------|
| `trigger_screenshot` | Request browser to take a fresh screenshot NOW — returns PNG image |
| `live_query_element` | Query ANY element by CSS selector in real-time — even deeply nested ones |

### DOM Inspection (5 tools)
| Tool | Description |
|------|-------------|
| `get_dom_tree` | Full DOM tree with semantic structure |
| `inspect_element` | Complete element details: DOM + styles + layout |
| `query_selector` | Search DOM by tag, class, ID, or selector |
| `get_element_hierarchy` | Parent → child path from root to element |
| `get_elements_summary` | Overview of all captured elements |

### CSS Analysis (4 tools)
| Tool | Description |
|------|-------------|
| `get_computed_styles` | All computed CSS properties for any element |
| `get_css_variables` | CSS custom properties (`--*`) with values |
| `get_typography` | Font families, sizes, weights with usage counts |
| `get_color_palette` | All colors (text, bg, border) with hex + count |

### Layout & Spacing (3 tools)
| Tool | Description |
|------|-------------|
| `get_layout_info` | Box model, flex/grid info, positioning |
| `get_spacing_analysis` | Margin/padding/gap analysis + spacing scale |
| `get_responsive_info` | Viewport, DPR, breakpoints, media queries |

### Visual & Screenshots (4 tools)
| Tool | Description |
|------|-------------|
| `get_page_screenshot` | Latest cached viewport screenshot as PNG |
| `get_all_screenshots` | List all captured screenshots with metadata |
| `describe_ui` | AI-friendly page description |
| `capture_screenshot_with_analysis` | Screenshot + detailed layout/style analysis |

### Design Comparison (4 tools)
| Tool | Description |
|------|-------------|
| `compare_with_figma` | Compare element vs design specs → score + diff |
| `get_comparison_history` | All previous comparison results |
| `suggest_css_fixes` | Generate copy-paste CSS from comparison |
| `get_visual_diff_report` | Aggregate report across all comparisons |

### Page Analysis (4 tools)
| Tool | Description |
|------|-------------|
| `get_full_page_analysis` | Everything in one call: structure, tokens, a11y |
| `get_design_tokens` | CSS variables grouped by category |
| `inspect_feature_area` | Inspect specific UI section with children |
| `get_connection_status` | Check browser connection + setup instructions |

### General (4 tools)
| Tool | Description |
|------|-------------|
| `get_page_info` | Page URL, viewport, element count |
| `get_dom_mutations` | Recent DOM changes |
| `get_accessibility_info` | ARIA, roles, headings, landmarks |
| `clear_data` | Clear all captured data |

---

## MCP Prompts (5) — `/` Commands in IDE

Type `/` in your IDE chat to see these guided workflows:

| Prompt | When to Use | What It Does |
|--------|-------------|-------------|
| `/compare_with_figma` | After implementing a UI from Figma | Walks through comparing each element, generates CSS fixes |
| `/audit_ui` | Before PR review or release | Audits colors, typography, spacing, accessibility — rates 1-10 |
| `/describe_page` | When you need to explain the current UI to AI | Generates detailed page description with structure, styles, elements |
| `/suggest_fixes` | After running comparisons | Collects all failing comparisons + a11y issues → prioritized fix list |
| `/visual_qa` | Final check before shipping | Takes screenshot, compares elements, outputs PASS/NEEDS_WORK/FAIL |

**Example usage in Antigravity/Cursor:**
```
/compare_with_figma
→ AI reads current page data, asks for Figma specs, runs comparisons, suggests fixes

/audit_ui
→ AI analyzes colors (too many?), typography (consistent?), spacing (scale?), a11y (issues?)
```

---

## MCP Resources (12) — `@` References in IDE

Type `@mcp:browser-lens/` in your IDE to access these data sources directly:

| Resource | Shorthand | When to Use | Example |
|----------|-----------|-------------|---------|
| `dom://snapshot` | `@browser-lens/dom-snapshot` | Get the full DOM tree structure | "Show me the page structure" |
| `dom://elements` | `@browser-lens/dom-elements` | List all captured element selectors | "What elements are captured?" |
| `dom://mutations` | `@browser-lens/mutations-log` | Check recent DOM changes | "What changed since last sync?" |
| `css://variables` | `@browser-lens/css-variables` | Get all CSS custom properties | "What design tokens exist?" |
| `css://typography` | `@browser-lens/css-typography` | Get font usage analysis | "What fonts are used?" |
| `css://colors` | `@browser-lens/css-colors` | Get color palette | "What colors are on this page?" |
| `layout://responsive` | `@browser-lens/layout-responsive` | Get viewport & breakpoints | "What breakpoint is active?" |
| `layout://spacing` | `@browser-lens/layout-spacing` | Get spacing analysis | "Is spacing consistent?" |
| `visual://screenshots` | `@browser-lens/visual-screenshots` | List captured screenshots | "How many screenshots exist?" |
| `a11y://audit` | `@browser-lens/accessibility-info` | Get accessibility audit | "Any a11y issues?" |
| `figma://comparisons` | `@browser-lens/comparison-results` | Get comparison results | "How did the last comparison go?" |
| `browser://page` | `@browser-lens/page-info` | Get page info summary | "Is browser connected?" |

**Example usage:**
```
@browser-lens/css-colors Tell me the primary colors used on this page
@browser-lens/dom-snapshot Show me the semantic structure
@browser-lens/accessibility-info Are there any accessibility issues?
```

**Resources vs Tools:**
- **Resources** (`@`) = Read-only data snapshots. Fast, no browser command needed. Use for quick lookups.
- **Tools** = Actions that can query the browser live, take screenshots, compare with Figma. Use for interactive work.

---

## Bidirectional Command System

Unlike other MCP tools that only read cached data, Browser Lens has a **live command channel**:

```
IDE → MCP Server → WebSocket → Browser Bookmarklet
                                     ↓
                              Execute command
                                     ↓
IDE ← MCP Server ← WebSocket ← Send result
```

**Commands the server can send to the browser:**
- `screenshot` — Capture viewport screenshot (cross-origin images auto-replaced with placeholders)
- `element_screenshot` — Capture a specific element by CSS selector
- `query_element` — Inspect any element by CSS selector on-demand
- `fullsync` — Trigger a full data re-capture

---

## Screenshots (CDP — 100% Reliable)

Screenshots use **Chrome DevTools Protocol (CDP)** via `puppeteer-core` — captures exactly what you see in the browser. No CORS issues, no CSP restrictions, works on any page.

### Setup: Launch browser with remote debugging

<details open>
<summary><strong>Brave Browser (Mac)</strong></summary>

```bash
/Applications/Brave\ Browser.app/Contents/MacOS/Brave\ Browser --remote-debugging-port=9222
```
</details>

<details>
<summary><strong>Google Chrome (Mac)</strong></summary>

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
```
</details>

<details>
<summary><strong>Google Chrome (Linux)</strong></summary>

```bash
google-chrome --remote-debugging-port=9222
```
</details>

<details>
<summary><strong>Microsoft Edge (Mac)</strong></summary>

```bash
/Applications/Microsoft\ Edge.app/Contents/MacOS/Microsoft\ Edge --remote-debugging-port=9222
```
</details>

<details>
<summary><strong>Tip: Create a shell alias</strong></summary>

```bash
# Add to ~/.zshrc or ~/.bashrc
alias brave-debug='/Applications/Brave\ Browser.app/Contents/MacOS/Brave\ Browser --remote-debugging-port=9222'
alias chrome-debug='/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222'

# Then just run
brave-debug
```
</details>

**Verify CDP is running:**

```bash
curl http://127.0.0.1:9222/json/version
# Should show: {"Browser":"Brave/...","webSocketDebuggerUrl":"ws://..."}
```

### Screenshot tools

| Tool | What it does |
|------|-------------|
| `trigger_screenshot` | Capture full viewport — returns PNG image directly |
| `screenshot_element` | Capture specific element by CSS selector (e.g. `header`, `.hero-btn`) |

### Screenshot fallback chain

```
trigger_screenshot / screenshot_element
  ├─ 1. CDP (puppeteer-core) ← primary, 100% reliable
  ├─ 2. WS command → bookmarklet → html2canvas (simple pages)
  └─ 3. Return cached screenshot if available
```

CDP auto-scans ports 9222, 9229, 9333. Set `MCP_BROWSER_LENS_CDP_PORT` for custom port.

---

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_BROWSER_LENS_PORT` | `3202` | HTTP server port |
| `MCP_BROWSER_LENS_WS_PORT` | `3203` | WebSocket server port |
| `MCP_BROWSER_LENS_CDP_PORT` | `9222` | Chrome DevTools Protocol port for screenshots |
| `MCP_BROWSER_LENS_STORE_PATH` | `.store/browser.json` | Custom store path |

**Full config example:**

```json
{
  "mcpServers": {
    "browser-lens": {
      "command": "npx",
      "args": ["-y", "browser-lens-mcp@latest"],
      "env": {
        "MCP_BROWSER_LENS_PORT": "3300",
        "MCP_BROWSER_LENS_WS_PORT": "3301",
        "MCP_BROWSER_LENS_CDP_PORT": "9222"
      }
    }
  }
}

---

## License

MIT — see [LICENSE](LICENSE)

---

<div align="center">
  <sub>Built by <a href="https://github.com/nano-step"><strong>nano-step</strong></a> — Copyright &copy; 2026 Hoai Nho Nguyen</sub>
</div>
