(async () => {
  await BRNVData.ensureDefaults();

  const runtimeState = {
    settings: null,
    shortcuts: [],
    lastReplacement: {
      timestamp: 0,
      target: null,
      text: ""
    }
  };

  const CONTENTEDITABLE_SELECTOR = "[contenteditable]:not([contenteditable='false'])";

  function getEditableRoot(target) {
    if (!target) {
      return null;
    }

    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      return target;
    }

    if (target.nodeType === Node.TEXT_NODE) {
      return target.parentElement?.closest?.(CONTENTEDITABLE_SELECTOR) || null;
    }

    if (target instanceof Element) {
      return target.closest(CONTENTEDITABLE_SELECTOR);
    }

    return null;
  }

  function isTextControl(target) {
    if (!target || target.readOnly || target.disabled) {
      return false;
    }

    if (target instanceof HTMLTextAreaElement) {
      return true;
    }

    if (target instanceof HTMLInputElement) {
      const supportedTypes = new Set(["text", "search", "email", "url", "tel", "password"]);
      return supportedTypes.has(target.type);
    }

    return target.isContentEditable;
  }

  async function loadRuntimeState() {
    const syncData = await BRNVData.getSyncData();
    runtimeState.settings = syncData.settings;
    runtimeState.shortcuts = syncData.shortcuts.filter((item) => item.enabled);
  }

  function getMatches(textBeforeCaret) {
    if (!textBeforeCaret || !runtimeState.settings.expansionEnabled) {
      return null;
    }

    const caseSensitive = runtimeState.settings.caseSensitive;
    const normalizedBefore = caseSensitive ? textBeforeCaret : textBeforeCaret.toLowerCase();

    for (const shortcut of runtimeState.shortcuts) {
      const trigger = caseSensitive ? shortcut.trigger : shortcut.trigger.toLowerCase();
      if (normalizedBefore.endsWith(trigger)) {
        return shortcut;
      }
    }

    return null;
  }

  function shouldSkipLoop(target, replacementText) {
    const tooSoon = Date.now() - runtimeState.lastReplacement.timestamp < 30;
    return tooSoon && runtimeState.lastReplacement.target === target && runtimeState.lastReplacement.text === replacementText;
  }

  function markReplacement(target, replacementText) {
    runtimeState.lastReplacement = {
      timestamp: Date.now(),
      target,
      text: replacementText
    };
  }

  async function recordExpansion(shortcutId) {
    try {
      await chrome.runtime.sendMessage({ type: "brnv:record-expansion", shortcutId });
    } catch (_error) {
      await BRNVData.recordUsage(shortcutId);
    }
  }

  function setNativeInputValue(target, value) {
    const prototype = target instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
    descriptor?.set?.call(target, value);
  }

  function replaceInInput(target, shortcut) {
    const caret = target.selectionStart;
    if (caret == null) {
      return false;
    }

    const before = target.value.slice(0, caret);
    const after = target.value.slice(target.selectionEnd);
    const replacementStart = caret - shortcut.trigger.length;
    const nextValue = `${before.slice(0, replacementStart)}${shortcut.content}${after}`;

    if (shouldSkipLoop(target, shortcut.content)) {
      return false;
    }

    setNativeInputValue(target, nextValue);
    const nextCaret = replacementStart + shortcut.content.length;
    target.setSelectionRange(nextCaret, nextCaret);
    target.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: shortcut.content }));
    markReplacement(target, shortcut.content);
    recordExpansion(shortcut.id);
    return true;
  }

  function getContentEditableTextBeforeCaret(root) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) {
      return null;
    }

    const range = selection.getRangeAt(0);
    if (!root.contains(range.endContainer)) {
      return null;
    }

    const probe = range.cloneRange();
    probe.selectNodeContents(root);
    probe.setEnd(range.endContainer, range.endOffset);
    return probe.toString();
  }

  function locateOffset(root, offset) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let currentOffset = offset;
    let node = walker.nextNode();

    while (node) {
      const length = node.textContent.length;
      if (currentOffset <= length) {
        return { node, offset: currentOffset };
      }
      currentOffset -= length;
      node = walker.nextNode();
    }

    return { node: root, offset: root.childNodes.length };
  }

  function replaceInContentEditable(target, shortcut, beforeText) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) {
      return false;
    }

    const endRange = selection.getRangeAt(0);
    const startOffset = beforeText.length - shortcut.trigger.length;
    if (startOffset < 0) {
      return false;
    }

    const startPoint = locateOffset(target, startOffset);
    const replaceRange = document.createRange();

    try {
      replaceRange.setStart(startPoint.node, startPoint.offset);
      replaceRange.setEnd(endRange.endContainer, endRange.endOffset);
    } catch (_error) {
      return false;
    }

    if (shouldSkipLoop(target, shortcut.content)) {
      return false;
    }

    replaceRange.deleteContents();
    const textNode = document.createTextNode(shortcut.content);
    replaceRange.insertNode(textNode);

    const caretRange = document.createRange();
    caretRange.setStart(textNode, textNode.textContent.length);
    caretRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(caretRange);

    target.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: shortcut.content }));
    markReplacement(target, shortcut.content);
    recordExpansion(shortcut.id);
    return true;
  }

  function maybeExpand(target) {
    if (!runtimeState.settings) {
      return;
    }

    const editableRoot = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
      ? target
      : getEditableRoot(target);

    if (!isTextControl(editableRoot)) {
      return;
    }

    if (editableRoot instanceof HTMLInputElement || editableRoot instanceof HTMLTextAreaElement) {
      const caret = editableRoot.selectionStart;
      if (caret == null || editableRoot.selectionStart !== editableRoot.selectionEnd) {
        return;
      }

      const beforeText = editableRoot.value.slice(0, caret);
      const match = getMatches(beforeText);
      if (match) {
        replaceInInput(editableRoot, match);
      }
      return;
    }

    if (editableRoot.isContentEditable) {
      const beforeText = getContentEditableTextBeforeCaret(editableRoot);
      if (!beforeText) {
        return;
      }
      const match = getMatches(beforeText);
      if (match) {
        replaceInContentEditable(editableRoot, match, beforeText);
      }
    }
  }

  async function bootstrap() {
    await loadRuntimeState();

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "sync") {
        return;
      }
      if (changes.shortcuts || changes.settings) {
        loadRuntimeState();
      }
    });

    document.addEventListener("input", (event) => {
      maybeExpand(event.target);
    }, true);

    document.addEventListener("compositionend", (event) => {
      maybeExpand(event.target);
    }, true);

    document.addEventListener("keyup", (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      maybeExpand(event.target);
    }, true);
  }

  bootstrap();
})();
