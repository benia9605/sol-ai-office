/**
 * @file src/hooks/useTasks.ts
 * @description 할일 데이터 관리 훅
 * - Supabase 연동 (tasks 테이블)
 * - Supabase 미설정 시 더미 데이터 폴백
 * - starred, category, tags DB 동기화
 * - cycleStatus: pending→in_progress→completed 순환
 * - toggleStar: 로컬 전용 즐겨찾기 토글
 */
import { useState, useEffect, useCallback } from 'react';
import { TaskItem, TaskStatus } from '../types';
import { dummyTasks } from '../data';
import {
  fetchTasks, updateTaskStatus, addTask, deleteTask, updateTaskFields,
  TaskRow, fromDbStatus, toDbStatus,
} from '../services/tasks.service';
import { calcNextDate } from '../utils/dateCalc';
import { useWorkspaceContext } from '../contexts/WorkspaceContext';
import { notify, getActorName } from '../services/notify.service';
import { getCurrentUserId } from '../services/auth';

const STATUS_CYCLE: TaskStatus[] = ['pending', 'in_progress', 'completed'];

/** DB 행 → 프론트 타입 변환 */
function toTaskItem(row: TaskRow): TaskItem {
  return {
    id: row.id,
    title: row.title,
    project: row.project ?? '',
    goalId: row.goal_id,
    status: fromDbStatus(row.status),
    priority: (row.priority as TaskItem['priority']) ?? 'medium',
    starred: row.starred ?? false,
    date: row.due_date,
    category: row.category,
    notes: row.notes,
    repeat: row.repeat,
    tags: row.tags,
    pomodoroEstimate: row.estimated_time,
    pomodoroCompleted: row.actual_time,
    conversationId: row.conversation_id,
    workspaceId: row.workspace_id,
    isShared: row.is_shared,
    assigneeId: row.assignee_id,
    meetingId: row.meeting_id,
    source: row.source ?? 'manual',   // 레거시(NULL) 행은 manual로 해석 — 필터·분석 누락 방지
    completedAt: row.completed_at,
  };
}

export function useTasks() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingDummy, setUsingDummy] = useState(false);
  const { activeWorkspaceId } = useWorkspaceContext();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const rows = await fetchTasks();
      setTasks(rows.map(toTaskItem));
      setUsingDummy(false);
    } catch (e) {
      console.warn('[useTasks] Supabase 연결 실패, 더미 데이터 사용:', e);
      setTasks(dummyTasks);
      setUsingDummy(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /** 반복 태스크 완료 시 다음 주기 태스크 자동 생성 (로컬 + DB) */
  const createNextRepeat = useCallback(async (target: TaskItem) => {
    if (!target.repeat || target.repeat === 'none' || target.repeat === 'daily') return;
    const nextDate = calcNextDate(target.date, target.repeat);

    if (!usingDummy) {
      try {
        const row = await addTask({
          title: target.title,
          project: target.project,
          priority: target.priority,
          due_date: nextDate,
          notes: target.notes,
          repeat: target.repeat,
          estimated_time: target.pomodoroEstimate,
          starred: target.starred,
          category: target.category,
          tags: target.tags,
        });
        setTasks((prev) => [toTaskItem(row), ...prev]);
        return;
      } catch (e) {
        console.error('[useTasks] 반복 태스크 DB 생성 실패:', e);
      }
    }
    // 더미 모드 또는 DB 실패 시 로컬 생성
    const newTask: TaskItem = {
      id: Date.now().toString(),
      title: target.title,
      project: target.project,
      status: 'pending',
      priority: target.priority,
      starred: false,
      date: nextDate,
      category: target.category,
      notes: target.notes,
      repeat: target.repeat,
      tags: target.tags,
      pomodoroEstimate: target.pomodoroEstimate,
      pomodoroCompleted: 0,
    };
    setTasks((prev) => [newTask, ...prev]);
  }, [usingDummy]);

  /** 상태 순환: pending → in_progress → completed */
  const cycleStatus = useCallback(async (id: string) => {
    const target = tasks.find((t) => t.id === id);
    if (!target) return;

    const currentIdx = STATUS_CYCLE.indexOf(target.status);
    const nextStatus = STATUS_CYCLE[(currentIdx + 1) % STATUS_CYCLE.length];

    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: nextStatus } : t))
    );

    // 반복 태스크 완료 시 다음 주기 자동 생성
    if (nextStatus === 'completed') {
      createNextRepeat(target);
    }

    if (!usingDummy) {
      try {
        await updateTaskStatus(id, nextStatus);
      } catch {
        setTasks((prev) =>
          prev.map((t) => (t.id === id ? { ...t, status: target.status } : t))
        );
      }
    }
  }, [tasks, usingDummy, createNextRepeat]);

  /** 상태 직접 변경 (칸반 DnD 용) */
  const updateStatus = useCallback(async (id: string, status: TaskStatus) => {
    const target = tasks.find((t) => t.id === id);
    if (!target || target.status === status) return;

    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status } : t))
    );

    // 반복 태스크 완료 시 다음 주기 자동 생성
    if (status === 'completed') {
      createNextRepeat(target);
    }

    if (!usingDummy) {
      try {
        await updateTaskStatus(id, status);
      } catch {
        setTasks((prev) =>
          prev.map((t) => (t.id === id ? { ...t, status: target.status } : t))
        );
      }
    }
  }, [tasks, usingDummy, createNextRepeat]);

  /** 즐겨찾기 토글 (DB 동기화) */
  const toggleStar = useCallback(async (id: string) => {
    const target = tasks.find((t) => t.id === id);
    if (!target) return;
    const newVal = !target.starred;

    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, starred: newVal } : t))
    );

    if (!usingDummy) {
      try {
        await updateTaskFields(id, { starred: newVal });
      } catch {
        setTasks((prev) =>
          prev.map((t) => (t.id === id ? { ...t, starred: target.starred } : t))
        );
      }
    }
  }, [tasks, usingDummy]);

  /** 할일 추가 → Supabase insert */
  const add = useCallback(async (data: Partial<TaskItem> & { conversation_id?: string }) => {
    if (usingDummy) {
      const newTask: TaskItem = {
        id: Date.now().toString(),
        title: data.title ?? '',
        project: data.project ?? '',
        status: 'pending',
        priority: data.priority ?? 'medium',
        starred: false,
        date: data.date,
        category: data.category,
        notes: data.notes,
        repeat: data.repeat,
        tags: data.tags,
        assigneeId: data.assigneeId,
        source: data.source ?? 'manual',
        pomodoroEstimate: data.pomodoroEstimate,
        pomodoroCompleted: 0,
      };
      setTasks((prev) => [newTask, ...prev]);
      return;
    }
    try {
      const row = await addTask({
        title: data.title,
        project: data.project,
        goal_id: data.goalId,
        priority: data.priority,
        due_date: data.date,
        notes: data.notes,
        repeat: data.repeat,
        estimated_time: data.pomodoroEstimate,
        starred: data.starred,
        category: data.category,
        tags: data.tags,
        conversation_id: data.conversation_id,
        workspace_id: activeWorkspaceId ?? undefined,
        assignee_id: data.assigneeId,
        source: data.source ?? 'manual',
        meeting_id: data.meetingId,
      });
      setTasks((prev) => [toTaskItem(row), ...prev]);
      // 이벤트 알림 — 담당자 배정 시(오피스만, best-effort). 나에게 배정은 서버가 액터 제외로 거름.
      if (activeWorkspaceId && row.assignee_id) {
        (async () => {
          const actor = await getCurrentUserId().catch(() => null);
          if (row.assignee_id === actor) return;
          const name = await getActorName(activeWorkspaceId, actor);
          notify({
            type: 'notify_task_assigned', workspaceId: activeWorkspaceId, actorId: actor,
            title: '📝 새 할일', body: `${name} 님이 「${row.title}」을 배정했어요.`,
            tag: `task-${row.id}`, targetUserIds: [row.assignee_id],
          });
        })();
      }
    } catch (e) {
      console.error('[useTasks] 추가 실패:', e);
      throw e;   // 호출부(폼)가 실패를 알 수 있게 — 성공한 척 폼 비우고 유실되는 것 방지
    }
  }, [usingDummy, activeWorkspaceId]);

  const remove = useCallback(async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    if (!usingDummy) {
      try {
        await deleteTask(id);
      } catch (e) {
        console.error('[useTasks] 삭제 실패:', e);
        load();
      }
    }
  }, [usingDummy, load]);

  /** 태스크 필드 업데이트 (로컬 + DB 동기화) */
  const updateTask = useCallback(async (id: string, patch: Partial<TaskItem>) => {
    const prevTask = tasks.find((t) => t.id === id);  // 재배정·완료 감지용(알림)
    // 상태 변경 시 completed_at 동기화(완료율·리드타임 분석용) — 로컬 상태도 반영
    const localPatch = patch.status !== undefined
      ? { ...patch, completedAt: patch.status === 'completed' ? new Date().toISOString() : undefined }
      : patch;
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...localPatch } : t)));

    if (!usingDummy) {
      try {
        // 프론트 필드명 → DB 컬럼명 변환
        const dbPatch: Record<string, unknown> = {};
        if (patch.title !== undefined) dbPatch.title = patch.title;
        if (patch.project !== undefined) dbPatch.project = patch.project;
        if (patch.goalId !== undefined) dbPatch.goal_id = patch.goalId || null;
        if (patch.priority !== undefined) dbPatch.priority = patch.priority;
        if (patch.category !== undefined) dbPatch.category = patch.category || null;
        if (patch.status !== undefined) {
          dbPatch.status = toDbStatus(patch.status);
          dbPatch.completed_at = patch.status === 'completed' ? new Date().toISOString() : null;
        }
        if (patch.assigneeId !== undefined) dbPatch.assignee_id = patch.assigneeId || null;
        if (patch.meetingId !== undefined) dbPatch.meeting_id = patch.meetingId || null;
        if (patch.date !== undefined) dbPatch.due_date = patch.date || null;
        if (patch.notes !== undefined) dbPatch.notes = patch.notes || null;
        if (patch.repeat !== undefined) dbPatch.repeat = patch.repeat || null;
        if (patch.starred !== undefined) dbPatch.starred = patch.starred;
        if (patch.tags !== undefined) dbPatch.tags = patch.tags || null;
        if (patch.pomodoroEstimate !== undefined) dbPatch.estimated_time = patch.pomodoroEstimate;
        if (patch.pomodoroCompleted !== undefined) dbPatch.actual_time = patch.pomodoroCompleted;

        if (Object.keys(dbPatch).length > 0) {
          await updateTaskFields(id, dbPatch);
        }

        // ── 이벤트 알림 (오피스만, best-effort) ──
        const wsId = prevTask?.workspaceId ?? activeWorkspaceId ?? undefined;
        const title = patch.title ?? prevTask?.title ?? '할일';
        if (wsId) {
          const actor = await getCurrentUserId().catch(() => null);
          // ① 재배정 → 새 담당자
          if (patch.assigneeId && patch.assigneeId !== prevTask?.assigneeId && patch.assigneeId !== actor) {
            const name = await getActorName(wsId, actor);
            notify({
              type: 'notify_task_assigned', workspaceId: wsId, actorId: actor,
              title: '🔄 할일 담당자 변경', body: `${name} 님이 「${title}」을 회원님께 넘겼어요.`,
              tag: `task-assign-${id}-${patch.assigneeId}`, targetUserIds: [patch.assigneeId],
            });
          }
          // ② 완료 전환 → 멤버 전체(본인 제외)
          if (patch.status === 'completed' && prevTask?.status !== 'completed') {
            const name = await getActorName(wsId, actor);
            notify({
              type: 'notify_task_completed', workspaceId: wsId, actorId: actor,
              title: '✅ 할일 완료', body: `${name} 님이 「${title}」을 완료했어요.`,
              tag: `task-${id}-done`,
            });
          }
        }
      } catch (e) {
        console.error('[useTasks] 업데이트 실패:', e);
      }
    }
  }, [usingDummy, tasks, activeWorkspaceId]);

  // 활성 워크스페이스 필터 (null=통합이면 전체). 빈 workspaceId(레거시 행)는 통합/개인에서 보이게 유지.
  const visibleTasks = activeWorkspaceId
    ? tasks.filter((t) => t.workspaceId === activeWorkspaceId)  // 오피스: 그 워크스페이스 것만 (null-workspace 개인 할일 누수 방지)
    : tasks;

  return { tasks: visibleTasks, loading, error, cycleStatus, updateStatus, toggleStar, add, remove, updateTask, reload: load };
}
