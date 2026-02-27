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

export interface RecordRow {
  id: string;
  title: string;
  date: string;
  time?: string;
  mood?: string;
  energy?: number;
  tags?: string[];
  conversation_id?: string;
  record_type: string;
  morning_data?: Record<string, unknown>;
  evening_data?: Record<string, unknown>;
  weekly_data?: Record<string, unknown>;
  memo_body?: Record<string, unknown>;
  created_at: string;
}

export async function fetchRecords(): Promise<RecordRow[]> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('journals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function addRecord(record: Omit<RecordRow, 'id' | 'created_at'>): Promise<RecordRow> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('journals')
    .insert({ ...record, user_id: userId })
    .select()
    .single();

  if (error) throw error;
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
