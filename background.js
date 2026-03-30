importScripts("shared/data.js");

async function injectContentScriptsIntoTab(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: false },
      files: ["shared/data.js", "content.js"]
    });
  } catch (_error) {
    // Ignore restricted pages and tabs where injection is not allowed.
  }
}

async function refreshExistingTabs() {
  const tabs = await chrome.tabs.query({
    url: ["http://*/*", "https://*/*"]
  });

  await Promise.all(tabs.map((tab) => injectContentScriptsIntoTab(tab.id)));
}

chrome.runtime.onInstalled.addListener(async () => {
  await BRNVData.ensureDefaults();
  await refreshExistingTabs();
});

chrome.runtime.onStartup.addListener(async () => {
  await refreshExistingTabs();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "brnv:ensure-defaults") {
    BRNVData.ensureDefaults().then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message?.type === "brnv:record-expansion") {
    BRNVData.recordUsage(message.shortcutId).then(() => sendResponse({ ok: true }));
    return true;
  }

  return false;
});
