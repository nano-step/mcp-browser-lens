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
});
