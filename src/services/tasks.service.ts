/**
 * @file src/services/tasks.service.ts
 * @description 할일(tasks) CRUD 서비스
 * - Supabase tasks 테이블과 연동
 * - DB 컬럼: id, title, type, project, status(default 'todo'), priority,
 *   due_date, estimated_time, actual_time, repeat, notes, conversation_id,
 *   completed_at, created_at
 * - starred, category, tags 컬럼 추가 (2026-02-24)
 */
import { supabase } from './supabase';
import { getCurrentUserId } from './auth';
import { RepeatType } from '../types';

export interface TaskRow {
  id: string;
  title: string;
  type?: string;
  project?: string;
  goal_id?: string;
  status: string;            // DB default: 'todo'
  priority: string;          // DB default: 'medium'
  due_date?: string;         // date
  estimated_time?: number;   // 뽀모도로 예상
  actual_time?: number;      // 뽀모도로 완료
  repeat?: RepeatType;
  notes?: string;
  starred?: boolean;
  category?: string;
  tags?: string[];
  conversation_id?: string;
  completed_at?: string;
  created_at: string;
}

/** 프론트 status → DB status */
export function toDbStatus(status: string): string {
  if (status === 'pending') return 'todo';
  if (status === 'completed') return 'done';
  return status; // 'in_progress' 그대로
}

/** DB status → 프론트 status */
export function fromDbStatus(status: string): 'pending' | 'in_progress' | 'completed' {
  if (status === 'todo') return 'pending';
  if (status === 'done') return 'completed';
  if (status === 'in_progress') return 'in_progress';
  // 혹시 'pending', 'completed' 등으로 저장된 경우 그대로
  if (status === 'pending') return 'pending';
  if (status === 'completed') return 'completed';
  return 'pending';
}

export async function fetchTasks(): Promise<TaskRow[]> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function updateTaskStatus(id: string, frontendStatus: string): Promise<void> {
  const dbStatus = toDbStatus(frontendStatus);
  const updates: Record<string, unknown> = { status: dbStatus };
  if (frontendStatus === 'completed') {
    updates.completed_at = new Date().toISOString();
  }
  const { error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', id);

  if (error) throw error;
}

export async function addTask(task: {
  title?: string;
  project?: string;
  goal_id?: string;
  priority?: string;
  due_date?: string;
  estimated_time?: number;
  repeat?: string;
  notes?: string;
  starred?: boolean;
  category?: string;
  tags?: string[];
  conversation_id?: string;
}): Promise<TaskRow> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      user_id: userId,
      title: task.title ?? '',
      project: task.project ?? '',
      goal_id: task.goal_id || null,
      priority: task.priority ?? 'medium',
      status: 'todo',
      due_date: task.due_date || null,
      estimated_time: task.estimated_time || null,
      actual_time: 0,
      repeat: task.repeat || null,
      notes: task.notes || null,
      starred: task.starred ?? false,
      category: task.category || null,
      tags: task.tags || null,
      conversation_id: task.conversation_id || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** 태스크 필드 범용 업데이트 */
export async function updateTaskFields(id: string, fields: Record<string, unknown>): Promise<void> {
  const { error } = await supabase
    .from('tasks')
    .update(fields)
    .eq('id', id);

  if (error) throw error;
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
