/**
 * html2canvas 只支持 rgb/rgba/hsl/hsla，不支持 oklch/oklab/color-mix。
 * 在 onclone 里对克隆文档的样式做替换，避免 "Attempting to parse an unsupported color function"。
 * 将 oklch/oklab 转为 rgb，并去掉 color-mix(in oklab,...)。
 */

const M3 = [
  1.2268798758459243, -0.5578149944602171, 0.2813910456659647,
  -0.0405757452148008, 1.112286803280317, -0.0717110580655164,
  -0.0763729366746601, -0.4214933324022432, 1.5869240198367816,
];
const M2 = [
  1, 0.3963377773761749, 0.2158037573099136,
  1, -0.1055613458156586, -0.0638541728258133,
  1, -0.0894841775298119, -1.2914855480194092,
];
const M1 = [
  3.2409699419045226, -1.537383177570094, -0.4986107602930034,
  -0.9692436362808796, 1.8759675015077202, 0.04155505740717559,
  0.05563007969699366, -0.20397695888897652, 1.0569715142428786,
];

function multiplyMatrices(A: number[], B: number[]): number[] {
  return [
    A[0] * B[0] + A[1] * B[1] + A[2] * B[2],
    A[3] * B[0] + A[4] * B[1] + A[5] * B[2],
    A[6] * B[0] + A[7] * B[1] + A[8] * B[2],
  ];
}

function oklch2oklab([l, c, h]: number[]): number[] {
  const hRad = (h * Math.PI) / 180;
  return [
    l,
    isNaN(h) ? 0 : c * Math.cos(hRad),
    isNaN(h) ? 0 : c * Math.sin(hRad),
  ];
}

function oklab2xyz(lab: number[]): number[] {
  const LMSg = multiplyMatrices(M2, lab).map((v) => v ** 3);
  return multiplyMatrices(M3, LMSg);
}

function xyz2rgbLinear(xyz: number[]): number[] {
  return multiplyMatrices(M1, xyz);
}

function srgbLinear2rgb(rgb: number[]): number[] {
  return rgb.map((c) =>
    Math.abs(c) > 0.0031308
      ? (c < 0 ? -1 : 1) * (1.055 * Math.abs(c) ** (1 / 2.4) - 0.055)
      : 12.92 * c
  );
}

function oklchToRgb(l: number, c: number, h: number, a = 1): string {
  const lab = oklch2oklab([l, c, h]);
  const xyz = oklab2xyz(lab);
  const linear = xyz2rgbLinear(xyz);
  const rgb = srgbLinear2rgb(linear).map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255));
  if (a >= 1) return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
}

function oklabToRgb(L: number, a: number, b: number, alpha = 1): string {
  const xyz = oklab2xyz([L, a, b]);
  const linear = xyz2rgbLinear(xyz);
  const rgb = srgbLinear2rgb(linear).map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255));
  if (alpha >= 1) return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
}

const GRAY = 'rgb(128,128,128)';

function parseOklchArgs(inner: string): { l: number; c: number; h: number; a: number } | null {
  const slash = inner.indexOf('/');
  const main = (slash >= 0 ? inner.slice(0, slash) : inner).trim();
  const parts = main.split(/\s+/).filter(Boolean);
  if (parts.length < 3) return null;
  const l = parts[0].endsWith('%') ? parseFloat(parts[0]) / 100 : parseFloat(parts[0]);
  const c = parseFloat(parts[1]);
  const h = parseFloat(parts[2]);
  let a = 1;
  if (slash >= 0) {
    const alphaPart = inner.slice(slash + 1).trim();
    const num = parseFloat(alphaPart);
    a = Number.isNaN(num) ? 1 : num;
  }
  if (Number.isNaN(l) || Number.isNaN(c) || Number.isNaN(h)) return null;
  return { l, c, h, a };
}

function parseOklabArgs(inner: string): { L: number; a: number; b: number; alpha: number } | null {
  const slash = inner.indexOf('/');
  const main = (slash >= 0 ? inner.slice(0, slash) : inner).trim();
  const parts = main.split(/\s+/).filter(Boolean);
  if (parts.length < 3) return null;
  const L = parts[0].endsWith('%') ? parseFloat(parts[0]) / 100 : parseFloat(parts[0]);
  const a = parseFloat(parts[1]);
  const b = parseFloat(parts[2]);
  let alpha = 1;
  if (slash >= 0) {
    const alphaPart = inner.slice(slash + 1).trim();
    const num = parseFloat(alphaPart);
    alpha = Number.isNaN(num) ? 1 : num;
  }
  if (Number.isNaN(L) || Number.isNaN(a) || Number.isNaN(b)) return null;
  return { L, a, b, alpha };
}

/** 匹配括号对：从 start 找 name(，然后找到与之匹配的 )，返回 [start, end] */
function findMatchingParen(s: string, name: string): [number, number] | null {
  const open = s.indexOf(name + '(');
  if (open === -1) return null;
  const start = open + name.length + 1;
  let depth = 1;
  for (let i = start; i < s.length; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')') {
      depth--;
      if (depth === 0) return [open, i + 1];
    }
  }
  return null;
}

/** 将 CSS 中所有 oklch/oklab/color-mix(in oklab,...) 替换为 html2canvas 支持的 rgb/rgba */
export function replaceUnsupportedColorFunctions(css: string): string {
  let out = css;

  // color-mix(in oklab, ...) 整段替换为第一个颜色或灰色，避免解析失败
  let range = findMatchingParen(out, 'color-mix');
  while (range) {
    const [start, end] = range;
    const slice = out.slice(start, end);
    if (/color-mix\s*\(\s*in\s+oklab\s*,/i.test(slice)) {
      // 取第一个颜色：color-mix(in oklab, var(--x) 50%, transparent) -> var(--x)
      const inner = slice.slice(slice.indexOf(',') + 1, -1).trim();
      const firstComma = inner.indexOf(',');
      const firstPart = (firstComma >= 0 ? inner.slice(0, firstComma) : inner).trim();
      const varMatch = firstPart.match(/^(var\s*\([^)]+\))/);
      const fallback = varMatch ? varMatch[1] : GRAY;
      out = out.slice(0, start) + fallback + out.slice(end);
    } else {
      out = out.slice(0, start) + GRAY + out.slice(end);
    }
    range = findMatchingParen(out, 'color-mix');
  }

  // oklch(...)
  out = out.replace(/oklch\s*\(\s*([^)]*(?:\([^)]*\))?[^)]*)\s*\)/g, (_, inner) => {
    const parsed = parseOklchArgs(inner);
    if (!parsed) return GRAY;
    return oklchToRgb(parsed.l, parsed.c, parsed.h, parsed.a);
  });

  // oklab(...)
  out = out.replace(/oklab\s*\(\s*([^)]*(?:\([^)]*\))?[^)]*)\s*\)/g, (_, inner) => {
    const parsed = parseOklabArgs(inner);
    if (!parsed) return GRAY;
    return oklabToRgb(parsed.L, parsed.a, parsed.b, parsed.alpha);
  });

  return out;
}

/** 在克隆文档中移除外链样式并替换所有不支持的色彩函数 */
export function stripUnsupportedColorsInClone(doc: Document): void {
  doc.querySelectorAll('link[rel="stylesheet"]').forEach((link) => link.remove());
  doc.querySelectorAll('style').forEach((el) => {
    const raw = (el as HTMLStyleElement).textContent || '';
    if (/oklch|oklab|color-mix\s*\(\s*in\s+oklab/i.test(raw)) {
      (el as HTMLStyleElement).textContent = replaceUnsupportedColorFunctions(raw);
    }
  });
  doc.querySelectorAll('[style]').forEach((el) => {
    const htmlEl = el as HTMLElement;
    const css = htmlEl.style?.cssText || '';
    if (/oklch|oklab|color-mix\s*\(\s*in\s+oklab/i.test(css)) {
      htmlEl.style.cssText = replaceUnsupportedColorFunctions(css);
    }
  });
}
