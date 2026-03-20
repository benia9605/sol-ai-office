/**
 * @file supabase/functions/_shared/kst.ts
 * @description KST 시간 유틸리티
 * - UTC → KST 변환, 오늘 날짜 문자열 등
 */

const KST_OFFSET = 9 * 60 * 60 * 1000;

/** 현재 KST Date 객체 */
export function getKSTNow(): Date {
  return new Date(Date.now() + KST_OFFSET);
}

/** 오늘 KST 날짜 문자열 (YYYY-MM-DD) */
export function getKSTDateString(date?: Date): string {
  const d = date || getKSTNow();
  return d.toISOString().slice(0, 10);
}

/** 내일 KST 날짜 문자열 */
export function getKSTTomorrowString(): string {
  const d = getKSTNow();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** 현재 KST 시간 문자열 (HH:MM) */
export function getKSTTimeString(): string {
  const d = getKSTNow();
  return d.toISOString().slice(11, 16);
}

/** 리마인더 오프셋을 분 단위로 변환 */
export function reminderToMinutes(reminder: string): number {
  switch (reminder) {
    case '10min': return 10;
    case '30min': return 30;
    case '1hour': return 60;
    case '1day': return 1440;
    default: return 0;
  }
}
