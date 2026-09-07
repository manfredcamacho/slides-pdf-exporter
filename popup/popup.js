// popup/popup.js
document.addEventListener('DOMContentLoaded', async () => {
  const I18N = {
    en: {
      extName: "Slides PDF Exporter",
      headerTitle: "Slides PDF",
      headerSubtitle: "High-Definition PDF Exporter",
      inactiveTitle: "No presentation detected",
      inactiveDesc: "Open a presentation in Google Slides to export.",
      loadingTitle: "Loading presentation...",
      detectingSlides: "📊 Detecting slides...",
      slidesCount: "📊 $1 slides",
      notesBadgeDefault: "📝 Speaker notes",
      notesBadgeDetected: "📝 Notes detected",
      checkHidden: "Include hidden / skipped slides",
      checkSearchable: "Selectable and searchable text (Ctrl + F)",
      checkNotes: "Include speaker notes",
      notesFormatLabel: "Notes format:",
      formatAppendix: "Appendix at the end of PDF",
      formatCompanion: "Slide followed by its notes page",
      btnExport: "Download PDF",
      progressStarting: "Starting PDF export...",
      progressSuccess: "PDF downloaded successfully!"
    },
    es: {
      extName: "Slides PDF Exporter",
      headerTitle: "Slides PDF",
      headerSubtitle: "Exportador PDF en Alta Definición",
      inactiveTitle: "No se detectó presentación",
      inactiveDesc: "Abre una presentación en Google Slides para exportar.",
      loadingTitle: "Cargando presentación...",
      detectingSlides: "📊 Detectando diapositivas...",
      slidesCount: "📊 $1 diapositivas",
      notesBadgeDefault: "📝 Notas del presentador",
      notesBadgeDetected: "📝 Notas detectadas",
      checkHidden: "Incluir diapositivas ocultas / omitidas",
      checkSearchable: "Texto seleccionable y buscable (Ctrl + F)",
      checkNotes: "Incluir notas del presentador",
      notesFormatLabel: "Formato de notas:",
      formatAppendix: "Apéndice al final del PDF",
      formatCompanion: "Diapositiva seguida de notas",
      btnExport: "Descargar PDF",
      progressStarting: "Iniciando generación de PDF...",
      progressSuccess: "¡PDF descargado con éxito!"
    }
  };

  const btnLangEs = document.getElementById('lang-es');
  const btnLangEn = document.getElementById('lang-en');
  const stateActive = document.getElementById('state-active');
  const stateInactive = document.getElementById('state-inactive');
  const docTitle = document.getElementById('doc-title');
  const slideCountBadge = document.getElementById('slide-count-badge');
  const notesBadge = document.getElementById('notes-badge');
  const checkHidden = document.getElementById('check-hidden');
  const checkSearchable = document.getElementById('check-searchable');
  const checkNotes = document.getElementById('check-notes');
  const notesOptions = document.getElementById('notes-options-container');
  const selectNotesFormat = document.getElementById('select-notes-format');

  const btnPdf = document.getElementById('btn-export-pdf');

  const progressContainer = document.getElementById('progress-container');
  const progressMessage = document.getElementById('progress-message');
  const progressPercent = document.getElementById('progress-percent');
  const progressBarFill = document.getElementById('progress-bar-fill');

  let currentLang = 'en';
  let lastStatus = null;

  function getText(key, subs = []) {
    const dict = I18N[currentLang] || I18N.en;
    let str = dict[key] || chrome.i18n.getMessage(key, subs) || '';
    if (subs.length > 0) {
      subs.forEach((val, idx) => {
        str = str.replace(new RegExp(`\\$${idx + 1}`, 'g'), val);
      });
    }
    return str;
  }

  function applyLanguage(lang) {
    currentLang = lang;
    if (btnLangEs && btnLangEn) {
      btnLangEs.classList.toggle('active', lang === 'es');
      btnLangEn.classList.toggle('active', lang === 'en');
    }

    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const val = getText(key);
      if (val) el.textContent = val;
    });

    if (selectNotesFormat && selectNotesFormat.options.length >= 2) {
      selectNotesFormat.options[0].textContent = getText('formatAppendix');
      selectNotesFormat.options[1].textContent = getText('formatCompanion');
    }

    if (lastStatus && lastStatus.isGoogleSlides) {
      showActive(lastStatus);
    }
  }

  // Load saved preferences
  const saved = await chrome.storage.sync.get([
    'includeNotes',
    'notesFormat',
    'includeHiddenSlides',
    'searchableText',
    'userLanguage'
  ]);

  if (saved.includeHiddenSlides !== undefined) checkHidden.checked = saved.includeHiddenSlides;
  if (saved.searchableText !== undefined) checkSearchable.checked = saved.searchableText;
  if (saved.includeNotes !== undefined) checkNotes.checked = saved.includeNotes;
  if (saved.notesFormat) selectNotesFormat.value = saved.notesFormat;
  notesOptions.style.display = checkNotes.checked ? 'flex' : 'none';

  // Determine initial language: saved > browser language > default en
  if (saved.userLanguage) {
    currentLang = saved.userLanguage;
  } else {
    const browserLang = (chrome.i18n.getUILanguage() || 'en').toLowerCase();
    currentLang = browserLang.startsWith('es') ? 'es' : 'en';
  }
  applyLanguage(currentLang);

  if (btnLangEs) {
    btnLangEs.addEventListener('click', () => {
      applyLanguage('es');
      chrome.storage.sync.set({ userLanguage: 'es' });
    });
  }

  if (btnLangEn) {
    btnLangEn.addEventListener('click', () => {
      applyLanguage('en');
      chrome.storage.sync.set({ userLanguage: 'en' });
    });
  }

  checkHidden.addEventListener('change', () => {
    chrome.storage.sync.set({ includeHiddenSlides: checkHidden.checked });
  });

  checkSearchable.addEventListener('change', () => {
    chrome.storage.sync.set({ searchableText: checkSearchable.checked });
  });

  checkNotes.addEventListener('change', () => {
    notesOptions.style.display = checkNotes.checked ? 'flex' : 'none';
    chrome.storage.sync.set({ includeNotes: checkNotes.checked });
  });

  selectNotesFormat.addEventListener('change', () => {
    chrome.storage.sync.set({ notesFormat: selectNotesFormat.value });
  });

  // Get active tab
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab || !activeTab.id) {
    showInactive();
    return;
  }

  // Check presentation status
  try {
    lastStatus = await chrome.tabs.sendMessage(activeTab.id, { action: 'GET_STATUS' });
  } catch (err) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        files: ['libs/jspdf.umd.min.js', 'content/content.js']
      });
      lastStatus = await chrome.tabs.sendMessage(activeTab.id, { action: 'GET_STATUS' });
    } catch (e) {
      console.warn('Could not inject or reach content script:', e);
    }
  }

  if (lastStatus && lastStatus.isGoogleSlides) {
    showActive(lastStatus);
  } else {
    showInactive();
  }

  function showActive(info) {
    stateActive.style.display = 'flex';
    stateInactive.style.display = 'none';

    const defaultTitle = getText('extName') || 'Untitled Presentation';
    docTitle.textContent = info.title || defaultTitle;
    docTitle.title = info.title || '';

    const countStr = (info.slideCount || 0).toString();
    slideCountBadge.textContent = getText('slidesCount', [countStr]);

    if (info.hasNotes) {
      notesBadge.textContent = getText('notesBadgeDetected');
      notesBadge.style.color = '#15803d';
    } else {
      notesBadge.textContent = getText('notesBadgeDefault');
    }
  }

  function showInactive() {
    stateActive.style.display = 'none';
    stateInactive.style.display = 'flex';
  }

  function updateProgress(p) {
    progressContainer.style.display = 'flex';
    progressMessage.textContent = p.message || getText('progressStarting');
    const pct = p.percent || 0;
    progressPercent.textContent = `${pct}%`;
    progressBarFill.style.width = `${pct}%`;
  }

  function setButtonsDisabled(disabled) {
    btnPdf.disabled = disabled;
  }

  // Listen for progress updates
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'PROGRESS_UPDATE' && msg.progress) {
      updateProgress(msg.progress);
    }
  });

  // Handle Export PDF
  btnPdf.addEventListener('click', async () => {
    setButtonsDisabled(true);
    updateProgress({ percent: 5, message: getText('progressStarting') });

    const options = {
      resolution: '1080p',
      range: 'all',
      includeHiddenSlides: checkHidden.checked,
      searchableText: checkSearchable.checked,
      includeNotes: checkNotes.checked,
      notesFormat: selectNotesFormat.value,
      userLanguage: currentLang
    };

    try {
      const resp = await chrome.tabs.sendMessage(activeTab.id, {
        action: 'START_EXPORT_PDF',
        options
      });

      if (resp && resp.success) {
        updateProgress({ percent: 100, message: getText('progressSuccess') });
      } else {
        alert('Error: ' + (resp?.error || 'Could not complete export.'));
        progressContainer.style.display = 'none';
      }
    } catch (err) {
      alert('Error: ' + err.message);
      progressContainer.style.display = 'none';
    } finally {
      setButtonsDisabled(false);
    }
  });
});
