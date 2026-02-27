/**
 * @file src/services/schedules.service.ts
 * @description 일정(schedules) CRUD 서비스
 * - Supabase schedules 테이블과 연동
 * - DB 컬럼: id, title, date, time, project, color, category, repeat, reminder, notes, tags, created_at
 */
import { supabase } from './supabase';
import { getCurrentUserId } from './auth';
import { RepeatType } from '../types';

export interface ScheduleRow {
  id: string;
  title: string;
  date: string;
  time: string;
  project: string;
  color: string;
  category?: string;
  repeat?: RepeatType;
  reminder?: string;
  notes?: string;
  tags?: string[];
  created_at: string;
}

export async function fetchSchedules(): Promise<ScheduleRow[]> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('schedules')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function addSchedule(schedule: Omit<ScheduleRow, 'id' | 'created_at'>): Promise<ScheduleRow> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('schedules')
    .insert({ ...schedule, user_id: userId })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateSchedule(id: string, fields: Partial<ScheduleRow>): Promise<void> {
  const { error } = await supabase
    .from('schedules')
    .update(fields)
    .eq('id', id);

  if (error) throw error;
}

export async function deleteSchedule(id: string): Promise<void> {
  const { error } = await supabase
    .from('schedules')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
