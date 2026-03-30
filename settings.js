const settingsState = {
  settings: null,
  language: "en"
};

function settingsText(key) {
  return BRNVI18n.t(settingsState.language, key);
}

function closeSettingsModal() {
  const root = document.getElementById("settingsModalRoot");
  root.classList.add("hidden");
  root.innerHTML = "";
}

function openSettingsInfoModal({ title, message, actionLabel }) {
  return new Promise((resolve) => {
    const root = document.getElementById("settingsModalRoot");
    root.innerHTML = `
      <div class="modal-panel">
        <div class="modal-header">
          <h2 class="modal-title">${title}</h2>
          <button id="closeSettingsInfoButton" class="close-button" type="button">×</button>
        </div>
        <p class="modal-copy">${message}</p>
        <div class="modal-actions">
          <button id="confirmSettingsInfoButton" class="primary-button" type="button">${actionLabel || settingsText("ok")}</button>
        </div>
      </div>
    `;
    root.classList.remove("hidden");

    const finish = () => {
      closeSettingsModal();
      resolve();
    };

    root.querySelector("#closeSettingsInfoButton").addEventListener("click", finish);
    root.querySelector("#confirmSettingsInfoButton").addEventListener("click", finish);
    root.addEventListener("click", (event) => {
      if (event.target === root) {
        finish();
      }
    }, { once: true });
  });
}

function openSettingsConfirmModal({ title, message, confirmLabel }) {
  return new Promise((resolve) => {
    const root = document.getElementById("settingsModalRoot");
    root.innerHTML = `
      <div class="modal-panel">
        <div class="modal-header">
          <h2 class="modal-title">${title}</h2>
          <button id="closeSettingsConfirmButton" class="close-button" type="button">×</button>
        </div>
        <p class="modal-copy">${message}</p>
        <div class="modal-actions">
          <button id="cancelSettingsConfirmButton" class="secondary-button" type="button">${settingsText("cancel")}</button>
          <button id="approveSettingsConfirmButton" class="danger-button" type="button">${confirmLabel || settingsText("yes")}</button>
        </div>
      </div>
    `;
    root.classList.remove("hidden");

    const finish = (value) => {
      closeSettingsModal();
      resolve(value);
    };

    root.querySelector("#closeSettingsConfirmButton").addEventListener("click", () => finish(false));
    root.querySelector("#cancelSettingsConfirmButton").addEventListener("click", () => finish(false));
    root.querySelector("#approveSettingsConfirmButton").addEventListener("click", () => finish(true));
    root.addEventListener("click", (event) => {
      if (event.target === root) {
        finish(false);
      }
    }, { once: true });
  });
}

function renderSettingsTexts() {
  document.documentElement.lang = settingsState.language;
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = settingsText(node.dataset.i18n);
  });

  document.getElementById("backButton").textContent = settingsText("backToDashboard");
  document.getElementById("exportButton").textContent = settingsText("exportShortcuts");
  document.getElementById("importButton").textContent = settingsText("importShortcuts");
  document.getElementById("disableAllShortcutsButton").textContent = settingsText("disableAllShortcuts");
  document.getElementById("resetStatsButton").textContent = settingsText("resetStatistics");
  document.getElementById("supportToggleButton").textContent = settingsText("supportButton");
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
      await openSettingsInfoModal({
        title: settingsText("settings"),
        message: settingsText(validation.errorKey)
      });
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
    await openSettingsInfoModal({
      title: settingsText("importShortcuts"),
      message: settingsText("importInvalidJson")
    });
    return;
  }

  try {
    await BRNVData.importData(payload);
    await loadSettings();
    await openSettingsInfoModal({
      title: settingsText("importShortcuts"),
      message: settingsText("importSuccess")
    });
  } catch (error) {
    await openSettingsInfoModal({
      title: settingsText("importShortcuts"),
      message: error.message || settingsText("importValidationFailed")
    });
  }
}

async function resetStatistics() {
  const confirmed = await openSettingsConfirmModal({
    title: settingsText("resetStatistics"),
    message: settingsText("resetStatisticsConfirm"),
    confirmLabel: settingsText("yes")
  });
  if (!confirmed) {
    return;
  }

  await BRNVData.resetStats();
  await openSettingsInfoModal({
    title: settingsText("resetStatistics"),
    message: settingsText("resetStatisticsDone")
  });
}

async function disableAllShortcutsAction() {
  const confirmed = await openSettingsConfirmModal({
    title: settingsText("disableAllShortcuts"),
    message: settingsText("disableAllShortcutsConfirm"),
    confirmLabel: settingsText("yes")
  });
  if (!confirmed) {
    return;
  }

  await BRNVData.disableAllShortcuts();
  await openSettingsInfoModal({
    title: settingsText("disableAllShortcuts"),
    message: settingsText("disableAllShortcutsDone")
  });
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
  document.getElementById("disableAllShortcutsButton").addEventListener("click", disableAllShortcutsAction);
  document.getElementById("resetStatsButton").addEventListener("click", resetStatistics);
  document.getElementById("supportToggleButton").addEventListener("click", () => {
    document.getElementById("supportWalletPanel").classList.toggle("hidden");
  });
  document.getElementById("copyWalletButton").addEventListener("click", async () => {
    await navigator.clipboard.writeText("TKQF5fJQ6VLZJka7xZyYKCUScWWJphm6tW");
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      const root = document.getElementById("settingsModalRoot");
      if (!root.classList.contains("hidden")) {
        closeSettingsModal();
        event.preventDefault();
        event.stopPropagation();
      }
    }
  }, true);
}

document.addEventListener("DOMContentLoaded", initSettings);
