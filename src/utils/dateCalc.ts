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

/** 오늘로부터 남은 일수 (YYYY-MM-DD 기준, 로컬). 지났으면 음수, 오늘은 0. 기한 없으면 null. */
export function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return null;
  const due = new Date(y, m - 1, d); due.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

export type DateBucket = 'overdue' | 'today' | 'this_week' | 'later' | 'no_date';

/** 기한을 5개 버킷으로 (대시보드 '내 할일' — 가이드 §10.8) */
export function bucketFor(dateStr?: string): DateBucket {
  const diff = daysUntil(dateStr);
  if (diff === null) return 'no_date';
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  if (diff <= 7) return 'this_week';
  return 'later';
}

/** 마감 라벨: "3일 지남" / "오늘 마감" / "내일 마감" / "5일 남음" / "기한 없음" */
export function dueLabel(dateStr?: string): string {
  const diff = daysUntil(dateStr);
  if (diff === null) return '기한 없음';
  if (diff < 0) return `${Math.abs(diff)}일 지남`;
  if (diff === 0) return '오늘 마감';
  if (diff === 1) return '내일 마감';
  return `${diff}일 남음`;
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
