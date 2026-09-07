// popup/popup.js
document.addEventListener('DOMContentLoaded', async () => {
  // Localize page elements using Chrome i18n
  function localizePage() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const msg = chrome.i18n.getMessage(key);
      if (msg) el.textContent = msg;
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      const msg = chrome.i18n.getMessage(key);
      if (msg) el.title = msg;
    });
  }
  localizePage();

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

  // Load saved preferences
  const saved = await chrome.storage.sync.get(['includeNotes', 'notesFormat', 'includeHiddenSlides', 'searchableText']);
  if (saved.includeHiddenSlides !== undefined) checkHidden.checked = saved.includeHiddenSlides;
  if (saved.searchableText !== undefined) checkSearchable.checked = saved.searchableText;
  if (saved.includeNotes !== undefined) checkNotes.checked = saved.includeNotes;
  if (saved.notesFormat) selectNotesFormat.value = saved.notesFormat;
  notesOptions.style.display = checkNotes.checked ? 'flex' : 'none';

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
  let status = null;
  try {
    status = await chrome.tabs.sendMessage(activeTab.id, { action: 'GET_STATUS' });
  } catch (err) {
    // If content script was not yet injected, inject scripts
    try {
      await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        files: ['libs/jspdf.umd.min.js', 'content/content.js']
      });
      status = await chrome.tabs.sendMessage(activeTab.id, { action: 'GET_STATUS' });
    } catch (e) {
      console.warn('Could not inject or reach content script:', e);
    }
  }

  if (status && status.isGoogleSlides) {
    showActive(status);
  } else {
    showInactive();
  }

  function showActive(info) {
    stateActive.style.display = 'flex';
    stateInactive.style.display = 'none';

    const defaultTitle = chrome.i18n.getMessage('extName') || 'Untitled Presentation';
    docTitle.textContent = info.title || defaultTitle;
    docTitle.title = info.title || '';

    const countStr = (info.slideCount || 0).toString();
    slideCountBadge.textContent = chrome.i18n.getMessage('slidesCount', [countStr]) || `📊 ${countStr} slides`;

    if (info.hasNotes) {
      notesBadge.textContent = chrome.i18n.getMessage('notesBadgeDetected') || '📝 Notes detected';
      notesBadge.style.color = '#15803d';
    } else {
      notesBadge.textContent = chrome.i18n.getMessage('notesBadgeDefault') || '📝 Speaker notes';
    }
  }

  function showInactive() {
    stateActive.style.display = 'none';
    stateInactive.style.display = 'flex';
  }

  function updateProgress(p) {
    progressContainer.style.display = 'flex';
    progressMessage.textContent = p.message || chrome.i18n.getMessage('progressStarting') || 'Processing...';
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
    const startMsg = chrome.i18n.getMessage('progressStarting') || 'Starting PDF export...';
    updateProgress({ percent: 5, message: startMsg });

    const options = {
      resolution: '1080p',
      range: 'all',
      includeHiddenSlides: checkHidden.checked,
      searchableText: checkSearchable.checked,
      includeNotes: checkNotes.checked,
      notesFormat: selectNotesFormat.value
    };

    try {
      const resp = await chrome.tabs.sendMessage(activeTab.id, {
        action: 'START_EXPORT_PDF',
        options
      });

      if (resp && resp.success) {
        const succMsg = chrome.i18n.getMessage('progressSuccess') || 'PDF downloaded successfully!';
        updateProgress({ percent: 100, message: succMsg });
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
