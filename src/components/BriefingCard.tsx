/**
 * @file src/components/BriefingCard.tsx
 * @description 모디 아침 브리핑 카드
 * - 홈 대시보드 최상단 풀와이드 배치
 * - 오늘 일정 / 긴급 할일 / 프로젝트 진행률 / 모디 한마디
 * - 접기/펼치기 토글 (localStorage 저장)
 * - [모디에게 물어보기] → 비서방 채팅 열기
 */
import { useState } from 'react';
import { useBriefing } from '../hooks/useBriefing';

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

function formatToday(): string {
  const d = new Date();
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DAY_NAMES[d.getDay()]})`;
}

function daysLabel(daysLeft: number): string {
  if (daysLeft < 0) return `D+${Math.abs(daysLeft)}`;
  if (daysLeft === 0) return 'D-Day';
  return `D-${daysLeft}`;
}

interface BriefingCardProps {
  onOpenModi?: () => void;
}

export function BriefingCard({ onOpenModi }: BriefingCardProps) {
  const { briefing, loading, refresh } = useBriefing();
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('briefing-collapsed') === 'true';
  });

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('briefing-collapsed', String(next));
  };

  // 로딩 스켈레톤
  if (loading && !briefing) {
    return (
      <div className="p-5 rounded-2xl bg-amber-50 border border-amber-100 animate-pulse">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-amber-200" />
          <div className="h-5 w-40 bg-amber-200 rounded" />
        </div>
        <div className="space-y-2">
          <div className="h-3 w-3/4 bg-amber-100 rounded" />
          <div className="h-3 w-1/2 bg-amber-100 rounded" />
          <div className="h-3 w-2/3 bg-amber-100 rounded" />
        </div>
      </div>
    );
  }

  if (!briefing) return null;

  const { schedules, urgentTasks, projectProgress, aiComment } = briefing;
  const hasContent = schedules.length > 0 || urgentTasks.length > 0 || projectProgress.length > 0;

  return (
    <div className="p-5 rounded-2xl bg-amber-50 border border-amber-100
      transition-all duration-300">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2.5">
          <img src="/images/modi.png" alt="모디" className="w-7 h-7 rounded-full object-cover" />
          <span className="text-sm font-bold text-amber-800">오늘 브리핑</span>
        </div>
        <span className="text-xs text-amber-500">{formatToday()}</span>
      </div>

      {/* 접힌 상태: 모디 한마디만 표시 */}
      {collapsed ? (
        <div className="mt-2">
          <p className="text-sm text-gray-600 line-clamp-1">{aiComment}</p>
          <button
            onClick={toggleCollapse}
            className="text-xs text-amber-500 hover:text-amber-700 mt-2 transition-colors"
          >
            펼치기
          </button>
        </div>
      ) : (
        <>
          {/* 본문 섹션들 */}
          {hasContent && (
            <div className="mt-3 space-y-3">
              {/* 오늘 일정 */}
              {schedules.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-amber-700 mb-1.5">
                    오늘 일정 {schedules.length}개
                  </p>
                  <ul className="space-y-1">
                    {schedules.map((s, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs text-gray-700">
                        <span className="text-amber-400 flex-shrink-0">{s.time || '--:--'}</span>
                        <span className="truncate">{s.title}</span>
                        {s.project && (
                          <span className="text-[10px] text-amber-500 flex-shrink-0">[{s.project}]</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 긴급 할일 */}
              {urgentTasks.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-amber-700 mb-1.5">
                    긴급 할일 {urgentTasks.length}개
                  </p>
                  <ul className="space-y-1">
                    {urgentTasks.map((t, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs">
                        <span className="flex-shrink-0">
                          {t.urgencyType === 'overdue' ? '\uD83D\uDD34' : '\uD83D\uDFE1'}
                        </span>
                        <span className="text-gray-700 truncate flex-1">{t.title}</span>
                        <span className={`text-[10px] font-medium flex-shrink-0 ${
                          t.urgencyType === 'overdue' ? 'text-red-500' : 'text-amber-500'
                        }`}>
                          {daysLabel(t.daysLeft)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 프로젝트 진행률 */}
              {projectProgress.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-amber-700 mb-1.5">
                    프로젝트 진행률
                  </p>
                  <ul className="space-y-1.5">
                    {projectProgress.map((p, i) => (
                      <li key={i}>
                        <div className="flex items-center justify-between text-xs mb-0.5">
                          <span className="text-gray-700">
                            {p.emoji} {p.name}
                          </span>
                          <span className="text-gray-500 text-[10px]">{p.percent}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-white/80 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-400 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, p.percent)}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* 모디 한마디 */}
          <div className="mt-3 pt-3 border-t border-amber-200/60">
            <p className="text-sm text-gray-700">
              {loading ? (
                <span className="inline-block w-48 h-4 bg-amber-100 rounded animate-pulse" />
              ) : (
                aiComment
              )}
            </p>
          </div>

          {/* 하단 버튼 */}
          <div className="flex items-center justify-between mt-3">
            <button
              onClick={toggleCollapse}
              className="text-xs text-amber-500 hover:text-amber-700 transition-colors"
            >
              접기
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={refresh}
                disabled={loading}
                className="text-xs text-amber-500 hover:text-amber-700 transition-colors disabled:opacity-50"
              >
                {loading ? '생성 중...' : '새로고침'}
              </button>
              {onOpenModi && (
                <button
                  onClick={onOpenModi}
                  className="text-xs px-3 py-1.5 rounded-full bg-amber-200/60 text-amber-700
                    hover:bg-amber-200 transition-colors font-medium"
                >
                  모디에게 물어보기
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
