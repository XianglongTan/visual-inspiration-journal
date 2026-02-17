/**
 * Content script: 在任意网页注入「截图」悬浮按钮，截屏后发送给扩展并导入当日手账。
 */
import html2canvas from 'html2canvas';
import { stripUnsupportedColorsInClone } from '../utils/stripUnsupportedColors';

const CONTAINER_ID = 'designlog-screenshot-root';
const Z_BUTTON = 2147483646;
const Z_OVERLAY = 2147483647;

function getOrCreateContainer(): HTMLDivElement {
  let el = document.getElementById(CONTAINER_ID) as HTMLDivElement | null;
  if (!el) {
    el = document.createElement('div');
    el.id = CONTAINER_ID;
    document.body.appendChild(el);
  }
  return el;
}

function injectStyles(): void {
  if (document.getElementById('designlog-screenshot-styles')) return;
  const style = document.createElement('style');
  style.id = 'designlog-screenshot-styles';
  style.textContent = `
    #designlog-float-wrapper {
      position: fixed;
      top: 50%;
      transform: translateY(-50%);
      right: 0;
      z-index: ${Z_BUTTON};
      width: 72px;
      transition: width 0.2s ease;
      overflow: hidden;
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    #designlog-float-wrapper.collapsed { width: 12px; }
    #designlog-float-hide-btn {
      position: absolute;
      top: 2px;
      left: 2px;
      width: 20px;
      height: 20px;
      padding: 0;
      border: none;
      background: rgba(255,255,255,0.6);
      border-radius: 6px;
      color: #fb7185;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2;
      outline: none;
    }
    #designlog-float-hide-btn:hover { color: #f43f5e; background: rgba(255,255,255,0.9); }
    #designlog-float-restore-btn {
      position: absolute;
      inset: 0;
      width: 12px;
      padding: 0;
      border: none;
      background: transparent;
      color: #fb7185;
      cursor: pointer;
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 2;
      outline: none;
      border-radius: 16px 0 0 16px;
    }
    #designlog-float-restore-btn:hover { color: #f43f5e; }
    #designlog-float-wrapper { position: relative; }
    #designlog-float-wrapper.collapsed #designlog-float-restore-btn { display: flex; }
    #designlog-float-wrapper.collapsed #designlog-float-hide-btn { display: none; }
    #designlog-float-edge {
      display: none;
      position: absolute;
      left: 0;
      top: 50%;
      transform: translateY(-50%);
      width: 12px;
      height: 56px;
      border-radius: 16px 0 0 16px;
      border: 2px solid rgba(255,255,255,0.8);
      border-right: none;
      background: linear-gradient(to bottom right, #ffe4e6, #fce7f3);
      box-shadow: 2px 0 8px rgba(244,114,182,0.2);
    }
    #designlog-float-wrapper.collapsed #designlog-float-edge { display: block; }
    #designlog-float-restore-btn { left: 0; top: 50%; transform: translateY(-50%); height: 56px; }
    #designlog-screenshot-btn-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      border: none;
      background: transparent;
      padding: 0;
      outline: none;
    }
    #designlog-float-wrapper.collapsed #designlog-screenshot-btn-wrap { display: none; }
    #designlog-screenshot-btn-wrap:hover #designlog-screenshot-btn { transform: scale(1.1); }
    #designlog-screenshot-btn-wrap:active #designlog-screenshot-btn { transform: scale(0.95); }
    #designlog-screenshot-btn {
      position: relative;
      width: 56px;
      height: 56px;
      border-radius: 16px;
      background: linear-gradient(to bottom right, #ffe4e6, #fce7f3);
      box-shadow: 0 4px 14px rgba(244,114,182,0.35);
      border: 2px solid rgba(255,255,255,0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s;
    }
    #designlog-screenshot-btn svg { width: 28px; height: 28px; color: #fb7185; }
    #designlog-screenshot-label { font-size: 11px; font-weight: 500; color: #fb7185; letter-spacing: 0.02em; }
    #designlog-screenshot-overlay {
      position: fixed;
      inset: 0;
      z-index: ${Z_OVERLAY};
      background: rgba(0,0,0,0.4);
      cursor: crosshair;
      font-family: system-ui, sans-serif;
    }
    #designlog-screenshot-hint {
      position: absolute;
      top: 24px;
      left: 50%;
      transform: translateX(-50%);
      padding: 8px 16px;
      border-radius: 9999px;
      background: rgba(255,255,255,0.95);
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      color: #57534e;
      font-size: 14px;
    }
    #designlog-screenshot-hint kbd { padding: 2px 6px; background: #e7e5e4; border-radius: 4px; font-size: 12px; }
  `;
  document.head.appendChild(style);
}

function cameraIconSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>`;
}

const TRANSPARENT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

function replaceCrossOriginImagesInClone(doc: Document): void {
  doc.querySelectorAll('img[src^="http://"], img[src^="https://"]').forEach((img) => {
    (img as HTMLImageElement).src = TRANSPARENT_PIXEL;
  });
}

async function captureRegion(
  startX: number, startY: number,
  endX: number, endY: number
): Promise<string> {
  const left = Math.min(startX, endX);
  const top = Math.min(startY, endY);
  const width = Math.abs(endX - startX);
  const height = Math.abs(endY - startY);

  // scale: 1 使画布与 CSS 像素一致，裁剪坐标与框选区域对齐
  const canvas = await html2canvas(document.body, {
    allowTaint: true,
    useCORS: true,
    scale: 1,
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    windowWidth: document.documentElement.scrollWidth,
    windowHeight: document.documentElement.scrollHeight,
    onclone: (clonedDoc) => {
      replaceCrossOriginImagesInClone(clonedDoc);
      stripUnsupportedColorsInClone(clonedDoc);
      const bg =
        document.body && getComputedStyle(document.body).backgroundColor !== 'rgba(0, 0, 0, 0)'
          ? getComputedStyle(document.body).backgroundColor
          : getComputedStyle(document.documentElement).backgroundColor || '#f3f4f6';
      (clonedDoc.documentElement as HTMLElement).style.backgroundColor = bg;
      (clonedDoc.body as HTMLElement).style.backgroundColor = bg;
    },
  });

  const sourceX = left + window.scrollX;
  const sourceY = top + window.scrollY;
  const cropped = document.createElement('canvas');
  cropped.width = width;
  cropped.height = height;
  const ctx = cropped.getContext('2d');
  if (!ctx) throw new Error('No 2d context');
  ctx.drawImage(canvas, sourceX, sourceY, width, height, 0, 0, width, height);
  return cropped.toDataURL('image/png');
}

function run(): void {
  injectStyles();
  const container = getOrCreateContainer();
  container.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.id = 'designlog-float-wrapper';

  const hideBtn = document.createElement('button');
  hideBtn.type = 'button';
  hideBtn.id = 'designlog-float-hide-btn';
  hideBtn.title = '收起';
  hideBtn.setAttribute('aria-label', '收起');
  hideBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>';

  const restoreBtn = document.createElement('button');
  restoreBtn.type = 'button';
  restoreBtn.id = 'designlog-float-restore-btn';
  restoreBtn.title = '展开';
  restoreBtn.setAttribute('aria-label', '展开');
  restoreBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>';

  const edgeDiv = document.createElement('div');
  edgeDiv.id = 'designlog-float-edge';

  const screenshotBtn = document.createElement('div');
  screenshotBtn.id = 'designlog-screenshot-btn';
  screenshotBtn.innerHTML = cameraIconSvg();
  screenshotBtn.insertBefore(hideBtn, screenshotBtn.firstChild);

  const labelSpan = document.createElement('span');
  labelSpan.id = 'designlog-screenshot-label';
  labelSpan.textContent = '截图';

  const btnWrap = document.createElement('button');
  btnWrap.type = 'button';
  btnWrap.id = 'designlog-screenshot-btn-wrap';
  btnWrap.title = '截屏并导入今日手账';
  btnWrap.setAttribute('aria-label', '截屏并导入今日手账');
  btnWrap.appendChild(screenshotBtn);
  btnWrap.appendChild(labelSpan);

  const toggleCollapsed = (): void => {
    wrapper.classList.toggle('collapsed');
  };
  hideBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleCollapsed(); });
  restoreBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleCollapsed(); });

  wrapper.appendChild(edgeDiv);
  wrapper.appendChild(restoreBtn);
  wrapper.appendChild(btnWrap);
  container.appendChild(wrapper);

  let overlay: HTMLDivElement | null = null;
  let start: { x: number; y: number } | null = null;
  let current: { x: number; y: number } | null = null;

  function hideOverlay(): void {
    if (overlay && overlay.parentNode) overlay.remove();
    overlay = null;
    start = null;
    current = null;
  }

  function showOverlay(): void {
    overlay = document.createElement('div');
    overlay.id = 'designlog-screenshot-overlay';
    overlay.innerHTML = `
      <div id="designlog-screenshot-hint">
        拖拽框选区域，松开即截屏 · 按 <kbd>Esc</kbd> 取消
      </div>
    `;

    const selectionDiv = document.createElement('div');
    selectionDiv.style.cssText = 'position:absolute;pointer-events:none;border:2px solid #fb7185;background:transparent;display:none;';
    overlay.appendChild(selectionDiv);

    overlay.addEventListener('mousedown', (e: MouseEvent) => {
      e.preventDefault();
      start = { x: e.clientX, y: e.clientY };
      current = { x: e.clientX, y: e.clientY };
      updateSelectionDiv();
      selectionDiv.style.display = 'block';
    });

    overlay.addEventListener('mousemove', (e: MouseEvent) => {
      if (!start) return;
      current = { x: e.clientX, y: e.clientY };
      updateSelectionDiv();
    });

    function updateSelectionDiv(): void {
      if (!start || !current) return;
      const left = Math.min(start.x, current.x);
      const top = Math.min(start.y, current.y);
      const width = Math.abs(current.x - start.x);
      const height = Math.abs(current.y - start.y);
      selectionDiv.style.left = left + 'px';
      selectionDiv.style.top = top + 'px';
      selectionDiv.style.width = width + 'px';
      selectionDiv.style.height = height + 'px';
      selectionDiv.style.boxShadow = '0 0 0 9999px rgba(0,0,0,0.45)';
    }

    overlay.addEventListener('mouseup', async () => {
      if (!start || !current) return;
      const w = Math.abs(current.x - start.x);
      const h = Math.abs(current.y - start.y);
      if (w < 10 || h < 10) {
        hideOverlay();
        return;
      }
      try {
        const dataUrl = await captureRegion(start.x, start.y, current.x, current.y);
        if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
          chrome.runtime.sendMessage({ type: 'PENDING_SCREENSHOT', dataUrl });
        }
      } catch (err) {
        console.error('DesignLog screenshot failed:', err);
      }
      hideOverlay();
    });

    overlay.addEventListener('mouseleave', () => {
      if (start && current) {
        const w = Math.abs(current.x - start.x);
        const h = Math.abs(current.y - start.y);
        if (w >= 10 && h >= 10) {
          overlay?.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
          return;
        }
      }
      hideOverlay();
    });

    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        hideOverlay();
        window.removeEventListener('keydown', onKey);
      }
    };
    window.addEventListener('keydown', onKey);

    document.body.appendChild(overlay);
  }

  btnWrap.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    showOverlay();
  });

  // wrapper 已在上面 appendChild 到 container，不要再用 container.appendChild(btnWrap)，否则会把按钮从 wrapper 移出、脱离 fixed 定位
}

function init(): void {
  if (!document.body) {
    document.addEventListener('DOMContentLoaded', init);
    return;
  }
  try {
    run();
  } catch (e) {
    console.error('DesignLog content script failed:', e);
  }
}
init();
