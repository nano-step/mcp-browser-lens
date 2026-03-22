const statusEl = document.getElementById("status");
const switchEl = document.getElementById("switchEl");
const toggleBtn = document.getElementById("toggleBtn");
const httpPortEl = document.getElementById("httpPort");
const wsPortEl = document.getElementById("wsPort");
const saveBtn = document.getElementById("saveBtn");

let config = { enabled: true, httpPort: 3202, wsPort: 3203 };

function updateUI() {
  switchEl.className = "switch " + (config.enabled ? "on" : "");
  httpPortEl.value = config.httpPort;
  wsPortEl.value = config.wsPort;
  checkStatus();
}

function checkStatus() {
  fetch("http://localhost:" + config.httpPort + "/health")
    .then((r) => r.json())
    .then((d) => {
      const connected = d.hasDom || d.elements > 0;
      statusEl.className = "status " + (connected ? "on" : "off");
      statusEl.innerHTML =
        '<span class="dot ' + (connected ? "on" : "off") + '"></span>' +
        (connected
          ? "Connected — " + d.elements + " elements"
          : "Server running, no browser data yet");
    })
    .catch(() => {
      statusEl.className = "status off";
      statusEl.innerHTML = '<span class="dot off"></span>MCP server not running on port ' + config.httpPort;
    });
}

toggleBtn.addEventListener("click", () => {
  config.enabled = !config.enabled;
  chrome.runtime.sendMessage({ type: "setConfig", config }, updateUI);
});

saveBtn.addEventListener("click", () => {
  config.httpPort = parseInt(httpPortEl.value) || 3202;
  config.wsPort = parseInt(wsPortEl.value) || 3203;
  chrome.runtime.sendMessage({ type: "setConfig", config }, () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) chrome.tabs.reload(tabs[0].id);
    });
    updateUI();
  });
});

chrome.runtime.sendMessage({ type: "getConfig" }, (cfg) => {
  if (cfg) config = cfg;
  updateUI();
});
