/**
 * @file src/hooks/useProjects.ts
 * @description 프로젝트 데이터 관리 훅
 * - Supabase 연동 (projects 테이블)
 * - Supabase 미설정 시 더미 데이터 폴백
 * - CRUD: add, update, remove, reorder
 * - 모듈 레벨 이벤트로 모든 인스턴스 간 상태 동기화
 */
import { useState, useEffect, useCallback } from 'react';
import { Project } from '../types';
import { projects as dummyProjects } from '../data';
import {
  fetchProjects, addProject, updateProject, deleteProject, ProjectRow,
} from '../services/projects.service';

/** DB 행 → 프론트 타입 변환 */
function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji,
    color: row.color,
    image: row.image,
    description: row.description,
    status: row.status,
    priority: row.priority,
    startDate: row.start_date,
    endDate: row.end_date,
  };
}

/** 모든 useProjects 인스턴스 간 동기화를 위한 이벤트 */
type Listener = () => void;
const listeners = new Set<Listener>();
function notifyAll() { listeners.forEach((fn) => fn()); }

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingDummy, setUsingDummy] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const rows = await fetchProjects();
      setProjects(rows.map(toProject));
      setUsingDummy(false);
    } catch (e) {
      console.warn('[useProjects] Supabase 연결 실패, 더미 데이터 사용:', e);
      setProjects(dummyProjects);
      setUsingDummy(true);
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

  const add = useCallback(async (data: Omit<Project, 'id'>) => {
    if (usingDummy) {
      const newProject: Project = { id: Date.now().toString(), ...data };
      setProjects((prev) => [...prev, newProject]);
      return newProject;
    }
    try {
      const row = await addProject({
        name: data.name,
        emoji: data.emoji,
        color: data.color,
        image: data.image,
        description: data.description,
        status: data.status,
        priority: data.priority,
        start_date: data.startDate || undefined,
        end_date: data.endDate || undefined,
      });
      const p = toProject(row);
      setProjects((prev) => [...prev, p]);
      notifyAll();
      return p;
    } catch (e) {
      console.error('[useProjects] 추가 실패:', e);
      return null;
    }
  }, [usingDummy]);

  const update = useCallback(async (id: string, patch: Partial<Project>) => {
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    if (!usingDummy) {
      try {
        const dbPatch: Record<string, unknown> = {};
        if (patch.name !== undefined) dbPatch.name = patch.name;
        if (patch.emoji !== undefined) dbPatch.emoji = patch.emoji;
        if (patch.color !== undefined) dbPatch.color = patch.color;
        if (patch.image !== undefined) dbPatch.image = patch.image;
        if (patch.description !== undefined) dbPatch.description = patch.description;
        if (patch.status !== undefined) dbPatch.status = patch.status;
        if (patch.priority !== undefined) dbPatch.priority = patch.priority;
        if (patch.startDate !== undefined) dbPatch.start_date = patch.startDate || null;
        if (patch.endDate !== undefined) dbPatch.end_date = patch.endDate || null;
        await updateProject(id, dbPatch as Partial<ProjectRow>);
        notifyAll();
      } catch (e) {
        console.error('[useProjects] 업데이트 실패:', e);
        load();
      }
    }
  }, [usingDummy, load]);

  const remove = useCallback(async (id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    if (!usingDummy) {
      try {
        await deleteProject(id);
        notifyAll();
      } catch (e) {
        console.error('[useProjects] 삭제 실패:', e);
        load();
      }
    }
  }, [usingDummy, load]);

  /** 순서 변경 (위/아래 이동) */
  const reorder = useCallback(async (id: string, direction: 'up' | 'down') => {
    setProjects((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      if (idx < 0) return prev;
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= prev.length) return prev;

      const next = [...prev];
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      // priority 재계산
      const updated = next.map((p, i) => ({ ...p, priority: i + 1 }));

      // DB 반영 (비동기)
      if (!usingDummy) {
        Promise.all(
          updated.map((p) => updateProject(p.id, { priority: p.priority }))
        ).then(() => notifyAll())
          .catch((e) => console.error('[useProjects] 순서 변경 실패:', e));
      }

      return updated;
    });
  }, [usingDummy]);

  return { projects, loading, usingDummy, add, update, remove, reorder, reload: load };
}
