/**
 * @file src/components/calendar/DateRangePicker.tsx
 * @description 노션 스타일 커스텀 날짜 피커
 * - 시작일 / 종료일 선택 (종료일 토글)
 * - 하루종일 토글
 * - 캘린더 그리드에서 날짜 범위 선택 + 하이라이트
 */
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';

/* ─────────── types ─────────── */

interface DateRangePickerProps {
  date: string;
  endDate?: string;
  time?: string;
  onDateChange: (date: string) => void;
  onEndDateChange: (endDate: string | undefined) => void;
  onTimeChange?: (time: string) => void;
  accentColor?: string;       // 테마 색상 (hex)
  accentBg?: string;          // 테마 배경 tailwind class
  accentRing?: string;        // focus ring tailwind class
}

/* ─────────── helpers ─────────── */

const toYMD = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function getCalendarDays(year: number, month: number): Date[][] {
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const start = new Date(year, month, 1 - startOffset);
  const weeks: Date[][] = [];
  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + d));
    }
    weeks.push(week);
  }
  return weeks;
}

const formatLabel = (dateStr: string) => {
  if (!dateStr) return '날짜 선택';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
};

/* ─────────── component ─────────── */

export function DateRangePicker({
  date, endDate, time, onDateChange, onEndDateChange, onTimeChange,
  accentColor = '#fb923c', accentBg = 'bg-orange-50', accentRing = 'focus:ring-orange-200',
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (date) {
      const d = new Date(date + 'T00:00:00');
      return new Date(d.getFullYear(), d.getMonth(), 1);
    }
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  // 'start' 또는 'end' — 어느 날짜를 선택 중인지
  const [selecting, setSelecting] = useState<'start' | 'end'>('start');
  const containerRef = useRef<HTMLDivElement>(null);

  const hasEndDate = !!endDate;
  const isAllDay = time === '' || time === undefined;

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const weeks = useMemo(() => getCalendarDays(year, month), [year, month]);
  const todayStr = toYMD(new Date());

  // 외부 클릭 닫기
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleDateClick = useCallback((dateStr: string) => {
    if (!hasEndDate) {
      // 종료일 없으면 시작일만 변경
      onDateChange(dateStr);
    } else if (selecting === 'start') {
      onDateChange(dateStr);
      // 시작일이 종료일보다 뒤면 종료일 조정
      if (endDate && dateStr > endDate) {
        onEndDateChange(dateStr);
      }
      setSelecting('end');
    } else {
      // 종료일 선택
      if (dateStr < date) {
        // 시작일보다 앞이면 시작일로 교체
        onDateChange(dateStr);
        onEndDateChange(date);
      } else {
        onEndDateChange(dateStr);
      }
      setSelecting('start');
    }
  }, [date, endDate, hasEndDate, selecting, onDateChange, onEndDateChange]);

  const toggleEndDate = useCallback(() => {
    if (hasEndDate) {
      onEndDateChange(undefined);
      setSelecting('start');
    } else {
      onEndDateChange(date);
      setSelecting('end');
    }
  }, [hasEndDate, date, onEndDateChange]);

  const toggleAllDay = useCallback(() => {
    if (onTimeChange) {
      onTimeChange(isAllDay ? '09:00' : '');
    }
  }, [isAllDay, onTimeChange]);

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));

  // 날짜가 범위 안에 있는지
  const isInRange = (dateStr: string) => {
    if (!hasEndDate || !endDate) return false;
    return dateStr > date && dateStr < endDate;
  };
  const isRangeStart = (dateStr: string) => dateStr === date && hasEndDate;
  const isRangeEnd = (dateStr: string) => dateStr === endDate;

  return (
    <div ref={containerRef} className="relative">
      {/* ── 트리거 버튼 ── */}
      <div
        onClick={() => {
          if (!date) {
            onDateChange(toYMD(new Date()));
          }
          setOpen(!open);
        }}
        className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm cursor-pointer hover:border-gray-300 transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 flex-shrink-0">
          <rect x="2" y="3" width="12" height="11" rx="1.5" /><line x1="2" y1="7" x2="14" y2="7" /><line x1="5.5" y1="1.5" x2="5.5" y2="4.5" /><line x1="10.5" y1="1.5" x2="10.5" y2="4.5" />
        </svg>
        <span className="text-gray-700">{formatLabel(date)}</span>
        {hasEndDate && endDate && (
          <>
            <span className="text-gray-400">→</span>
            <span className="text-gray-700">{formatLabel(endDate)}</span>
          </>
        )}
        {time && <span className="text-gray-400 text-xs ml-1">{time}</span>}
        {isAllDay && onTimeChange && <span className="text-gray-400 text-xs ml-1">종일</span>}
      </div>

      {/* ── 드롭다운 피커 ── */}
      {open && (
        <div className="absolute z-40 left-0 top-full mt-1 bg-white rounded-2xl shadow-lg border border-gray-100 w-[300px] overflow-hidden animate-in">
          {/* 시작/종료 탭 */}
          {hasEndDate && (
            <div className="flex border-b border-gray-100">
              <button
                onClick={() => setSelecting('start')}
                className={`flex-1 py-2 text-xs font-medium transition-colors ${
                  selecting === 'start' ? 'border-b-2 text-gray-800' : 'text-gray-400'
                }`}
                style={selecting === 'start' ? { borderColor: accentColor } : undefined}
              >
                시작 {formatLabel(date)}
              </button>
              <button
                onClick={() => setSelecting('end')}
                className={`flex-1 py-2 text-xs font-medium transition-colors ${
                  selecting === 'end' ? 'border-b-2 text-gray-800' : 'text-gray-400'
                }`}
                style={selecting === 'end' ? { borderColor: accentColor } : undefined}
              >
                종료 {formatLabel(endDate || '')}
              </button>
            </div>
          )}

          {/* 월 네비게이션 */}
          <div className="flex items-center justify-between px-3 pt-2 pb-1">
            <button onClick={prevMonth} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 6l-6 6 6 6" /></svg>
            </button>
            <span className="text-xs font-semibold text-gray-700">{year}년 {month + 1}월</span>
            <button onClick={nextMonth} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 6l6 6-6 6" /></svg>
            </button>
          </div>

          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 px-2">
            {['일', '월', '화', '수', '목', '금', '토'].map((day, i) => (
              <div key={day} className={`text-center py-1 text-[10px] font-medium ${i === 0 ? 'text-red-300' : i === 6 ? 'text-blue-300' : 'text-gray-400'}`}>
                {day}
              </div>
            ))}
          </div>

          {/* 캘린더 그리드 */}
          <div className="px-2 pb-2">
            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7">
                {week.map((d) => {
                  const ds = toYMD(d);
                  const isCurrentMonth = d.getMonth() === month;
                  const isToday = ds === todayStr;
                  const isStart = ds === date;
                  const isEnd = isRangeEnd(ds);
                  const inRange = isInRange(ds);
                  const isSelected = isStart || isEnd;
                  const dayNum = d.getDay();

                  return (
                    <div key={ds} className="flex justify-center items-center relative">
                      {/* 범위 배경 */}
                      {(inRange || (isStart && hasEndDate) || isEnd) && (
                        <div
                          className={`absolute inset-y-0.5 ${
                            isStart ? 'left-1/2 right-0' : isEnd ? 'left-0 right-1/2' : 'left-0 right-0'
                          }`}
                          style={{ backgroundColor: accentColor + '15' }}
                        />
                      )}
                      <button
                        onClick={() => handleDateClick(ds)}
                        className={`relative w-8 h-8 flex items-center justify-center rounded-full text-xs transition-all
                          ${!isCurrentMonth ? 'opacity-25' : ''}
                          ${isSelected ? 'text-white font-bold' : ''}
                          ${isToday && !isSelected ? 'font-bold' : ''}
                          ${!isSelected && !isToday ? `font-medium ${dayNum === 0 ? 'text-red-400' : dayNum === 6 ? 'text-blue-400' : 'text-gray-600'}` : ''}
                          ${!isSelected ? 'hover:bg-gray-100' : ''}
                        `}
                        style={isSelected ? { backgroundColor: accentColor } : isToday && !isSelected ? { color: accentColor } : undefined}
                      >
                        {d.getDate()}
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* 옵션 토글 */}
          <div className="border-t border-gray-100 px-4 py-2 space-y-2">
            {/* 종료일 */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600">종료일</span>
              <button
                onClick={toggleEndDate}
                className={`w-9 h-5 rounded-full transition-colors relative ${hasEndDate ? '' : 'bg-gray-200'}`}
                style={hasEndDate ? { backgroundColor: accentColor } : undefined}
              >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${hasEndDate ? 'left-[18px]' : 'left-0.5'}`} />
              </button>
            </div>

            {/* 하루종일 */}
            {onTimeChange && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">하루종일</span>
                <button
                  onClick={toggleAllDay}
                  className={`w-9 h-5 rounded-full transition-colors relative ${isAllDay ? '' : 'bg-gray-200'}`}
                  style={isAllDay ? { backgroundColor: accentColor } : undefined}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${isAllDay ? 'left-[18px]' : 'left-0.5'}`} />
                </button>
              </div>
            )}

            {/* 시간 입력 */}
            {onTimeChange && !isAllDay && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">시간</span>
                <input
                  type="time"
                  value={time || ''}
                  onChange={(e) => onTimeChange(e.target.value)}
                  className={`px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs ${accentRing} focus:outline-none focus:ring-2`}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
