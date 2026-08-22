/**
 * @file src/services/records.service.ts
 * @description 기록(journals) CRUD 서비스
 * - Supabase journals 테이블과 연동
 * - DB 컬럼: id, title, date, time, mood, energy, tags, conversation_id,
 *   record_type, morning_data (JSONB), evening_data (JSONB),
 *   weekly_data (JSONB), memo_body (JSONB), created_at
 */
import { supabase } from './supabase';
import { getCurrentUserId } from './auth';
import { recordActivity } from './activities.service';
import { notify, getActorName } from './notify.service';

export interface RecordRow {
  id: string;
  title: string;
  date: string;
  time?: string;
  mood?: string;
  energy?: number;
  tags?: string[];
  project?: string;
  conversation_id?: string;
  record_type: string;
  morning_data?: Record<string, unknown>;
  evening_data?: Record<string, unknown>;
  weekly_data?: Record<string, unknown>;
  memo_body?: Record<string, unknown>;
  workspace_id?: string;
  is_shared?: boolean;
  created_by?: string;
  created_at: string;
}

/** workspaceId 주면 그 워크스페이스의 팀 공유 기록, 없으면 개인(NULL). recordType 주면 그 종류만(예: 'memo') */
export async function fetchRecords(workspaceId?: string, recordType?: string): Promise<RecordRow[]> {
  const userId = await getCurrentUserId();
  let q = supabase.from('journals').select('*');
  q = workspaceId ? q.eq('workspace_id', workspaceId) : q.eq('user_id', userId).is('workspace_id', null);
  if (recordType) q = q.eq('record_type', recordType);
  const { data, error } = await q.order('created_at', { ascending: false }).limit(200);
  if (error) throw error;
  return data ?? [];
}

/** 단일 기록 조회 (상세 페이지용). 없으면 null. */
export async function fetchRecordById(id: string): Promise<RecordRow | null> {
  const { data, error } = await supabase.from('journals').select('*').eq('id', id).maybeSingle();
  if (error && error.code !== 'PGRST116') throw error;
  return data ?? null;
}

export async function addRecord(record: Omit<RecordRow, 'id' | 'created_at'>): Promise<RecordRow> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('journals')
    .insert({ ...record, user_id: userId, created_by: userId })
    .select()
    .single();

  if (error) throw error;
  // 오피스 메모는 팀 활동 기록 + 알림 (best-effort)
  if (data?.workspace_id && data.record_type === 'memo') {
    recordActivity({ workspaceId: data.workspace_id, action: 'created_record', resourceType: 'record', resourceId: data.id, metadata: { title: data.title } });
    getActorName(data.workspace_id, userId).then(name =>
      notify({ type: 'notify_content', workspaceId: data.workspace_id, actorId: userId, title: '📓 새 기록', body: `${name} 님이 「${data.title}」 기록을 남겼어요.`, tag: `record-${data.id}` }),
    ).catch(() => {});
  }
  return data;
}

export async function updateRecord(id: string, fields: Partial<RecordRow>): Promise<void> {
  const { error } = await supabase
    .from('journals')
    .update(fields)
    .eq('id', id);

  if (error) throw error;
}

export async function deleteRecord(id: string): Promise<void> {
  const { error } = await supabase
    .from('journals')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
