// background/service-worker.js
// Manifest V3 Service Worker for G-Slides PDF Exporter

chrome.runtime.onInstalled.addListener(async () => {
  console.log('[G-Slides PDF Exporter] Extension installed successfully.');
  const defaults = {
    resolution: '1080p',
    captureMode: 'visual', // 'visual' (screen capture of viewport) or 'vector' (SVG)
    includeNotes: true,
    notesFormat: 'appendix', // 'appendix' or 'slide_with_notes'
    includeHiddenSlides: true,
    imageFormat: 'jpeg',
    quality: 0.95
  };
  const current = await chrome.storage.sync.get(Object.keys(defaults));
  await chrome.storage.sync.set({ ...defaults, ...current });
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let lastCaptureTime = 0;
const MIN_CAPTURE_INTERVAL_MS = 0; // Run at maximum speed without artificial delay

async function captureVisibleTabWithRetry(windowId, maxRetries = 3) {
  const options = { format: 'png' };

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Only pause if MIN_CAPTURE_INTERVAL_MS > 0
    if (MIN_CAPTURE_INTERVAL_MS > 0) {
      const now = Date.now();
      const elapsed = now - lastCaptureTime;
      if (elapsed < MIN_CAPTURE_INTERVAL_MS) {
        await sleep(MIN_CAPTURE_INTERVAL_MS - elapsed);
      }
    }

    try {
      lastCaptureTime = Date.now();
      if (typeof windowId === 'number') {
        try {
          return await chrome.tabs.captureVisibleTab(windowId, options);
        } catch (innerErr) {
          if (innerErr.message && innerErr.message.includes('MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND')) {
            throw innerErr;
          }
          return await chrome.tabs.captureVisibleTab(options);
        }
      } else {
        return await chrome.tabs.captureVisibleTab(options);
      }
    } catch (err) {
      const isQuota = err.message && err.message.includes('MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND');
      if (isQuota && attempt < maxRetries) {
        console.warn(`[G-Slides Exporter] Quota limit reached, waiting 1000ms before retry ${attempt + 1}/${maxRetries}...`);
        await sleep(1000);
      } else {
        throw err;
      }
    }
  }
}

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Capture visible tab (screen capture of main slide viewport)
  if (request.action === 'CAPTURE_VISIBLE_TAB') {
    (async () => {
      try {
        const windowId = sender.tab?.windowId;
        const dataUrl = await captureVisibleTabWithRetry(windowId);
        sendResponse({ success: true, dataUrl });
      } catch (err) {
        console.error('[G-Slides Exporter] captureVisibleTab error:', err);
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true; // Keep channel open
  }

  // Handle direct downloads
  if (request.action === 'DOWNLOAD_FILE') {
    (async () => {
      try {
        const downloadId = await chrome.downloads.download({
          url: request.url,
          filename: request.filename,
          saveAs: request.saveAs ?? false
        });
        sendResponse({ success: true, downloadId });
      } catch (err) {
        console.error('[G-Slides PDF Exporter] Download failed:', err);
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  if (request.action === 'GET_TAB_INFO') {
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        sendResponse({ success: true, tab });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }
});
