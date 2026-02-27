/**
 * @file src/components/records/RecordCalendar.tsx
 * @description 기록 캘린더 뷰어
 * - 월별 달력, 셀 안에 기록 유형 배지 + 제목 미리보기
 * - 타입별 에너지바 톤 색상 (orange/violet/emerald/amber)
 * - 날짜 클릭 시 해당 날짜 필터링
 */
import { useState } from 'react';
import { RecordItem, RecordType } from '../../types';
import { recordTypeConfig } from '../../utils/recordTemplates';

interface RecordCalendarProps {
  records: RecordItem[];
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
}

const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** 타입별 에너지바 톤 색상 (캘린더 미리보기용, 매우 연한 배경) */
const typeCalColors: Record<RecordType, { bg: string; text: string; dot: string; label: string }> = {
  morning: { bg: 'bg-orange-100/40', text: 'text-orange-500', dot: 'bg-orange-400', label: '아침' },
  evening: { bg: 'bg-fuchsia-100/40', text: 'text-fuchsia-500', dot: 'bg-fuchsia-400', label: '저녁' },
  weekly:  { bg: 'bg-pink-100/40', text: 'text-pink-500', dot: 'bg-pink-400', label: '주간' },
  memo:    { bg: 'bg-amber-100/40', text: 'text-amber-500', dot: 'bg-amber-400', label: '메모' },
};

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevDays = new Date(year, month, 0).getDate();

  const cells: { day: number; current: boolean; dateStr: string }[] = [];

  for (let i = firstDay - 1; i >= 0; i--) {
    const d = prevDays - i;
    const m = month === 0 ? 12 : month;
    const y = month === 0 ? year - 1 : year;
    cells.push({ day: d, current: false, dateStr: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      day: d, current: true,
      dateStr: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    });
  }

  // 필요한 주 수만큼만 채우기 (5주 or 6주)
  const totalRows = Math.ceil(cells.length / 7);
  const totalCells = totalRows * 7;
  const remaining = totalCells - cells.length;
  for (let d = 1; d <= remaining; d++) {
    const m = month + 2 > 12 ? 1 : month + 2;
    const y = month + 2 > 12 ? year + 1 : year;
    cells.push({ day: d, current: false, dateStr: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` });
  }

  return cells;
}

/** 기록에서 짧은 미리보기 텍스트 추출 */
function getPreview(r: RecordItem): string {
  if (r.title) return r.title;
  if (r.recordType === 'morning' && r.morningData) {
    const f = r.morningData.gratitude.find((g) => g.text.trim());
    return f ? f.text : '';
  }
  if (r.recordType === 'evening' && r.eveningData) {
    const f = r.eveningData.greatThings.find((g) => g.text.trim());
    return f ? f.text : '';
  }
  if (r.recordType === 'weekly' && r.weeklyData) {
    const f = r.weeklyData.achievements.find((g) => g.text.trim());
    return f ? f.text : '';
  }
  return '';
}

export function RecordCalendar({ records, selectedDate, onSelectDate }: RecordCalendarProps) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const cells = getMonthDays(viewYear, viewMonth);

  const recordsByDate = new Map<string, RecordItem[]>();
  records.forEach((r) => {
    const existing = recordsByDate.get(r.date) || [];
    existing.push(r);
    recordsByDate.set(r.date, existing);
  });

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const handlePrev = () => {
    if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11); }
    else setViewMonth(viewMonth - 1);
  };
  const handleNext = () => {
    if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0); }
    else setViewMonth(viewMonth + 1);
  };
  const handleToday = () => {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
  };

  // 이번 달 기록 요약 통계
  const monthPrefix = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;
  const monthRecords = records.filter((r) => r.date.startsWith(monthPrefix));
  const typeCounts: Partial<Record<RecordType, number>> = {};
  monthRecords.forEach((r) => { typeCounts[r.recordType] = (typeCounts[r.recordType] || 0) + 1; });

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-soft">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={handlePrev} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-pink-50 text-gray-500 transition-colors">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 12L6 8l4-4" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <span className="text-base font-bold text-gray-800">
            {viewYear}년 {viewMonth + 1}월
          </span>
          <button onClick={handleToday} className="text-[10px] px-2 py-0.5 rounded-full bg-pink-100 text-pink-500 font-medium hover:bg-pink-200 transition-colors">
            오늘
          </button>
          {selectedDate && (
            <button onClick={() => onSelectDate(null)} className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium hover:bg-gray-200 transition-colors">
              전체 보기
            </button>
          )}
        </div>
        <button onClick={handleNext} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-pink-50 text-gray-500 transition-colors">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 4l4 4-4 4" />
          </svg>
        </button>
      </div>

      {/* 월간 요약 배지 */}
      {monthRecords.length > 0 && (
        <div className="flex gap-2 mb-3 flex-wrap">
          {(Object.entries(typeCounts) as [RecordType, number][]).map(([type, count]) => {
            const rc = recordTypeConfig[type];
            return (
              <span key={type} className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${rc.bgColor} ${rc.textColor}`}>
                {rc.label} {count}
              </span>
            );
          })}
          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-500">
            총 {monthRecords.length}건
          </span>
        </div>
      )}

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 border-b border-gray-100 mb-0.5">
        {DAYS.map((d, i) => (
          <div key={d} className={`text-center text-[11px] font-semibold py-1.5 ${
            i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'
          }`}>
            {d}
          </div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className="grid grid-cols-7 border-l border-gray-100">
        {cells.map((cell, idx) => {
          const dayRecords = recordsByDate.get(cell.dateStr) || [];
          const isToday = cell.dateStr === todayStr;
          const isSelected = cell.dateStr === selectedDate;
          const hasRecords = dayRecords.length > 0 && cell.current;
          const dayOfWeek = idx % 7;

          return (
            <button
              key={`${cell.dateStr}-${idx}`}
              onClick={() => {
                if (isSelected) onSelectDate(null);
                else onSelectDate(cell.dateStr);
              }}
              className={`relative flex flex-col items-start p-1 sm:p-1.5 min-h-[60px] sm:min-h-[72px] border-r border-b border-gray-100 transition-all text-left ${
                !cell.current ? 'bg-gray-50/50' : ''
              } ${isSelected ? 'bg-pink-50 ring-2 ring-pink-400 ring-inset z-10' : 'hover:bg-pink-50/30'}`}
            >
              {/* 날짜 숫자 */}
              <span className={`text-[11px] leading-none mb-1 ${
                !cell.current ? 'text-gray-300'
                : isToday ? 'text-white font-bold bg-pink-500 w-5 h-5 rounded-full flex items-center justify-center'
                : dayOfWeek === 0 ? 'text-red-400 font-medium'
                : dayOfWeek === 6 ? 'text-blue-400 font-medium'
                : 'text-gray-600 font-medium'
              }`}>
                {cell.day}
              </span>

              {/* 기록 내용 표시 */}
              {hasRecords && (
                <div className="w-full space-y-px overflow-hidden flex-1">
                  {dayRecords.slice(0, 3).map((r) => {
                    const c = typeCalColors[r.recordType];
                    const preview = getPreview(r);
                    return (
                      <div
                        key={r.id}
                        className={`${c.bg} rounded-sm px-0.5 truncate leading-[14px]`}
                      >
                        <span className={`text-[9px] sm:text-[10px] ${c.text}`}>
                          {preview || c.label}
                        </span>
                      </div>
                    );
                  })}
                  {dayRecords.length > 3 && (
                    <span className="text-[9px] text-gray-400 leading-[12px]">+{dayRecords.length - 3}</span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
