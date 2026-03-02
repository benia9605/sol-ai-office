/**
 * @file src/components/DashboardWidgets.tsx
 * @description 홈 상단 대시보드 위젯 4개
 * - 이번주 일정: 다가오는 일정 2~3개 리스트
 * - 주요 업무: 진행 중 할일 2~3개 (체크박스)
 * - 인사이트: 최근 인사이트 1~2개 미리보기
 * - 독서 기록: 읽고 있는 책 + 진행률 바
 * - PC: 4열 그리드 / 모바일: 가로 스크롤
 * - 클릭 시 해당 페이지로 이동
 * - 카드 컬러: 일정(주황), 할일(초록), 인사이트(노랑), 독서(파랑) 파스텔톤
 */
import { Link } from 'react-router-dom';
import { useTasks } from '../hooks/useTasks';
import { useSchedules } from '../hooks/useSchedules';
import { useInsights } from '../hooks/useInsights';
import { useReadings } from '../hooks/useReadings';
import { calcReadingProgress } from '../utils/readingProgress';
import { getUrgentTasks } from '../utils/urgentTasks';

/** 일정 날짜를 오늘/내일/요일 형태로 변환 */
function formatScheduleDate(dateStr: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return '오늘';
  if (diff === 1) return '내일';
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  return dayNames[target.getDay()];
}

export function DashboardWidgets() {
  const { tasks } = useTasks();
  const { schedules } = useSchedules();
  const { insights } = useInsights();
  const { readings } = useReadings();

  const upcomingSchedules = schedules.slice(0, 3);
  const urgentTasks = getUrgentTasks(tasks).slice(0, 3);
  const recentInsights = insights.slice(0, 2);
  const readingBooks = readings.filter((r) => r.status === 'reading');

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:grid-cols-4">
      {/* 이번주 일정 — 주황 파스텔 */}
      <Link
        to="/schedules"
        className="p-4 rounded-2xl bg-[#fff3e0] border border-orange-100
          hover:shadow-hover transition-all duration-300 cursor-pointer group"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <img src="/images/schedule.png" alt="일정" className="w-5 h-5 object-contain" />
            <span className="text-sm font-bold text-orange-700">이번주 일정</span>
          </div>
          <span className="text-xs text-orange-300 group-hover:text-orange-500">&rarr;</span>
        </div>
        <ul className="space-y-1.5">
          {upcomingSchedules.map((s) => (
            <li key={s.id} className="flex items-center gap-2">
              <div className="w-1 h-4 rounded-full bg-orange-300" />
              <span className="text-xs text-gray-700 truncate flex-1">{s.title}</span>
              <span className="text-[10px] text-orange-500 font-medium flex-shrink-0">{formatScheduleDate(s.date)}</span>
              <span className="text-xs text-gray-400 flex-shrink-0">{s.time}</span>
            </li>
          ))}
        </ul>
      </Link>

      {/* 긴급 업무 — 초록 파스텔 */}
      <Link
        to="/tasks"
        className="p-4 rounded-2xl bg-[#f0fdf4] border border-green-100
          hover:shadow-hover transition-all duration-300 cursor-pointer group"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <img src="/images/todo.png" alt="할일" className="w-5 h-5 object-contain" />
            <span className="text-sm font-bold text-green-700">긴급 업무</span>
          </div>
          <span className="text-xs text-green-300 group-hover:text-green-500">&rarr;</span>
        </div>
        <ul className="space-y-1.5">
          {urgentTasks.length > 0 ? (
            urgentTasks.map((t) => (
              <li key={t.id} className="flex items-center gap-2">
                <span className="text-xs flex-shrink-0">
                  {t.urgencyType === 'overdue' ? '\uD83D\uDD34' : '\uD83D\uDFE1'}
                </span>
                <span className="text-xs text-gray-700 truncate flex-1">{t.title}</span>
                <span className={`text-[10px] font-medium flex-shrink-0 ${
                  t.urgencyType === 'overdue' ? 'text-red-500' : 'text-amber-500'
                }`}>
                  {t.daysLeft < 0 ? `D+${Math.abs(t.daysLeft)}` : t.daysLeft === 0 ? 'D-Day' : `D-${t.daysLeft}`}
                </span>
              </li>
            ))
          ) : null}
        </ul>
      </Link>

      {/* 인사이트 — 노랑 파스텔 */}
      <Link
        to="/insights"
        className="p-4 rounded-2xl bg-[#fffde7] border border-yellow-100
          hover:shadow-hover transition-all duration-300 cursor-pointer group"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <img src="/images/insight.png" alt="인사이트" className="w-5 h-5 object-contain" />
            <span className="text-sm font-bold text-amber-700">인사이트</span>
          </div>
          <span className="text-xs text-amber-300 group-hover:text-amber-500">&rarr;</span>
        </div>
        <ul className="space-y-2">
          {recentInsights.map((i) => (
            <li key={i.id}>
              <p className="text-xs font-semibold text-gray-700 truncate">{i.title}</p>
              <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{i.content}</p>
            </li>
          ))}
        </ul>
      </Link>

      {/* 독서 기록 — 파랑 파스텔 */}
      <Link
        to="/readings"
        className="p-4 rounded-2xl bg-[#e3f2fd] border border-blue-100
          hover:shadow-hover transition-all duration-300 cursor-pointer group"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <img src="/images/book.png" alt="스터디" className="w-5 h-5 object-contain" />
            <span className="text-sm font-bold text-blue-700">스터디</span>
          </div>
          <span className="text-xs text-blue-300 group-hover:text-blue-500">&rarr;</span>
        </div>
        <ul className="space-y-2">
          {readingBooks.map((r) => (
            <li key={r.id}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-700 truncate">
                  {r.coverImage
                    ? <img src={r.coverImage} alt="" className="w-4 h-4 rounded inline-block mr-1 object-cover" />
                    : r.coverEmoji}{' '}{r.title}
                </span>
                <span className="text-xs font-semibold text-gray-500 flex-shrink-0 ml-2">{calcReadingProgress(r)}%</span>
              </div>
              <div className="w-full h-1.5 bg-white/80 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-400 rounded-full"
                  style={{ width: `${calcReadingProgress(r)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </Link>
    </div>
  );
}
