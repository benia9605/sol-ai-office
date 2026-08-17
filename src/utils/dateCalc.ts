/**
 * @file src/utils/dateCalc.ts
 * @description 날짜 유틸 함수 (반복 계산, 오늘/내일 문자열 등)
 */
import { RepeatType } from '../types';

function formatDateStr(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function getTodayStr(): string {
  return formatDateStr(new Date());
}

export function getTomorrowStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return formatDateStr(d);
}

/** 로컬 기준 날짜 더하기 (YYYY-MM-DD → YYYY-MM-DD). toISOString 왕복 없이 안전(타임존 밀림 방지). */
export function addDaysStr(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return getTodayStr();
  return formatDateStr(new Date(y, m - 1, d + n));
}

export function calcNextDate(currentDate: string | undefined, repeat: RepeatType): string | undefined {
  if (!currentDate || repeat === 'none' || repeat === 'daily') return undefined;

  const date = new Date(currentDate);

  switch (repeat) {
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    case 'yearly':
      date.setFullYear(date.getFullYear() + 1);
      break;
  }

  return formatDateStr(date);
}
