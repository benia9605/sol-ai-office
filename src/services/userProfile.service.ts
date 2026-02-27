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
  created_at: string;
  updated_at: string;
}

export async function fetchUserProfile(): Promise<UserProfileRow | null> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // no rows
    throw error;
  }
  return data;
}

export async function upsertUserProfile(
  fields: Partial<Omit<UserProfileRow, 'id' | 'created_at' | 'updated_at'>>,
): Promise<UserProfileRow> {
  // 기존 프로필 확인
  const existing = await fetchUserProfile();

  if (existing) {
    const { data, error } = await supabase
      .from('user_profiles')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  // 없으면 새로 생성
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('user_profiles')
    .insert({ name: fields.name || 'User', ...fields, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
}
