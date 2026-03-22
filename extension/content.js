(function () {
  if (window.__MCP_BROWSER_LENS_EXT__) return;
  window.__MCP_BROWSER_LENS_EXT__ = true;

  function inject(cfg) {
    if (!cfg.enabled) return;
    var httpPort = cfg.httpPort || 3202;

    fetch("http://localhost:" + httpPort + "/connector.js")
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.text();
      })
      .then(function (code) {
        try {
          new Function(code).call(window);
          console.log("[BrowserLens Extension] Injected on " + location.hostname);
        } catch (e) {
          console.error("[BrowserLens Extension] Inject failed:", e);
        }
      })
      .catch(function () {
        console.log("[BrowserLens Extension] MCP server not running on port " + httpPort);
      });
  }

  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
    chrome.runtime.sendMessage({ type: "getConfig" }, function (cfg) {
      if (chrome.runtime.lastError) {
        inject({ enabled: true, httpPort: 3202, wsPort: 3203 });
        return;
      }
      inject(cfg || { enabled: true, httpPort: 3202, wsPort: 3203 });
    });
  } else {
    inject({ enabled: true, httpPort: 3202, wsPort: 3203 });
  }
})();
