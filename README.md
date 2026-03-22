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

## MCP Prompts (5)

| Prompt | Description |
|--------|-------------|
| `compare_with_figma` | Guided Figma comparison workflow |
| `audit_ui` | Comprehensive UI audit |
| `describe_page` | Detailed page description |
| `suggest_fixes` | Prioritized fix list |
| `visual_qa` | Visual QA pass/fail report |

---

## MCP Resources (12)

| URI | Description |
|-----|-------------|
| `dom://snapshot` | Full DOM tree |
| `dom://elements` | Element selectors |
| `dom://mutations` | DOM changes |
| `css://variables` | Custom properties |
| `css://typography` | Font analysis |
| `css://colors` | Color palette |
| `layout://responsive` | Viewport info |
| `layout://spacing` | Spacing analysis |
| `visual://screenshots` | Screenshot metadata |
| `a11y://audit` | Accessibility audit |
| `figma://comparisons` | Comparison results |
| `browser://page` | Page info |

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
- `screenshot` — Capture and send a fresh screenshot
- `query_element` — Inspect any element by CSS selector on-demand
- `fullsync` — Trigger a full data re-capture

This means your AI agent can ask about ANY element, even ones not in the initial auto-capture.

---

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_BROWSER_LENS_PORT` | `3202` | HTTP server port |
| `MCP_BROWSER_LENS_WS_PORT` | `3203` | WebSocket server port |
| `MCP_BROWSER_LENS_STORE_PATH` | `.store/browser.json` | Custom store path |

---

## License

MIT — see [LICENSE](LICENSE)

---

<div align="center">
  <sub>Built by <a href="https://github.com/nano-step"><strong>nano-step</strong></a> — Copyright &copy; 2026 Hoai Nho Nguyen</sub>
</div>
