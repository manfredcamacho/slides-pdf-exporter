# 📊 Slides PDF Exporter (Chrome Extension)

[![Manifest V3](https://img.shields.io/badge/Chrome%20Extension-Manifest%20V3-blue.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Google%20Chrome%20%7C%20Edge%20%7C%20Brave-success.svg)]()
[![i18n](https://img.shields.io/badge/i18n-English%20%7C%20Spanish-orange.svg)]()

A lightweight, privacy-focused Google Chrome extension (Manifest V3) designed to export **Google Slides** presentations to **high-definition PDF** documents with complete support for **searchable & selectable text (`Ctrl + F`)**, **structured speaker notes**, and **interactive hyperlinks**, even when default printing or downloading options are restricted.

---

## 🎯 Why This Tool?

When viewing presentations in Google Slides, owners may disable native export options:
- `File` → `Download` → `PDF Document (.pdf)` is greyed out or disabled.
- The standard browser print dialog (`Ctrl + P`) is blocked or corrupts slide layouts.
- Direct export endpoints return `403 Forbidden`.

### How It Works
When a presentation loads in your browser, Google Slides renders its graphics vectorially on the client side. This extension:
1. **Captures high-resolution slides (1080p)**: Preserves gradients, vectors, custom Google Fonts, and embedded graphics with 100% visual fidelity.
2. **Injects a Searchable Text Layer ("Searchable PDF")**: Places an invisible text overlay (`renderingMode: 'invisible'` / PDF operator `3 Tr`) directly over each slide's exact coordinates. You can seamlessly **search with `Ctrl + F`**, **select text**, and **copy/paste** without affecting visual styling.
3. **Extracts Speaker Notes & Hyperlinks**: Parses speaker notes directly from the presentation data model, preserving all external URLs and email addresses as native interactive PDF link annotations (`/Subtype /Link`).
4. **Supports Hidden & Skipped Slides**: Gives you full control over whether omitted/hidden slides should be included.
5. **100% Private & Local**: Runs entirely inside your browser. No presentations, notes, or credentials ever leave your machine.

---

## ✨ Features

- 🔍 **Searchable & Selectable Text (`Ctrl + F`)**: Fast keyword searching and copy-paste capabilities powered by an intelligent proportional-spacing text engine.
- 📝 **Full Speaker Notes Support**:
  - **Appendix format**: All speaker notes compiled at the end of the PDF with clear slide numbering.
  - **Interleaved companion pages**: Each slide followed immediately by its dedicated notes page.
- 🔗 **Interactive Hyperlinks**: All links in notes and on slides remain directly clickable in any PDF viewer.
- 👁️ **Hidden Slides Toggle**: Easily include or exclude slides marked as hidden.
- 🌐 **Bilingual (English / Spanish)**: UI and generated PDF titles automatically adapt to your browser language.
- ⚡ **Optimized Performance**: Direct client-side rendering with no artificial delays.

---

## 🚀 Installation

1. Clone or download this repository:
   ```bash
   git clone https://github.com/your-username/slides-pdf-exporter.git
   ```
2. Open Google Chrome (or any Chromium-based browser like Microsoft Edge, Brave, or Opera) and navigate to:
   ```text
   chrome://extensions
   ```
3. Enable **"Developer mode"** via the toggle switch in the top-right corner.
4. Click the **"Load unpacked"** button in the top-left corner.
5. Select this project's root folder.
6. The **Slides PDF** icon will appear in your extensions toolbar (you can pin it for quick access).

> [!TIP]
> To use the extension with saved offline HTML slide files:
> 1. Go to `chrome://extensions` and click **"Details"** on the **Slides PDF Exporter** card.
> 2. Enable **"Allow access to file URLs"**.

---

## 📖 Usage

1. Open any presentation in Google Slides.
2. Click the **Slides PDF Exporter** icon in your browser toolbar.
3. The popup automatically detects the presentation title and slide count.
4. Configure your preferences:
   - **Include hidden / skipped slides** (checked by default).
   - **Selectable and searchable text (Ctrl + F)** (checked by default).
   - **Include speaker notes** (select *Appendix at the end* or *Slide followed by notes*).
5. Click **"Download PDF"**.
6. Your high-definition PDF will download directly to your default Downloads folder.

---

## 📁 Repository Structure

```text
├── manifest.json              # Extension Manifest V3 configuration
├── _locales/                  # Official Chrome internationalization (i18n)
│   ├── en/messages.json       # English locale definitions
│   └── es/messages.json       # Spanish locale definitions
├── background/
│   └── service-worker.js      # Background worker for capture & settings
├── content/
│   └── content.js             # SVG rendering engine, data parser & PDF generator
├── popup/
│   ├── popup.html             # Clean popup interface
│   ├── popup.css              # Modern UI styling
│   └── popup.js               # Popup controller & messaging logic
├── icons/                     # Extension branding icons (16, 48, 128 px)
├── libs/
│   └── jspdf.umd.min.js       # Client-side PDF generation engine
├── CHROMEWEBSTORE.md          # Store submission guide and metadata
├── LICENSE                    # MIT Open Source License
├── README.md                  # Project documentation
└── .gitignore                 # Standard Git ignore rules
```

---

## 🔒 Privacy & Permissions

- **`activeTab`**: Used only when you click the extension popup to inspect the active Google Slides tab.
- **`storage`**: Saves your export preferences locally on your browser.
- **`downloads`**: Saves the generated PDF file to your computer.
- **`scripting`**: Injects necessary content scripts if opened on an already-loaded presentation tab.
- **Host permissions**: Strictly scoped to `*://docs.google.com/presentation/*` and `file://*/*`. No access to your browsing history or other websites.

No personal information, presentation data, or analytics are ever collected or transmitted.

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
