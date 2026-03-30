const popupState = {
  shortcuts: [],
  folders: [],
  settings: null,
  language: "en"
};

function popupText(key) {
  return BRNVI18n.t(popupState.language, key);
}

function popupPreview(text) {
  return text.replace(/\s+/g, " ").trim().slice(0, 92) || "…";
}

function closePopupModal() {
  const root = document.getElementById("popupModalRoot");
  root.classList.add("hidden");
  root.innerHTML = "";
}

function openPopupShortcutPreview(shortcut) {
  const root = document.getElementById("popupModalRoot");
  const folder = popupState.folders.find((item) => item.id === shortcut.folderId);
  root.innerHTML = `
    <div class="popup-modal-panel">
      <div class="popup-modal-header">
        <div>
          <div class="result-head">
            <h2 class="popup-modal-title">${BRNVData.escapeHtml(shortcut.name)}</h2>
            <span class="trigger-pill">${BRNVData.escapeHtml(shortcut.trigger)}</span>
          </div>
          ${folder ? `<p class="popup-modal-meta folder-pill">${BRNVData.escapeHtml(folder.name)}</p>` : ""}
        </div>
        <button id="popupCloseButton" class="popup-close-button" type="button">×</button>
      </div>
      <p class="popup-modal-copy">${BRNVData.escapeHtml(shortcut.content)}</p>
      <div class="popup-modal-actions">
        <button id="popupDismissButton" class="popup-secondary-button" type="button">${popupText("close")}</button>
        <button id="popupOpenDashboardButton" class="popup-primary-button" type="button">${popupText("openDashboard")}</button>
      </div>
    </div>
  `;
  root.classList.remove("hidden");

  const close = () => closePopupModal();
  root.querySelector("#popupCloseButton").addEventListener("click", close);
  root.querySelector("#popupDismissButton").addEventListener("click", close);
  root.querySelector("#popupOpenDashboardButton").addEventListener("click", () => {
    const url = chrome.runtime.getURL(`dashboard.html?shortcut=${encodeURIComponent(shortcut.id)}`);
    chrome.tabs.create({ url });
    window.close();
  });
  root.addEventListener("click", (event) => {
    if (event.target === root) {
      close();
    }
  }, { once: true });
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

    card.addEventListener("click", () => openPopupShortcutPreview(shortcut));

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
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      const root = document.getElementById("popupModalRoot");
      if (!root.classList.contains("hidden")) {
        closePopupModal();
        event.preventDefault();
      }
    }
  }, true);

  renderPopupResults();
}

document.addEventListener("DOMContentLoaded", initPopup);
