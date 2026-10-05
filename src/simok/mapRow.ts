/**
 * @file src/simok/mapRow.ts
 * @description DB row → 프론트 타입 매핑 (시목 전용 화면용 최소 매퍼)
 *
 * 왜 따로 두는가: 기존 `views.tsx` 의 `rowToTaskItem` 은 그 파일 안의 로컬 함수다.
 * 공통 파일을 건드려 기존 오피스 화면에 회귀를 만들지 않기 위해, 시목 쪽은 같은 규칙의
 * 매퍼를 여기에 둔다. 상태 변환은 기존 `tasks.service.ts` 의 `fromDbStatus` 를 재사용한다.
 */
import { TaskRow, fromDbStatus } from '../services/tasks.service';
import { TaskItem } from '../types';

export function rowToTask(r: TaskRow): TaskItem {
  return {
    id: r.id,
    title: r.title,
    project: r.project ?? '',
    status: fromDbStatus(r.status),
    priority: (r.priority as TaskItem['priority']) ?? 'medium',
    starred: !!r.starred,
    date: r.due_date,
    category: r.category,
    notes: r.notes,
    tags: r.tags,
    workspaceId: r.workspace_id,
    isShared: r.is_shared,
    assigneeId: r.assignee_id,
    createdBy: r.user_id,
    meetingId: r.meeting_id,
    source: r.source,
    completedAt: r.completed_at,
  };
}
