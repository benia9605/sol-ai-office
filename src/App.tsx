/**
 * @file src/App.tsx
 * @description 메인 앱 컴포넌트 — 인증 + 라우팅
 * - useAuth로 로그인 상태 확인
 * - 미인증: LoginPage / 인증: BrowserRouter 라우팅
 */
import { useEffect, useRef, useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { updateLastAccess, hasActiveSubscription, subscribePush } from './services/pushNotification.service';
import { WorkspaceProvider, useWorkspaceContext } from './contexts/WorkspaceContext';
import { OfficeShell } from './components/office/OfficeShell';
import { BrandShell } from './brand/BrandShell';
import { WorkspaceLauncher } from './components/WorkspaceLauncher';
import { WorkspaceCreateModal } from './components/WorkspaceCreateModal';
import { LoginPage } from './pages/LoginPage';
import { Workspace } from './types';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { SchedulesPage } from './pages/SchedulesPage';
import { TasksPage } from './pages/TasksPage';
import { InsightsPage } from './pages/InsightsPage';
import { ReadingsPage } from './pages/ReadingsPage';
import { RecordsPage } from './pages/RecordsPage';
import { SettingsPage } from './pages/SettingsPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { SummariesPage } from './pages/SummariesPage';
import { ContentPage } from './pages/ContentPage';
import { FEATURES } from './config/features';

/** 인증/워크스페이스 로딩 중 공통 스플래시 */
function LoadingSplash() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-3">
        <h1 className="text-2xl font-bold text-gray-800">Teamie</h1>
        <div className="flex gap-1 justify-center">
          <span className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

function App() {
  const { user, loading } = useAuth();
  const lastAccessUpdated = useRef(false);

  // 마지막 접속 시간 업데이트 + 기존 구독 갱신
  useEffect(() => {
    if (!user || lastAccessUpdated.current) return;
    lastAccessUpdated.current = true;

    updateLastAccess(user.id);

    hasActiveSubscription().then((active) => {
      if (active) subscribePush(user.id);
    });
  }, [user]);

  if (loading) {
    return <LoadingSplash />;
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <WorkspaceProvider>
      <AppShell />
    </WorkspaceProvider>
  );
}

/**
 * 활성 워크스페이스 종류에 따라 셸 분기:
 * - office → 회사 오피스 셸(OfficeShell)
 * - personal / 전체(null) → 기존 개인 앱(라우터 + Layout)
 */
/**
 * 앱을 처음 열 때 「어디로 갈까요?」 (개인 공간 / 회사 오피스 → 어느 오피스) 팝업.
 * 브라우저 탭마다 한 번 (sessionStorage). 슬랙 · 링크로 /w/... 에 바로 들어오면 띄우지 않는다.
 * 닫으면 마지막에 있던 곳 그대로.
 */
const START_KEY = 'startLauncherShown';
function StartLauncher() {
  const { personal, offices, activeWorkspaceId, setActiveWorkspace, reload } = useWorkspaceContext();
  const [open, setOpen] = useState(() => {
    try {
      if (sessionStorage.getItem(START_KEY) || window.location.pathname.startsWith('/w/')) return false;
      sessionStorage.setItem(START_KEY, '1');
    } catch { /* 사생활 보호 모드 - 그래도 한 번은 띄운다 */ }
    return true;
  });
  const [showCreate, setShowCreate] = useState(false);
  if (!personal && offices.length === 0) return null;

  // AppShell 이 셸마다 BrowserRouter 를 새로 만들므로 주소를 먼저 바꿔 두면 그 화면으로 열린다
  const pick = (id: string) => {
    const ws = [personal, ...offices].find(w => w?.id === id);
    window.history.replaceState(null, '', ws?.type === 'office' ? `/w/${id}/today` : '/');
    setActiveWorkspace(id);
  };
  return (
    <>
      <WorkspaceLauncher open={open} onClose={() => setOpen(false)} personal={personal} offices={offices}
        activeId={activeWorkspaceId} onPick={pick} onCreate={() => setShowCreate(true)} />
      <WorkspaceCreateModal open={showCreate} onClose={() => setShowCreate(false)}
        onCreated={async (ws: Workspace) => { await reload(); pick(ws.id); }} />
    </>
  );
}

function AppShell() {
  return <><AppShellInner /><StartLauncher /></>;
}

function AppShellInner() {
  const { activeWorkspace, loading } = useWorkspaceContext();

  // 워크스페이스 목록 로드가 끝나야 어떤 셸(개인/오피스)인지 확정된다.
  // 로드 전에는 activeWorkspace가 잠깐 null이라, 가드 없이 렌더하면
  // 개인홈이 먼저 떴다가 로드 후 오피스로 튀는 깜빡임(5~10초)이 생긴다.
  // 로딩 동안에는 스플래시를 유지해 잘못된 셸 노출을 막는다.
  // (전용 셸 도입 후에도 같은 이유로 유지 — 다른 브랜드 콘텐츠가 순간 노출되면 안 된다)
  if (loading) {
    return <LoadingSplash />;
  }

  if (activeWorkspace?.type === 'office') {
    // 오피스 셸도 실제 URL을 쓴다 (가이드 00 원칙 1 — 팝업이 아니라 페이지).
    // 서버(server.js)가 SPA fallback을 처리하므로 새로고침·딥링크도 유지된다.
    return (
      <BrowserRouter>
        <Routes>
          {/* 전용 셸의 workspace 딥링크 — URL 이 localStorage 보다 우선한다 (BUILD_PACK §2) */}
          <Route path="/w/:workspaceId" element={<WorkspaceRoute />} />
          <Route path="/w/:workspaceId/:view" element={<WorkspaceRoute />} />
          <Route path="/w/:workspaceId/:view/:detailId" element={<WorkspaceRoute />} />
          <Route path="*" element={<OfficeEntry workspace={activeWorkspace} />} />
        </Routes>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* 개인 셸에서도 /w/:id 딥링크를 해석한다 (다른 기기에서 링크로 들어오는 경우) */}
        <Route path="/w/:workspaceId" element={<WorkspaceRoute />} />
        <Route path="/w/:workspaceId/:view" element={<WorkspaceRoute />} />
        <Route path="/w/:workspaceId/:view/:detailId" element={<WorkspaceRoute />} />
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/insights" element={<InsightsPage />} />
          <Route path="/readings" element={<ReadingsPage />} />
          <Route path="/records" element={<RecordsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          {/* 슬림다운으로 백업/숨김 — 플래그 on이면 부활 (docs/PERSONAL_SLIMDOWN_PLAN.md) */}
          {FEATURES.schedules && <Route path="/schedules" element={<SchedulesPage />} />}
          {FEATURES.summaries && <Route path="/summaries" element={<SummariesPage />} />}
          {FEATURES.content && <Route path="/content" element={<ContentPage />} />}
          {FEATURES.projects && <Route path="/project/:projectId" element={<ProjectDetailPage />} />}
          {/* 숨긴/미지원 경로(/todos·/schedules 등)로 들어와도 흰 화면 대신 홈으로 폴백 */}
          <Route path="*" element={<HomePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

/**
 * 오피스 진입 - 모든 오피스 워크스페이스는 브랜드 오피스 템플릿(BrandShell)으로 연다.
 *
 * 대표 결정 (2026-10-27): 시목 · 쏠닝포인트 · 운명랩이 같은 템플릿을 쓰고 브랜드 값만 다르다.
 * 기존 Teamie 화면(OfficeShell)은 백업 - 설정 → 「Teamie 기존 화면」 으로 들어가고, 그 화면의
 * 「화면 바꾸기」 로 돌아온다. 고른 값은 workspace 별로 기억한다 (localStorage · 표시 취향일 뿐 권한과 무관).
 * 예전 시목 전용 셸(src/simok)은 코드만 남아 있다.
 */
// 예전 화면 고르기 팝업의 값(officeShell:*)은 보지 않는다 - 새 키라 배포 뒤 모두 새 화면으로 연다
const BACKUP_KEY = (wsId: string) => `officeBackup:${wsId}`;
const readBackup = (wsId: string) => { try { return localStorage.getItem(BACKUP_KEY(wsId)) === '1'; } catch { return false; } };
const writeBackup = (wsId: string, on: boolean) => {
  try { if (on) localStorage.setItem(BACKUP_KEY(wsId), '1'); else localStorage.removeItem(BACKUP_KEY(wsId)); } catch { /* noop */ }
};

function OfficeEntry({ workspace }: { workspace: Workspace }) {
  const [backup, setBackup] = useState(() => readBackup(workspace.id));
  useEffect(() => { setBackup(readBackup(workspace.id)); }, [workspace.id]);

  if (backup) {
    return <OfficeShell workspace={workspace} onSwitchShell={() => { writeBackup(workspace.id, false); setBackup(false); }} />;
  }
  return <BrandShell workspace={workspace} onBackupShell={() => { writeBackup(workspace.id, true); setBackup(true); }} />;
}

/**
 * `/w/:workspaceId/...` 딥링크 처리.
 * URL 의 workspace 를 먼저 해석하고 **멤버십을 확인한 뒤** 그 셸을 렌더한다.
 * localStorage 의 마지막 workspace 보다 URL 대상이 우선한다(BUILD_PACK §2).
 */
function WorkspaceRoute() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const { workspaces, loading, activeWorkspaceId, setActiveWorkspace } = useWorkspaceContext();

  const target = workspaces.find(w => w.id === workspaceId) ?? null;

  // URL 의 workspace 로 활성 컨텍스트를 맞춘다 (다른 기기·새로고침에서도 같은 브랜드가 열리도록)
  useEffect(() => {
    if (!loading && target && activeWorkspaceId !== target.id) setActiveWorkspace(target.id);
  }, [loading, target, activeWorkspaceId, setActiveWorkspace]);

  if (loading) return <LoadingSplash />;

  // 멤버가 아니거나 없는 workspace → 권한 없는 대상으로 자동 전환하지 않는다(BUILD_PACK §4)
  if (!target) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-sm text-center space-y-3">
          <h1 className="text-lg font-semibold text-gray-800">열 수 없는 워크스페이스예요</h1>
          <p className="text-sm text-gray-500 leading-relaxed">
            링크의 워크스페이스에 접근 권한이 없거나 삭제되었어요.
            다른 워크스페이스로 자동 이동하지 않았습니다.
          </p>
          <button onClick={() => navigate('/')} className="text-sm text-primary-500 underline">
            내 화면으로 가기
          </button>
        </div>
      </div>
    );
  }

  if (target.type !== 'office') { navigate('/', { replace: true }); return <LoadingSplash />; }
  return <OfficeEntry workspace={target} />;
}

export default App;
