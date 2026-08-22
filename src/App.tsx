/**
 * @file src/App.tsx
 * @description 메인 앱 컴포넌트 — 인증 + 라우팅
 * - useAuth로 로그인 상태 확인
 * - 미인증: LoginPage / 인증: BrowserRouter 라우팅
 */
import { useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { updateLastAccess, hasActiveSubscription, subscribePush } from './services/pushNotification.service';
import { WorkspaceProvider, useWorkspaceContext } from './contexts/WorkspaceContext';
import { OfficeShell } from './components/office/OfficeShell';
import { LoginPage } from './pages/LoginPage';
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
  if (loading) {
    return <LoadingSplash />;
  }

  if (activeWorkspace?.type === 'office') {
    // 오피스 셸도 실제 URL을 쓴다 (가이드 00 원칙 1 — 팝업이 아니라 페이지).
    // OfficeShell 내부에서 useLocation/useNavigate로 view·상세를 URL과 동기화한다.
    // 서버(server.js)가 SPA fallback을 처리하므로 새로고침·딥링크도 유지된다.
    return (
      <BrowserRouter>
        <OfficeShell workspace={activeWorkspace} />
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/schedules" element={<SchedulesPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/insights" element={<InsightsPage />} />
          <Route path="/readings" element={<ReadingsPage />} />
          <Route path="/records" element={<RecordsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/summaries" element={<SummariesPage />} />
          <Route path="/content" element={<ContentPage />} />
          <Route path="/project/:projectId" element={<ProjectDetailPage />} />
          {/* 오피스에서 쓰던 경로(/todos 등)로 들어와도 흰 화면이 안 뜨게 홈으로 폴백 */}
          <Route path="*" element={<HomePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
