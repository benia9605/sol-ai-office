/**
 * @file src/services/dailyCompletions.service.ts
 * @description 매일 루틴 완료 기록 CRUD (Supabase daily_completions 테이블)
 * - 오늘 날짜 기준 완료 목록 조회
 * - 토글 (insert / delete)
 */
import { supabase } from './supabase';
import { getCurrentUserId } from './auth';

function getTodayDate(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export interface DailyCompletionRow {
  id: string;
  task_id: string;
  completed_date: string;
  created_at: string;
}

/** 오늘 완료된 task_id 목록 조회 */
export async function fetchTodayCompletions(): Promise<string[]> {
  const userId = await getCurrentUserId();
  const today = getTodayDate();
  const { data, error } = await supabase
    .from('daily_completions')
    .select('task_id')
    .eq('user_id', userId)
    .eq('completed_date', today);

  if (error) throw error;
  return (data ?? []).map((r) => r.task_id);
}

/** 오늘 완료 추가 */
export async function addDailyCompletion(taskId: string): Promise<void> {
  const userId = await getCurrentUserId();
  const today = getTodayDate();
  const { error } = await supabase
    .from('daily_completions')
    .insert({ task_id: taskId, completed_date: today, user_id: userId });

  if (error) throw error;
}

/** 오늘 완료 제거 */
export async function removeDailyCompletion(taskId: string): Promise<void> {
  const userId = await getCurrentUserId();
  const today = getTodayDate();
  const { error } = await supabase
    .from('daily_completions')
    .delete()
    .eq('user_id', userId)
    .eq('task_id', taskId)
    .eq('completed_date', today);

  if (error) throw error;
}
