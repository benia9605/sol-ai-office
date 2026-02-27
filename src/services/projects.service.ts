/**
 * @file src/services/projects.service.ts
 * @description 프로젝트 CRUD 서비스
 * - Supabase projects 테이블과 연동
 * - DB 컬럼: id, name, emoji, color, image, description, status, priority, created_at
 */
import { supabase } from './supabase';
import { getCurrentUserId } from './auth';

export interface ProjectRow {
  id: string;
  name: string;
  emoji: string;
  color: string;
  image?: string;
  description?: string;
  status?: string;
  priority?: number;
  start_date?: string;
  end_date?: string;
  created_at: string;
}

export async function fetchProjects(): Promise<ProjectRow[]> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .order('priority', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function addProject(project: Omit<ProjectRow, 'id' | 'created_at'>): Promise<ProjectRow> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('projects')
    .insert({ ...project, user_id: userId })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateProject(id: string, fields: Partial<ProjectRow>): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .update(fields)
    .eq('id', id);

  if (error) throw error;
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
