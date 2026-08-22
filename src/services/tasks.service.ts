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
  user_id?: string;          // 작성자(=배정한 사람). 팀 화면에서 '내가 배정한 일'·작성자 표시용
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
  workspace_id?: string;
  is_shared?: boolean;
  assignee_id?: string;
  source?: string;           // manual|content|decision|memory|campaign|ai
  meeting_id?: string;       // 연결된 회의 (마이그 040)
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

/**
 * 워크스페이스(오피스) 단위 조회 — 멤버 전원의 '공유' 할일을 가져온다.
 * fetchTasks()는 user_id=본인만 조회하므로, 남이 나에게 배정한 할일·팀 진행률·멤버 담당은 이걸 쓴다.
 * (RLS 041: is_shared + 워크스페이스 멤버 SELECT 허용)
 */
export async function fetchWorkspaceTasks(workspaceId: string): Promise<TaskRow[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  return data ?? [];
}

/** 단일 할일 조회 (상세 페이지용). 없으면 null. */
export async function fetchTaskById(id: string): Promise<TaskRow | null> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error && error.code !== 'PGRST116') throw error;
  return data ?? null;
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
  workspace_id?: string;
  is_shared?: boolean;
  assignee_id?: string;
  source?: string;
  meeting_id?: string;
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
      // 공유 워크스페이스 (제공 시에만 세팅 — 빌드 C에서 채움)
      ...(task.workspace_id ? { workspace_id: task.workspace_id } : {}),
      ...(task.is_shared !== undefined ? { is_shared: task.is_shared } : {}),
      ...(task.assignee_id ? { assignee_id: task.assignee_id } : {}),
      ...(task.source ? { source: task.source } : {}),
      ...(task.meeting_id ? { meeting_id: task.meeting_id } : {}),
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
