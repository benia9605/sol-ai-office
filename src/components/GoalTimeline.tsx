/**
 * @file src/components/GoalTimeline.tsx
 * @description 목표 타임라인 뷰어 (간트차트 스타일)
 * - 줌 레벨: 월/분기/년
 * - 각 목표를 수평 바로 표시 (startDate~endDate)
 * - 상태별 스타일, 진행률 표시, 오늘 라인
 */
import { useState, useRef, useEffect, useMemo } from 'react';
import { GoalItem } from '../types';
import { getBadgeColors } from '../utils/colorUtils';

interface GoalTimelineProps {
  goals: GoalItem[];
  projectColor: string;
  onGoalClick?: (goalId: string) => void;
}

type ZoomLevel = 'week' | 'month' | 'quarter' | 'year';

const ZOOM_LABELS: Record<ZoomLevel, string> = {
  week: '주', month: '월', quarter: '분기', year: '년',
};

const ZOOM_COL_WIDTH: Record<ZoomLevel, number> = {
  week: 64, month: 90, quarter: 120, year: 140,
};

/** 날짜 문자열 → Date 객체 (로컬) */
function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** 두 날짜 차이 (일) */
function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/** 주의 월요일 구하기 */
function getMonday(d: Date): Date {
  const r = new Date(d);
  const day = r.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  r.setDate(r.getDate() + diff);
  return r;
}

/** 분기 시작 */
function getQuarterStart(d: Date): Date {
  const q = Math.floor(d.getMonth() / 3);
  return new Date(d.getFullYear(), q * 3, 1);
}

/** 타임라인 열(슬롯) 정보 생성 */
function generateSlots(zoom: ZoomLevel, origin: Date, count: number) {
  const slots: { start: Date; end: Date; label: string; groupLabel?: string }[] = [];
  let prevGroup = '';

  for (let i = -Math.floor(count / 2); i <= Math.ceil(count / 2); i++) {
    let start: Date, end: Date, label: string, groupLabel: string | undefined;

    if (zoom === 'week') {
      // 각 열 = 1일, 요일 라벨 (월 3, 화 4 ...)
      start = new Date(origin);
      start.setDate(start.getDate() + i);
      end = new Date(start);
      end.setDate(end.getDate() + 1);
      const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
      label = `${dayNames[start.getDay()]} ${start.getDate()}`;
      const g = `${start.getFullYear()}년 ${start.getMonth() + 1}월`;
      groupLabel = g !== prevGroup ? g : undefined;
      prevGroup = g;
    } else if (zoom === 'month') {
      start = new Date(origin.getFullYear(), origin.getMonth() + i, 1);
      end = new Date(origin.getFullYear(), origin.getMonth() + i + 1, 1);
      label = `${start.getMonth() + 1}월`;
      const g = `${start.getFullYear()}년`;
      groupLabel = g !== prevGroup ? g : undefined;
      prevGroup = g;
    } else if (zoom === 'quarter') {
      const baseQ = Math.floor(origin.getMonth() / 3);
      const totalQ = baseQ + i;
      const y = origin.getFullYear() + Math.floor(totalQ / 4);
      const q = ((totalQ % 4) + 4) % 4;
      start = new Date(y, q * 3, 1);
      end = new Date(y, q * 3 + 3, 1);
      label = `Q${q + 1}`;
      const g = `${y}년`;
      groupLabel = g !== prevGroup ? g : undefined;
      prevGroup = g;
    } else {
      start = new Date(origin.getFullYear() + i, 0, 1);
      end = new Date(origin.getFullYear() + i + 1, 0, 1);
      label = `${start.getFullYear()}`;
      groupLabel = undefined;
    }

    slots.push({ start, end, label, groupLabel });
  }
  return slots;
}

/** 상태 아이콘 */
function StatusDot({ status }: { status: GoalItem['status'] }) {
  if (status === 'completed') {
    return (
      <svg className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="8" cy="8" r="6" />
        <path d="M5.5 8l2 2 3-3.5" />
      </svg>
    );
  }
  if (status === 'in_progress') {
    return (
      <svg className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="8" cy="8" r="6" />
        <path d="M8 5v3.5l2.5 1.5" />
      </svg>
    );
  }
  if (status === 'on_hold') {
    return <div className="w-3 h-3 rounded-full border-2 border-gray-300 bg-gray-100 flex-shrink-0" />;
  }
  return <div className="w-3 h-3 rounded-full border-2 border-gray-300 flex-shrink-0" />;
}

export function GoalTimeline({ goals, projectColor, onGoalClick }: GoalTimelineProps) {
  const [zoom, setZoom] = useState<ZoomLevel>('month');
  const scrollRef = useRef<HTMLDivElement>(null);
  const badge = getBadgeColors(projectColor);

  // origin = 오늘 기준
  const today = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }, []);

  const [origin, setOrigin] = useState(() => {
    if (zoom === 'week') return getMonday(today);
    if (zoom === 'quarter') return getQuarterStart(today);
    if (zoom === 'year') return new Date(today.getFullYear(), 0, 1);
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  // 줌 변경 시 origin 리셋
  useEffect(() => {
    if (zoom === 'week') setOrigin(getMonday(today));
    else if (zoom === 'month') setOrigin(new Date(today.getFullYear(), today.getMonth(), 1));
    else if (zoom === 'quarter') setOrigin(getQuarterStart(today));
    else setOrigin(new Date(today.getFullYear(), 0, 1));
  }, [zoom, today]);

  const slotCount = zoom === 'week' ? 28 : zoom === 'month' ? 12 : zoom === 'quarter' ? 8 : 6;
  const colW = ZOOM_COL_WIDTH[zoom];
  const slots = useMemo(() => generateSlots(zoom, origin, slotCount), [zoom, origin, slotCount]);

  // 타임라인 시작~끝 날짜
  const timelineStart = slots[0].start;
  const timelineEnd = slots[slots.length - 1].end;
  const totalDays = diffDays(timelineStart, timelineEnd);
  const totalWidth = slots.length * colW;

  // 오늘 위치 (px)
  const todayOffset = totalDays > 0 ? (diffDays(timelineStart, today) / totalDays) * totalWidth : 0;
  const todayInRange = today >= timelineStart && today < timelineEnd;

  // 날짜가 있는 목표 / 없는 목표 분리
  const goalsWithDates = goals.filter((g) => g.startDate && g.endDate);
  const goalsWithoutDates = goals.filter((g) => !g.startDate || !g.endDate);

  // 좌우 네비게이션
  const handlePrev = () => {
    const d = new Date(origin);
    if (zoom === 'week') d.setDate(d.getDate() - 7);
    else if (zoom === 'month') d.setMonth(d.getMonth() - 3);
    else if (zoom === 'quarter') d.setMonth(d.getMonth() - 12);
    else d.setFullYear(d.getFullYear() - 3);
    setOrigin(d);
  };
  const handleNext = () => {
    const d = new Date(origin);
    if (zoom === 'week') d.setDate(d.getDate() + 7);
    else if (zoom === 'month') d.setMonth(d.getMonth() + 3);
    else if (zoom === 'quarter') d.setMonth(d.getMonth() + 12);
    else d.setFullYear(d.getFullYear() + 3);
    setOrigin(d);
  };
  const handleToday = () => {
    if (zoom === 'week') setOrigin(getMonday(today));
    else if (zoom === 'month') setOrigin(new Date(today.getFullYear(), today.getMonth(), 1));
    else if (zoom === 'quarter') setOrigin(getQuarterStart(today));
    else setOrigin(new Date(today.getFullYear(), 0, 1));
  };

  // 스크롤 → 오늘 위치로
  useEffect(() => {
    if (scrollRef.current && todayInRange) {
      const containerW = scrollRef.current.clientWidth;
      scrollRef.current.scrollLeft = Math.max(0, todayOffset - containerW / 2);
    }
  }, [todayInRange, todayOffset, zoom, origin]);

  /** 목표 바의 left% / width% 계산 */
  function getBarPosition(startDate: string, endDate: string) {
    const s = parseDate(startDate);
    const e = parseDate(endDate);
    // 1일 추가 (endDate 포함)
    const eInclusive = new Date(e);
    eInclusive.setDate(eInclusive.getDate() + 1);

    const startPx = (diffDays(timelineStart, s) / totalDays) * totalWidth;
    const endPx = (diffDays(timelineStart, eInclusive) / totalDays) * totalWidth;
    const left = Math.max(0, startPx);
    const right = Math.min(totalWidth, endPx);
    const width = Math.max(right - left, 4);

    return { left, width, isPartialStart: startPx < 0, isPartialEnd: endPx > totalWidth };
  }

  const LABEL_W = 220;

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-soft p-4 sm:p-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="text-sm font-bold text-gray-700">타임라인</h3>
        <div className="flex items-center gap-1.5">
          {/* 줌 레벨 */}
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            {(Object.keys(ZOOM_LABELS) as ZoomLevel[]).map((z) => (
              <button
                key={z}
                onClick={() => setZoom(z)}
                className={`text-[10px] px-2 py-1 rounded-md font-medium transition-colors ${
                  zoom === z ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {ZOOM_LABELS[z]}
              </button>
            ))}
          </div>
          {/* 네비게이션 */}
          <button onClick={handlePrev} className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-400">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 12L6 8l4-4" />
            </svg>
          </button>
          <button onClick={handleToday} className="text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors" style={{ backgroundColor: badge.bg, color: badge.text }}>
            오늘
          </button>
          <button onClick={handleNext} className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-400">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 4l4 4-4 4" />
            </svg>
          </button>
        </div>
      </div>

      {/* 기간 라벨 */}
      <div className="mb-2 text-xs font-semibold text-gray-500" style={{ paddingLeft: LABEL_W }}>
        {(() => {
          // 중앙 슬롯 기준 기간 표시
          const mid = slots[Math.floor(slots.length / 2)];
          if (!mid) return '';
          if (zoom === 'week') return `${mid.start.getFullYear()}년 ${mid.start.getMonth() + 1}월`;
          if (zoom === 'month') return `${mid.start.getFullYear()}년`;
          if (zoom === 'quarter') return `${mid.start.getFullYear()}년`;
          return '';
        })()}
      </div>

      {/* 타임라인 본체 */}
      <div className="flex">
        {/* 왼쪽: 목표 라벨 */}
        <div className="flex-shrink-0" style={{ width: LABEL_W }}>
          {/* 헤더 높이 맞춤 */}
          <div className="h-[28px]" />
          {goalsWithDates.map((g) => {
            const typeLabel = g.type === 'kpi' ? '수치' : g.type === 'task' ? '목표' : '혼합';
            const endD = g.endDate ? parseDate(g.endDate) : null;
            const dDay = endD ? diffDays(today, endD) : null;
            const dateStr = g.endDate ? `${parseDate(g.endDate).getMonth() + 1}/${parseDate(g.endDate).getDate()}` : '';
            return (
              <div
                key={g.id}
                className="min-h-[36px] flex items-start gap-1.5 pr-2 py-1 cursor-pointer hover:bg-gray-50 rounded-l-lg transition-colors border-b border-gray-50"
                onClick={() => onGoalClick?.(g.id)}
              >
                <div className="pt-0.5"><StatusDot status={g.status} /></div>
                <span className="text-[11px] text-gray-700 font-medium flex-1 min-w-0 leading-tight break-words">{g.title}</span>
                <div className="flex items-center gap-1 flex-shrink-0 pt-0.5">
                  <span className="text-[9px] px-1 py-px rounded bg-gray-100 text-gray-400">{typeLabel}</span>
                  {dateStr && <span className="text-[9px] text-gray-400">{dateStr}</span>}
                  {dDay !== null && (
                    <span className={`text-[9px] font-medium ${dDay < 0 ? 'text-red-400' : dDay <= 7 ? 'text-orange-400' : 'text-gray-400'}`}>
                      {dDay === 0 ? 'D-day' : dDay > 0 ? `D-${dDay}` : `D+${Math.abs(dDay)}`}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* 오른쪽: 스크롤 영역 */}
        <div ref={scrollRef} className="flex-1 overflow-x-auto relative" style={{ minHeight: goalsWithDates.length * 36 + 28 }}>
          <div style={{ width: totalWidth, position: 'relative' }}>
            {/* 슬롯 헤더 (월/주/일 라벨) */}
            <div className="flex h-[28px] border-b border-gray-100">
              {slots.map((slot, i) => (
                <div
                  key={i}
                  className="flex-shrink-0 text-[11px] text-gray-500 font-medium text-center border-r border-gray-50 flex items-center justify-center"
                  style={{ width: colW }}
                >
                  {slot.label}
                </div>
              ))}
            </div>

            {/* 목표 바 영역 */}
            <div className="relative">
              {/* 그리드 라인 */}
              {slots.map((_, i) => (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 border-r border-gray-50"
                  style={{ left: i * colW, width: colW }}
                />
              ))}

              {/* 오늘 라인 */}
              {todayInRange && (
                <div
                  className="absolute top-0 bottom-0 w-px bg-red-400 z-10"
                  style={{ left: todayOffset }}
                >
                  <div className="absolute -top-0.5 -left-1 w-2 h-2 bg-red-400 rounded-full" />
                </div>
              )}

              {/* 각 목표 바 */}
              {goalsWithDates.map((goal) => {
                const pos = getBarPosition(goal.startDate!, goal.endDate!);
                const isCompleted = goal.status === 'completed';
                const isOnHold = goal.status === 'on_hold';
                const isPending = goal.status === 'pending';

                return (
                  <div key={goal.id} className="min-h-[36px] flex items-center relative border-b border-gray-50">
                    <div
                      className={`absolute h-5 rounded-md overflow-hidden cursor-pointer transition-opacity hover:opacity-80 ${
                        isPending ? 'border border-dashed' : ''
                      }`}
                      style={{
                        left: pos.left,
                        width: pos.width,
                        backgroundColor: isOnHold ? '#e5e7eb' : badge.bg,
                        borderColor: isPending ? projectColor : undefined,
                      }}
                      onClick={() => onGoalClick?.(goal.id)}
                      title={`${goal.title} (${goal.progress}%)`}
                    >
                      {/* 진행률 */}
                      {!isPending && (
                        <div
                          className="h-full rounded-md transition-all"
                          style={{
                            width: `${isCompleted ? 100 : goal.progress}%`,
                            backgroundColor: isOnHold ? '#9ca3af' : projectColor,
                            opacity: isCompleted ? 0.7 : 0.6,
                          }}
                        />
                      )}
                      {/* 완료 체크 */}
                      {isCompleted && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 8l3 3 5-5.5" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 기간 미설정 목표 */}
      {goalsWithoutDates.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <span className="text-[10px] text-gray-400 font-medium">기간 미설정</span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {goalsWithoutDates.map((g) => (
              <button
                key={g.id}
                onClick={() => onGoalClick?.(g.id)}
                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg hover:bg-gray-50 transition-colors text-gray-500"
              >
                <StatusDot status={g.status} />
                <span>{g.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
