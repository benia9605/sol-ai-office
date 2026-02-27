/**
 * @file src/utils/readingProgress.ts
 * @description 독서/학습 진행률 계산 유틸
 * - 책: currentPage / totalPages
 * - 강의: currentLesson / totalLessons
 * - 완료 상태: 100%
 */
import { ReadingItem } from '../types';

export function calcReadingProgress(item: ReadingItem): number {
  if (item.status === 'completed') return 100;
  if (item.totalPages && item.currentPage) {
    return Math.min(100, Math.round((item.currentPage / item.totalPages) * 100));
  }
  if (item.totalLessons && item.currentLesson) {
    return Math.min(100, Math.round((item.currentLesson / item.totalLessons) * 100));
  }
  return 0;
}

/** 진행률 텍스트 (예: "230/320p", "189/420강") */
export function progressLabel(item: ReadingItem): string {
  if (item.totalPages) {
    return `${item.currentPage || 0}/${item.totalPages}p`;
  }
  if (item.totalLessons) {
    return `${item.currentLesson || 0}/${item.totalLessons}강`;
  }
  return '';
}
