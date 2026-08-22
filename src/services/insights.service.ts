/**
 * @file src/services/insights.service.ts
 * @description 인사이트(insights) CRUD 서비스
 * - Supabase insights 테이블과 연동
 * - DB 컬럼: id, title, content, source, link, tags, project, priority, created_at
 */
import { supabase } from './supabase';
import { getCurrentUserId } from './auth';
import { recordActivity } from './activities.service';
import { notify, getActorName } from './notify.service';

export interface InsightRow {
  id: string;
  title: string;
  content: string;
  source: string;
  link?: string;
  tags: string[];
  project?: string;
  starred?: boolean;
  conversation_id?: string;
  workspace_id?: string;
  is_shared?: boolean;
  created_by?: string;
  created_at: string;
}

/** workspaceId 주면 그 워크스페이스의 팀 공유 인사이트(+본인 것), 없으면 개인(workspace_id NULL) */
export async function fetchInsights(workspaceId?: string): Promise<InsightRow[]> {
  const userId = await getCurrentUserId();
  let q = supabase.from('insights').select('*');
  q = workspaceId ? q.eq('workspace_id', workspaceId) : q.eq('user_id', userId).is('workspace_id', null);
  const { data, error } = await q.order('created_at', { ascending: false }).limit(200);
  if (error) throw error;
  return data ?? [];
}

/** 단일 인사이트 조회 (상세 페이지용). 없으면 null. */
export async function fetchInsightById(id: string): Promise<InsightRow | null> {
  const { data, error } = await supabase.from('insights').select('*').eq('id', id).maybeSingle();
  if (error && error.code !== 'PGRST116') throw error;
  return data ?? null;
}

export async function addInsight(insight: Omit<InsightRow, 'id' | 'created_at' | 'conversation_id'> & { created_at?: string; conversation_id?: string }): Promise<InsightRow> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('insights')
    .insert({ ...insight, user_id: userId, created_by: userId })
    .select()
    .single();

  if (error) throw error;
  // 팀 활동 기록 + 알림 (오피스 인사이트만) — best-effort
  if (data?.workspace_id) {
    recordActivity({ workspaceId: data.workspace_id, action: 'created_insight', resourceType: 'insight', resourceId: data.id, metadata: { title: data.title } });
    getActorName(data.workspace_id, userId).then(name =>
      notify({ type: 'notify_content', workspaceId: data.workspace_id, actorId: userId, title: '📈 새 인사이트', body: `${name} 님이 「${data.title}」 인사이트를 남겼어요.`, tag: `insight-${data.id}` }),
    ).catch(() => {});
  }
  return data;
}

export async function updateInsight(id: string, fields: Partial<InsightRow>): Promise<void> {
  const { error } = await supabase
    .from('insights')
    .update(fields)
    .eq('id', id);

  if (error) throw error;
}

export async function deleteInsight(id: string): Promise<void> {
  const { error } = await supabase
    .from('insights')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
