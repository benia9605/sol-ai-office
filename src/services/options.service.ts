/**
 * @file src/services/options.service.ts
 * @description options 테이블 CRUD 서비스
 * - 카테고리별 옵션 관리 (insight_source, schedule_category 등)
 * - DB 컬럼: id, category, name, color, emoji, sort_order, created_at
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
  created_at: string;
}

export async function fetchOptionsByCategory(category: string): Promise<OptionRow[]> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('options')
    .select('*')
    .eq('user_id', userId)
    .eq('category', category)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function addOption(option: Omit<OptionRow, 'id' | 'created_at'>): Promise<OptionRow> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('options')
    .insert({ ...option, user_id: userId })
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
