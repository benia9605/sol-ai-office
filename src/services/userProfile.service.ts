/**
 * @file src/services/userProfile.service.ts
 * @description 유저 프로필 서비스
 * - Supabase user_profiles 테이블과 연동
 * - 싱글 프로필: 로그인 없이 첫 번째 행을 사용
 * - 이름, 소개, 대화 스타일(톤/답변길이/이모지) 관리
 */
import { supabase } from './supabase';
import { getCurrentUserId } from './auth';

export interface UserProfileRow {
  id: string;
  user_id: string | null;
  name: string;
  bio: string | null;
  tone: string;             // friendly / polite / formal
  response_length: string;  // short / medium / detailed
  emoji_usage: string;      // many / moderate / few
  active_theme?: string;    // 'modi' | 'modern' — UI 테마 (docs/THEME_SYSTEM_PLAN.md)
  created_at: string;
  updated_at: string;
}

export async function fetchUserProfile(): Promise<UserProfileRow | null> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();   // 0행이어도 throw 없이 null

  if (error && error.code !== 'PGRST116') throw error;
  return data ?? null;
}

/**
 * user_id가 아직 없거나(레거시 단일 프로필) 내 것인 행 1건을 찾는다.
 * 다른 유저의 행은 절대 흡수하지 않는다(user_id가 채워져 있고 내 것이 아니면 제외).
 */
async function fetchAdoptableProfile(userId: string): Promise<UserProfileRow | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(5);
  if (error && error.code !== 'PGRST116') throw error;
  const rows = (data ?? []) as UserProfileRow[];
  return rows.find(r => r.user_id == null || r.user_id === userId) ?? null;
}

export async function upsertUserProfile(
  fields: Partial<Omit<UserProfileRow, 'id' | 'created_at' | 'updated_at'>>,
): Promise<UserProfileRow> {
  const userId = await getCurrentUserId();
  // 1) 내 프로필(user_id 일치) 우선, 2) 없으면 레거시 미할당 행을 흡수 —
  //    이게 없으면 user_id가 NULL/불일치인 기존 행을 못 찾아 중복 INSERT 되거나
  //    UPDATE가 0행이 되어 "저장이 안 되는" 버그가 난다.
  const existing = (await fetchUserProfile()) ?? (await fetchAdoptableProfile(userId));

  if (existing) {
    const { data, error } = await supabase
      .from('user_profiles')
      .update({ ...fields, user_id: userId, updated_at: new Date().toISOString() })  // 흡수 시 user_id 채움
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  // 정말 아무 행도 없을 때만 새로 생성
  const { data, error } = await supabase
    .from('user_profiles')
    .insert({ name: fields.name || 'User', ...fields, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
}
