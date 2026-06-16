/**
 * @file src/services/insights.service.ts
 * @description 인사이트(insights) CRUD 서비스
 * - Supabase insights 테이블과 연동
 * - DB 컬럼: id, title, content, source, link, tags, project, priority, created_at
 */
import { supabase } from './supabase';
import { getCurrentUserId } from './auth';

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
  created_at: string;
}

/** workspaceId 주면 그 워크스페이스(오피스), 없으면 개인(workspace_id NULL) */
export async function fetchInsights(workspaceId?: string): Promise<InsightRow[]> {
  const userId = await getCurrentUserId();
  let q = supabase.from('insights').select('*').eq('user_id', userId);
  q = workspaceId ? q.eq('workspace_id', workspaceId) : q.is('workspace_id', null);
  const { data, error } = await q.order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function addInsight(insight: Omit<InsightRow, 'id' | 'created_at' | 'conversation_id'> & { created_at?: string; conversation_id?: string }): Promise<InsightRow> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('insights')
    .insert({ ...insight, user_id: userId })
    .select()
    .single();

  if (error) throw error;
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
