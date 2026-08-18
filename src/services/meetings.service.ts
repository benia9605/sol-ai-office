/**
 * @file src/services/meetings.service.ts
 * @description 회의 + 회의록 CRUD (마이그 040)
 * - 회의 등록·회의록 작성 시 멤버에게 알림(notify_schedule 재사용).
 * - 액션아이템은 tasks(meeting_id)로 만들어 할일 메뉴와 양방향 연동.
 * - (AI 회의실 채팅용 meeting.service.ts와는 별개)
 */
import { supabase } from './supabase';
import { getCurrentUserId } from './auth';
import { Meeting } from '../types';
import { notify, getActorName } from './notify.service';
import { fetchTasks, addTask, updateTaskFields, deleteTask } from './tasks.service';

const toMeeting = (r: any): Meeting => ({
  id: r.id, workspaceId: r.workspace_id, createdBy: r.created_by, title: r.title,
  meetingDate: r.meeting_date ?? undefined, meetingTime: r.meeting_time ?? undefined,
  content: r.content ?? undefined, createdAt: r.created_at, updatedAt: r.updated_at,
});

export async function fetchMeetings(workspaceId: string): Promise<Meeting[]> {
  const { data, error } = await supabase
    .from('meetings').select('*').eq('workspace_id', workspaceId)
    .order('meeting_date', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toMeeting);
}

export async function addMeeting(workspaceId: string, fields: { title: string; meetingDate?: string; meetingTime?: string }): Promise<Meeting> {
  const userId = await getCurrentUserId().catch(() => null);
  const { data, error } = await supabase.from('meetings')
    .insert({ workspace_id: workspaceId, created_by: userId, title: fields.title.trim(), meeting_date: fields.meetingDate || null, meeting_time: fields.meetingTime || null })
    .select().single();
  if (error) throw error;
  const m = toMeeting(data);
  // 일정(캘린더)에 '회의'로 연동 — 날짜 있으면 schedule 1건 생성
  if (m.meetingDate) {
    try {
      await supabase.from('schedules').insert({
        workspace_id: workspaceId, user_id: userId, title: m.title, date: m.meetingDate, time: m.meetingTime || '',
        category: '회의', project: '', color: '#f59e0b', is_shared: true, meeting_id: m.id,
      });
    } catch (_) { /* 일정 연동 실패는 무시 */ }
  }
  // 회의 등록 알림 → 멤버 전체
  const name = await getActorName(workspaceId, userId);
  notify({ type: 'notify_schedule', workspaceId, actorId: userId, title: '📋 새 회의', body: `${name} 님이 「${m.title}」 회의를 만들었어요.`, tag: `meeting-${m.id}`, url: '/office/meetings' });
  return m;
}

export async function updateMeeting(id: string, fields: Partial<Meeting>): Promise<void> {
  const p: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fields.title !== undefined) p.title = fields.title;
  if (fields.meetingDate !== undefined) p.meeting_date = fields.meetingDate || null;
  if (fields.meetingTime !== undefined) p.meeting_time = fields.meetingTime || null;
  if (fields.content !== undefined) p.content = fields.content || null;
  const { error } = await supabase.from('meetings').update(p).eq('id', id);
  if (error) throw error;
  // 연동된 일정도 동기화(제목·날짜·시간)
  if (fields.title !== undefined || fields.meetingDate !== undefined || fields.meetingTime !== undefined) {
    const sp: Record<string, unknown> = {};
    if (fields.title !== undefined) sp.title = fields.title;
    if (fields.meetingDate !== undefined && fields.meetingDate) sp.date = fields.meetingDate;
    if (fields.meetingTime !== undefined) sp.time = fields.meetingTime || '';
    if (Object.keys(sp).length) { try { await supabase.from('schedules').update(sp).eq('meeting_id', id); } catch (_) { /* 무시 */ } }
  }
}

export async function deleteMeeting(id: string): Promise<void> {
  const { error } = await supabase.from('meetings').delete().eq('id', id);
  if (error) throw error;
}

/**
 * 회의의 액션아이템(할일)을 폼 상태와 일치시킨다. (가이드 §7 syncTasksForNote 이식)
 * - id 있음 → keep : updateTaskFields 로 수정(id 유지 → 댓글/좋아요/완료상태 보존)
 * - id 없음 → create: addTask + 담당자 알림
 * - DB엔 있는데 폼엔 없음 → delete
 * 순서 고정: 삭제 → 수정 → 생성. due는 이 앱 관례대로 'YYYY-MM-DD'로 저장(date 컬럼).
 */
export type MeetingTaskDraft = { id: string | null; title: string; assigneeId: string; due: string };

export async function syncMeetingTasks(
  meetingId: string, workspaceId: string, drafts: MeetingTaskDraft[],
): Promise<void> {
  const actorId = await getCurrentUserId().catch(() => null);
  const rows = drafts.map(d => ({ ...d, title: d.title.trim() })).filter(d => d.title.length > 0);
  const all = await fetchTasks().catch(() => []);
  const existing = all.filter(r => r.meeting_id === meetingId);
  const existingById = new Map(existing.map(e => [e.id, e]));
  const keepIds = new Set(rows.filter(r => r.id).map(r => r.id as string));
  const actorName = await getActorName(workspaceId, actorId);

  // ① 삭제 — 폼에서 × 로 뺀 기존 할일
  for (const e of existing) {
    if (!keepIds.has(e.id)) await deleteTask(e.id).catch(() => {});
  }
  // ② 수정 — 유지되는 할일. note(=회의) 연결 강제, 담당자 바뀌면 알림
  for (const r of rows) {
    if (!r.id) continue;
    const prev = existingById.get(r.id);
    await updateTaskFields(r.id, {
      title: r.title,
      assignee_id: r.assigneeId || null,
      due_date: r.due || null,
      meeting_id: meetingId,
    }).catch(() => {});
    if (r.assigneeId && r.assigneeId !== prev?.assignee_id && r.assigneeId !== actorId) {
      notify({ type: 'notify_task_assigned', workspaceId, actorId, title: '🔄 할일 담당자 변경', body: `${actorName} 님이 「${r.title}」을 회원님께 넘겼어요.`, tag: `task-assign-${r.id}-${r.assigneeId}`, targetUserIds: [r.assigneeId] });
    }
  }
  // ③ 생성 — 새 줄
  for (const r of rows) {
    if (r.id) continue;
    const created = await addTask({ workspace_id: workspaceId, title: r.title, assignee_id: r.assigneeId || undefined, due_date: r.due || undefined, meeting_id: meetingId, source: 'manual' }).catch(() => null);
    if (created && r.assigneeId && r.assigneeId !== actorId) {
      notify({ type: 'notify_task_assigned', workspaceId, actorId, title: '📝 새 할일(회의)', body: `${actorName} 님이 회원님께 「${r.title}」을 배정했어요.`, tag: `task-${created.id}`, targetUserIds: [r.assigneeId] });
    }
  }
}

/** 회의록 저장 알림 → 멤버 (본인 제외). 회의록을 처음/다시 저장할 때 호출. */
export async function notifyMeetingNote(workspaceId: string, meeting: Meeting): Promise<void> {
  const userId = await getCurrentUserId().catch(() => null);
  const name = await getActorName(workspaceId, userId);
  notify({ type: 'notify_schedule', workspaceId, actorId: userId, title: '📝 회의록', body: `${name} 님이 「${meeting.title}」 회의록을 정리했어요.`, tag: `meeting-note-${meeting.id}`, url: '/office/meetings' });
}
