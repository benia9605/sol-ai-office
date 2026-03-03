/**
 * @file src/utils/colorUtils.ts
 * @description 색상 변환 유틸리티
 * - macOS 캘린더 스타일: 연한 프로젝트 색상 → 진한 텍스트 + 더 연한 배경 자동 생성
 * - hex ↔ HSL 변환
 */

/** hex → { h, s, l } (h: 0-360, s: 0-100, l: 0-100) */
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const cleaned = hex.replace('#', '');
  const r = parseInt(cleaned.substring(0, 2), 16) / 255;
  const g = parseInt(cleaned.substring(2, 4), 16) / 255;
  const b = parseInt(cleaned.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/** { h, s, l } → hex */
function hslToHex(h: number, s: number, l: number): string {
  const sN = s / 100;
  const lN = l / 100;

  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lN - c / 2;

  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }

  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * 프로젝트 색상 → 배지 색상 세트 생성 (macOS Calendar 스타일)
 * - dot: 원래 프로젝트 색상
 * - bg: 더 연한 배경 (lightness 94%)
 * - text: 같은 계열 진한 색 (lightness 35%, saturation 조정)
 */
export function getBadgeColors(projectColor: string): { dot: string; bg: string; text: string } {
  if (!projectColor || !projectColor.startsWith('#') || projectColor.length < 7) {
    return { dot: '#d1d5db', bg: '#f3f4f6', text: '#6b7280' };
  }

  const { h, s } = hexToHsl(projectColor);

  return {
    dot: projectColor,
    bg: hslToHex(h, Math.min(s + 10, 60), 94),
    text: hslToHex(h, Math.max(Math.min(s, 40), 20), 35),
  };
}
