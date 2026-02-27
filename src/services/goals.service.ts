/**
 * @file src/services/goals.service.ts
 * @description 목표(goals) CRUD 서비스
 * - Supabase goals 테이블과 연동
 * - DB 컬럼: id, project_id, title, deadline, status, progress, notes, created_at
 */
import { supabase } from './supabase';
import { getCurrentUserId } from './auth';

export interface GoalRow {
  id: string;
  project_id: string;
  title: string;
  type: string;          // 'kpi' | 'task' | 'mixed'
  start_date?: string;
  end_date?: string;
  status: string;
  progress: number;
  notes?: string;
  created_at: string;
}

export async function fetchAllGoals(): Promise<GoalRow[]> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function fetchGoalsByProject(projectId: string): Promise<GoalRow[]> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function addGoal(goal: Omit<GoalRow, 'id' | 'created_at'>): Promise<GoalRow> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('goals')
    .insert({ ...goal, user_id: userId })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateGoal(id: string, fields: Partial<GoalRow>): Promise<void> {
  const { error } = await supabase
    .from('goals')
    .update(fields)
    .eq('id', id);

  if (error) throw error;
}

export async function deleteGoal(id: string): Promise<void> {
  const { error } = await supabase
    .from('goals')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
