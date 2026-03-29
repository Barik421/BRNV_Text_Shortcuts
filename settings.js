const settingsState = {
  settings: null,
  language: "en"
};

function settingsText(key) {
  return BRNVI18n.t(settingsState.language, key);
}

function renderSettingsTexts() {
  document.documentElement.lang = settingsState.language;
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = settingsText(node.dataset.i18n);
  });

  document.getElementById("backButton").textContent = settingsText("backToDashboard");
  document.getElementById("exportButton").textContent = settingsText("exportShortcuts");
  document.getElementById("importButton").textContent = settingsText("importShortcuts");
  document.getElementById("resetStatsButton").textContent = settingsText("resetStatistics");
}

async function loadSettings() {
  await BRNVData.ensureDefaults();
  const syncData = await BRNVData.getSyncData();
  settingsState.settings = syncData.settings;
  settingsState.language = syncData.settings.language;

  renderSettingsTexts();
  document.getElementById("languageSelect").value = settingsState.settings.language;
  document.getElementById("caseSensitiveToggle").checked = settingsState.settings.caseSensitive;
  document.getElementById("expansionToggle").checked = settingsState.settings.expansionEnabled;
  document.getElementById("syncInfoText").textContent = settingsText("syncInfoCopy");
}

async function updateSetting(key, value) {
  if (key === "caseSensitive") {
    const syncData = await BRNVData.getSyncData();
    const validation = BRNVData.validateShortcutCollection(syncData.shortcuts, value);

    if (!validation.ok) {
      window.alert(settingsText(validation.errorKey));
      document.getElementById("caseSensitiveToggle").checked = settingsState.settings.caseSensitive;
      return;
    }
  }

  const nextSettings = { ...settingsState.settings, [key]: value };
  await BRNVData.setSettings(nextSettings);
  settingsState.settings = nextSettings;

  if (key === "language") {
    settingsState.language = value;
    renderSettingsTexts();
    document.getElementById("syncInfoText").textContent = settingsText("syncInfoCopy");
  }
}

async function exportData() {
  const payload = await BRNVData.exportData();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "brnv-text-shortcuts-export.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

async function importData(file) {
  const text = await file.text();
  let payload;

  try {
    payload = JSON.parse(text);
  } catch (_error) {
    window.alert(settingsText("importInvalidJson"));
    return;
  }

  try {
    await BRNVData.importData(payload);
    await loadSettings();
    window.alert(settingsText("importSuccess"));
  } catch (error) {
    window.alert(error.message || settingsText("importValidationFailed"));
  }
}

async function resetStatistics() {
  const confirmed = window.confirm(settingsText("resetStatisticsConfirm"));
  if (!confirmed) {
    return;
  }

  await BRNVData.resetStats();
  window.alert(settingsText("resetStatisticsDone"));
}

async function initSettings() {
  await loadSettings();

  document.getElementById("backButton").addEventListener("click", () => {
    window.location.href = chrome.runtime.getURL("dashboard.html");
  });

  document.getElementById("languageSelect").addEventListener("change", (event) => {
    updateSetting("language", event.target.value);
  });

  document.getElementById("caseSensitiveToggle").addEventListener("change", (event) => {
    updateSetting("caseSensitive", event.target.checked);
  });

  document.getElementById("expansionToggle").addEventListener("change", (event) => {
    updateSetting("expansionEnabled", event.target.checked);
  });

  document.getElementById("exportButton").addEventListener("click", exportData);
  document.getElementById("importButton").addEventListener("click", () => {
    document.getElementById("importFileInput").click();
  });
  document.getElementById("importFileInput").addEventListener("change", async (event) => {
    const [file] = event.target.files || [];
    if (file) {
      await importData(file);
      event.target.value = "";
    }
  });
  document.getElementById("resetStatsButton").addEventListener("click", resetStatistics);
}

document.addEventListener("DOMContentLoaded", initSettings);
