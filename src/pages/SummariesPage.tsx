/**
 * @file src/pages/SummariesPage.tsx
 * @description 대화 요약 모아보기 페이지
 * - 날짜별 그룹핑으로 각 방의 대화 요약 표시
 * - 방 필터 탭으로 특정 방 요약만 보기
 */
import { useState, useEffect } from 'react';
import { fetchSummaries, SummaryRow, ROOM_LABELS, ROOM_ICONS } from '../services/summary.service';

/** 필터 탭 목록 */
const FILTER_TABS = [
  { id: 'all', label: '전체' },
  { id: 'strategy', label: '플래니' },
  { id: 'marketing', label: '마키' },
  { id: 'dev', label: '데비' },
  { id: 'research', label: '서치' },
  { id: 'secretary', label: '모디' },
];

/** 날짜 포맷: "2월 27일 (목)" */
function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  const weekday = weekdays[d.getDay()];
  return `${month}월 ${day}일 (${weekday})`;
}

/** 날짜별 그룹핑 */
function groupByDate(summaries: SummaryRow[]): Record<string, SummaryRow[]> {
  const grouped: Record<string, SummaryRow[]> = {};
  for (const s of summaries) {
    if (!grouped[s.date]) grouped[s.date] = [];
    grouped[s.date].push(s);
  }
  return grouped;
}

export function SummariesPage() {
  const [summaries, setSummaries] = useState<SummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    setLoading(true);
    fetchSummaries(30).then((data) => {
      setSummaries(data);
      setLoading(false);
    });
  }, []);

  // 필터 적용
  const filtered = filter === 'all'
    ? summaries
    : summaries.filter(s => s.room_id === filter);

  const grouped = groupByDate(filtered);
  const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div className="min-h-full bg-[#fffef8] p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto space-y-5">
        {/* 헤더 */}
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <img src="/images/modi.png" alt="대화 요약" className="w-6 h-6 object-contain" />
          대화 요약
        </h1>

        {/* 방 필터 */}
        <div className="flex flex-wrap gap-1.5">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filter === tab.id
                  ? 'bg-yellow-200 text-yellow-800'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {tab.id !== 'all' && ROOM_ICONS[tab.id] && (
                <span className="mr-1">{ROOM_ICONS[tab.id].emoji}</span>
              )}
              {tab.label}
            </button>
          ))}
        </div>

        {/* 로딩 */}
        {loading && (
          <p className="text-sm text-gray-400 text-center py-8">불러오는 중...</p>
        )}

        {/* 빈 상태 */}
        {!loading && dates.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">
            저장된 요약이 없습니다
          </p>
        )}

        {/* 날짜별 요약 */}
        {dates.map((date) => (
          <div key={date} className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-500 flex items-center gap-1.5">
              <span>📅</span> {formatDateLabel(date)}
            </h2>

            <div className="space-y-2">
              {grouped[date].map((s) => {
                const icon = ROOM_ICONS[s.room_id];
                return (
                  <div
                    key={s.id}
                    className="bg-white rounded-2xl p-4 shadow-soft hover:shadow-hover transition-all"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {icon && (
                        <img src={icon.image} alt="" className="w-6 h-6 rounded-full object-cover" />
                      )}
                      <span className="text-sm font-semibold text-gray-700">
                        {ROOM_LABELS[s.room_id] || s.room_id}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                      {s.summary}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
