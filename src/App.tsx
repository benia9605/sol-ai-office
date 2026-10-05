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
import { SimokShell } from './simok/SimokShell';
import { ShellPicker, ShellChoice, readShellChoice, writeShellChoice } from './simok/ShellPicker';
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
function AppShell() {
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
 * 오피스 진입 — 전용 셸이 있는 워크스페이스면 "어떤 화면으로 볼까" 를 먼저 묻는다.
 *
 * 대표 요청(2026-10-05): 오피스를 클릭하면 시목 / 직접 만든 오피스 중 고르는 팝업이 나오게.
 * 고른 값은 workspace 별로 localStorage 에 기억하고, 양쪽 셸에서 다시 고를 수 있다.
 *
 * ⚠️ 이 선택은 **표시 취향**이다. 데이터 접근 권한을 바꾸지 않는다(서버 RLS·가드가 결정).
 */
function OfficeEntry({ workspace }: { workspace: Workspace }) {
  // 전용 셸 후보가 있는가 — 신뢰되는 DB 설정(workspaces.office_shell, 마이그 062)
  const hasDedicated = workspace.officeShell === 'simok';
  const [choice, setChoice] = useState<ShellChoice | null>(() =>
    hasDedicated ? readShellChoice(workspace.id) : 'common');
  const [picking, setPicking] = useState(false);

  // 워크스페이스를 바꾸면 그 workspace 의 선택을 다시 읽는다
  useEffect(() => {
    setChoice(hasDedicated ? readShellChoice(workspace.id) : 'common');
    setPicking(false);
  }, [workspace.id, hasDedicated]);

  const pick = (c: ShellChoice) => {
    writeShellChoice(workspace.id, c);
    setChoice(c);
    setPicking(false);
  };

  // 전용 셸이 없는 워크스페이스는 기존 화면 그대로 (운명랩·쏠닝오즈는 영향 없음)
  if (!hasDedicated) return <OfficeShell workspace={workspace} />;

  // 아직 고르지 않았으면 먼저 묻는다 (닫기 없음 — 골라야 들어간다)
  if (!choice) {
    return (
      <>
        <LoadingSplash />
        <ShellPicker workspace={workspace} onPick={pick} />
      </>
    );
  }

  return (
    <>
      {choice === 'simok'
        ? <SimokShell workspace={workspace} onSwitchShell={() => setPicking(true)} />
        : <OfficeShell workspace={workspace} onSwitchShell={() => setPicking(true)} />}
      {picking && (
        <ShellPicker
          workspace={workspace}
          current={choice}
          onPick={pick}
          onClose={() => setPicking(false)}
        />
      )}
    </>
  );
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
