import React, { useState, useRef, useCallback, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { replaceUnsupportedColorFunctions, stripUnsupportedColorsInClone } from '../utils/stripUnsupportedColors';

/** 从当前文档收集所有样式表文本（含通过 link 加载的），同源可读 */
function getDocumentCSS(doc: Document): string {
  let out = '';
  try {
    const sheets = Array.from(doc.styleSheets);
    for (const sheet of sheets) {
      try {
        const rules = (sheet as CSSStyleSheet).cssRules ?? (sheet as CSSStyleSheet).rules;
        if (rules) {
          for (let i = 0; i < rules.length; i++) {
            out += rules[i].cssText;
          }
        }
      } catch {
        // 跨域或禁用样式表时无法读取
      }
    }
  } catch {
    // ignore
  }
  return out;
}

interface ScreenshotOverlayProps {
  onCapture: (dataUrl: string) => void;
  onCancel: () => void;
}

const ScreenshotOverlay: React.FC<ScreenshotOverlayProps> = ({ onCapture, onCancel }) => {
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [current, setCurrent] = useState<{ x: number; y: number } | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  const rect = start && current
    ? {
        left: Math.min(start.x, current.x),
        top: Math.min(start.y, current.y),
        width: Math.abs(current.x - start.x),
        height: Math.abs(current.y - start.y),
      }
    : null;

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setStart({ x: e.clientX, y: e.clientY });
    setCurrent({ x: e.clientX, y: e.clientY });
    setIsCapturing(true);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isCapturing) return;
    setCurrent({ x: e.clientX, y: e.clientY });
  }, [isCapturing]);

  const handleMouseUp = useCallback(() => {
    if (!start || !current) return;
    const w = Math.abs(current.x - start.x);
    const h = Math.abs(current.y - start.y);
    if (w < 10 || h < 10) {
      setStart(null);
      setCurrent(null);
      setIsCapturing(false);
      return;
    }
    setIsCapturing(false);
    captureRegion(start, current);
    setStart(null);
    setCurrent(null);
  }, [start, current, isCapturing]);

  const TRANSPARENT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

  const replaceCrossOriginImages = (doc: Document): void => {
    doc.querySelectorAll('img[src^="http://"], img[src^="https://"]').forEach((img) => {
      (img as HTMLImageElement).src = TRANSPARENT_PIXEL;
    });
  };

  const captureRegion = useCallback(
    async (startPt: { x: number; y: number }, endPt: { x: number; y: number }) => {
      const left = Math.min(startPt.x, endPt.x);
      const top = Math.min(startPt.y, endPt.y);
      const width = Math.abs(endPt.x - startPt.x);
      const height = Math.abs(endPt.y - startPt.y);

      // 先收集当前文档全部 CSS（含 link 加载的），替换 oklch/oklab，克隆里会注入为 style 再删 link，避免克隆文档无样式变灰
      const fullCSS = getDocumentCSS(document);
      const replacedCSS = replaceUnsupportedColorFunctions(fullCSS);

      try {
        // 取当前页背景色，供 html2canvas 顶层使用（扩展页克隆后样式可能丢失，必须显式传）
        const bgColor =
          document.body && getComputedStyle(document.body).backgroundColor !== 'rgba(0, 0, 0, 0)'
            ? getComputedStyle(document.body).backgroundColor
            : (getComputedStyle(document.documentElement).backgroundColor || '#f3f4f6');
        // 使用 scale: 1，使画布尺寸与 CSS 像素一致，裁剪坐标才能与框选区域对齐
        const canvas = await html2canvas(document.body, {
          allowTaint: true,
          useCORS: true,
          scale: 1,
          backgroundColor: bgColor,
          scrollX: window.scrollX,
          scrollY: window.scrollY,
          windowWidth: document.documentElement.scrollWidth,
          windowHeight: document.documentElement.scrollHeight,
          onclone: (clonedDoc) => {
            replaceCrossOriginImages(clonedDoc);
            const style = clonedDoc.createElement('style');
            style.textContent = replacedCSS;
            clonedDoc.head.insertBefore(style, clonedDoc.head.firstChild);
            clonedDoc.querySelectorAll('link[rel="stylesheet"]').forEach((el) => el.remove());
            stripUnsupportedColorsInClone(clonedDoc);
            (clonedDoc.documentElement as HTMLElement).style.backgroundColor = bgColor;
            (clonedDoc.body as HTMLElement).style.backgroundColor = bgColor;
          },
        });

        const sourceX = left + window.scrollX;
        const sourceY = top + window.scrollY;
        const cropped = document.createElement('canvas');
        cropped.width = width;
        cropped.height = height;
        const ctx = cropped.getContext('2d');
        if (!ctx) {
          onCancel();
          return;
        }
        ctx.drawImage(canvas, sourceX, sourceY, width, height, 0, 0, width, height);
        const dataUrl = cropped.toDataURL('image/png');
        onCapture(dataUrl);
      } catch (err) {
        console.error('Screenshot failed:', err);
        onCancel();
      }
    },
    [onCapture, onCancel]
  );

  useEffect(() => {
    const onUp = () => handleMouseUp();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('mouseup', onUp);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('keydown', onKey);
    };
  }, [handleMouseUp, onCancel]);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[9999] bg-black/40 cursor-crosshair"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* 提示文案 */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-white/95 shadow-lg text-stone-600 text-sm">
        拖拽框选区域，松开即截屏 · 按 <kbd className="px-1.5 py-0.5 bg-stone-200 rounded text-xs">Esc</kbd> 取消
      </div>

      {/* 微信风格：选区外变暗，选区透明 + 玫瑰色边框 */}
      {rect && rect.width > 0 && rect.height > 0 && (
        <div
          className="absolute border-2 border-rose-400 pointer-events-none bg-transparent"
          style={{
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
          }}
        />
      )}
    </div>
  );
};

export default ScreenshotOverlay;
