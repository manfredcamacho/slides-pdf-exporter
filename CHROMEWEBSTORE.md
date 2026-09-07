# Chrome Web Store Listing — Slides PDF Exporter

## Store Listing Details

**Extension Name**  
Slides PDF Exporter

**Short Description (max 132 chars)**  
Export Google Slides presentations to high-definition PDF with speaker notes and searchable text (Ctrl + F).

**Detailed Description**  
Export any Google Slides presentation directly to a high-fidelity PDF document, complete with speaker notes and interactive links.

### Key Features:
- **Searchable & Selectable Text (Ctrl + F)**: Uses an invisible text overlay engine that enables keyword search, mouse text selection, and copy-pasting while preserving 100% of the original visual design and typography.
- **Comprehensive Speaker Notes**: Extracts speaker notes directly from the presentation data model, preserving all external links and formatting them either as a dedicated appendix at the end or as interleaved companion pages.
- **Interactive Hyperlinks**: Web URLs and email addresses in notes and slides are converted into native clickable PDF annotations.
- **Hidden Slides Support**: Choose whether to include or skip slides marked as hidden in the presentation.
- **High Resolution Output**: Crisp 1080p slide captures suitable for printing and archiving.
- **100% Private & Client-Side**: All rendering and processing occur locally in your browser. No files, texts, or account credentials ever leave your computer.

### How to Use:
1. Open any presentation in Google Slides.
2. Click the **Slides PDF Exporter** icon in your Chrome toolbar.
3. Select your desired preferences (include hidden slides, searchable text, speaker notes format).
4. Click **Download PDF** to export your document immediately.

---

## Store Metadata

- **Category**: Productivity / Workflow
- **Single Purpose**: Export Google Slides presentations to searchable PDF documents with speaker notes.
- **Default Language**: English (en)
- **Supported Languages**: English, Spanish (via automatic `_locales` detection)

---

## Permissions Justification

| Permission | Type | Justification |
|---|---|---|
| `activeTab` | permissions | Required to interact with the active Google Slides tab when the user opens the extension popup. |
| `storage` | permissions | Used exclusively to save the user's export preferences (e.g. include notes, notes format). |
| `downloads` | permissions | Required to save the generated PDF file directly into the user's Downloads folder. |
| `scripting` | permissions | Used to inject the extraction and rendering scripts if the extension is opened on an already loaded tab. |
| `*://docs.google.com/presentation/*` | host_permissions | Strictly limited to Google Slides presentation URLs to read rendered slide graphics and speaker notes. |

---

## Privacy Policy & Data Use Declarations

- **Does the extension collect or transmit user data?**  
  **No.** The extension does not collect, transmit, or store any personal data, usage metrics, or presentation content on any remote server.
- **Data Use Certification**:
  - [x] Does not sell or transfer user data to third parties.
  - [x] Does not use or transfer user data for purposes unrelated to the item's single purpose.
  - [x] Does not use or transfer user data to determine creditworthiness or for lending purposes.
