/**
 * @file src/components/Layout.tsx
 * @description 앱 공유 레이아웃 컴포넌트
 * - Header + NewSidebar + Outlet(메인 콘텐츠) + ModiFAB + ChatModal
 * - ChatModal 상태를 여기서 관리 (어느 페이지에서든 열 수 있도록)
 * - 뽀모도로 타이머 상태 관리 + PomodoroTimer 플로팅 위젯
 * - 뽀모도로 미니 타이머를 BottomNav에 인라인 표시
 * - Outlet context로 openRoom, startPomodoro 함수를 하위 페이지에 전달
 */
import { useState, useCallback, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import { Room, ChatHistory, TaskItem } from '../types';
import { rooms, modiSecretary } from '../data';
import { Header } from './Header';
import { useAuth } from '../hooks/useAuth';
import { useUserProfile } from '../hooks/useUserProfile';
import { signOut } from '../services/auth';
import { NewSidebar } from './NewSidebar';
import { ModiFAB } from './ModiFAB';
import { BottomNav } from './BottomNav';
import { ChatModal } from './ChatModal';
import { PomodoroTimer, PomodoroState } from './PomodoroTimer';

export interface LayoutContext {
  openRoom: (room: Room) => void;
  startPomodoro: (task: TaskItem, workMin?: number, breakMin?: number) => void;
  onPomodoroComplete: (taskId: string) => void;
}

export function Layout() {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [pomodoroTask, setPomodoroTask] = useState<TaskItem | null>(null);
  const [pomodoroWorkMin, setPomodoroWorkMin] = useState(25);
  const [pomodoroBreakMin, setPomodoroBreakMin] = useState(5);
  const [pomodoroState, setPomodoroState] = useState<PomodoroState | null>(null);
  const pomodoroToggleRef = useRef<(() => void) | null>(null);
  const pomodoroExpandRef = useRef<(() => void) | null>(null);

  const openRoom = (room: Room) => {
    setSelectedRoom(room);
  };

  const handleHistorySelect = (history: ChatHistory) => {
    const room = rooms.find((r) => r.id === history.roomId);
    if (room) setSelectedRoom(room);
  };

  const handleOpenModi = () => {
    setSelectedRoom(modiSecretary);
  };

  const startPomodoro = useCallback((task: TaskItem, workMin?: number, breakMin?: number) => {
    setPomodoroTask({ ...task });
    if (workMin) setPomodoroWorkMin(workMin);
    if (breakMin) setPomodoroBreakMin(breakMin);
  }, []);

  const handlePomodoroComplete = useCallback((taskId: string) => {
    setPomodoroTask((prev) => {
      if (!prev || prev.id !== taskId) return prev;
      return { ...prev, pomodoroCompleted: (prev.pomodoroCompleted ?? 0) + 1 };
    });
  }, []);

  const handlePomodoroStop = useCallback(() => {
    setPomodoroTask(null);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <Header
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        userName={profile.name || user?.user_metadata?.name || user?.email?.split('@')[0]}
        onLogout={signOut}
      />

      <div className="flex flex-1 overflow-hidden">
        <NewSidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onSelectHistory={handleHistorySelect}
        />

        {/* 메인 콘텐츠 — 모바일 하단 네비 높이만큼 여백 */}
        <main className="flex-1 overflow-y-auto pb-14 lg:pb-0 min-w-0">
          <Outlet context={{ openRoom, startPomodoro, onPomodoroComplete: handlePomodoroComplete } satisfies LayoutContext} />
        </main>

        {/* PC: 채팅 사이드 패널 / 모바일: 풀스크린 오버레이 (ChatModal 내부에서 반응형 처리) */}
        {selectedRoom && (
          <ChatModal room={selectedRoom} onClose={() => setSelectedRoom(null)} />
        )}
      </div>

      {/* 모바일 하단 네비게이션 — 뽀모도로 미니 타이머 포함 */}
      <BottomNav
        onMoreClick={() => setSidebarOpen(true)}
        pomodoroTask={pomodoroTask}
        pomodoroTimeStr={pomodoroState?.timeStr}
        pomodoroMode={pomodoroState?.mode}
        pomodoroRunning={pomodoroState?.isRunning}
        onPomodoroToggle={() => pomodoroToggleRef.current?.()}
        onPomodoroExpand={() => pomodoroExpandRef.current?.()}
      />

      {/* 뽀모도로 타이머 (PC: 플로팅 위젯, 모바일: BottomNav에 미니 표시) */}
      <PomodoroTimer
        task={pomodoroTask}
        initialWorkMin={pomodoroWorkMin}
        initialBreakMin={pomodoroBreakMin}
        onComplete={handlePomodoroComplete}
        onStop={handlePomodoroStop}
        onStateChange={setPomodoroState}
        onToggleRef={pomodoroToggleRef}
        onExpandRef={pomodoroExpandRef}
      />

      {/* 모디 FAB */}
      <ModiFAB onClick={handleOpenModi} />

    </div>
  );
}
