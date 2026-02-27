/**
 * @file src/hooks/useUserProfile.ts
 * @description 유저 프로필 관리 훅
 * - Supabase user_profiles 테이블 연동
 * - 로드, 저장 기능 제공
 */
import { useState, useEffect, useCallback } from 'react';
import { fetchUserProfile, upsertUserProfile, UserProfileRow } from '../services/userProfile.service';

export interface UserProfile {
  id: string;
  name: string;
  bio: string;
  tone: string;
  responseLength: string;
  emojiUsage: string;
}

function toProfile(row: UserProfileRow): UserProfile {
  return {
    id: row.id,
    name: row.name,
    bio: row.bio || '',
    tone: row.tone || 'polite',
    responseLength: row.response_length || 'short',
    emojiUsage: row.emoji_usage || 'moderate',
  };
}

const defaultProfile: UserProfile = {
  id: '',
  name: '',
  bio: '',
  tone: 'polite',
  responseLength: 'short',
  emojiUsage: 'moderate',
};

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

  const save = useCallback(async (data: Omit<UserProfile, 'id'>) => {
    try {
      const row = await upsertUserProfile({
        name: data.name,
        bio: data.bio || null,
        tone: data.tone,
        response_length: data.responseLength,
        emoji_usage: data.emojiUsage,
      });
      setProfile(toProfile(row));
      return true;
    } catch (e) {
      console.error('[useUserProfile] 저장 실패:', e);
      return false;
    }
  }, []);

  return { profile, loading, save, reload: load };
}
