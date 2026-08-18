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

/** 회의록 저장 알림 → 멤버 (본인 제외). 회의록을 처음/다시 저장할 때 호출. */
export async function notifyMeetingNote(workspaceId: string, meeting: Meeting): Promise<void> {
  const userId = await getCurrentUserId().catch(() => null);
  const name = await getActorName(workspaceId, userId);
  notify({ type: 'notify_schedule', workspaceId, actorId: userId, title: '📝 회의록', body: `${name} 님이 「${meeting.title}」 회의록을 정리했어요.`, tag: `meeting-note-${meeting.id}`, url: '/office/meetings' });
}
