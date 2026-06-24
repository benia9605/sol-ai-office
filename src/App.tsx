/**
 * @file src/App.tsx
 * @description 메인 앱 컴포넌트 — 인증 + 라우팅
 * - useAuth로 로그인 상태 확인
 * - 미인증: LoginPage / 인증: BrowserRouter 라우팅
 */
import { useEffect, useRef } from 'react';
import { BrowserRouter, MemoryRouter, Routes, Route } from 'react-router-dom';
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
  const { activeWorkspace } = useWorkspaceContext();

  if (activeWorkspace?.type === 'office') {
    // 오피스 셸은 URL 라우팅을 쓰지 않지만, 내부 공용 컴포넌트(예: ItemDetailPopup)가
    // useNavigate()를 호출하므로 라우터 컨텍스트가 필요하다. 브라우저 주소를 건드리지 않도록
    // MemoryRouter로 감싼다(없으면 일정/할일 상세 클릭 시 useNavigate가 throw → 흰 화면).
    return (
      <MemoryRouter>
        <OfficeShell workspace={activeWorkspace} />
      </MemoryRouter>
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
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
