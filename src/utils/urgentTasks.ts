/**
 * @file src/utils/urgentTasks.ts
 * @description 긴급/지연 태스크 필터 유틸
 * - 지연(overdue): 마감일이 오늘 이전인 미완료 할일
 * - 임박(imminent): 마감일이 오늘~3일 이하인 미완료 할일
 * - overdue 먼저, imminent 그 다음, 각각 날짜순 정렬
 */
import { TaskItem } from '../types';

export interface UrgentTask extends TaskItem {
  urgencyType: 'overdue' | 'imminent';
  daysLeft: number;
}

export function getUrgentTasks(tasks: TaskItem[]): UrgentTask[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const urgent: UrgentTask[] = [];

  for (const task of tasks) {
    if (task.status === 'completed') continue;
    if (!task.date) continue;

    const target = new Date(task.date);
    target.setHours(0, 0, 0, 0);
    const diffMs = target.getTime() - today.getTime();
    const daysLeft = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (daysLeft < 0) {
      urgent.push({ ...task, urgencyType: 'overdue', daysLeft });
    } else if (daysLeft <= 3) {
      urgent.push({ ...task, urgencyType: 'imminent', daysLeft });
    }
  }

  urgent.sort((a, b) => {
    if (a.urgencyType !== b.urgencyType) {
      return a.urgencyType === 'overdue' ? -1 : 1;
    }
    return a.daysLeft - b.daysLeft;
  });

  return urgent;
}
