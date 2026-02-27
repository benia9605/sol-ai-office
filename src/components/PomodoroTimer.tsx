/**
 * @file src/components/PomodoroTimer.tsx
 * @description 플로팅 미니 뽀모도로 타이머 위젯
 * - 작업 시간 / 휴식 시간 커스텀 설정 (기본 25분/5분)
 * - 카운트다운 → 완료 시 알림음 + 휴식 모드 전환
 * - 미니 모드 (기본): 시간 + 할일이름 + 일시정지/중지
 * - 확장 모드 (클릭): 시간 조절, 세션 카운트, 리셋
 * - 위치: 화면 하단 ModiFAB 위쪽
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { TaskItem } from '../types';

interface PomodoroTimerProps {
  task: TaskItem | null;
  initialWorkMin?: number;
  initialBreakMin?: number;
  onComplete: (taskId: string) => void;
  onStop: () => void;
  onStateChange?: (state: PomodoroState | null) => void;
  /** BottomNav에서 재생/일시정지 토글을 위한 ref */
  onToggleRef?: React.MutableRefObject<(() => void) | null>;
  /** BottomNav에서 확장 모드 열기를 위한 ref */
  onExpandRef?: React.MutableRefObject<(() => void) | null>;
}

export interface PomodoroState {
  timeStr: string;
  mode: 'work' | 'break';
  isRunning: boolean;
}

type TimerMode = 'work' | 'break';

export function PomodoroTimer({ task, initialWorkMin, initialBreakMin, onComplete, onStop, onStateChange, onToggleRef, onExpandRef }: PomodoroTimerProps) {
  const [workMinutes, setWorkMinutes] = useState(initialWorkMin || 25);
  const [breakMinutes, setBreakMinutes] = useState(initialBreakMin || 5);
  const [secondsLeft, setSecondsLeft] = useState((initialWorkMin || 25) * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState<TimerMode>('work');
  const [expanded, setExpanded] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<AudioContext | null>(null);

  const playBeep = useCallback(() => {
    try {
      const ctx = audioRef.current || new AudioContext();
      audioRef.current = ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 800;
      gain.gain.value = 0.3;
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch {
      // audio not supported
    }
  }, []);

  useEffect(() => {
    if (task) {
      const wm = initialWorkMin || 25;
      const bm = initialBreakMin || 5;
      setWorkMinutes(wm);
      setBreakMinutes(bm);
      setSecondsLeft(wm * 60);
      setMode('work');
      setIsRunning(true);
    }
  }, [task]);

  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          playBeep();
          if (mode === 'work') {
            if (task) {
              onComplete(task.id);
              setSessionCount((s) => s + 1);
            }
            setMode('break');
            return breakMinutes * 60;
          } else {
            setMode('work');
            return workMinutes * 60;
          }
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, mode, workMinutes, breakMinutes, task, onComplete, playBeep]);

  const handleStop = () => {
    setIsRunning(false);
    setSecondsLeft(workMinutes * 60);
    setMode('work');
    setSessionCount(0);
    setExpanded(false);
    onStop();
  };

  const handleReset = () => {
    setSecondsLeft(mode === 'work' ? workMinutes * 60 : breakMinutes * 60);
    setIsRunning(false);
  };

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  // 부모에게 타이머 상태 알림 (BottomNav 표시용)
  useEffect(() => {
    if (task) {
      onStateChange?.({ timeStr, mode, isRunning });
    } else {
      onStateChange?.(null);
    }
  }, [task, timeStr, mode, isRunning, onStateChange]);

  // BottomNav에서 호출할 수 있도록 ref에 함수 바인딩
  useEffect(() => {
    if (onToggleRef) onToggleRef.current = () => setIsRunning((r) => !r);
    if (onExpandRef) onExpandRef.current = () => setExpanded(true);
    return () => {
      if (onToggleRef) onToggleRef.current = null;
      if (onExpandRef) onExpandRef.current = null;
    };
  }, [onToggleRef, onExpandRef]);

  if (!task) return null;

  return (
    <div className={`fixed z-[45] ${expanded ? 'bottom-20 right-4 lg:bottom-6 lg:right-24' : 'hidden lg:block lg:bottom-6 lg:right-24'}`}>
      {expanded ? (
        /* 확장 모드 */
        <div className="bg-white rounded-2xl shadow-hover p-4 w-72 space-y-3">
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              mode === 'work' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
            }`}>
              {mode === 'work' ? 'WORK' : 'BREAK'}
            </span>
            <button onClick={() => setExpanded(false)} className="text-gray-400 hover:text-gray-600 text-sm">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
            </button>
          </div>

          <div className="text-center">
            <p className="text-3xl font-mono font-bold text-gray-800">{timeStr}</p>
            <p className="text-xs text-gray-500 mt-1 truncate">{task.title}</p>
          </div>

          <div className="flex justify-center gap-2">
            <button
              onClick={() => setIsRunning(!isRunning)}
              className={`px-4 py-2 rounded-xl text-sm font-medium text-white transition-colors ${
                isRunning ? 'bg-amber-500 hover:bg-amber-600' : 'bg-green-500 hover:bg-green-600'
              }`}
            >
              {isRunning ? 'II' : '\u25B6'}
            </button>
            <button onClick={handleReset}
              className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">
              Reset
            </button>
            <button onClick={handleStop}
              className="px-4 py-2 rounded-xl text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors">
              Stop
            </button>
          </div>

          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Sessions: {sessionCount}</span>
            <span>
              {task.pomodoroCompleted ?? 0}/{task.pomodoroEstimate ?? '?'}
            </span>
          </div>

          <div className="space-y-2 pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-500">Work</label>
              <div className="flex items-center gap-2">
                <input type="range" min={5} max={60} step={5} value={workMinutes}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setWorkMinutes(v);
                    if (mode === 'work' && !isRunning) setSecondsLeft(v * 60);
                  }}
                  className="w-24 accent-red-500" />
                <span className="text-xs font-medium w-8 text-right">{workMinutes}m</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-500">Break</label>
              <div className="flex items-center gap-2">
                <input type="range" min={1} max={30} step={1} value={breakMinutes}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setBreakMinutes(v);
                    if (mode === 'break' && !isRunning) setSecondsLeft(v * 60);
                  }}
                  className="w-24 accent-green-500" />
                <span className="text-xs font-medium w-8 text-right">{breakMinutes}m</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* 미니 모드 */
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-2xl shadow-hover cursor-pointer transition-all ${
            mode === 'work' ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'
          }`}
          onClick={() => setExpanded(true)}
        >
          <span className="text-sm">
            {mode === 'work' ? '\uD83C\uDF45' : '\u2615'}
          </span>
          <span className="font-mono text-sm font-bold text-gray-800">{timeStr}</span>
          <span className="text-xs text-gray-500 max-w-[100px] truncate">{task.title}</span>
          <button
            onClick={(e) => { e.stopPropagation(); setIsRunning(!isRunning); }}
            className="text-xs px-1.5 py-0.5 rounded-lg bg-white/80 text-gray-600 hover:bg-white"
          >
            {isRunning ? 'II' : '\u25B6'}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleStop(); }}
            className="text-xs px-1.5 py-0.5 rounded-lg bg-white/80 text-red-500 hover:bg-white"
          >
            x
          </button>
        </div>
      )}
    </div>
  );
}
