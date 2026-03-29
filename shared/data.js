const BRNVData = (() => {
  const DEFAULT_FOLDER_ID = "folder-general";
  const SYNC_KEYS = ["folders", "shortcuts", "settings"];
  const LOCAL_STATS_KEY = "stats";

  const defaults = {
    folders: [
      {
        id: DEFAULT_FOLDER_ID,
        name: "General",
        createdAt: Date.now()
      }
    ],
    shortcuts: [],
    settings: {
      language: "en",
      caseSensitive: true,
      expansionEnabled: true
    }
  };

  function storageGet(area, keys) {
    return new Promise((resolve) => chrome.storage[area].get(keys, resolve));
  }

  function storageSet(area, values) {
    return new Promise((resolve) => chrome.storage[area].set(values, resolve));
  }

  function storageRemove(area, keys) {
    return new Promise((resolve) => chrome.storage[area].remove(keys, resolve));
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function makeId(prefix) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function normalizeTrigger(trigger, caseSensitive) {
    return caseSensitive ? trigger : trigger.toLowerCase();
  }

  async function ensureDefaults() {
    const current = await storageGet("sync", SYNC_KEYS);
    const next = {};
    let changed = false;

    SYNC_KEYS.forEach((key) => {
      if (!Array.isArray(defaults[key]) && typeof defaults[key] !== "object") {
        return;
      }

      if (current[key] === undefined) {
        next[key] = clone(defaults[key]);
        changed = true;
      }
    });

    if (Array.isArray(current.folders) && !current.folders.some((folder) => folder.id === DEFAULT_FOLDER_ID)) {
      next.folders = [...current.folders, clone(defaults.folders[0])];
      changed = true;
    }

    if (changed) {
      await storageSet("sync", next);
    }

    const local = await storageGet("local", [LOCAL_STATS_KEY]);
    if (!local[LOCAL_STATS_KEY]) {
      await storageSet("local", {
        [LOCAL_STATS_KEY]: {
          totalExpansions: 0,
          daily: {},
          monthly: {},
          yearly: {}
        }
      });
    }
  }

  async function getSyncData() {
    await ensureDefaults();
    const data = await storageGet("sync", SYNC_KEYS);
    return {
      folders: data.folders || clone(defaults.folders),
      shortcuts: data.shortcuts || [],
      settings: { ...defaults.settings, ...(data.settings || {}) }
    };
  }

  async function getLocalStats() {
    await ensureDefaults();
    const data = await storageGet("local", [LOCAL_STATS_KEY]);
    return data[LOCAL_STATS_KEY];
  }

  async function setSyncData(payload) {
    await storageSet("sync", payload);
  }

  async function setSettings(settings) {
    const data = await getSyncData();
    await setSyncData({
      ...data,
      settings: { ...defaults.settings, ...settings }
    });
  }

  function validateTrigger(trigger, shortcuts, excludeId, caseSensitive) {
    const normalized = normalizeTrigger(trigger, caseSensitive);
    const otherShortcuts = shortcuts.filter((item) => item.id !== excludeId);

    for (const shortcut of otherShortcuts) {
      const existing = normalizeTrigger(shortcut.trigger, caseSensitive);

      if (existing === normalized) {
        return { ok: false, errorKey: "errorTriggerDuplicate" };
      }

      if (existing.startsWith(normalized) || normalized.startsWith(existing)) {
        return { ok: false, errorKey: "errorTriggerPrefix" };
      }
    }

    return { ok: true };
  }

  function validateShortcutCollection(shortcuts, caseSensitive) {
    for (const shortcut of shortcuts) {
      const validation = validateTrigger(shortcut.trigger, shortcuts, shortcut.id, caseSensitive);
      if (!validation.ok) {
        return validation;
      }
    }

    return { ok: true };
  }

  async function upsertFolder(folder) {
    const data = await getSyncData();
    const name = (folder.name || "").trim();
    if (!name) {
      throw new Error("Folder name is required.");
    }

    const nextFolder = {
      id: folder.id || makeId("folder"),
      name,
      createdAt: folder.createdAt || Date.now()
    };

    const nextFolders = data.folders.some((item) => item.id === nextFolder.id)
      ? data.folders.map((item) => (item.id === nextFolder.id ? nextFolder : item))
      : [...data.folders, nextFolder];

    await setSyncData({ ...data, folders: nextFolders });
    return nextFolder;
  }

  async function deleteFolder(folderId) {
    if (folderId === DEFAULT_FOLDER_ID) {
      throw new Error("Default folder cannot be deleted.");
    }

    const data = await getSyncData();
    const nextFolders = data.folders.filter((item) => item.id !== folderId);
    const nextShortcuts = data.shortcuts.map((shortcut) => (
      shortcut.folderId === folderId ? { ...shortcut, folderId: DEFAULT_FOLDER_ID } : shortcut
    ));
    await setSyncData({ ...data, folders: nextFolders, shortcuts: nextShortcuts });
  }

  async function upsertShortcut(shortcut, caseSensitive) {
    const data = await getSyncData();
    const cleanShortcut = {
      id: shortcut.id || makeId("shortcut"),
      name: (shortcut.name || "").trim(),
      trigger: (shortcut.trigger || "").trim(),
      content: shortcut.content || "",
      folderId: shortcut.folderId || DEFAULT_FOLDER_ID,
      enabled: shortcut.enabled !== false,
      createdAt: shortcut.createdAt || nowIso(),
      updatedAt: nowIso()
    };

    if (!cleanShortcut.name) {
      throw new Error("Name is required.");
    }
    if (!cleanShortcut.trigger) {
      throw new Error("Trigger is required.");
    }
    if (!cleanShortcut.content.trim()) {
      throw new Error("Content is required.");
    }

    const validation = validateTrigger(cleanShortcut.trigger, data.shortcuts, shortcut.id, caseSensitive);
    if (!validation.ok) {
      throw new Error(validation.errorKey);
    }

    const nextShortcuts = data.shortcuts.some((item) => item.id === cleanShortcut.id)
      ? data.shortcuts.map((item) => (item.id === cleanShortcut.id ? { ...item, ...cleanShortcut } : item))
      : [...data.shortcuts, cleanShortcut];

    await setSyncData({ ...data, shortcuts: nextShortcuts });
    return cleanShortcut;
  }

  async function deleteShortcut(shortcutId) {
    const data = await getSyncData();
    await setSyncData({
      ...data,
      shortcuts: data.shortcuts.filter((item) => item.id !== shortcutId)
    });
  }

  function makeDuplicateShortcut(shortcut, shortcuts, caseSensitive) {
    let copyIndex = 2;
    let trigger = `${shortcut.trigger}_copy`;
    let name = `${shortcut.name} Copy`;

    while (!validateTrigger(trigger, shortcuts, null, caseSensitive).ok) {
      trigger = `${shortcut.trigger}_copy${copyIndex}`;
      name = `${shortcut.name} Copy ${copyIndex}`;
      copyIndex += 1;
    }

    return {
      ...shortcut,
      id: makeId("shortcut"),
      name,
      trigger,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
  }

  async function recordUsage(shortcutId) {
    const stats = await getLocalStats();
    const now = new Date();
    const dayKey = now.toISOString().slice(0, 10);
    const monthKey = dayKey.slice(0, 7);
    const yearKey = dayKey.slice(0, 4);
    const next = clone(stats);

    next.totalExpansions += 1;
    next.daily[dayKey] = (next.daily[dayKey] || 0) + 1;
    next.monthly[monthKey] = (next.monthly[monthKey] || 0) + 1;
    next.yearly[yearKey] = (next.yearly[yearKey] || 0) + 1;

    if (shortcutId) {
      next.byShortcut = next.byShortcut || {};
      next.byShortcut[shortcutId] = (next.byShortcut[shortcutId] || 0) + 1;
    }

    await storageSet("local", { [LOCAL_STATS_KEY]: next });
    return next;
  }

  function getUsageForPeriod(stats, period) {
    if (!stats) {
      return 0;
    }

    const now = new Date().toISOString().slice(0, 10);
    if (period === "day") {
      return stats.daily?.[now] || 0;
    }
    if (period === "month") {
      return stats.monthly?.[now.slice(0, 7)] || 0;
    }
    return stats.yearly?.[now.slice(0, 4)] || 0;
  }

  async function exportData() {
    const data = await getSyncData();
    return {
      version: 1,
      exportedAt: nowIso(),
      folders: data.folders,
      shortcuts: data.shortcuts,
      settings: data.settings
    };
  }

  async function importData(payload) {
    if (!payload || typeof payload !== "object") {
      throw new Error("Invalid payload.");
    }

    const folders = Array.isArray(payload.folders) ? payload.folders : [];
    const shortcuts = Array.isArray(payload.shortcuts) ? payload.shortcuts : [];
    const settings = { ...defaults.settings, ...(payload.settings || {}) };

    const mergedFolders = folders.length ? folders : clone(defaults.folders);
    if (!mergedFolders.some((folder) => folder.id === DEFAULT_FOLDER_ID)) {
      mergedFolders.unshift(clone(defaults.folders[0]));
    }

    const seen = new Set();
    shortcuts.forEach((shortcut) => {
      if (!shortcut.name || !shortcut.trigger || !shortcut.content) {
        throw new Error("Shortcut is missing required fields.");
      }
      const key = normalizeTrigger(shortcut.trigger, settings.caseSensitive);
      if (seen.has(key)) {
        throw new Error("Duplicate triggers found in import.");
      }
      seen.add(key);
    });

    const collectionValidation = validateShortcutCollection(shortcuts, settings.caseSensitive);
    if (!collectionValidation.ok) {
      throw new Error("Trigger validation failed.");
    }

    await setSyncData({
      folders: mergedFolders,
      shortcuts: shortcuts.map((shortcut) => ({
        id: shortcut.id || makeId("shortcut"),
        name: String(shortcut.name).trim(),
        trigger: String(shortcut.trigger).trim(),
        folderId: mergedFolders.some((folder) => folder.id === shortcut.folderId) ? shortcut.folderId : DEFAULT_FOLDER_ID,
        content: String(shortcut.content),
        enabled: shortcut.enabled !== false,
        createdAt: shortcut.createdAt || nowIso(),
        updatedAt: nowIso()
      })),
      settings
    });
  }

  async function resetStats() {
    await storageRemove("local", [LOCAL_STATS_KEY]);
    await ensureDefaults();
  }

  return {
    DEFAULT_FOLDER_ID,
    escapeHtml,
    ensureDefaults,
    exportData,
    getLocalStats,
    getSyncData,
    getUsageForPeriod,
    importData,
    makeDuplicateShortcut,
    recordUsage,
    resetStats,
    setSettings,
    upsertFolder,
    upsertShortcut,
    deleteFolder,
    deleteShortcut,
    validateShortcutCollection,
    validateTrigger
  };
})();
