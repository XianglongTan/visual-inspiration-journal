/**
 * Content script: 在任意网页注入「截图」悬浮按钮。
 * 使用 getDisplayMedia 进行像素级屏幕捕获（可截取屏幕任意区域），
 * 将截图写入当日手账。
 */

const CONTAINER_ID = 'designlog-screenshot-root';
const Z_BUTTON = 2147483646;
const Z_OVERLAY = 2147483647;

/** 全局单例：同一时间只允许一次截图流程 */
let isCaptureInProgress = false;

function getOrCreateContainer(): HTMLDivElement {
  let el = document.getElementById(CONTAINER_ID) as HTMLDivElement | null;
  if (!el) {
    el = document.createElement('div');
    el.id = CONTAINER_ID;
    // 使用 Popover API 将容器提升到浏览器 Top Layer，
    // 使其凌驾于所有 <dialog> / 弹窗之上（Top Layer 不受 z-index 约束）。
    // 降级方案：不支持 Popover API 时回退到 document.body。
    const root = document.documentElement ?? document.body;
    root.appendChild(el);
    if ('popover' in el) {
      (el as HTMLElement & { popover: string }).popover = 'manual';
      try {
        (el as HTMLElement & { showPopover: () => void }).showPopover();
      } catch {
        // 某些页面安全策略可能阻止 showPopover，静默降级
      }
    }
  }
  return el;
}

function injectStyles(): void {
  if (document.getElementById('designlog-screenshot-styles')) return;
  const style = document.createElement('style');
  style.id = 'designlog-screenshot-styles';
  style.textContent = `
    /* Popover 容器：透明、不拦截点击，仅作 Top Layer 挂载点 */
    #${CONTAINER_ID} {
      position: fixed;
      inset: 0;
      pointer-events: none;
      background: transparent;
      border: none;
      padding: 0;
      margin: 0;
      overflow: visible;
    }
    #${CONTAINER_ID}::backdrop { display: none; }

    #designlog-float-wrapper {
      position: fixed;
      top: 50%;
      transform: translateY(-50%);
      right: 0;
      z-index: ${Z_BUTTON};
      width: 72px;
      min-height: 56px;
      transition: width 0.2s ease, opacity 0.2s ease;
      overflow: visible;
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      opacity: 0.7;
      pointer-events: auto;
    }
    #designlog-float-wrapper:hover { opacity: 1; }
    #designlog-float-wrapper.collapsed { width: 12px; min-height: 56px; overflow: hidden; }

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
      z-index: 3;
      outline: none;
    }
    #designlog-float-hide-btn:hover { color: #f43f5e; background: rgba(255,255,255,0.9); }
    #designlog-float-wrapper.collapsed #designlog-float-hide-btn { display: none; }

    #designlog-float-restore-btn {
      position: absolute;
      left: 0;
      top: 50%;
      transform: translateY(-50%);
      width: 12px;
      height: 56px;
      padding: 0;
      border: none;
      background: transparent;
      color: #fb7185;
      cursor: pointer;
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 3;
      outline: none;
      border-radius: 16px 0 0 16px;
    }
    #designlog-float-restore-btn:hover { color: #f43f5e; }
    #designlog-float-wrapper.collapsed #designlog-float-restore-btn { display: flex; }

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

    #designlog-screenshot-btn-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      border: none;
      background: transparent;
      padding: 0 0 6px;
      outline: none;
    }
    #designlog-float-wrapper.collapsed #designlog-screenshot-btn-wrap { display: none; }
    #designlog-screenshot-btn-wrap:hover #designlog-screenshot-btn { transform: scale(1.08); }
    #designlog-screenshot-btn-wrap:active #designlog-screenshot-btn { transform: scale(0.95); }

    #designlog-screenshot-btn {
      width: 56px;
      height: 56px;
      border-radius: 16px;
      background: linear-gradient(to bottom right, #ffe4e6, #fce7f3);
      box-shadow: 0 4px 14px rgba(244,114,182,0.35);
      border: 2px solid rgba(255,255,255,0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.15s ease;
    }
    #designlog-screenshot-btn svg { width: 28px; height: 28px; color: #fb7185; }

    #designlog-screenshot-label {
      font-size: 11px;
      font-weight: 500;
      color: #fb7185;
      letter-spacing: 0.02em;
      user-select: none;
    }

    #designlog-screenshot-overlay {
      position: fixed;
      inset: 0;
      z-index: ${Z_OVERLAY};
      cursor: crosshair;
      user-select: none;
      pointer-events: auto;
    }

    #designlog-screenshot-hint {
      position: absolute;
      top: 24px;
      left: 50%;
      transform: translateX(-50%);
      padding: 8px 18px;
      border-radius: 9999px;
      background: rgba(255,255,255,0.95);
      box-shadow: 0 4px 12px rgba(0,0,0,0.12);
      color: #57534e;
      font-size: 14px;
      font-family: system-ui, -apple-system, sans-serif;
      pointer-events: none;
      white-space: nowrap;
    }
    #designlog-screenshot-hint kbd {
      padding: 2px 6px;
      background: #e7e5e4;
      border-radius: 4px;
      font-size: 12px;
    }
  `;

  // Image hover save button styles
  const imgStyle = document.createElement('style');
  imgStyle.id = 'designlog-img-hover-styles';
  imgStyle.textContent = `
    #designlog-img-save-pill {
      position: fixed;
      z-index: ${Z_BUTTON};
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 5px 10px 5px 7px;
      border-radius: 9999px;
      background: linear-gradient(to bottom right, #ffe4e6, #fce7f3);
      border: 1.5px solid rgba(255,255,255,0.9);
      box-shadow: 0 4px 14px rgba(244,114,182,0.35);
      color: #e11d48;
      font-size: 12px;
      font-weight: 600;
      font-family: system-ui, -apple-system, sans-serif;
      letter-spacing: 0.01em;
      cursor: pointer;
      pointer-events: auto;
      user-select: none;
      transition: opacity 0.15s ease, transform 0.15s ease;
      white-space: nowrap;
    }
    #designlog-img-save-pill:hover {
      background: linear-gradient(to bottom right, #fecdd3, #fbcfe8);
      transform: scale(1.04);
    }
    #designlog-img-save-pill:active { transform: scale(0.97); }
    #designlog-img-save-pill svg { flex-shrink: 0; }
  `;
  document.head.appendChild(imgStyle);

  document.head.appendChild(style);
}

function cameraIconSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>`;
}

/** 短暂显示一条 toast 提示 */
function showToast(message: string): void {
  const existing = document.getElementById('designlog-toast');
  existing?.remove();
  const toast = document.createElement('div');
  toast.id = 'designlog-toast';
  toast.style.cssText = `
    position: fixed;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(30,27,24,0.82);
    color: #fff;
    padding: 8px 18px;
    border-radius: 8px;
    font-size: 13px;
    z-index: ${Z_OVERLAY};
    pointer-events: none;
    font-family: system-ui, -apple-system, sans-serif;
    white-space: nowrap;
  `;
  toast.textContent = message;
  const container = document.getElementById(CONTAINER_ID);
  (container ?? document.body).appendChild(toast);
  setTimeout(() => toast.remove(), 2800);
}

/**
 * 使用 getDisplayMedia 捕获屏幕帧，然后展示框选遮罩。
 * 遮罩背景显示捕获的屏幕画面，用户拖拽框选后裁剪对应区域。
 */
async function startScreenCapture(): Promise<void> {
  if (isCaptureInProgress) {
    console.warn('DesignLog: 截图流程进行中，请完成后再试');
    return;
  }
  isCaptureInProgress = true;

  let stream: MediaStream | null = null;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: { displaySurface: 'monitor' } as MediaTrackConstraints,
      audio: false,
    });
  } catch {
    // 用户取消或浏览器拒绝，静默退出
    isCaptureInProgress = false;
    return;
  }

  // 从视频流中抓取一帧
  const video = document.createElement('video');
  video.srcObject = stream;
  video.muted = true;

  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('video load timeout')), 6000);
      video.onloadedmetadata = () => {
        clearTimeout(timeout);
        video.play().then(resolve).catch(reject);
      };
      video.onerror = () => { clearTimeout(timeout); reject(new Error('video error')); };
    });
  } catch (err) {
    console.error('DesignLog: 视频帧获取失败', err);
    stream.getTracks().forEach(t => t.stop());
    isCaptureInProgress = false;
    return;
  }

  const srcW = video.videoWidth;
  const srcH = video.videoHeight;
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = srcW;
  srcCanvas.height = srcH;
  srcCanvas.getContext('2d')!.drawImage(video, 0, 0, srcW, srcH);

  // 立即停止流，缩短屏幕共享指示器的显示时间
  stream.getTracks().forEach(t => t.stop());
  video.srcObject = null;

  showSelectionOverlay(srcCanvas);
}

/**
 * 展示全屏暗色遮罩（不显示截屏图像，无变形）。
 * 用户拖拽选区；松开后按屏幕坐标映射从捕获帧中裁剪。
 *
 * 坐标映射：
 *   captureScale = 捕获帧像素 / screen.width(CSS px)
 *   视口左上角在屏幕上的偏移 = window.screenX + 浏览器chrome宽高
 *   选区屏幕坐标 = 视口偏移 + clientX/Y
 *   捕获像素坐标 = 屏幕坐标 * captureScale
 */
function showSelectionOverlay(src: HTMLCanvasElement): void {
  const srcW = src.width;
  const srcH = src.height;

  // 屏幕 CSS px → 捕获帧物理像素的缩放比（基础设备 DPR，不含浏览器缩放）
  const captureScaleX = srcW / screen.width;
  const captureScaleY = srcH / screen.height;

  // 浏览器缩放系数：devicePixelRatio 包含缩放，除以基础 DPR 得到纯缩放倍数
  // 例：Ctrl+放大至 110% 时 zoomFactor ≈ 1.1
  const zoomFactor = window.devicePixelRatio / captureScaleX;

  // 视口左上角在屏幕上的位置（屏幕 CSS px）
  // 注意：outerWidth/innerWidth 单位不同（outer=屏幕 CSS px，inner=视口 CSS px）
  // 需将 innerWidth 换算到屏幕 CSS px 再做减法
  const chromeW = Math.round((window.outerWidth - window.innerWidth * zoomFactor) / 2);
  const chromeH = window.outerHeight - window.innerHeight * zoomFactor;
  const vpLeft = window.screenX + chromeW;
  const vpTop = window.screenY + chromeH;

  const overlay = document.createElement('div');
  overlay.id = 'designlog-screenshot-overlay';

  // 提示文字
  const hint = document.createElement('div');
  hint.id = 'designlog-screenshot-hint';
  hint.innerHTML = '拖拽框选区域，松开即截屏 &middot; 按 <kbd>Esc</kbd> 取消';
  overlay.appendChild(hint);

  // 选框（仅边线，配合 boxShadow 暗化外侧）
  const selRect = document.createElement('div');
  selRect.style.cssText = 'position:absolute;pointer-events:none;border:2px solid #fb7185;display:none;';
  overlay.appendChild(selRect);

  let startX = 0, startY = 0, currentX = 0, currentY = 0;
  let isDragging = false;
  let keyHandler: ((e: KeyboardEvent) => void) | null = null;

  function updateSelRect(): void {
    const left = Math.min(startX, currentX);
    const top = Math.min(startY, currentY);
    const w = Math.abs(currentX - startX);
    const h = Math.abs(currentY - startY);
    selRect.style.left = `${left}px`;
    selRect.style.top = `${top}px`;
    selRect.style.width = `${w}px`;
    selRect.style.height = `${h}px`;
    selRect.style.boxShadow = '0 0 0 9999px rgba(0,0,0,0.45)';
    selRect.style.display = 'block';
  }

  function destroy(): void {
    overlay.remove();
    if (keyHandler) window.removeEventListener('keydown', keyHandler);
    isCaptureInProgress = false;
  }

  overlay.addEventListener('mousedown', (e: MouseEvent) => {
    e.preventDefault();
    isDragging = true;
    startX = currentX = e.clientX;
    startY = currentY = e.clientY;
    selRect.style.display = 'none';
  });

  overlay.addEventListener('mousemove', (e: MouseEvent) => {
    if (!isDragging) return;
    currentX = e.clientX;
    currentY = e.clientY;
    updateSelRect();
  });

  overlay.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;

    const w = Math.abs(currentX - startX);
    const h = Math.abs(currentY - startY);
    if (w < 10 || h < 10) {
      destroy();
      return;
    }

    // 视口 CSS px → 屏幕 CSS px（乘以 zoomFactor）→ 捕获像素（乘以 captureScale）
    const selLeft = Math.min(startX, currentX);
    const selTop = Math.min(startY, currentY);
    const cropLeft = Math.max(0, Math.round((vpLeft + selLeft * zoomFactor) * captureScaleX));
    const cropTop = Math.max(0, Math.round((vpTop + selTop * zoomFactor) * captureScaleY));
    const cropW = Math.min(Math.round(w * zoomFactor * captureScaleX), srcW - cropLeft);
    const cropH = Math.min(Math.round(h * zoomFactor * captureScaleY), srcH - cropTop);

    if (cropW <= 0 || cropH <= 0) { destroy(); return; }

    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = cropW;
    cropCanvas.height = cropH;
    cropCanvas.getContext('2d')!.drawImage(src, cropLeft, cropTop, cropW, cropH, 0, 0, cropW, cropH);

    const dataUrl = cropCanvas.toDataURL('image/png');
    destroy();

    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      try {
        chrome.runtime.sendMessage({ type: 'PENDING_SCREENSHOT', dataUrl }, () => {
          if (chrome.runtime.lastError) {
            console.error('DesignLog:', chrome.runtime.lastError.message);
          }
        });
      } catch (err) {
        console.error(
          'DesignLog: 扩展上下文已失效（Extension context invalidated）。' +
          '请刷新此标签页后重新截图。',
          err
        );
      }
    }
  });

  keyHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') destroy();
  };
  window.addEventListener('keydown', keyHandler);

  // 将遮罩挂载到与悬浮按钮相同的 Top Layer 容器，
  // 确保在任何弹窗/dialog 之上都能响应交互。
  const container = document.getElementById(CONTAINER_ID);
  (container ?? document.body).appendChild(overlay);
}

// ─── Image hover save pill ───────────────────────────────────────────────────

const MIN_IMG_SIZE = 80; // px — ignore tiny icons/avatars

let imgSavePill: HTMLDivElement | null = null;
let pillTargetImg: HTMLImageElement | null = null;
let pillHideTimer: ReturnType<typeof setTimeout> | null = null;

function sendImageUrl(url: string): void {
  if (!url || url.startsWith('data:') || url.startsWith('blob:')) return;
  if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    try {
      chrome.runtime.sendMessage({ type: 'SAVE_IMAGE_URL', url }, () => {
        if (chrome.runtime.lastError) {
          console.error('DesignLog:', chrome.runtime.lastError.message);
        }
      });
    } catch (err) {
      console.error('DesignLog: 扩展上下文已失效，请刷新页面后重试', err);
    }
  }
}

function getOrCreateImgSavePill(): HTMLDivElement {
  if (imgSavePill) return imgSavePill;
  imgSavePill = document.createElement('div');
  imgSavePill.id = 'designlog-img-save-pill';
  imgSavePill.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 5v14M5 12l7 7 7-7"/>
    </svg>
    保存到视觉灵感手账
  `;
  imgSavePill.style.opacity = '0';
  imgSavePill.style.pointerEvents = 'none';
  document.body.appendChild(imgSavePill);

  imgSavePill.addEventListener('mouseenter', () => {
    if (pillHideTimer) { clearTimeout(pillHideTimer); pillHideTimer = null; }
  });
  imgSavePill.addEventListener('mouseleave', () => {
    scheduleHidePill();
  });
  imgSavePill.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (pillTargetImg?.src) sendImageUrl(pillTargetImg.src);
  });

  return imgSavePill;
}

function showPillOnImg(img: HTMLImageElement): void {
  const rect = img.getBoundingClientRect();
  if (rect.width < MIN_IMG_SIZE || rect.height < MIN_IMG_SIZE) return;

  pillTargetImg = img;
  if (pillHideTimer) { clearTimeout(pillHideTimer); pillHideTimer = null; }

  const pill = getOrCreateImgSavePill();
  // Estimate pill width ~150px, height ~28px; clamp within viewport
  const pillW = 156;
  const pillH = 28;
  const gap = 8;
  let top = rect.bottom - pillH - gap;
  let left = rect.right - pillW - gap;
  if (left < gap) left = gap;
  if (top < gap) top = gap;

  pill.style.top = `${top}px`;
  pill.style.left = `${left}px`;
  pill.style.opacity = '1';
  pill.style.pointerEvents = 'auto';
}

function scheduleHidePill(): void {
  pillHideTimer = setTimeout(() => {
    if (imgSavePill) {
      imgSavePill.style.opacity = '0';
      imgSavePill.style.pointerEvents = 'none';
    }
    pillTargetImg = null;
    pillHideTimer = null;
  }, 200);
}

function attachImgHoverListeners(img: HTMLImageElement): void {
  if ((img as HTMLImageElement & { _dlAttached?: boolean })._dlAttached) return;
  (img as HTMLImageElement & { _dlAttached?: boolean })._dlAttached = true;

  img.addEventListener('mouseenter', () => showPillOnImg(img));
  img.addEventListener('mouseleave', () => scheduleHidePill());
}

function scanAndAttach(): void {
  document.querySelectorAll<HTMLImageElement>('img').forEach(attachImgHoverListeners);
}

function initImageHover(): void {
  scanAndAttach();
  // Watch for dynamically added images (e.g. Xiaohongshu lazy-loads)
  const observer = new MutationObserver(() => scanAndAttach());
  observer.observe(document.body, { childList: true, subtree: true });
}

// ─────────────────────────────────────────────────────────────────────────────

function run(): void {
  injectStyles();
  const container = getOrCreateContainer();
  container.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.id = 'designlog-float-wrapper';

  // 收起状态的边条
  const edgeDiv = document.createElement('div');
  edgeDiv.id = 'designlog-float-edge';

  // 还原按钮（收起状态可见）
  const restoreBtn = document.createElement('button');
  restoreBtn.type = 'button';
  restoreBtn.id = 'designlog-float-restore-btn';
  restoreBtn.title = '展开悬浮窗';
  restoreBtn.setAttribute('aria-label', '展开悬浮窗');
  restoreBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>`;

  // 收起按钮（展开状态可见，绝对定位在 wrapper 左上角）
  const hideBtn = document.createElement('button');
  hideBtn.type = 'button';
  hideBtn.id = 'designlog-float-hide-btn';
  hideBtn.title = '收起悬浮窗';
  hideBtn.setAttribute('aria-label', '收起悬浮窗');
  hideBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>`;

  // 截图主按钮（相机图标 + 文案）
  const screenshotBtnInner = document.createElement('div');
  screenshotBtnInner.id = 'designlog-screenshot-btn';
  screenshotBtnInner.innerHTML = cameraIconSvg();

  const labelSpan = document.createElement('span');
  labelSpan.id = 'designlog-screenshot-label';
  labelSpan.textContent = '截图';

  const btnWrap = document.createElement('button');
  btnWrap.type = 'button';
  btnWrap.id = 'designlog-screenshot-btn-wrap';
  btnWrap.title = '截屏并导入今日手账';
  btnWrap.setAttribute('aria-label', '截屏并导入今日手账');
  btnWrap.appendChild(screenshotBtnInner);
  btnWrap.appendChild(labelSpan);

  hideBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    wrapper.classList.add('collapsed');
  });

  restoreBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    wrapper.classList.remove('collapsed');
  });

  btnWrap.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    startScreenCapture();
  });

  wrapper.appendChild(edgeDiv);
  wrapper.appendChild(restoreBtn);
  wrapper.appendChild(hideBtn);
  wrapper.appendChild(btnWrap);
  container.appendChild(wrapper);

  // 阻止容器内所有鼠标/指针事件向上冒泡到 document，
  // 防止触发弹窗的"点击外部区域自动关闭"逻辑。
  // 用 bubble 阶段拦截（不影响子元素自身接收事件）。
  const stopBubble = (e: Event) => e.stopPropagation();
  for (const type of ['mousedown', 'mouseup', 'click', 'pointerdown', 'pointerup']) {
    container.addEventListener(type, stopBubble);
  }
}

function init(): void {
  if (!document.body) {
    document.addEventListener('DOMContentLoaded', init);
    return;
  }
  try {
    run();
    initImageHover();
  } catch (e) {
    console.error('DesignLog content script failed:', e);
  }
}

init();
