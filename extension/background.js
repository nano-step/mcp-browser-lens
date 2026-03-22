const DEFAULTS = { enabled: true, httpPort: 3202, wsPort: 3203 };

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(DEFAULTS, (cfg) => {
    chrome.storage.local.set(cfg);
  });
});

function captureAndSend(tabId, httpPort) {
  chrome.tabs.captureVisibleTab(null, { format: "png" }, (dataUrl) => {
    if (chrome.runtime.lastError || !dataUrl) {
      console.error("[BrowserLens] captureVisibleTab failed:", chrome.runtime.lastError);
      return;
    }
    const payload = JSON.stringify({
      timestamp: Date.now(),
      screenshots: [{
        timestamp: Date.now(),
        type: "viewport",
        width: 0,
        height: 0,
        dataUrl: dataUrl,
        format: "png"
      }]
    });
    fetch("http://localhost:" + httpPort + "/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload
    }).then((r) => {
      if (r.ok) console.log("[BrowserLens] Screenshot sent to MCP server");
    }).catch((e) => {
      console.error("[BrowserLens] Failed to send screenshot:", e);
    });
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "getConfig") {
    chrome.storage.local.get(DEFAULTS, (cfg) => sendResponse(cfg));
    return true;
  }

  if (msg.type === "setConfig") {
    chrome.storage.local.set(msg.config, () => sendResponse({ ok: true }));
    return true;
  }

  if (msg.type === "captureScreenshot" && sender.tab) {
    chrome.storage.local.get(DEFAULTS, (cfg) => {
      captureAndSend(sender.tab.id, cfg.httpPort || 3202);
      sendResponse({ ok: true });
    });
    return true;
  }

  if (msg.type === "injectScript" && sender.tab) {
    chrome.scripting.executeScript({
      target: { tabId: sender.tab.id },
      world: "MAIN",
      func: (code) => {
        if (window.__MCP_BROWSER_LENS__) return;
        try {
          new Function(code).call(window);
        } catch (e) {
          console.error("[BrowserLens Extension] Inject error:", e);
        }
      },
      args: [msg.code]
    }).then(() => {
      sendResponse({ ok: true });
    }).catch((e) => {
      console.error("[BrowserLens Extension] executeScript failed:", e);
      sendResponse({ error: e.message });
    });
    return true;
  }
});
