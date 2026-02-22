import React, { useRef, useState, useCallback } from 'react';

interface Props {
  onCapture: (dataUrl: string) => void;
}

/**
 * 与 content script 中悬浮按钮逻辑一致的 React 版本，
 * 供扩展自身页面（index.html）使用。
 * 同样采用 getDisplayMedia + 屏幕坐标映射裁剪，无图像变形。
 */
const FloatingCaptureButton: React.FC<Props> = ({ onCapture }) => {
  const [collapsed, setCollapsed] = useState(false);
  const inProgressRef = useRef(false);

  const startCapture = useCallback(async () => {
    if (inProgressRef.current) return;
    inProgressRef.current = true;

    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'monitor' } as MediaTrackConstraints,
        audio: false,
      });
    } catch {
      inProgressRef.current = false;
      return;
    }

    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;

    try {
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('timeout')), 6000);
        video.onloadedmetadata = () => { clearTimeout(t); video.play().then(resolve).catch(reject); };
        video.onerror = () => { clearTimeout(t); reject(new Error('video error')); };
      });
    } catch {
      stream.getTracks().forEach(t => t.stop());
      inProgressRef.current = false;
      return;
    }

    const srcW = video.videoWidth;
    const srcH = video.videoHeight;
    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = srcW;
    srcCanvas.height = srcH;
    srcCanvas.getContext('2d')!.drawImage(video, 0, 0, srcW, srcH);

    stream.getTracks().forEach(t => t.stop());
    video.srcObject = null;

    showOverlay(srcCanvas, () => { inProgressRef.current = false; }, onCapture);
  }, [onCapture]);

  const btnStyle: React.CSSProperties = {
    position: 'fixed',
    top: '50%',
    right: 0,
    transform: 'translateY(-50%)',
    zIndex: 9998,
    minHeight: 56,
    fontFamily: 'system-ui, -apple-system, sans-serif',
    transition: 'opacity 0.2s ease',
  };

  if (collapsed) {
    return (
      <div style={{ ...btnStyle, width: 12, opacity: 0.7 }}>
        {/* 边条 */}
        <div style={{
          position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
          width: 12, height: 56, borderRadius: '16px 0 0 16px',
          border: '2px solid rgba(255,255,255,0.8)', borderRight: 'none',
          background: 'linear-gradient(to bottom right, #ffe4e6, #fce7f3)',
          boxShadow: '2px 0 8px rgba(244,114,182,0.2)',
        }} />
        {/* 还原按钮 */}
        <button
          title="展开悬浮窗" aria-label="展开悬浮窗"
          onClick={() => setCollapsed(false)}
          style={{
            position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
            width: 12, height: 56, padding: 0, border: 'none', background: 'transparent',
            color: '#fb7185', cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 2,
            outline: 'none', borderRadius: '16px 0 0 16px',
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div
      style={{ ...btnStyle, width: 72, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.7 }}
      onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
      onMouseLeave={e => (e.currentTarget.style.opacity = '0.7')}
    >
      {/* 收起按钮 */}
      <button
        title="收起悬浮窗" aria-label="收起悬浮窗"
        onClick={e => { e.stopPropagation(); setCollapsed(true); }}
        style={{
          position: 'absolute', top: 2, left: 2, width: 20, height: 20,
          padding: 0, border: 'none', background: 'rgba(255,255,255,0.6)',
          borderRadius: 6, color: '#fb7185', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 3, outline: 'none',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>

      {/* 截图按钮 */}
      <button
        title="截屏并导入今日手账" aria-label="截屏并导入今日手账"
        onClick={startCapture}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
          border: 'none', background: 'transparent', padding: '0 0 6px',
          cursor: 'pointer', outline: 'none',
        }}
      >
        <div style={{
          width: 56, height: 56, borderRadius: 16,
          background: 'linear-gradient(to bottom right, #ffe4e6, #fce7f3)',
          boxShadow: '0 4px 14px rgba(244,114,182,0.35)',
          border: '2px solid rgba(255,255,255,0.8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'transform 0.15s ease',
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fb7185" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
            <circle cx="12" cy="13" r="3" />
          </svg>
        </div>
        <span style={{ fontSize: 11, fontWeight: 500, color: '#fb7185', letterSpacing: '0.02em', userSelect: 'none' }}>
          截图
        </span>
      </button>
    </div>
  );
};

/**
 * 纯 DOM 遮罩：暗色蒙版 + 坐标映射裁剪，不显示屏幕预览，无变形。
 */
function showOverlay(
  src: HTMLCanvasElement,
  onDone: () => void,
  onCapture: (dataUrl: string) => void,
): void {
  const srcW = src.width;
  const srcH = src.height;
  const captureScaleX = srcW / screen.width;
  const captureScaleY = srcH / screen.height;
  const zoomFactor = window.devicePixelRatio / captureScaleX;
  const chromeW = Math.round((window.outerWidth - window.innerWidth * zoomFactor) / 2);
  const chromeH = window.outerHeight - window.innerHeight * zoomFactor;
  const vpLeft = window.screenX + chromeW;
  const vpTop = window.screenY + chromeH;

  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:2147483647;
    background:rgba(0,0,0,0.4);cursor:crosshair;user-select:none;
  `;

  const hint = document.createElement('div');
  hint.innerHTML = '拖拽框选区域，松开即截屏 &middot; 按 <kbd style="padding:2px 6px;background:#e7e5e4;border-radius:4px;font-size:12px">Esc</kbd> 取消';
  hint.style.cssText = `
    position:absolute;top:24px;left:50%;transform:translateX(-50%);
    padding:8px 18px;border-radius:9999px;background:rgba(255,255,255,0.95);
    box-shadow:0 4px 12px rgba(0,0,0,0.12);color:#57534e;font-size:14px;
    font-family:system-ui,sans-serif;pointer-events:none;white-space:nowrap;
  `;
  overlay.appendChild(hint);

  const selRect = document.createElement('div');
  selRect.style.cssText = 'position:absolute;pointer-events:none;border:2px solid #fb7185;display:none;';
  overlay.appendChild(selRect);

  let startX = 0, startY = 0, currentX = 0, currentY = 0, isDragging = false;
  let keyHandler: ((e: KeyboardEvent) => void) | null = null;

  function destroy(): void {
    overlay.remove();
    if (keyHandler) window.removeEventListener('keydown', keyHandler);
    onDone();
  }

  function updateSel(): void {
    const left = Math.min(startX, currentX);
    const top = Math.min(startY, currentY);
    selRect.style.left = `${left}px`;
    selRect.style.top = `${top}px`;
    selRect.style.width = `${Math.abs(currentX - startX)}px`;
    selRect.style.height = `${Math.abs(currentY - startY)}px`;
    selRect.style.boxShadow = '0 0 0 9999px rgba(0,0,0,0.45)';
    selRect.style.display = 'block';
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
    updateSel();
  });

  overlay.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    const w = Math.abs(currentX - startX);
    const h = Math.abs(currentY - startY);
    if (w < 10 || h < 10) { destroy(); return; }

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
    destroy();
    onCapture(cropCanvas.toDataURL('image/png'));
  });

  keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') destroy(); };
  window.addEventListener('keydown', keyHandler);
  document.body.appendChild(overlay);
}

export default FloatingCaptureButton;
