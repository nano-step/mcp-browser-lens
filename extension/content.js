(function () {
  if (window.__MCP_BROWSER_LENS_EXT__) return;
  window.__MCP_BROWSER_LENS_EXT__ = true;

  window.addEventListener("__BROWSER_LENS_CAPTURE__", function () {
    chrome.runtime.sendMessage({ type: "captureScreenshot" });
  });

  chrome.storage.local.get({ enabled: true, httpPort: 3202 }, function (cfg) {
    if (!cfg.enabled) return;
    var port = cfg.httpPort || 3202;

    fetch("http://localhost:" + port + "/connector.js")
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.text();
      })
      .then(function (code) {
        chrome.runtime.sendMessage({
          type: "injectScript",
          code: code,
          port: port
        });
      })
      .catch(function () {
        console.log("[BrowserLens Extension] MCP server not reachable on port " + port);
      });
  });
})();
