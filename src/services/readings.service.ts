/**
 * @file src/services/readings.service.ts
 * @description 독서(readings) CRUD 서비스
 * - Supabase readings 테이블과 연동
 * - DB 컬럼: id, title, author, category, total_pages, current_page, total_lessons,
 *   current_lesson, status, cover_emoji, cover_image, start_date, completed_date,
 *   rating, review, tags, link, price, toc, chapters, isbn13, created_at
 */
import { supabase } from './supabase';
import { getCurrentUserId } from './auth';

export interface ReadingRow {
  id: string;
  title: string;
  author: string;
  category: string;
  total_pages?: number;
  current_page?: number;
  total_lessons?: number;
  current_lesson?: number;
  status: string;
  cover_emoji: string;
  cover_image?: string;
  start_date?: string;
  completed_date?: string;
  rating?: number;
  review?: string;
  tags?: string[];
  link?: string;
  price?: number;
  toc?: string;
  chapters?: string[];
  isbn13?: string;
  created_at: string;
}

export async function fetchReadings(): Promise<ReadingRow[]> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('readings')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function addReading(reading: Omit<ReadingRow, 'id' | 'created_at'>): Promise<ReadingRow> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('readings')
    .insert({ ...reading, user_id: userId })
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error('데이터가 반환되지 않았습니다');
  return data;
}

export async function updateReading(id: string, fields: Partial<ReadingRow>): Promise<void> {
  const { error } = await supabase
    .from('readings')
    .update(fields)
    .eq('id', id);

  if (error) throw error;
}

export async function deleteReading(id: string): Promise<void> {
  const { error } = await supabase
    .from('readings')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
