# BRNV Text Shortcuts

Free Chrome Extension (Manifest V3) for folder-based text shortcuts with instant plain-text expansion inside editable fields.

## Key Features

- Instant shortcut expansion with no Enter, Space, Tab, or extra button
- Folder-based shortcut management
- Fast popup search across name, trigger, and content
- Main dashboard with modal editor, settings, and lightweight statistics
- English and Ukrainian interface
- JSON import/export for shortcuts, folders, and settings

## Install in Chrome

1. Open `chrome://extensions`
2. Enable `Developer mode`
3. Click `Load unpacked`
4. Select this project folder

## Localization

- Supported languages: English, Ukrainian
- Default language: English
- Language can be changed in Settings

## Storage

- `chrome.storage.sync`: shortcuts, folders, and user settings
- `chrome.storage.local`: usage statistics and runtime-friendly local counters

## Import / Export

- JSON export includes `version`, `folders`, `shortcuts`, and `settings`
- JSON import validates required fields, duplicate triggers, and prefix conflicts before saving
