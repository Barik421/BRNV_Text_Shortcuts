importScripts("shared/data.js");

chrome.runtime.onInstalled.addListener(async () => {
  await BRNVData.ensureDefaults();
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
