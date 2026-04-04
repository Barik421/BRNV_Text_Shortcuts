const dashboardState = {
  folders: [],
  shortcuts: [],
  settings: null,
  stats: null,
  language: "en",
  currentFolderId: null,
  search: ""
};

function dashboardText(key) {
  return BRNVI18n.t(dashboardState.language, key);
}

function getDashboardLocale() {
  return dashboardState.language === "uk" ? "uk-UA" : "en-US";
}

function formatChartLabel(date, periodKey) {
  const locale = getDashboardLocale();

  if (periodKey === "day") {
    return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(date);
  }

  if (periodKey === "month") {
    return new Intl.DateTimeFormat(locale, { month: "short" }).format(date);
  }

  return String(date.getFullYear());
}

function applyDashboardTheme(isDark) {
  document.documentElement.dataset.theme = isDark ? "dark" : "light";
}

function renderStaticTexts() {
  document.documentElement.lang = dashboardState.language;
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = dashboardText(node.dataset.i18n);
  });

  document.getElementById("statisticsButton").textContent = dashboardText("statistics");
  document.getElementById("settingsButton").textContent = dashboardText("settings");
  document.getElementById("addShortcutButton").textContent = dashboardText("addShortcut");
  document.getElementById("addFolderButton").textContent = dashboardText("addFolder");
  document.getElementById("dashboardSearch").placeholder = dashboardText("dashboardSearch");
  document.querySelector('label[for="dashboardSearch"]').textContent = dashboardText("dashboardSearch");
}

function getVisibleShortcuts() {
  const query = dashboardState.search.trim().toLowerCase();
  let shortcuts = dashboardState.shortcuts;

  if (dashboardState.currentFolderId) {
    shortcuts = shortcuts.filter((item) => item.folderId === dashboardState.currentFolderId);
  }

  if (!query) {
    return shortcuts;
  }

  return shortcuts.filter((shortcut) => {
    const haystack = [shortcut.name, shortcut.trigger, shortcut.content].join("\n").toLowerCase();
    return haystack.includes(query);
  });
}

function createSummaryCard(label, value) {
  const card = document.createElement("article");
  card.className = "summary-card";
  card.innerHTML = `<p class="summary-label"></p><p class="summary-value"></p>`;
  card.querySelector(".summary-label").textContent = label;
  card.querySelector(".summary-value").textContent = value;
  return card;
}

function getChartSeries(periodKey) {
  const stats = dashboardState.stats || {};
  const now = new Date();
  const series = [];

  if (periodKey === "day") {
    for (let index = 6; index >= 0; index -= 1) {
      const date = new Date(now);
      date.setDate(now.getDate() - index);
      const key = date.toISOString().slice(0, 10);
      series.push({
        label: formatChartLabel(date, "day"),
        value: stats.daily?.[key] || 0
      });
    }
    return series;
  }

  if (periodKey === "month") {
    for (let index = 5; index >= 0; index -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      series.push({
        label: formatChartLabel(date, "month"),
        value: stats.monthly?.[key] || 0
      });
    }
    return series;
  }

  for (let index = 4; index >= 0; index -= 1) {
    const date = new Date(now.getFullYear() - index, 0, 1);
    const year = String(date.getFullYear());
    series.push({
      label: formatChartLabel(date, "year"),
      value: stats.yearly?.[year] || 0
    });
  }

  return series;
}

function renderStatsChart(periodKey) {
  const series = getChartSeries(periodKey);
  const maxValue = Math.max(...series.map((item) => item.value), 1);

  return `
    <section class="stats-chart">
      <div class="stats-chart-head">
        <p class="summary-label">${dashboardText("usageTrend")}</p>
      </div>
      <div class="stats-chart-bars">
        ${series.map((item) => `
          <div class="stats-bar-wrap">
            <div class="stats-bar-value">${item.value}</div>
            <div class="stats-bar-track">
              <div class="stats-bar-fill" style="height:${Math.max((item.value / maxValue) * 100, item.value > 0 ? 12 : 6)}%"></div>
            </div>
            <div class="stats-bar-label">${item.label}</div>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function renderSummary() {
  const node = document.getElementById("dashboardSummary");
  const folderCount = dashboardState.folders.length;
  const enabledCount = dashboardState.shortcuts.filter((item) => item.enabled).length;
  const totalUsage = dashboardState.stats?.totalExpansions || 0;

  node.innerHTML = "";
  node.appendChild(createSummaryCard(dashboardText("summaryFolders"), String(folderCount)));
  node.appendChild(createSummaryCard(dashboardText("summaryShortcuts"), String(dashboardState.shortcuts.length)));
  node.appendChild(createSummaryCard(dashboardText("summaryEnabled"), String(enabledCount)));
  node.appendChild(createSummaryCard(dashboardText("summaryUsage"), String(totalUsage)));
}

function renderFolders() {
  const grid = document.getElementById("foldersGrid");
  grid.innerHTML = "";

  dashboardState.folders.forEach((folder) => {
    const count = dashboardState.shortcuts.filter((item) => item.folderId === folder.id).length;
    const card = document.createElement("article");
    card.className = "folder-card";
    card.innerHTML = `
      <div class="folder-card-head">
        <div class="folder-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" class="folder-icon-svg">
            <path d="M3.75 7.75A2.75 2.75 0 0 1 6.5 5h3.059c.73 0 1.42.327 1.885.891l.806.978c.19.23.472.365.77.365H17.5a2.75 2.75 0 0 1 2.75 2.75v5.516a2.75 2.75 0 0 1-2.75 2.75h-11A2.75 2.75 0 0 1 3.75 15.5V7.75Z" fill="currentColor"/>
            <path d="M3.75 10.5h16.5" stroke="white" stroke-width="1.5" stroke-linecap="round" opacity="0.65"/>
          </svg>
        </div>
        <button class="folder-action folder-open" type="button"></button>
      </div>
      <div class="inline-row" style="margin-top: 16px;">
        <div>
          <h3></h3>
          <p class="folder-count"></p>
        </div>
      </div>
      <div class="folder-footer">
        <button class="folder-action folder-rename" type="button"></button>
        <button class="folder-action folder-delete" type="button"></button>
      </div>
    `;

    card.querySelector("h3").textContent = folder.name;
    card.querySelector(".folder-count").textContent = dashboardText("shortcutCountLabel").replace("{count}", count);
    card.querySelector(".folder-open").textContent = dashboardText("openFolder");
    card.querySelector(".folder-rename").textContent = dashboardText("rename");
    card.querySelector(".folder-delete").textContent = dashboardText("delete");

    card.querySelector(".folder-open").addEventListener("click", () => {
      dashboardState.currentFolderId = folder.id;
      openFolderScreen(folder.id);
    });

    card.querySelector(".folder-rename").addEventListener("click", async () => {
      const nextName = await openFolderModal(folder);
      if (!nextName) {
        return;
      }

      await BRNVData.upsertFolder({ ...folder, name: nextName.trim() });
      await refreshDashboard();
    });

    card.querySelector(".folder-delete").addEventListener("click", async () => {
      const isDefaultFolder = folder.id === BRNVData.DEFAULT_FOLDER_ID;
      if (isDefaultFolder) {
        openInfoModal({
          title: dashboardText("cannotDeleteTitle"),
          message: dashboardText("defaultFolderDeleteError")
        });
        return;
      }

      const confirmed = await openConfirmModal({
        title: dashboardText("deleteFolderTitle"),
        message: dashboardText("deleteFolderConfirm"),
        confirmLabel: dashboardText("yes"),
        danger: true
      });
      if (!confirmed) {
        return;
      }

      await BRNVData.deleteFolder(folder.id);
      if (dashboardState.currentFolderId === folder.id) {
        dashboardState.currentFolderId = null;
      }
      await refreshDashboard();
    });

    grid.appendChild(card);
  });
}

function renderShortcuts() {
  const node = document.getElementById("folderScreenShortcutList");
  if (!node) {
    return;
  }
  const shortcuts = getVisibleShortcuts();
  node.innerHTML = "";

  if (!shortcuts.length) {
    const empty = document.createElement("div");
    empty.className = "summary-card";
    empty.innerHTML = `<p class="summary-label">${dashboardText("emptyShortcuts")}</p>`;
    node.appendChild(empty);
    return;
  }

  shortcuts.forEach((shortcut) => {
    const card = document.createElement("article");
    card.className = `shortcut-card ${shortcut.enabled ? "" : "disabled"}`;
    card.innerHTML = `
      <div class="shortcut-head">
        <h3></h3>
        <span class="badge trigger"></span>
      </div>
      <p class="shortcut-preview"></p>
      <div class="inline-row">
        <span class="badge status"></span>
        <span class="shortcut-meta"></span>
      </div>
    `;

    card.querySelector("h3").textContent = shortcut.name;
    card.querySelector(".badge.trigger").textContent = shortcut.trigger;
    card.querySelector(".shortcut-preview").textContent = shortcut.content.replace(/\s+/g, " ").trim().slice(0, 120);
    card.querySelector(".badge.status").textContent = shortcut.enabled ? dashboardText("enabled") : dashboardText("disabled");

    const folder = dashboardState.folders.find((item) => item.id === shortcut.folderId);
    card.querySelector(".shortcut-meta").textContent = folder ? folder.name : dashboardText("generalFolder");
    card.addEventListener("click", () => openShortcutEditor(shortcut.id));
    node.appendChild(card);
  });
}

function renderDashboardSearchResults() {
  const section = document.getElementById("dashboardSearchResultsSection");
  const node = document.getElementById("dashboardSearchResultsList");
  const query = dashboardState.search.trim().toLowerCase();

  if (!query) {
    section.classList.add("hidden");
    node.innerHTML = "";
    return;
  }

  const matches = dashboardState.shortcuts.filter((shortcut) => {
    const haystack = [shortcut.name, shortcut.trigger, shortcut.content].join("\n").toLowerCase();
    return haystack.includes(query);
  });

  section.classList.remove("hidden");
  node.innerHTML = "";

  if (!matches.length) {
    const empty = document.createElement("div");
    empty.className = "summary-card";
    empty.innerHTML = `<p class="summary-label">${dashboardText("emptySearch")}</p>`;
    node.appendChild(empty);
    return;
  }

  matches.forEach((shortcut) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "search-result-item";
    card.innerHTML = `
      <div class="shortcut-head">
        <h3 class="search-result-title"></h3>
        <span class="badge trigger"></span>
      </div>
      <p class="search-result-copy"></p>
      <div class="inline-row">
        <span class="badge status"></span>
        <span class="shortcut-meta"></span>
      </div>
    `;

    card.querySelector(".search-result-title").textContent = shortcut.name;
    card.querySelector(".badge.trigger").textContent = shortcut.trigger;
    card.querySelector(".search-result-copy").textContent = shortcut.content.replace(/\s+/g, " ").trim().slice(0, 120);
    card.querySelector(".badge.status").textContent = shortcut.enabled ? dashboardText("enabled") : dashboardText("disabled");

    const folder = dashboardState.folders.find((item) => item.id === shortcut.folderId);
    card.querySelector(".shortcut-meta").textContent = folder ? folder.name : dashboardText("generalFolder");
    card.addEventListener("click", () => {
      dashboardState.search = "";
      document.getElementById("dashboardSearch").value = "";
      renderDashboardSearchResults();
      dashboardState.currentFolderId = shortcut.folderId;
      openFolderScreen(shortcut.folderId);
      openShortcutEditor(shortcut.id);
    });
    node.appendChild(card);
  });
}

function renderFolderView() {
  return;
}

function closeModal(root) {
  root.classList.add("hidden");
  root.innerHTML = "";
}

function isRootOpen(rootId) {
  const root = document.getElementById(rootId);
  return root && !root.classList.contains("hidden");
}

function closeTopDashboardLayer() {
  if (isRootOpen("modalRoot")) {
    closeModal(document.getElementById("modalRoot"));
    return true;
  }

  if (isRootOpen("statsRoot")) {
    closeModal(document.getElementById("statsRoot"));
    return true;
  }

  if (dashboardState.currentFolderId) {
    closeFolderScreen();
    return true;
  }

  return false;
}

function closeFolderScreen() {
  const root = document.getElementById("folderScreenRoot");
  root.classList.add("hidden");
  root.innerHTML = "";
  dashboardState.currentFolderId = null;
}

async function renameFolder(folder) {
  const nextName = await openFolderModal(folder);
  if (!nextName) {
    return;
  }

  await BRNVData.upsertFolder({ ...folder, name: nextName.trim() });
  await refreshDashboard();
}

function openFolderScreen(folderId) {
  const root = document.getElementById("folderScreenRoot");
  const folder = dashboardState.folders.find((item) => item.id === folderId);
  if (!folder) {
    return;
  }

  dashboardState.currentFolderId = folderId;
  root.innerHTML = `
    <div class="folder-screen-shell">
      <div class="folder-screen-backdrop"></div>
      <section class="folder-screen-panel">
        <header class="folder-screen-header">
          <div>
            <p class="eyebrow">${dashboardText("folderViewEyebrow")}</p>
            <h2 class="folder-screen-title">${folder.name}</h2>
            <p class="folder-screen-subtitle">${dashboardText("folderShortcuts")}</p>
          </div>
          <div class="folder-screen-actions">
            <button id="folderScreenRenameButton" class="mini-button" type="button">${dashboardText("rename")}</button>
            <button id="folderScreenAddShortcutButton" class="mini-button" type="button">${dashboardText("addShortcut")}</button>
            <button id="folderScreenCloseButton" class="ghost-button" type="button">${dashboardText("close")}</button>
          </div>
        </header>
        <section class="folder-screen-meta">
          <span class="badge status">${dashboardText("shortcutCountLabel").replace("{count}", dashboardState.shortcuts.filter((item) => item.folderId === folderId).length)}</span>
        </section>
        <section id="folderScreenShortcutList" class="folder-screen-list shortcut-list"></section>
      </section>
    </div>
  `;
  root.classList.remove("hidden");

  renderShortcuts();

  root.querySelector("#folderScreenRenameButton").addEventListener("click", async () => {
    const latestFolder = dashboardState.folders.find((item) => item.id === folderId);
    if (!latestFolder) {
      return;
    }
    await renameFolder(latestFolder);
  });
  root.querySelector("#folderScreenCloseButton").addEventListener("click", closeFolderScreen);
  root.querySelector(".folder-screen-backdrop").addEventListener("click", closeFolderScreen);
  root.querySelector("#folderScreenAddShortcutButton").addEventListener("click", () => openShortcutEditor());
}

function openInfoModal({ title, message }) {
  const root = document.getElementById("modalRoot");
  root.innerHTML = `
      <div class="modal-panel modal-panel-compact">
      <div class="modal-header">
        <div>
          <h2 class="modal-title">${title}</h2>
        </div>
        <button id="closeInfoButton" class="close-button" type="button">×</button>
      </div>
      <p class="modal-copy">${message}</p>
      <div class="modal-actions modal-actions-end">
        <button id="closeInfoPrimaryButton" class="primary-button" type="button">${dashboardText("ok")}</button>
      </div>
    </div>
  `;
  root.classList.remove("hidden");

  const handleKeydown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  };
  const close = () => {
    document.removeEventListener("keydown", handleKeydown, true);
    closeModal(root);
  };
  root.querySelector("#closeInfoButton").addEventListener("click", close);
  root.querySelector("#closeInfoPrimaryButton").addEventListener("click", close);
  document.addEventListener("keydown", handleKeydown, true);
  root.addEventListener("click", (event) => {
    if (event.target === root) {
      close();
    }
  }, { once: true });
}

function openConfirmModal({ title, message, confirmLabel, danger = false }) {
  return new Promise((resolve) => {
    const root = document.getElementById("modalRoot");
    root.innerHTML = `
      <div class="modal-panel modal-panel-compact">
        <div class="modal-header">
          <div>
            <h2 class="modal-title">${title}</h2>
          </div>
          <button id="closeConfirmButton" class="close-button" type="button">×</button>
        </div>
        <p class="modal-copy">${message}</p>
        <div class="modal-actions modal-actions-end">
          <button id="cancelConfirmButton" class="secondary-button" type="button">${dashboardText("cancel")}</button>
          <button id="approveConfirmButton" class="${danger ? "danger-button" : "primary-button"}" type="button">${confirmLabel}</button>
        </div>
      </div>
    `;
    root.classList.remove("hidden");

    const finish = (value) => {
      document.removeEventListener("keydown", handleKeydown, true);
      closeModal(root);
      resolve(value);
    };

    const handleKeydown = (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        finish(true);
      }
    };

    root.querySelector("#closeConfirmButton").addEventListener("click", () => finish(false));
    root.querySelector("#cancelConfirmButton").addEventListener("click", () => finish(false));
    root.querySelector("#approveConfirmButton").addEventListener("click", () => finish(true));
    document.addEventListener("keydown", handleKeydown, true);
    root.addEventListener("click", (event) => {
      if (event.target === root) {
        finish(false);
      }
    }, { once: true });
  });
}

function openFolderModal(folder = null) {
  return new Promise((resolve) => {
    const root = document.getElementById("modalRoot");
    const isRename = Boolean(folder);
    root.innerHTML = `
      <div class="modal-panel modal-panel-compact">
        <div class="modal-header">
          <div>
            <h2 class="modal-title">${isRename ? dashboardText("renameFolderTitle") : dashboardText("addFolderTitle")}</h2>
          </div>
          <button id="closeFolderModalButton" class="close-button" type="button">×</button>
        </div>
        <form id="folderModalForm" class="editor-form">
          <div class="field-group">
            <label class="field-label" for="folderModalName">${dashboardText("folderName")}</label>
            <input id="folderModalName" class="field-input" type="text" maxlength="60" value="${folder ? BRNVData.escapeHtml(folder.name) : ""}" autocomplete="off">
            <div id="folderModalError" class="error-text"></div>
          </div>
          <div class="modal-actions modal-actions-end">
            <button id="cancelFolderModalButton" class="secondary-button" type="button">${dashboardText("cancel")}</button>
            <button class="primary-button" type="submit">${isRename ? dashboardText("save") : dashboardText("create")}</button>
          </div>
        </form>
      </div>
    `;
    root.classList.remove("hidden");

    const input = root.querySelector("#folderModalName");
    input.focus();
    input.select();

    const finish = (value) => {
      document.removeEventListener("keydown", handleKeydown, true);
      closeModal(root);
      resolve(value);
    };

    const handleKeydown = (event) => {
      if (event.key === "Enter" && event.target !== input) {
        event.preventDefault();
        event.stopPropagation();
        root.querySelector("#folderModalForm").requestSubmit();
      }
    };

    root.querySelector("#closeFolderModalButton").addEventListener("click", () => finish(null));
    root.querySelector("#cancelFolderModalButton").addEventListener("click", () => finish(null));
    document.addEventListener("keydown", handleKeydown, true);
    root.addEventListener("click", (event) => {
      if (event.target === root) {
        finish(null);
      }
    }, { once: true });

    root.querySelector("#folderModalForm").addEventListener("submit", (event) => {
      event.preventDefault();
      const value = input.value.trim();
      if (!value) {
        root.querySelector("#folderModalError").textContent = dashboardText("errorFolderRequired");
        return;
      }
      finish(value);
    });
  });
}

function createSwitch(id, checked) {
  return `
    <label class="switch" for="${id}">
      <input id="${id}" type="checkbox" ${checked ? "checked" : ""}>
      <span class="switch-track"></span>
    </label>
  `;
}

function openShortcutEditor(shortcutId = null) {
  const root = document.getElementById("modalRoot");
  const shortcut = shortcutId ? dashboardState.shortcuts.find((item) => item.id === shortcutId) : null;
  const title = shortcut ? dashboardText("editShortcut") : dashboardText("createShortcut");

  root.innerHTML = `
    <div class="modal-panel">
      <div class="modal-header">
        <div>
          <p class="eyebrow">${dashboardText("editorEyebrow")}</p>
          <h2 class="modal-title">${title}</h2>
        </div>
        <button id="closeEditorButton" class="close-button" type="button">×</button>
      </div>
      <form id="shortcutForm" class="editor-form">
        <div class="field-group">
          <label class="field-label" for="shortcutName">${dashboardText("name")}</label>
          <input id="shortcutName" class="field-input" type="text" maxlength="80" value="${shortcut ? BRNVData.escapeHtml(shortcut.name) : ""}">
          <div id="nameError" class="error-text"></div>
        </div>
        <div class="field-group">
          <label class="field-label" for="shortcutTrigger">${dashboardText("triggerCode")}</label>
          <input id="shortcutTrigger" class="field-input" type="text" maxlength="80" autocapitalize="off" autocomplete="off" spellcheck="false" value="${shortcut ? BRNVData.escapeHtml(shortcut.trigger) : ""}">
          <div class="field-help">${dashboardText("triggerHelp")}</div>
          <div id="triggerError" class="error-text"></div>
        </div>
        <div class="field-group">
          <label class="field-label" for="shortcutFolder">${dashboardText("folder")}</label>
          <select id="shortcutFolder" class="field-select"></select>
        </div>
        <div class="field-group">
          <label class="field-label" for="shortcutContent">${dashboardText("textContent")}</label>
          <textarea id="shortcutContent" class="field-textarea"></textarea>
          <div id="contentError" class="error-text"></div>
        </div>
        <div class="toggle-row">
          <div>
            <div class="field-label">${dashboardText("enabled")}</div>
            <div class="field-help">${dashboardText("enabledHelp")}</div>
          </div>
          ${createSwitch("shortcutEnabled", shortcut ? shortcut.enabled : true)}
        </div>
        <div class="modal-actions">
          <div class="inline-row">
            ${shortcut ? '<button id="duplicateShortcutButton" class="secondary-button" type="button"></button>' : ""}
            ${shortcut ? '<button id="deleteShortcutButton" class="danger-button" type="button"></button>' : ""}
          </div>
          <div class="inline-row">
            <button id="cancelShortcutButton" class="secondary-button" type="button"></button>
            <button class="primary-button" type="submit"></button>
          </div>
        </div>
      </form>
    </div>
  `;

  root.classList.remove("hidden");

  const folderSelect = root.querySelector("#shortcutFolder");
  dashboardState.folders.forEach((folder) => {
    const option = document.createElement("option");
    option.value = folder.id;
    option.textContent = folder.name;
    if (folder.id === (shortcut?.folderId || dashboardState.currentFolderId || BRNVData.DEFAULT_FOLDER_ID)) {
      option.selected = true;
    }
    folderSelect.appendChild(option);
  });

  root.querySelector("#shortcutContent").value = shortcut?.content || "";
  root.querySelector(".primary-button").textContent = dashboardText("save");
  root.querySelector("#cancelShortcutButton").textContent = dashboardText("cancel");

  if (shortcut) {
    root.querySelector("#duplicateShortcutButton").textContent = dashboardText("duplicate");
    root.querySelector("#deleteShortcutButton").textContent = dashboardText("delete");
  }

  function validateForm(values) {
    const errors = { name: "", trigger: "", content: "" };

    if (!values.name.trim()) {
      errors.name = dashboardText("errorNameRequired");
    }

    if (!values.trigger.trim()) {
      errors.trigger = dashboardText("errorTriggerRequired");
    } else {
      const validation = BRNVData.validateTrigger(values.trigger.trim(), dashboardState.shortcuts, shortcut?.id, dashboardState.settings.caseSensitive);
      if (!validation.ok) {
        errors.trigger = dashboardText(validation.errorKey);
      }
    }

    if (!values.content.trim()) {
      errors.content = dashboardText("errorContentRequired");
    }

    root.querySelector("#nameError").textContent = errors.name;
    root.querySelector("#triggerError").textContent = errors.trigger;
    root.querySelector("#contentError").textContent = errors.content;

    return !errors.name && !errors.trigger && !errors.content;
  }

  const closeEditor = () => {
    document.removeEventListener("keydown", handleKeydown, true);
    closeModal(root);
  };
  const handleKeydown = (event) => {
    if (event.key === "Enter" && event.target.tagName !== "TEXTAREA") {
      const activeModal = document.getElementById("modalRoot");
      if (activeModal && !activeModal.classList.contains("hidden")) {
        event.preventDefault();
        event.stopPropagation();
        root.querySelector("#shortcutForm").requestSubmit();
      }
    }
  };

  root.querySelector("#closeEditorButton").addEventListener("click", closeEditor);
  root.querySelector("#cancelShortcutButton").addEventListener("click", closeEditor);
  document.addEventListener("keydown", handleKeydown, true);
  root.addEventListener("click", (event) => {
    if (event.target === root) {
      closeEditor();
    }
  });

  if (shortcut) {
    root.querySelector("#duplicateShortcutButton").addEventListener("click", async () => {
      const duplicate = BRNVData.makeDuplicateShortcut(shortcut, dashboardState.shortcuts, dashboardState.settings.caseSensitive);
      await BRNVData.upsertShortcut(duplicate, dashboardState.settings.caseSensitive);
      closeEditor();
      await refreshDashboard();
      openShortcutEditor(duplicate.id);
    });

    root.querySelector("#deleteShortcutButton").addEventListener("click", async () => {
      const confirmed = await openConfirmModal({
        title: dashboardText("deleteShortcutTitle"),
        message: dashboardText("deleteShortcutConfirm"),
        confirmLabel: dashboardText("delete"),
        danger: true
      });
      if (!confirmed) {
        return;
      }

      await BRNVData.deleteShortcut(shortcut.id);
      closeEditor();
      await refreshDashboard();
    });
  }

  root.querySelector("#shortcutForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    const values = {
      id: shortcut?.id,
      name: root.querySelector("#shortcutName").value,
      trigger: root.querySelector("#shortcutTrigger").value,
      folderId: root.querySelector("#shortcutFolder").value,
      content: root.querySelector("#shortcutContent").value,
      enabled: root.querySelector("#shortcutEnabled").checked
    };

    if (!validateForm(values)) {
      return;
    }

    await BRNVData.upsertShortcut(values, dashboardState.settings.caseSensitive);
    closeEditor();
    await refreshDashboard();
  });
}

function renderStatsModal(period = "day") {
  const root = document.getElementById("statsRoot");
  const periodKey = period.toLowerCase();
  const usageForPeriod = BRNVData.getUsageForPeriod(dashboardState.stats, periodKey);

  root.innerHTML = `
    <div class="modal-panel">
      <div class="modal-header">
        <div>
          <p class="eyebrow">${dashboardText("statistics")}</p>
          <h2 class="stats-title">${dashboardText("statisticsTitle")}</h2>
        </div>
        <button id="closeStatsButton" class="close-button" type="button">×</button>
      </div>
      <div class="stats-top">
        <div class="period-tabs">
          <button class="chip-button ${periodKey === "day" ? "active" : ""}" data-period="day" type="button">${dashboardText("day")}</button>
          <button class="chip-button ${periodKey === "month" ? "active" : ""}" data-period="month" type="button">${dashboardText("month")}</button>
          <button class="chip-button ${periodKey === "year" ? "active" : ""}" data-period="year" type="button">${dashboardText("year")}</button>
        </div>
        <p class="subtle-text">${dashboardText("statisticsSubtitle")}</p>
      </div>
      <div class="stats-grid">
        <article class="stats-card">
          <p>${dashboardText("totalShortcuts")}</p>
          <h3>${dashboardState.shortcuts.length}</h3>
        </article>
        <article class="stats-card">
          <p>${dashboardText("totalUsage")}</p>
          <h3>${dashboardState.stats?.totalExpansions || 0}</h3>
        </article>
        <article class="stats-card">
          <p>${dashboardText("periodUsage")}</p>
          <h3>${usageForPeriod}</h3>
        </article>
      </div>
      ${renderStatsChart(periodKey)}
      <div class="modal-actions modal-actions-end stats-actions">
        <button id="resetStatsInlineButton" class="danger-button" type="button">${dashboardText("resetStatisticsInline")}</button>
      </div>
    </div>
  `;

  root.classList.remove("hidden");
  root.querySelector("#closeStatsButton").addEventListener("click", () => closeModal(root));
  root.querySelector("#resetStatsInlineButton").addEventListener("click", async () => {
    const confirmed = await openConfirmModal({
      title: dashboardText("resetStatistics"),
      message: dashboardText("resetStatisticsConfirm"),
      confirmLabel: dashboardText("yes"),
      danger: true
    });
    if (!confirmed) {
      return;
    }

    await BRNVData.resetStats();
    dashboardState.stats = await BRNVData.getLocalStats();
    renderStatsModal(periodKey);
  });
  root.addEventListener("click", (event) => {
    if (event.target === root) {
      closeModal(root);
    }
  }, { once: true });

  root.querySelectorAll("[data-period]").forEach((button) => {
    button.addEventListener("click", () => renderStatsModal(button.dataset.period));
  });
}

async function refreshDashboard() {
  const syncData = await BRNVData.getSyncData();
  dashboardState.folders = syncData.folders;
  dashboardState.shortcuts = syncData.shortcuts;
  dashboardState.settings = syncData.settings;
  dashboardState.language = syncData.settings.language;
  dashboardState.stats = await BRNVData.getLocalStats();
  applyDashboardTheme(!!syncData.settings.darkTheme);

  renderStaticTexts();
  renderSummary();
  renderFolders();
  renderDashboardSearchResults();

  if (dashboardState.currentFolderId) {
    openFolderScreen(dashboardState.currentFolderId);
  }
}

async function addFolder() {
  const name = await openFolderModal();
  if (!name) {
    return;
  }

  await BRNVData.upsertFolder({ name: name.trim() });
  await refreshDashboard();
}

async function initDashboard() {
  await BRNVData.ensureDefaults();
  await refreshDashboard();

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "sync" && (changes.shortcuts || changes.folders || changes.settings)) {
      refreshDashboard();
    }

    if (areaName === "local" && changes.stats) {
      refreshDashboard();
    }
  });

  document.getElementById("dashboardSearch").addEventListener("input", (event) => {
    dashboardState.search = event.target.value;
    renderDashboardSearchResults();

    if (dashboardState.currentFolderId) {
      renderShortcuts();
    }
  });

  document.getElementById("addShortcutButton").addEventListener("click", () => openShortcutEditor());
  document.getElementById("addFolderButton").addEventListener("click", addFolder);
  document.getElementById("settingsButton").addEventListener("click", () => {
    window.location.href = chrome.runtime.getURL("settings.html");
  });
  document.getElementById("statisticsButton").addEventListener("click", () => renderStatsModal());
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }

    const handled = closeTopDashboardLayer();
    if (handled) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);

  const params = new URLSearchParams(window.location.search);
  const shortcutId = params.get("shortcut");
  if (shortcutId) {
    dashboardState.currentFolderId = dashboardState.shortcuts.find((item) => item.id === shortcutId)?.folderId || null;
    if (dashboardState.currentFolderId) {
      openFolderScreen(dashboardState.currentFolderId);
    }
    openShortcutEditor(shortcutId);
  }
}

document.addEventListener("DOMContentLoaded", initDashboard);
