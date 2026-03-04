/**
 * @file src/components/Layout.tsx
 * @description 앱 공유 레이아웃 컴포넌트
 * - Header + NewSidebar + Outlet(메인 콘텐츠) + ModiFAB + ChatModal
 * - ChatModal 상태를 여기서 관리 (어느 페이지에서든 열 수 있도록)
 * - 뽀모도로 타이머 상태 관리 + PomodoroTimer 플로팅 위젯
 * - 뽀모도로 미니 타이머를 BottomNav에 인라인 표시
 * - Outlet context로 openRoom, startPomodoro 함수를 하위 페이지에 전달
 */
import { useState, useCallback, useRef, useEffect } from 'react';
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

  // 채팅 사이드 패널 리사이즈
  const MIN_CHAT_W = 320;
  const MAX_CHAT_RATIO = 0.55;
  const [chatWidth, setChatWidth] = useState(() =>
    Math.max(MIN_CHAT_W, Math.round(window.innerWidth * 0.32))
  );
  const isResizing = useRef(false);

  // 드래그 리사이즈 핸들러
  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev: MouseEvent) => {
      if (!isResizing.current) return;
      const maxW = Math.round(window.innerWidth * MAX_CHAT_RATIO);
      const newW = Math.max(MIN_CHAT_W, Math.min(window.innerWidth - ev.clientX, maxW));
      setChatWidth(newW);
    };
    const onUp = () => {
      isResizing.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  // 윈도우 리사이즈 시 채팅 너비 보정
  useEffect(() => {
    const onResize = () => {
      setChatWidth(prev => {
        const maxW = Math.round(window.innerWidth * MAX_CHAT_RATIO);
        if (prev > maxW) return maxW;
        if (prev < MIN_CHAT_W) return MIN_CHAT_W;
        return prev;
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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

        {/* PC: 채팅 사이드 패널 (리사이즈 가능) / 모바일: 풀스크린 오버레이 */}
        {selectedRoom && (
          <>
            {/* 드래그 리사이즈 핸들 (PC만) */}
            <div
              onMouseDown={startResize}
              className="hidden lg:flex w-1.5 h-full flex-shrink-0 cursor-col-resize items-center justify-center
                hover:bg-primary-200 active:bg-primary-300 transition-colors group"
            >
              <div className="w-0.5 h-8 rounded-full bg-gray-300 group-hover:bg-primary-400 transition-colors" />
            </div>
            <div className="lg:flex-shrink-0 h-full overflow-hidden" style={{ width: chatWidth }}>
              <ChatModal key={selectedRoom.id} room={selectedRoom} onClose={() => setSelectedRoom(null)} />
            </div>
          </>
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

      {/* 모디 FAB — 채팅 패널이 열려있으면 숨김 */}
      {!selectedRoom && <ModiFAB onClick={handleOpenModi} />}

    </div>
  );
}
