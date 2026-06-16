/**
 * @file src/hooks/useUserProfile.ts
 * @description 유저 프로필 관리 훅
 * - Supabase user_profiles 테이블 연동
 * - 로드, 저장 기능 제공
 */
import { useState, useEffect, useCallback } from 'react';
import { fetchUserProfile, upsertUserProfile, UserProfileRow } from '../services/userProfile.service';

export type Theme = 'modi' | 'modern';

export interface UserProfile {
  id: string;
  name: string;
  bio: string;
  tone: string;
  responseLength: string;
  emojiUsage: string;
  activeTheme: Theme;
}

function toProfile(row: UserProfileRow): UserProfile {
  return {
    id: row.id,
    name: row.name,
    bio: row.bio || '',
    tone: row.tone || 'polite',
    responseLength: row.response_length || 'short',
    emojiUsage: row.emoji_usage || 'moderate',
    activeTheme: (row.active_theme as Theme) || 'modern',
  };
}

const defaultProfile: UserProfile = {
  id: '',
  name: '',
  bio: '',
  tone: 'polite',
  responseLength: 'short',
  emojiUsage: 'moderate',
  activeTheme: 'modern',
};

/** 모든 useUserProfile 인스턴스 간 동기화를 위한 이벤트 */
type Listener = () => void;
const listeners = new Set<Listener>();
function notifyAll() { listeners.forEach((fn) => fn()); }

export function useUserProfile() {
  const [profile, setProfile] = useState<UserProfile>(defaultProfile);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const row = await fetchUserProfile();
      if (row) setProfile(toProfile(row));
    } catch (e) {
      console.warn('[useUserProfile] 로드 실패:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // 다른 인스턴스에서 변경 시 reload
  useEffect(() => {
    listeners.add(load);
    return () => { listeners.delete(load); };
  }, [load]);

  // activeTheme은 ThemePicker가 별도 경로(userTheme.service.ts)로 저장하므로 save 시그니처에서 제외
  const save = useCallback(async (data: Omit<UserProfile, 'id' | 'activeTheme'>) => {
    try {
      const row = await upsertUserProfile({
        name: data.name,
        bio: data.bio || null,
        tone: data.tone,
        response_length: data.responseLength,
        emoji_usage: data.emojiUsage,
      });
      setProfile(toProfile(row));
      notifyAll();
      return true;
    } catch (e) {
      console.error('[useUserProfile] 저장 실패:', e);
      return false;
    }
  }, []);

  return { profile, loading, save, reload: load };
}
