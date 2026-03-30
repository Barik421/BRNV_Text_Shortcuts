const popupState = {
  shortcuts: [],
  folders: [],
  settings: null,
  language: "en",
  selectedShortcutId: null
};

function popupText(key) {
  return BRNVI18n.t(popupState.language, key);
}

function popupPreview(text) {
  return text.replace(/\s+/g, " ").trim().slice(0, 92) || "…";
}

function getPopupSelectedShortcut() {
  return popupState.shortcuts.find((shortcut) => shortcut.id === popupState.selectedShortcutId) || null;
}

function showPopupListView() {
  popupState.selectedShortcutId = null;
  document.getElementById("popupListView").classList.remove("hidden");
  document.getElementById("popupEditorView").classList.add("hidden");
}

function showPopupEditorView(shortcutId) {
  popupState.selectedShortcutId = shortcutId;
  document.getElementById("popupListView").classList.add("hidden");
  document.getElementById("popupEditorView").classList.remove("hidden");
  renderPopupEditor();
}

function renderPopupEditor() {
  const shortcut = getPopupSelectedShortcut();
  if (!shortcut) {
    showPopupListView();
    return;
  }

  document.getElementById("popupBackButton").textContent = popupText("back");
  document.getElementById("popupEditorSettingsButton").textContent = popupText("settings");
  document.getElementById("popupEditorEyebrow").textContent = popupText("editorEyebrow");
  document.getElementById("popupEditorTitle").textContent = shortcut.name;

  document.querySelector('label[for="popupShortcutName"]').textContent = popupText("name");
  document.querySelector('label[for="popupShortcutTrigger"]').textContent = popupText("triggerCode");
  document.querySelector('label[for="popupShortcutFolder"]').textContent = popupText("folder");
  document.querySelector('label[for="popupShortcutContent"]').textContent = popupText("textContent");
  document.querySelector(".popup-field-help").textContent = popupText("triggerHelp");
  document.getElementById("popupEnabledLabel").textContent = popupText("enabled");
  document.getElementById("popupEnabledHelp").textContent = popupText("enabledHelp");
  document.getElementById("popupDeleteButton").textContent = popupText("delete");
  document.getElementById("popupCancelButton").textContent = popupText("cancel");
  document.getElementById("popupSaveButton").textContent = popupText("save");

  document.getElementById("popupShortcutName").value = shortcut.name;
  document.getElementById("popupShortcutTrigger").value = shortcut.trigger;
  document.getElementById("popupShortcutContent").value = shortcut.content;
  document.getElementById("popupShortcutEnabled").checked = shortcut.enabled;
  document.getElementById("popupNameError").textContent = "";
  document.getElementById("popupTriggerError").textContent = "";
  document.getElementById("popupContentError").textContent = "";

  const folderSelect = document.getElementById("popupShortcutFolder");
  folderSelect.innerHTML = "";
  popupState.folders.forEach((folder) => {
    const option = document.createElement("option");
    option.value = folder.id;
    option.textContent = folder.name;
    option.selected = folder.id === shortcut.folderId;
    folderSelect.appendChild(option);
  });
}

function validatePopupShortcutForm(values) {
  const errors = { name: "", trigger: "", content: "" };
  if (!values.name.trim()) {
    errors.name = popupText("errorNameRequired");
  }

  if (!values.trigger.trim()) {
    errors.trigger = popupText("errorTriggerRequired");
  } else {
    const validation = BRNVData.validateTrigger(values.trigger.trim(), popupState.shortcuts, values.id, popupState.settings.caseSensitive);
    if (!validation.ok) {
      errors.trigger = popupText(validation.errorKey);
    }
  }

  if (!values.content.trim()) {
    errors.content = popupText("errorContentRequired");
  }

  document.getElementById("popupNameError").textContent = errors.name;
  document.getElementById("popupTriggerError").textContent = errors.trigger;
  document.getElementById("popupContentError").textContent = errors.content;

  return !errors.name && !errors.trigger && !errors.content;
}

function popupFilterShortcuts(query) {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return popupState.shortcuts;
  }

  return popupState.shortcuts.filter((shortcut) => {
    const haystack = [
      shortcut.name,
      shortcut.trigger,
      shortcut.content
    ].join("\n").toLowerCase();

    return haystack.includes(normalized);
  });
}

function renderPopupResults() {
  const resultsNode = document.getElementById("popupResults");
  const emptyNode = document.getElementById("popupEmptyState");
  const query = document.getElementById("popupSearch").value;
  const results = popupFilterShortcuts(query);

  resultsNode.innerHTML = "";

  if (!results.length) {
    emptyNode.classList.remove("hidden");
    emptyNode.textContent = query ? popupText("emptySearch") : popupText("emptyShortcuts");
    return;
  }

  emptyNode.classList.add("hidden");

  results.forEach((shortcut) => {
    const folder = popupState.folders.find((item) => item.id === shortcut.folderId);
    const card = document.createElement("button");
    card.type = "button";
    card.className = "result-card";
    card.innerHTML = `
      <div class="result-head">
        <h3 class="result-name"></h3>
        <span class="trigger-pill"></span>
      </div>
      <p class="result-preview"></p>
      ${folder ? '<div class="folder-pill"></div>' : ""}
    `;

    card.querySelector(".result-name").textContent = shortcut.name;
    card.querySelector(".trigger-pill").textContent = shortcut.trigger;
    card.querySelector(".result-preview").textContent = popupPreview(shortcut.content);

    if (folder) {
      card.querySelector(".folder-pill").textContent = folder.name;
    }

    card.addEventListener("click", () => showPopupEditorView(shortcut.id));

    resultsNode.appendChild(card);
  });
}

async function initPopup() {
  await BRNVData.ensureDefaults();
  const syncData = await BRNVData.getSyncData();
  popupState.shortcuts = syncData.shortcuts;
  popupState.folders = syncData.folders;
  popupState.settings = syncData.settings;
  popupState.language = syncData.settings.language;

  document.documentElement.lang = popupState.language;
  document.getElementById("openDashboardButton").textContent = popupText("openDashboard");
  document.getElementById("openSettingsButton").textContent = popupText("settings");
  document.getElementById("popupSearch").placeholder = popupText("searchPlaceholder");
  document.querySelector('label[for="popupSearch"]').textContent = popupText("searchPlaceholder");

  document.getElementById("openDashboardButton").addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
    window.close();
  });

  document.getElementById("openSettingsButton").addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("settings.html") });
    window.close();
  });

  document.getElementById("popupSearch").addEventListener("input", renderPopupResults);
  document.getElementById("popupBackButton").addEventListener("click", showPopupListView);
  document.getElementById("popupEditorSettingsButton").addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("settings.html") });
    window.close();
  });
  document.getElementById("popupCancelButton").addEventListener("click", showPopupListView);
  document.getElementById("popupDeleteButton").addEventListener("click", async () => {
    const shortcut = getPopupSelectedShortcut();
    if (!shortcut) {
      return;
    }
    await BRNVData.deleteShortcut(shortcut.id);
    const syncData = await BRNVData.getSyncData();
    popupState.shortcuts = syncData.shortcuts;
    popupState.folders = syncData.folders;
    renderPopupResults();
    showPopupListView();
  });
  document.getElementById("popupShortcutForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const shortcut = getPopupSelectedShortcut();
    if (!shortcut) {
      return;
    }

    const values = {
      id: shortcut.id,
      name: document.getElementById("popupShortcutName").value,
      trigger: document.getElementById("popupShortcutTrigger").value,
      folderId: document.getElementById("popupShortcutFolder").value,
      content: document.getElementById("popupShortcutContent").value,
      enabled: document.getElementById("popupShortcutEnabled").checked
    };

    if (!validatePopupShortcutForm(values)) {
      return;
    }

    await BRNVData.upsertShortcut(values, popupState.settings.caseSensitive);
    const syncData = await BRNVData.getSyncData();
    popupState.shortcuts = syncData.shortcuts;
    popupState.folders = syncData.folders;
    renderPopupResults();
    showPopupEditorView(values.id);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !document.getElementById("popupEditorView").classList.contains("hidden")) {
      showPopupListView();
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);

  renderPopupResults();
}

document.addEventListener("DOMContentLoaded", initPopup);
