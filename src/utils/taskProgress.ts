/**
 * @file src/utils/taskProgress.ts
 * @description 할일 진행률 집계 유틸 (회의·일정·멤버·팀 보드 공용) — 가이드 §11.4
 * - 카운트를 DB에 저장하지 않고 항상 tasks에서 실시간 계산한다.
 */
import { TaskItem } from '../types';

export type Progress = { done: number; total: number; overdue: number };
const EMPTY: Progress = { done: 0, total: 0, overdue: 0 };

/** 미완료 + 기한(YYYY-MM-DD) 지남 */
function isOverdue(t: TaskItem, todayStr: string): boolean {
  if (t.status === 'completed' || !t.date) return false;
  return t.date < todayStr;
}

/** 배열 전체를 하나로 집계 */
export function progressOf(tasks: ReadonlyArray<TaskItem>, todayStr: string): Progress {
  let done = 0, overdue = 0;
  for (const t of tasks) {
    if (t.status === 'completed') done += 1;
    else if (isOverdue(t, todayStr)) overdue += 1;
  }
  return { done, total: tasks.length, overdue };
}

/**
 * 키별로 묶어 집계(한 번 순회). keyFn이 falsy를 반환하면 그 행은 제외.
 *   progressBy(tasks, t => t.assigneeId, today)   // 담당자별
 *   progressBy(tasks, t => t.meetingId, today)    // 회의별
 */
export function progressBy(
  tasks: ReadonlyArray<TaskItem>,
  keyFn: (t: TaskItem) => string | null | undefined,
  todayStr: string,
): Map<string, Progress> {
  const map = new Map<string, Progress>();
  for (const t of tasks) {
    const key = keyFn(t);
    if (!key) continue;
    const prev = map.get(key) ?? { ...EMPTY };
    prev.total += 1;
    if (t.status === 'completed') prev.done += 1;
    else if (isOverdue(t, todayStr)) prev.overdue += 1;
    map.set(key, prev);
  }
  return map;
}

/** done===total일 때만 100, 그 외엔 최대 99(반올림 함정 방지 — 가이드 §11.2) */
export function progressPct(done: number, total: number): number {
  if (total === 0) return 0;
  if (done >= total) return 100;
  return Math.min(99, Math.round((done / total) * 100));
}
