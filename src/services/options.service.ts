/**
 * @file src/services/options.service.ts
 * @description options 테이블 CRUD 서비스
 * - 카테고리별 옵션 관리 (insight_source, task_category, content_category 등)
 * - DB 컬럼: id, user_id, workspace_id, category, name, color, emoji, sort_order, created_at
 * - workspace_id: NULL=개인, 값=오피스 (마이그 055). 카테고리 시스템 공통 기반(docs/CATEGORY_SYSTEM.md)
 */
import { supabase } from './supabase';
import { getCurrentUserId } from './auth';

export interface OptionRow {
  id: string;
  category: string;
  name: string;
  color?: string;
  emoji?: string;
  sort_order: number;
  workspace_id?: string | null;
  created_at: string;
}

/** category(옵션 종류)로 조회. workspaceId 있으면 오피스, 없으면 개인(workspace_id IS NULL). */
export async function fetchOptionsByCategory(category: string, workspaceId?: string): Promise<OptionRow[]> {
  const userId = await getCurrentUserId();
  let q = supabase
    .from('options')
    .select('*')
    .eq('category', category);
  q = workspaceId ? q.eq('workspace_id', workspaceId) : q.eq('user_id', userId).is('workspace_id', null);
  const { data, error } = await q.order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** 추가. id 지정 시 그대로 사용(기본 세트 시드용 — 기존 참조 id 보존). */
export async function addOption(
  option: Omit<OptionRow, 'id' | 'created_at' | 'workspace_id'> & { id?: string },
  workspaceId?: string,
): Promise<OptionRow> {
  const userId = await getCurrentUserId();
  const payload: Record<string, unknown> = { ...option, user_id: userId, workspace_id: workspaceId ?? null };
  if (!('id' in option) || !option.id) delete payload.id;
  const { data, error } = await supabase
    .from('options')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateOption(id: string, fields: Partial<OptionRow>): Promise<void> {
  const { error } = await supabase
    .from('options')
    .update(fields)
    .eq('id', id);
  if (error) throw error;
}

export async function deleteOption(id: string): Promise<void> {
  const { error } = await supabase
    .from('options')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
