/**
 * @file src/contexts/WorkspaceContext.tsx
 * @description 앱 전역 워크스페이스 컨텍스트 (빌드 C-①)
 * - useWorkspace 훅을 앱 전체에 1번만 제공 (스위처/필터가 공유)
 * - Provider 밖에서 호출해도 안전하도록 기본값(통합/빈 목록) 제공 → 절대 throw 안 함
 */
import { createContext, useContext, ReactNode } from 'react';
import { useWorkspace } from '../hooks/useWorkspace';
import { Workspace, ActiveWorkspace } from '../types';

interface WorkspaceContextValue {
  workspaces: Workspace[];
  personal: Workspace | null;
  offices: Workspace[];
  loading: boolean;
  activeWorkspaceId: ActiveWorkspace;
  activeWorkspace: Workspace | null;
  setActiveWorkspace: (id: ActiveWorkspace) => void;
  writeTargetId: string | null;
  reload: () => void;
}

const defaultValue: WorkspaceContextValue = {
  workspaces: [], personal: null, offices: [], loading: false,
  activeWorkspaceId: null, activeWorkspace: null,
  setActiveWorkspace: () => {}, writeTargetId: null, reload: () => {},
};

const WorkspaceContext = createContext<WorkspaceContextValue>(defaultValue);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const ws = useWorkspace();
  return <WorkspaceContext.Provider value={ws}>{children}</WorkspaceContext.Provider>;
}

/** 어디서든 안전하게 호출 (Provider 없으면 통합/빈 기본값) */
export function useWorkspaceContext(): WorkspaceContextValue {
  return useContext(WorkspaceContext);
}
