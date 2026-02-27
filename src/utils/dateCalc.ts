/**
 * @file src/utils/dateCalc.ts
 * @description 반복 태스크 다음 날짜 계산
 */
import { RepeatType } from '../types';

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

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
