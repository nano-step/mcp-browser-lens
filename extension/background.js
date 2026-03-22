const DEFAULTS = { enabled: true, httpPort: 3202, wsPort: 3203 };

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(DEFAULTS, (cfg) => {
    chrome.storage.local.set(cfg);
  });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "getConfig") {
    chrome.storage.local.get(DEFAULTS, (cfg) => sendResponse(cfg));
    return true;
  }

  if (msg.type === "setConfig") {
    chrome.storage.local.set(msg.config, () => sendResponse({ ok: true }));
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
      console.error("[BrowserLens Extension] scripting.executeScript failed:", e);
      sendResponse({ error: e.message });
    });
    return true;
  }
});
