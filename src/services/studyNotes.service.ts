/**
 * @file src/services/studyNotes.service.ts
 * @description 스터디 노트(reading_logs) CRUD 서비스
 * - Supabase reading_logs 테이블과 연동
 * - DB 컬럼: id, reading_id, date, time, chapter, content (JSONB),
 *   raw_text, sections (JSONB), action_items_json (JSONB), created_at, updated_at
 */
import { supabase } from './supabase';
import { getCurrentUserId } from './auth';

export interface StudyNoteRow {
  id: string;
  reading_id: string;
  date: string;
  time?: string;
  chapter?: string;
  content?: Record<string, unknown>;
  raw_text?: string;
  sections?: unknown[];
  action_items_json?: unknown[];
  created_at: string;
  updated_at?: string;
}

export async function fetchStudyNotes(): Promise<StudyNoteRow[]> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('reading_logs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function fetchStudyNotesByReading(readingId: string): Promise<StudyNoteRow[]> {
  const { data, error } = await supabase
    .from('reading_logs')
    .select('*')
    .eq('reading_id', readingId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function addStudyNote(note: Omit<StudyNoteRow, 'id' | 'created_at'>): Promise<StudyNoteRow> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('reading_logs')
    .insert({ ...note, user_id: userId })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateStudyNote(id: string, fields: Partial<StudyNoteRow>): Promise<void> {
  const { error } = await supabase
    .from('reading_logs')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}

export async function deleteStudyNote(id: string): Promise<void> {
  const { error } = await supabase
    .from('reading_logs')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
