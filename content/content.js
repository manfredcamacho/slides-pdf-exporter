// content/content.js - G-Slides PDF Exporter (V3 - Hybrid Viewport Capture & SVG Engine)
(() => {
  'use strict';

  if (window.__GSLIDES_EXPORTER_INJECTED__) return;
  window.__GSLIDES_EXPORTER_INJECTED__ = true;

  console.log('[G-Slides PDF Exporter] Content script loaded v3.');

  // ==========================================
  // Helpers
  // ==========================================
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const TRANSPARENT_1PX_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

  // ==========================================
  // Detection & Information
  // ==========================================
  function isPresentationPage() {
    return (
      !!document.querySelector('.punch-filmstrip-scroll') ||
      !!document.querySelector('.punch-filmstrip-thumbnails') ||
      !!document.querySelector('.pages') ||
      !!document.querySelector('.workspace') ||
      !!document.querySelector('.punch-viewer-content') ||
      !!document.querySelector('#speakernotes') ||
      location.href.includes('docs.google.com/presentation/') ||
      document.title.toLowerCase().includes('google slides') ||
      document.title.toLowerCase().includes('presentaciones de google')
    );
  }

  function getPresentationTitle() {
    const input = document.querySelector('.docs-title-input');
    if (input && input.value && input.value.trim()) {
      return input.value.trim();
    }
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle && ogTitle.content && ogTitle.content.trim()) {
      return ogTitle.content.trim();
    }
    let t = document.title || '';
    t = t.replace(/\s*-\s*Google Slides\s*$/i, '');
    t = t.replace(/\s*-\s*Presentaciones de Google\s*$/i, '');
    t = t.trim();
    return t || 'Presentacion_Google_Slides';
  }

  function getSlideThumbnails() {
    return Array.from(document.querySelectorAll('g.punch-filmstrip-thumbnail'));
  }

  async function ensureAllThumbnailsLoaded() {
    const scrollContainer = document.querySelector('.punch-filmstrip-scroll');
    if (!scrollContainer) return;

    // Check if total count is already reached
    const totalCountEl = document.getElementById('punch-total-slide-count');
    let expectedCount = 0;
    if (totalCountEl && totalCountEl.textContent) {
      const m = totalCountEl.textContent.match(/(\d+)\s+total\s+slides/i);
      if (m) expectedCount = parseInt(m[1], 10);
    }
    
    // Also estimate expected count from SVG filmstrip height (pitch is ~102px):
    const svgFilmstrip = scrollContainer.querySelector('svg.punch-filmstrip-thumbnails');
    if (svgFilmstrip) {
      const hStr = svgFilmstrip.getAttribute('height') || svgFilmstrip.style.height || '';
      const h = parseFloat(hStr);
      if (h > 0 && !expectedCount) {
        expectedCount = Math.round((h - 2) / 102);
      }
    }

    let currentThumbs = getSlideThumbnails();
    if (expectedCount > 0 && currentThumbs.length >= expectedCount) {
      return;
    }

    const origScrollTop = scrollContainer.scrollTop;
    const maxScroll = scrollContainer.scrollHeight;
    const clientH = scrollContainer.clientHeight || 700;
    const step = Math.max(300, clientH - 50);

    for (let pos = 0; pos <= maxScroll; pos += step) {
      scrollContainer.scrollTop = pos;
      scrollContainer.dispatchEvent(new Event('scroll', { bubbles: true }));
      await sleep(50);
      currentThumbs = getSlideThumbnails();
      if (expectedCount > 0 && currentThumbs.length >= expectedCount) break;
    }

    // Scroll to the bottom to ensure the last slides are mounted
    scrollContainer.scrollTop = maxScroll;
    scrollContainer.dispatchEvent(new Event('scroll', { bubbles: true }));
    await sleep(80);

    // Restore original scroll
    scrollContainer.scrollTop = origScrollTop;
    scrollContainer.dispatchEvent(new Event('scroll', { bubbles: true }));
    await sleep(40);
  }

  // Detect if a slide is hidden (omitida / skipped)
  function isSlideHidden(thumb) {
    if (!thumb) return false;
    // 1. Look for hide_slide.png in images
    const images = thumb.querySelectorAll('image');
    for (const img of images) {
      const href = img.getAttribute('href') || img.getAttribute('xlink:href') || '';
      if (href.includes('hide_slide')) return true;
    }
    // 2. Check aria-label or classes
    const aria = thumb.getAttribute('aria-label') || '';
    if (aria.toLowerCase().includes('omitida') || aria.toLowerCase().includes('skipped') || aria.toLowerCase().includes('oculta')) {
      return true;
    }
    if (thumb.classList.contains('punch-filmstrip-thumbnail-skipped')) return true;
    return false;
  }

  function getAspectDimensions(viewBox, resPreset) {
    let w = 16;
    let h = 9;
    if (viewBox) {
      const parts = viewBox.trim().split(/\s+/).map(Number);
      if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
        w = parts[2];
        h = parts[3];
      }
    }
    const ratio = w / h;

    let baseH = 1080;
    if (resPreset === '2160p') {
      baseH = 2160;
    } else if (resPreset === '1440p') {
      baseH = 1440;
    } else if (resPreset === '720p') {
      baseH = 720;
    }

    const baseW = Math.round(baseH * ratio);
    return {
      width: baseW,
      height: baseH,
      ratio: ratio,
      orientation: ratio >= 1 ? 'landscape' : 'portrait'
    };
  }

  // ==========================================
  // Slide Navigation & Selection
  // ==========================================
  function clickThumbnail(thumb) {
    if (!thumb) return;
    const target = thumb.querySelector('.punch-filmstrip-thumbnail-drag-overlay') ||
                   thumb.querySelector('.punch-filmstrip-thumbnail-background') ||
                   thumb;

    const rect = target.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const eventInit = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: cx,
      clientY: cy,
      screenX: cx + window.screenX,
      screenY: cy + window.screenY,
      button: 0,
      buttons: 1
    };

    target.dispatchEvent(new PointerEvent('pointerdown', eventInit));
    target.dispatchEvent(new MouseEvent('mousedown', eventInit));
    target.dispatchEvent(new PointerEvent('pointerup', eventInit));
    target.dispatchEvent(new MouseEvent('mouseup', eventInit));
    target.dispatchEvent(new MouseEvent('click', eventInit));

    const pageId = thumb.getAttribute('data-slide-page-id');
    if (pageId && window.location.hash !== `#slide=id.${pageId}`) {
      try {
        window.location.hash = `#slide=id.${pageId}`;
      } catch (e) {}
    }
  }

  async function activateSlide(thumb, index) {
    const scrollContainer = document.querySelector('.punch-filmstrip-scroll');

    // If thumb is not in DOM yet, scroll filmstrip to estimated position to force mount
    if (!thumb && scrollContainer) {
      const estimatedY = 2 + (index * 102);
      scrollContainer.scrollTop = Math.max(0, estimatedY - (scrollContainer.clientHeight / 2));
      scrollContainer.dispatchEvent(new Event('scroll', { bubbles: true }));
      await sleep(150);
      const thumbs = getSlideThumbnails();
      thumb = thumbs[index] || thumbs[thumbs.length - 1];
    }

    if (!thumb) return;
    const pageId = thumb.getAttribute('data-slide-page-id');

    // 1. Scroll into view in filmstrip
    thumb.scrollIntoView({ block: 'center', behavior: 'instant' });
    if (scrollContainer) {
      const thumbBox = thumb.getBoundingClientRect();
      const contBox = scrollContainer.getBoundingClientRect();
      scrollContainer.scrollTop += (thumbBox.top - contBox.top) - (contBox.height / 2);
      scrollContainer.dispatchEvent(new Event('scroll', { bubbles: true }));
    }

    // 2. Click thumbnail
    clickThumbnail(thumb);

    // 3. Wait for Google Slides to render the slide in the visible viewer
    const start = Date.now();
    while (Date.now() - start < 1500) {
      const pages = document.getElementById('pages') || document.querySelector('.pages');
      if (pages && pageId) {
        const visibleSvg = Array.from(pages.querySelectorAll('svg')).find(s => {
          if (s.style.display === 'none' || s.getAttribute('visibility') === 'hidden') return false;
          try {
            const style = window.getComputedStyle(s);
            if (style.display === 'none' || style.visibility === 'hidden') return false;
          } catch (e) {}
          return true;
        });
        if (visibleSvg && visibleSvg.querySelector(`[id*="${pageId}"]`)) {
          break;
        }
      }
      await sleep(50);
    }
    // Additional buffer for compositor paint
    await sleep(250);
  }

  // ==========================================
  // Speaker Notes Extraction (Model Data + DOM Fallback)
  // ==========================================
  let presentationNotesMap = null;

  function parseAllSpeakerNotesFromModel() {
    if (presentationNotesMap) return presentationNotesMap;
    presentationNotesMap = new Map();

    const scripts = Array.from(document.querySelectorAll('script'));
    let allScriptContent = '';
    for (const s of scripts) {
      if (s.textContent && (s.textContent.includes(':notes') || s.textContent.includes('modelChunk'))) {
        allScriptContent += '\n' + s.textContent;
      }
    }
    if (!allScriptContent) return presentationNotesMap;

    // 1. Map each slide to its notes box ID:
    const slideToBox = new Map();
    const boxRegex = /\[3,\s*"([^"]+)",\s*108,[\s\S]*?"([^"]+):notes"\]/g;
    let match;
    while ((match = boxRegex.exec(allScriptContent)) !== null) {
      slideToBox.set(match[2], match[1]);
    }

    // 2. Extract text for each notes box:
    const boxTexts = new Map();
    const textRegex = /\[15,\s*"([^"]+)",\s*null,\s*0,\s*"((?:[^"\\]|\\.)*)"\]/g;
    while ((match = textRegex.exec(allScriptContent)) !== null) {
      try {
        boxTexts.set(match[1], JSON.parse('"' + match[2] + '"'));
      } catch (e) {
        boxTexts.set(match[1], match[2]);
      }
    }

    // 3. Extract links for each notes box:
    const boxLinks = new Map();
    const linkRegex = /\[17,\s*"([^"]+)",\s*null,\s*(\d+),\s*(\d+),\s*\[\s*\],\s*\[\s*8,\s*"((?:[^"\\]|\\.)*)"\]/g;
    while ((match = linkRegex.exec(allScriptContent)) !== null) {
      const boxId = match[1];
      const start = parseInt(match[2], 10);
      const end = parseInt(match[3], 10);
      let url = match[4];
      try {
        url = JSON.parse('"' + url + '"');
      } catch (e) {}

      if (!boxLinks.has(boxId)) {
        boxLinks.set(boxId, []);
      }
      boxLinks.get(boxId).push({ start, end, url });
    }

    // 4. Combine text with links for each slide
    for (const [slideId, boxId] of slideToBox.entries()) {
      let text = boxTexts.get(boxId) || '';
      if (!text || !text.trim()) continue;

      const links = boxLinks.get(boxId) || [];
      links.sort((a, b) => b.start - a.start);

      let formatted = text;
      for (const link of links) {
        if (link.start >= 0 && link.end <= formatted.length && link.start < link.end) {
          const anchor = formatted.substring(link.start, link.end).trim();
          let targetUrl = link.url;
          if (targetUrl.includes('google.com/url?q=')) {
            try {
              const parsed = new URL(targetUrl);
              targetUrl = parsed.searchParams.get('q') || targetUrl;
            } catch (e) {}
          }
          if (anchor && targetUrl && !anchor.includes(targetUrl) && !targetUrl.includes(anchor)) {
            formatted = formatted.substring(0, link.start) + 
                        `${anchor} (${targetUrl})` + 
                        formatted.substring(link.end);
          }
        }
      }
      presentationNotesMap.set(slideId, formatted.trim());
    }

    return presentationNotesMap;
  }

  async function extractSlideNote(thumb, slideNumber, previousNote) {
    const pageId = thumb ? thumb.getAttribute('data-slide-page-id') : null;

    // 1. Primary & 100% accurate: Extract from Google Slides data model (preserves all text and hyperlinks)
    try {
      const modelNotes = parseAllSpeakerNotesFromModel();
      if (pageId && modelNotes.has(pageId)) {
        const note = modelNotes.get(pageId);
        if (note && note.trim()) return note.trim();
      }
    } catch (e) {
      console.warn('[G-Slides Exporter] Error getting note from model:', e);
    }

    const workspace = document.querySelector('#speakernotes-workspace') || document.querySelector('#speakernotes');
    if (!workspace) return '';

    // Wait up to 500ms for workspace to reflect active slide
    let attempts = 0;
    while (attempts < 10) {
      if (pageId && workspace.querySelector(`[id*="${pageId}"]`)) {
        break;
      }
      await sleep(50);
      attempts++;
    }

    // 1. Group by paragraphs in the speaker notes workspace
    const paragraphGroups = Array.from(workspace.querySelectorAll('[id*="-paragraph-"]'));
    const paragraphs = [];

    if (paragraphGroups.length > 0) {
      for (const pGroup of paragraphGroups) {
        const parts = [];
        const visited = new Set();

        // Query all text nodes, links, and text containers in document order
        const elements = Array.from(pGroup.querySelectorAll('a, [role="link"], text, [data-target]'));
        for (const el of elements) {
          if (visited.has(el)) continue;

          // Check if this element is a link or is inside a link
          const link = (el.tagName.toLowerCase() === 'a' || el.getAttribute('role') === 'link')
            ? el 
            : el.closest('a') || el.closest('[role="link"]');

          if (link) {
            visited.add(link);
            link.querySelectorAll('*').forEach(c => visited.add(c));

            let href = link.getAttribute('href') || 
                         link.getAttribute('xlink:href') || 
                         link.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || 
                         link.getAttribute('data-target') || '';

            if (href.includes('google.com/url?q=')) {
              try {
                const parsed = new URL(href);
                href = parsed.searchParams.get('q') || href;
              } catch (e) {}
            }

            const childTexts = Array.from(link.querySelectorAll('text'))
              .map(t => t.textContent.trim())
              .filter(Boolean);
            const linkText = childTexts.length > 0 ? childTexts.join(' ') : link.textContent.trim();

            if (linkText && href && !href.startsWith('javascript:') && !linkText.includes(href) && href.startsWith('http')) {
              parts.push(`${linkText} (${href})`);
            } else if (linkText) {
              parts.push(linkText);
            } else if (href && href.startsWith('http')) {
              parts.push(href);
            }
          } else if (el.tagName.toLowerCase() === 'text') {
            visited.add(el);
            const t = el.textContent.trim();
            if (t) parts.push(t);
          }
        }

        if (parts.length > 0) {
          paragraphs.push(parts.join(' '));
        }
      }
    }

    let resultText = paragraphs.join('\n\n');

    // 2. Fallback if paragraph groups were not detected
    if (!resultText) {
      const parts = [];
      const visited = new Set();
      const allNodes = Array.from(workspace.querySelectorAll('a, [role="link"], text'));
      for (const el of allNodes) {
        if (visited.has(el)) continue;
        const link = (el.tagName.toLowerCase() === 'a' || el.getAttribute('role') === 'link')
          ? el 
          : el.closest('a') || el.closest('[role="link"]');
        if (link) {
          visited.add(link);
          link.querySelectorAll('*').forEach(c => visited.add(c));
          let href = link.getAttribute('href') || link.getAttribute('xlink:href') || link.getAttribute('data-target') || '';
          if (href.includes('google.com/url?q=')) {
            try {
              const parsed = new URL(href);
              href = parsed.searchParams.get('q') || href;
            } catch (e) {}
          }
          const childTexts = Array.from(link.querySelectorAll('text'))
            .map(t => t.textContent.trim())
            .filter(Boolean);
          const linkText = childTexts.length > 0 ? childTexts.join(' ') : link.textContent.trim();

          if (linkText && href && !linkText.includes(href) && href.startsWith('http')) {
            parts.push(`${linkText} (${href})`);
          } else if (linkText) {
            parts.push(linkText);
          } else if (href && href.startsWith('http')) {
            parts.push(href);
          }
        } else if (el.tagName.toLowerCase() === 'text') {
          visited.add(el);
          const t = el.textContent.trim();
          if (t) parts.push(t);
        }
      }
      resultText = parts.join(' ');
    }

    // 3. Fallback to innerText
    if (!resultText && workspace.innerText) {
      resultText = workspace.innerText.trim();
    }

    // Filter default placeholders
    const placeholders = [
      'click to add speaker notes',
      'haga clic para agregar notas del presentador',
      'haga clic para agregar notas de orador',
      'haga clic para añadir notas del presentador',
      'haga clic para añadir notas de orador',
      'clique para adicionar anotações do apresentador'
    ];
    if (placeholders.includes(resultText.toLowerCase().trim())) {
      return '';
    }

    if (resultText && resultText === previousNote && pageId && !workspace.querySelector(`[id*="${pageId}"]`)) {
      return '';
    }

    return resultText;
  }

  // ==========================================
  // Engine 1: Viewport Screen Capture (Primary & 100% Reliable)
  // ==========================================
  let cachedSlideRect = null;

  function getSlideBoundingRect() {
    const pages = document.getElementById('pages') || document.querySelector('.pages');
    if (pages) {
      // Find all SVGs in pages and filter only VISIBLE ones
      const svgs = Array.from(pages.querySelectorAll('svg')).filter(s => {
        if (s.style.display === 'none' || s.getAttribute('visibility') === 'hidden') return false;
        try {
          const style = window.getComputedStyle(s);
          if (style.display === 'none' || style.visibility === 'hidden') return false;
        } catch (e) {}
        const r = s.getBoundingClientRect();
        return r.width > 200 && r.height > 100;
      });

      for (const svg of svgs) {
        // Look for the main slide group: <g transform="translate(...) scale(...)">
        const slideGroups = Array.from(svg.querySelectorAll('g')).filter(g => {
          const tf = g.getAttribute('transform') || '';
          return tf.includes('translate') && (tf.includes('scale') || tf.includes('matrix'));
        });

        const targetGroups = slideGroups.length > 0 ? slideGroups : [svg];
        for (const grp of targetGroups) {
          const shapes = Array.from(grp.querySelectorAll('path, rect'));
          let bestRect = null;
          let maxArea = 0;
          for (const shape of shapes) {
            const r = shape.getBoundingClientRect();
            const area = r.width * r.height;
            const ratio = r.width / (r.height || 1);
            // Must be the full slide canvas: wide area and typical slide aspect ratio (16:9, 4:3, 16:10)
            if (area > maxArea && r.width > 300 && r.height > 150 && ratio >= 1.1 && ratio <= 2.2) {
              maxArea = area;
              bestRect = r;
            }
          }
          if (bestRect) {
            cachedSlideRect = bestRect;
            return bestRect;
          }
        }

        const svgRect = svg.getBoundingClientRect();
        if (svgRect.width > 300 && svgRect.height > 150) {
          cachedSlideRect = svgRect;
          return svgRect;
        }
      }
    }

    // If we already detected the pristine slide rect on slide 1, reuse it!
    if (cachedSlideRect && cachedSlideRect.width > 200 && cachedSlideRect.height > 100) {
      return cachedSlideRect;
    }

    // Safe DOM workspace container fallback (starts BELOW toolbar, never touches Select or View only)
    const workspace = document.getElementById('workspace-container') || document.getElementById('workspace');
    if (workspace) {
      const wr = workspace.getBoundingClientRect();
      const targetW = wr.width * 0.90;
      const targetH = targetW * (9 / 16);
      return {
        left: wr.left + (wr.width - targetW) / 2,
        top: wr.top + Math.max(10, (wr.height - targetH) / 2),
        width: targetW,
        height: targetH
      };
    }

    // Fallback based on window center (safe margins avoiding top toolbar)
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const filmstripW = 220;
    const topBarH = 120; // Skip top toolbars and menu bars
    const availW = vw - filmstripW;
    const availH = vh - topBarH;
    const targetW = Math.min(availW * 0.92, (availH * 0.92) * (16 / 9));
    const targetH = targetW * (9 / 16);
    return {
      left: filmstripW + (availW - targetW) / 2,
      top: topBarH + (availH - targetH) / 2,
      width: targetW,
      height: targetH
    };
  }

  async function captureSlideFromScreen(rect) {
    let dataUrl = null;
    let attempts = 0;
    while (attempts < 3) {
      try {
        const response = await chrome.runtime.sendMessage({ action: 'CAPTURE_VISIBLE_TAB' });
        if (response && response.success && response.dataUrl) {
          dataUrl = response.dataUrl;
          break;
        }
        if (response && response.error && response.error.includes('MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND')) {
          console.warn(`[G-Slides Exporter] Quota hit in content script, pausing 1000ms (attempt ${attempts + 1})...`);
          await sleep(1000);
          attempts++;
          continue;
        }
        throw new Error(response?.error || 'No se pudo capturar la pestaña.');
      } catch (err) {
        if (err.message && err.message.includes('MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND') && attempts < 2) {
          await sleep(1000);
          attempts++;
          continue;
        }
        throw err;
      }
    }

    if (!dataUrl) {
      throw new Error('No se pudo obtener la captura visual de la pestaña.');
    }

    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = dataUrl;
    });

    const scaleX = img.width / window.innerWidth;
    const scaleY = img.height / window.innerHeight;

    const cropX = Math.max(0, Math.round(rect.left * scaleX));
    const cropY = Math.max(0, Math.round(rect.top * scaleY));
    const cropW = Math.max(1, Math.min(img.width - cropX, Math.round(rect.width * scaleX)));
    const cropH = Math.max(1, Math.min(img.height - cropY, Math.round(rect.height * scaleY)));

    const canvas = document.createElement('canvas');
    canvas.width = cropW;
    canvas.height = cropH;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

    return canvas;
  }

  // ==========================================
  // Engine 2: Fallback SVG to Canvas
  // ==========================================
  async function svgElementToCanvasFallback(svgEl, targetWidth, targetHeight) {
    const clone = svgEl.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

    let vb = clone.getAttribute('viewBox') || clone.getAttribute('viewbox');
    if (!vb) {
      const origW = parseFloat(clone.getAttribute('width')) || targetWidth;
      const origH = parseFloat(clone.getAttribute('height')) || targetHeight;
      vb = `0 0 ${origW} ${origH}`;
      clone.setAttribute('viewBox', vb);
    }
    clone.setAttribute('width', targetWidth);
    clone.setAttribute('height', targetHeight);

    // Remove hide_slide.png overlay if present
    const hideImages = clone.querySelectorAll('image[href*="hide_slide"], image[*|href*="hide_slide"]');
    hideImages.forEach(img => img.remove());

    // Safely inline images or replace with transparent fallback
    const images = Array.from(clone.querySelectorAll('image'));
    for (const img of images) {
      img.removeAttribute('xlink:href');
      img.removeAttributeNS('http://www.w3.org/1999/xlink', 'href');
      img.setAttribute('href', TRANSPARENT_1PX_PNG);
    }

    const svgStr = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, targetWidth, targetHeight);

    const img = new Image();
    await new Promise((resolve) => {
      img.onload = () => {
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        URL.revokeObjectURL(url);
        resolve();
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve();
      };
      img.src = url;
    });

    return canvas;
  }

  // ==========================================
  // Engine 3: Searchable PDF Text Layer (Invisible Overlay)
  // ==========================================
  function injectInvisibleTextOverlay(doc, dims, slideRect) {
    const pages = document.getElementById('pages') || document.querySelector('.pages');
    const sRect = slideRect || (cachedSlideRect && cachedSlideRect.width > 200 ? cachedSlideRect : null);
    if (!pages || !sRect || sRect.width <= 0 || sRect.height <= 0) return;

    // Find the visible SVG on the page
    const visibleSvg = Array.from(pages.querySelectorAll('svg')).find(s => {
      if (s.style.display === 'none' || s.getAttribute('visibility') === 'hidden') return false;
      try {
        const style = window.getComputedStyle(s);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
      } catch (e) {}
      return true;
    });
    if (!visibleSvg) return;

    // 1. Group by line groups (.sketchy-text-content-text)
    const lineGroups = Array.from(visibleSvg.querySelectorAll('.sketchy-text-content-text'));
    const handledTexts = new Set();

    for (const lg of lineGroups) {
      const texts = Array.from(lg.querySelectorAll('text'));
      if (texts.length === 0) continue;
      texts.forEach(t => handledTexts.add(t));

      let lineStr = '';
      let prevRect = null;
      for (const t of texts) {
        const textContent = t.textContent;
        if (!textContent) continue;
        const r = t.getBoundingClientRect();
        if (prevRect) {
          const gap = r.left - prevRect.right;
          let fontSize = 16;
          try {
            fontSize = parseFloat(window.getComputedStyle(t).fontSize) || 16;
          } catch (e) {}
          const spaceThreshold = Math.max(3, fontSize * 0.18);
          if (gap > spaceThreshold || textContent.startsWith(' ')) {
            if (!lineStr.endsWith(' ')) lineStr += ' ';
          }
        }
        lineStr += textContent.trim();
        prevRect = r;
      }
      lineStr = lineStr.trim();
      if (!lineStr) continue;

      const r = lg.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;

      const xRel = (r.left - sRect.left) / sRect.width;
      const yRel = (r.top - sRect.top) / sRect.height;
      const hRel = r.height / sRect.height;

      const pdfX = Math.round(xRel * dims.width);
      const pdfY = Math.round((yRel * dims.height) + (hRel * dims.height * 0.85));
      const fontSize = Math.max(8, Math.round(hRel * dims.height * 0.85));

      try {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(fontSize);
        doc.text(lineStr, pdfX, pdfY, { renderingMode: 'invisible' });

        // If line contains URL or email, attach PDF link annotation
        const urlRegex = /(https?:\/\/[^\s\)]+|mailto:[^\s\)]+|www\.[^\s\)]+)/g;
        let urlMatch;
        while ((urlMatch = urlRegex.exec(lineStr)) !== null) {
          let rawUrl = urlMatch[1];
          let fullUrl = rawUrl.startsWith('www.') ? 'http://' + rawUrl : rawUrl;
          const beforeText = lineStr.substring(0, urlMatch.index);
          const beforeW = doc.getTextWidth(beforeText);
          const linkW = doc.getTextWidth(rawUrl);
          const linkX = pdfX + beforeW;
          const linkY = Math.round(yRel * dims.height);
          const linkH = Math.max(12, Math.round(hRel * dims.height));
          doc.link(linkX, linkY, linkW, linkH, { url: fullUrl });
        }
      } catch (e) {}
    }

    // 2. Any remaining individual text elements
    const remainingTexts = Array.from(visibleSvg.querySelectorAll('text')).filter(t => !handledTexts.has(t));
    for (const t of remainingTexts) {
      const textStr = t.textContent.trim();
      if (!textStr) continue;

      const r = t.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;

      const xRel = (r.left - sRect.left) / sRect.width;
      const yRel = (r.top - sRect.top) / sRect.height;
      const hRel = r.height / sRect.height;

      const pdfX = Math.round(xRel * dims.width);
      const pdfY = Math.round((yRel * dims.height) + (hRel * dims.height * 0.85));
      const fontSize = Math.max(8, Math.round(hRel * dims.height * 0.85));

      try {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(fontSize);
        doc.text(textStr, pdfX, pdfY, { renderingMode: 'invisible' });

        const urlRegex = /(https?:\/\/[^\s\)]+|mailto:[^\s\)]+|www\.[^\s\)]+)/g;
        let urlMatch;
        while ((urlMatch = urlRegex.exec(textStr)) !== null) {
          let rawUrl = urlMatch[1];
          let fullUrl = rawUrl.startsWith('www.') ? 'http://' + rawUrl : rawUrl;
          const beforeText = textStr.substring(0, urlMatch.index);
          const beforeW = doc.getTextWidth(beforeText);
          const linkW = doc.getTextWidth(rawUrl);
          const linkX = pdfX + beforeW;
          const linkY = Math.round(yRel * dims.height);
          const linkH = Math.max(12, Math.round(hRel * dims.height));
          doc.link(linkX, linkY, linkW, linkH, { url: fullUrl });
        }
      } catch (e) {}
    }
  }

  // ==========================================
  // PDF Generation Pipeline
  // ==========================================
  async function generatePDF(options = {}, onProgress) {
    const {
      resolution = '1080p',
      range = 'all',
      includeNotes = true,
      notesFormat = 'appendix',
      includeHiddenSlides = true,
      searchableText = true,
      imageFormat = 'jpeg',
      quality = 0.95
    } = options;

    if (!window.jspdf || !window.jspdf.jsPDF) {
      throw new Error('Librería jsPDF no encontrada.');
    }

    cachedSlideRect = null; // Reset cached rect for clean detection
    presentationNotesMap = null; // Reset cached model notes for fresh extraction

    if (onProgress) {
      onProgress({
        phase: 'loading',
        message: 'Detectando todas las diapositivas de la presentación...',
        percent: 2
      });
    }

    await ensureAllThumbnailsLoaded();

    let thumbs = getSlideThumbnails();
    if (thumbs.length === 0) {
      throw new Error('No se detectaron diapositivas en la presentación.');
    }

    // Filter indices to export
    let indicesToExport = [];
    if (range === 'all') {
      indicesToExport = thumbs.map((_, i) => i);
    } else {
      const parts = range.split(',');
      for (const p of parts) {
        const trimmed = p.trim();
        if (trimmed.includes('-')) {
          const [start, end] = trimmed.split('-').map(Number);
          if (!isNaN(start) && !isNaN(end)) {
            for (let k = Math.max(1, start); k <= Math.min(thumbs.length, end); k++) {
              indicesToExport.push(k - 1);
            }
          }
        } else {
          const val = Number(trimmed);
          if (!isNaN(val) && val >= 1 && val <= thumbs.length) {
            indicesToExport.push(val - 1);
          }
        }
      }
      indicesToExport = Array.from(new Set(indicesToExport)).sort((a, b) => a - b);
      if (indicesToExport.length === 0) indicesToExport = thumbs.map((_, i) => i);
    }

    // Filter hidden slides if requested
    if (!includeHiddenSlides) {
      indicesToExport = indicesToExport.filter(i => !isSlideHidden(thumbs[i]));
    }

    // Slide dimensions
    const firstThumb = thumbs[indicesToExport[0]];
    const firstSvg = firstThumb.querySelector('svg');
    const vb = firstSvg ? (firstSvg.getAttribute('viewBox') || firstSvg.getAttribute('viewbox')) : null;
    const dims = getAspectDimensions(vb, resolution);

    const doc = new window.jspdf.jsPDF({
      orientation: dims.orientation,
      unit: 'px',
      format: [dims.width, dims.height]
    });

    const totalSteps = indicesToExport.length;
    const collectedNotes = [];
    let lastNote = null;

    // Sequential stepper: Navigates and captures each slide
    for (let i = 0; i < totalSteps; i++) {
      const slideIdx = indicesToExport[i];
      const slideNum = slideIdx + 1;

      thumbs = getSlideThumbnails();
      const thumb = thumbs[slideIdx] || thumbs[thumbs.length - 1];
      const isHidden = isSlideHidden(thumb);

      if (onProgress) {
        const pct = Math.round(((i + 0.2) / totalSteps) * 90);
        const tag = isHidden ? (chrome.i18n.getMessage('slideHiddenTag') || ' [Hidden Slide]') : '';
        const msg = chrome.i18n.getMessage('progressCapturing', [(i + 1).toString(), totalSteps.toString(), tag]) ||
                    `Capturing slide ${i + 1} of ${totalSteps}${tag}...`;
        onProgress({
          phase: 'capturing',
          message: msg,
          percent: pct,
          current: i + 1,
          total: totalSteps
        });
      }

      // 1. Navigate to and display slide in main viewport
      await activateSlide(thumb, slideIdx);

      // 2. Extract speaker notes
      let noteText = '';
      if (includeNotes) {
        noteText = await extractSlideNote(thumb, slideNum, lastNote);
        if (noteText) {
          lastNote = noteText;
          collectedNotes.push({
            slideNumber: slideNum,
            text: noteText,
            isHidden: isHidden
          });
        }
      }

      // 3. Capture slide image from screen (or fallback to SVG)
      let canvas = null;
      try {
        const rect = getSlideBoundingRect();
        canvas = await captureSlideFromScreen(rect);
      } catch (err) {
        console.warn('[G-Slides Exporter] Screen capture failed, using SVG fallback:', err);
        const svg = document.querySelector('#pages svg') || thumb.querySelector('svg');
        if (svg) {
          canvas = await svgElementToCanvasFallback(svg, dims.width, dims.height);
        }
      }

      // 4. Add slide to PDF
      if (i > 0) {
        doc.addPage([dims.width, dims.height], dims.orientation);
      }

      if (canvas) {
        const imgData = canvas.toDataURL(imageFormat === 'png' ? 'image/png' : 'image/jpeg', quality);
        doc.addImage(imgData, imageFormat === 'png' ? 'PNG' : 'JPEG', 0, 0, dims.width, dims.height);
      }

      // Inject searchable invisible text layer over the slide image (Ctrl+F and selectable text)
      if (searchableText) {
        try {
          const rect = getSlideBoundingRect();
          injectInvisibleTextOverlay(doc, dims, rect);
        } catch (err) {
          console.warn('[G-Slides Exporter] Error injecting invisible text layer:', err);
        }
      }

      // 5. Add companion notes page if format is slide_with_notes
      if (includeNotes && notesFormat === 'slide_with_notes' && noteText) {
        doc.addPage([dims.width, dims.height], dims.orientation);
        addFormattedNotesPage(doc, dims, slideNum, noteText, isHidden);
      }
    }

    // 6. Append notes appendix at the end if requested
    if (includeNotes && notesFormat === 'appendix' && collectedNotes.length > 0) {
      if (onProgress) {
        const msg = chrome.i18n.getMessage('progressAppendix') || 'Generating speaker notes appendix...';
        onProgress({ phase: 'appendix', message: msg, percent: 95 });
      }
      renderNotesAppendix(doc, dims, collectedNotes);
    }

    // 7. Save file
    if (onProgress) {
      const msg = chrome.i18n.getMessage('progressDownloading') || 'Done! Downloading PDF file...';
      onProgress({ phase: 'downloading', message: msg, percent: 100 });
    }

    const title = getPresentationTitle();
    const filename = `${title.replace(/[\/\\?%*:|"<>]/g, '_')}.pdf`;
    doc.save(filename);

    return { success: true, filename, slidesCount: totalSteps };
  }

  // ==========================================
  // Speaker Notes Formatting (Larger Font Size)
  // ==========================================
  function addFormattedNotesPage(doc, dims, slideNum, noteText, isHidden) {
    const margin = Math.round(dims.width * 0.05); // e.g. 96px for 1920
    const contentW = dims.width - (margin * 2);

    doc.setFillColor(248, 250, 252);
    doc.rect(0, 0, dims.width, dims.height, 'F');

    // Accent line
    doc.setFillColor(234, 67, 53);
    doc.rect(margin, 50, contentW, 6, 'F');

    // Title (Significantly larger)
    const titleSize = Math.max(28, Math.round(dims.height * 0.036)); // ~39px at 1080p
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(titleSize);
    doc.setTextColor(30, 41, 59);
    const tag = isHidden ? (chrome.i18n.getMessage('slideHiddenTag') || ' [Hidden Slide]') : '';
    const headerTitle = chrome.i18n.getMessage('slideNotesTitle', [slideNum.toString(), tag]) ||
                        `Speaker Notes — Slide ${slideNum}${tag}`;
    doc.text(headerTitle, margin, 110);

    // Notes Body (Significantly larger: ~28px at 1080p, line height ~39px)
    const bodySize = Math.max(20, Math.round(dims.height * 0.026)); // ~28px at 1080p
    const lineHeight = Math.round(bodySize * 1.42); // ~40px at 1080p
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(bodySize);
    doc.setTextColor(51, 65, 85);

    const splitLines = doc.splitTextToSize(noteText, contentW);
    let y = 175;
    for (const line of splitLines) {
      if (y > dims.height - margin) {
        doc.addPage([dims.width, dims.height], dims.orientation);
        doc.setFillColor(248, 250, 252);
        doc.rect(0, 0, dims.width, dims.height, 'F');
        y = margin;
      }
      doc.text(line, margin, y);

      // Detect hyperlinks in the text line to add interactive PDF link annotations
      const urlRegex = /(https?:\/\/[^\s\)]+|mailto:[^\s\)]+)/g;
      let urlMatch;
      while ((urlMatch = urlRegex.exec(line)) !== null) {
        const rawUrl = urlMatch[1];
        const beforeText = line.substring(0, urlMatch.index);
        const beforeW = doc.getTextWidth(beforeText);
        const linkW = doc.getTextWidth(rawUrl);
        const linkX = margin + beforeW;
        const linkY = y - Math.round(bodySize * 0.85);
        try {
          doc.link(linkX, linkY, linkW, lineHeight, { url: rawUrl });
        } catch (e) {}
      }

      y += lineHeight;
    }
  }

  function renderNotesAppendix(doc, dims, slidesWithNotes) {
    const margin = Math.round(dims.width * 0.05);
    const contentW = dims.width - (margin * 2);

    doc.addPage([dims.width, dims.height], dims.orientation);

    // Cover page for Appendix
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 0, dims.width, dims.height, 'F');

    doc.setFillColor(234, 67, 53);
    doc.rect(margin, 50, contentW, 6, 'F');

    const titleSize = Math.max(32, Math.round(dims.height * 0.044)); // ~48px at 1080p
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(titleSize);
    doc.setTextColor(30, 41, 59);
    const appTitle = chrome.i18n.getMessage('appendixTitle') || 'Appendix: Speaker Notes';
    doc.text(appTitle, margin, 115);

    const metaSize = Math.max(16, Math.round(dims.height * 0.021)); // ~23px at 1080p
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(metaSize);
    doc.setTextColor(100, 116, 139);
    const appMeta = chrome.i18n.getMessage('appendixTotal', [slidesWithNotes.length.toString()]) ||
                    `Total slides with notes: ${slidesWithNotes.length}`;
    doc.text(appMeta, margin, 155);

    let y = 220;
    const headerSize = Math.max(24, Math.round(dims.height * 0.030)); // ~32px at 1080p
    const bodySize = Math.max(18, Math.round(dims.height * 0.025));   // ~27px at 1080p
    const lineHeight = Math.round(bodySize * 1.42);                    // ~38px at 1080p
    const itemSpacing = Math.round(dims.height * 0.032);              // ~35px at 1080p

    for (const item of slidesWithNotes) {
      if (y > dims.height - 160) {
        doc.addPage([dims.width, dims.height], dims.orientation);
        doc.setFillColor(248, 250, 252);
        doc.rect(0, 0, dims.width, dims.height, 'F');
        y = margin;
      }

      // Slide Header
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(headerSize);
      doc.setTextColor(234, 67, 53);
      const tag = item.isHidden ? (chrome.i18n.getMessage('slideHiddenTag') || ' [Hidden Slide]') : '';
      const slideLabel = chrome.i18n.getMessage('slideLabel', [item.slideNumber.toString(), tag]) ||
                         `Slide ${item.slideNumber}${tag}:`;
      doc.text(slideLabel, margin, y);
      y += Math.round(headerSize * 1.35);

      // Note Body
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(bodySize);
      doc.setTextColor(30, 41, 59);

      const splitLines = doc.splitTextToSize(item.text, contentW);
      for (const line of splitLines) {
        if (y > dims.height - margin) {
          doc.addPage([dims.width, dims.height], dims.orientation);
          doc.setFillColor(248, 250, 252);
          doc.rect(0, 0, dims.width, dims.height, 'F');
          y = margin;
        }
        doc.text(line, margin, y);

        // Detect hyperlinks in the text line to add interactive PDF link annotations
        const urlRegex = /(https?:\/\/[^\s\)]+|mailto:[^\s\)]+)/g;
        let urlMatch;
        while ((urlMatch = urlRegex.exec(line)) !== null) {
          const rawUrl = urlMatch[1];
          const beforeText = line.substring(0, urlMatch.index);
          const beforeW = doc.getTextWidth(beforeText);
          const linkW = doc.getTextWidth(rawUrl);
          const linkX = margin + beforeW;
          const linkY = y - Math.round(bodySize * 0.85);
          try {
            doc.link(linkX, linkY, linkW, lineHeight, { url: rawUrl });
          } catch (e) {}
        }

        y += lineHeight;
      }

      y += itemSpacing;
    }
  }

  // ==========================================
  // Communication with Extension Popup
  // ==========================================
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'GET_STATUS') {
      (async () => {
        const isGoogle = isPresentationPage();
        if (isGoogle) {
          try {
            await ensureAllThumbnailsLoaded();
          } catch (e) {}
        }
        const title = isGoogle ? getPresentationTitle() : '';
        const thumbs = isGoogle ? getSlideThumbnails() : [];
        const hasNotes = !!document.querySelector('#speakernotes-workspace');

        sendResponse({
          isGoogleSlides: isGoogle,
          title: title,
          slideCount: thumbs.length,
          hasNotes: hasNotes
        });
      })();
      return true;
    }

    if (request.action === 'START_EXPORT_PDF') {
      (async () => {
        try {
          const result = await generatePDF(request.options, (p) => {
            chrome.runtime.sendMessage({ action: 'PROGRESS_UPDATE', progress: p }).catch(() => {});
          });
          sendResponse({ success: true, result });
        } catch (err) {
          sendResponse({ success: false, error: err.message });
        }
      })();
      return true;
    }
  });
})();
