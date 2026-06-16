/**
 * @file src/hooks/useWorkspace.ts
 * @description 현재 워크스페이스 컨텍스트 훅 (빌드 A)
 * - 내가 속한 워크스페이스 목록 로드 (개인 + 팀)
 * - 활성 워크스페이스 선택 (null = 🌐 통합) — localStorage 유지
 * - 빌드 A 단계에선 아직 UI에 안 붙음. 빌드 C에서 스위처/필터가 사용.
 */
import { useState, useEffect, useCallback } from 'react';
import { fetchMyWorkspaces, ensurePersonalWorkspace } from '../services/workspaces.service';
import { Workspace, ActiveWorkspace } from '../types';

const STORAGE_KEY = 'activeWorkspaceId';

export function useWorkspace() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<ActiveWorkspace>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'all' || saved === null ? null : saved;
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let list = await fetchMyWorkspaces();
      if (list.length === 0) {
        // 개인 워크스페이스 보장 (트리거 미적용 환경 대비)
        await ensurePersonalWorkspace();
        list = await fetchMyWorkspaces();
      }
      setWorkspaces(list);
    } catch (e) {
      console.warn('[useWorkspace] 로드 실패:', e);
      setWorkspaces([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const setActiveWorkspace = useCallback((id: ActiveWorkspace) => {
    setActiveWorkspaceId(id);
    localStorage.setItem(STORAGE_KEY, id ?? 'all');
  }, []);

  // "전체" 제거 → 선택 없으면 개인 공간을 기본으로
  useEffect(() => {
    if (loading || activeWorkspaceId !== null) return;
    const p = workspaces.find(w => w.type === 'personal');
    if (p) setActiveWorkspace(p.id);
  }, [loading, activeWorkspaceId, workspaces, setActiveWorkspace]);

  const personal = workspaces.find(w => w.type === 'personal') ?? null;
  const offices = workspaces.filter(w => w.type === 'office');
  const activeWorkspace = activeWorkspaceId
    ? workspaces.find(w => w.id === activeWorkspaceId) ?? null
    : null; // null = 통합

  /** 새 항목 작성 시 기본으로 넣을 워크스페이스 id (통합이면 개인) */
  const writeTargetId = activeWorkspaceId ?? personal?.id ?? null;

  return {
    workspaces, personal, offices,
    loading,
    activeWorkspaceId, activeWorkspace, setActiveWorkspace,
    writeTargetId,
    reload: load,
  };
}
