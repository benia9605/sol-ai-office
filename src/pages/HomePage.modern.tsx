/**
 * @file src/pages/HomePage.modern.tsx
 * @description 홈 페이지 — 모던 테마 (MUJI 톤, 진초록 액센트, 직사각형)
 * - 모디 테마(HomePage.tsx)와 완전 별도. useTheme 분기로 호출
 * - 디자인: 검정 글씨 + 진초록 포인트 + hairline 박스
 * - 참고: docs/design/samples/pages/dashboard.tsx
 */
import { useOutletContext, Link } from 'react-router-dom';
import { rooms, modiSecretary } from '../data';
import { useBriefing } from '../hooks/useBriefing';
import { useUserProfile } from '../hooks/useUserProfile';
import { useTasks } from '../hooks/useTasks';
import { useSchedules } from '../hooks/useSchedules';
import { useInsights } from '../hooks/useInsights';
import { useReadings } from '../hooks/useReadings';
import { calcReadingProgress } from '../utils/readingProgress';
import { getUrgentTasks } from '../utils/urgentTasks';
import { LayoutContext } from '../components/Layout';
import { Room } from '../types';

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
const MONTHS_EN = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function todayLabel(): string {
  const d = new Date();
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${DAY_NAMES[d.getDay()]}요일`;
}

function todayParts() {
  const d = new Date();
  return {
    monthEn: MONTHS_EN[d.getMonth()],
    day: String(d.getDate()).padStart(2, '0'),
    weekday: DAY_NAMES[d.getDay()],
    year: d.getFullYear(),
  };
}

function scheduleDayLabel(dateStr: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'TODAY';
  if (diff === 1) return 'TOMORROW';
  return DAY_NAMES[target.getDay()].toUpperCase();
}

function daysLabel(daysLeft: number): string {
  if (daysLeft < 0) return `+${Math.abs(daysLeft)}`;
  if (daysLeft === 0) return 'D-DAY';
  return `D-${daysLeft}`;
}

export function HomePageModern() {
  const { openRoom } = useOutletContext<LayoutContext>();
  const { profile } = useUserProfile();
  const { briefing } = useBriefing();
  const { tasks } = useTasks();
  const { schedules } = useSchedules();
  const { insights } = useInsights();
  const { readings } = useReadings();

  const upcomingSchedules = schedules.slice(0, 5);
  const urgentTasks = getUrgentTasks(tasks).slice(0, 5);
  const recentInsights = insights.slice(0, 5);
  const readingBooks = readings.filter((r) => r.status === 'reading').slice(0, 5);

  const t = todayParts();
  const displayName = profile.name || '솔';

  return (
    <main className="min-h-full bg-surface text-foreground">
      <div className="mx-auto max-w-6xl px-5 sm:px-8 py-10 sm:py-14 space-y-14 sm:space-y-16">

        {/* ── Greeting Hero ── */}
        <section>
          <p className="label">{todayLabel()}</p>
          <h1 className="mt-5 text-4xl font-light leading-[1.25] sm:text-5xl">
            <span className="text-primary-500">{displayName}</span>님,<br />
            오늘도 침착하게.
          </h1>
          <p className="mt-6 max-w-lg text-sm leading-[1.85] text-foreground-muted">
            AI 비서들과 함께 하루를 시작해보세요.
            모디 아침 브리핑이 아래에 준비되어 있습니다.
          </p>
        </section>

        {/* ── Featured: Morning Briefing ── */}
        <BriefingFeatured
          dayParts={t}
          schedules={briefing?.schedules ?? upcomingSchedules.map((s) => ({ id: s.id, title: s.title, time: s.time, date: s.date }))}
          urgent={briefing?.urgentTasks ?? urgentTasks.map((u) => ({ id: u.id, title: u.title, daysLeft: u.daysLeft }))}
          aiComment={briefing?.aiComment}
          onOpenModi={() => openRoom(modiSecretary)}
        />

        {/* ── This Week 4-up grid ── */}
        <section>
          <SectionHeader title="이번 주" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border-l border-line">
            {/* 일정 */}
            <WidgetBox
              label="Schedule"
              title="다가오는 일정"
              href="/schedules"
              emptyText="예정된 일정 없음"
              empty={upcomingSchedules.length === 0}
            >
              <ul className="divide-y divide-line">
                {upcomingSchedules.map((s) => (
                  <li key={s.id} className="py-2 flex items-center gap-3">
                    <span className="text-[10px] tracking-[0.15em] text-foreground-faint w-16 shrink-0">
                      {scheduleDayLabel(s.date)}
                    </span>
                    <span className="text-sm flex-1 truncate">{s.title}</span>
                    {s.time && <span className="text-xs text-foreground-faint tabular-nums">{s.time}</span>}
                  </li>
                ))}
              </ul>
            </WidgetBox>

            {/* 긴급 업무 */}
            <WidgetBox
              label="Urgent"
              title="긴급 할일"
              href="/tasks"
              emptyText="긴급한 할일 없음"
              empty={urgentTasks.length === 0}
            >
              <ul className="divide-y divide-line">
                {urgentTasks.map((u) => (
                  <li key={u.id} className="py-2 flex items-center gap-3">
                    <span className={`text-[10px] tracking-[0.1em] tabular-nums w-12 shrink-0 ${
                      u.urgencyType === 'overdue' ? 'text-primary-500' : 'text-foreground-faint'
                    }`}>
                      {daysLabel(u.daysLeft)}
                    </span>
                    <span className="text-sm flex-1 truncate">{u.title}</span>
                  </li>
                ))}
              </ul>
            </WidgetBox>

            {/* 인사이트 */}
            <WidgetBox
              label="Insights"
              title="최근 인사이트"
              href="/insights"
              emptyText="저장된 인사이트 없음"
              empty={recentInsights.length === 0}
            >
              <ul className="divide-y divide-line">
                {recentInsights.map((i) => (
                  <li key={i.id} className="py-2">
                    <p className="text-sm truncate">{i.title}</p>
                    {i.source && (
                      <p className="text-[10px] text-foreground-faint mt-0.5 truncate">— {i.source}</p>
                    )}
                  </li>
                ))}
              </ul>
            </WidgetBox>

            {/* 독서 */}
            <WidgetBox
              label="Reading"
              title="읽고 있는 책"
              href="/readings"
              emptyText="진행 중인 책 없음"
              empty={readingBooks.length === 0}
            >
              <ul className="divide-y divide-line">
                {readingBooks.map((r) => {
                  const progress = calcReadingProgress(r);
                  return (
                    <li key={r.id} className="py-2">
                      <p className="text-sm truncate">{r.title}</p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="flex-1 h-px bg-line relative">
                          <div
                            className="absolute inset-y-0 left-0 bg-primary-500"
                            style={{ width: `${progress}%`, height: '1px', top: '-0.5px' }}
                          />
                        </div>
                        <span className="text-[10px] text-foreground-faint tabular-nums">{progress}%</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </WidgetBox>
          </div>
        </section>

        {/* ── Office Rooms ── */}
        <section>
          <SectionHeader title="오피스 룸" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 border-l border-line">
            {rooms.map((room) => (
              <RoomCardModern key={room.id} room={room} onClick={() => openRoom(room)} />
            ))}
            <RoomCardModern room={modiSecretary} onClick={() => openRoom(modiSecretary)} />
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="border-t border-line pt-8 pb-4 text-center">
          <p className="text-xs tracking-[0.22em] uppercase text-foreground-faint">
            Sol AI Office · {t.year}
          </p>
        </footer>
      </div>
    </main>
  );
}

/* ─────────────────────────────────────────────────────── */
/*  서브 컴포넌트들                                          */
/* ─────────────────────────────────────────────────────── */

function SectionHeader({ title, href, cta = '전체 보기' }: { title: string; href?: string; cta?: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-line pb-3">
      <h2 className="text-base font-normal">{title}</h2>
      {href && (
        <Link to={href} className="text-xs text-foreground-muted hover:text-foreground transition-colors">
          {cta} →
        </Link>
      )}
    </div>
  );
}

interface BriefingFeaturedProps {
  dayParts: { monthEn: string; day: string; weekday: string; year: number };
  schedules: Array<{ id: string; title: string; time?: string; date: string }>;
  urgent: Array<{ id: string; title: string; daysLeft: number }>;
  aiComment?: string;
  onOpenModi: () => void;
}

function BriefingFeatured({ dayParts, schedules, urgent, aiComment, onOpenModi }: BriefingFeaturedProps) {
  return (
    <section className="border border-line">
      <div className="grid sm:grid-cols-[1fr_1.6fr]">
        {/* 좌측: 큰 날짜 */}
        <div className="aspect-[4/3] sm:aspect-auto bg-surface-muted relative">
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="label">{dayParts.monthEn}</p>
            <p className="mt-3 text-7xl sm:text-8xl font-light leading-none tabular-nums">{dayParts.day}</p>
            <p className="mt-3 label">{dayParts.weekday}요일</p>
          </div>
        </div>

        {/* 우측: 브리핑 콘텐츠 */}
        <div className="p-8 sm:p-10 flex flex-col">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="label text-primary-500">Morning Briefing</p>
              <h3 className="mt-3 text-2xl font-light leading-snug">
                오늘 일정과 할일을 한눈에.
              </h3>
            </div>
            <img src="/images/modi.png" alt="모디" className="w-12 h-12 object-cover shrink-0" />
          </div>

          {aiComment && (
            <p className="mt-5 text-sm leading-[1.85] text-foreground-muted">{aiComment}</p>
          )}

          <dl className="mt-7 grid grid-cols-2 gap-y-4 gap-x-6 border-t border-line pt-6 text-sm">
            <div>
              <dt className="label">오늘 일정</dt>
              <dd className="mt-2 tabular-nums">
                <span className="text-2xl font-light">{schedules.length}</span>
                <span className="text-xs text-foreground-faint ml-1">건</span>
              </dd>
            </div>
            <div>
              <dt className="label">긴급 할일</dt>
              <dd className="mt-2 tabular-nums">
                <span className="text-2xl font-light">{urgent.length}</span>
                <span className="text-xs text-foreground-faint ml-1">건</span>
              </dd>
            </div>
            {schedules.slice(0, 2).map((s) => (
              <div key={s.id} className="col-span-2 flex items-baseline gap-3 border-t border-line/60 pt-3">
                <span className="label w-14 shrink-0">{s.time || '시간미정'}</span>
                <span className="text-sm truncate">{s.title}</span>
              </div>
            ))}
          </dl>

          <button
            type="button"
            onClick={onOpenModi}
            className="mt-7 self-start border border-foreground px-6 py-2.5 text-sm hover:bg-foreground hover:text-surface transition-colors"
          >
            모디와 대화하기 →
          </button>
        </div>
      </div>
    </section>
  );
}

interface WidgetBoxProps {
  label: string;
  title: string;
  href: string;
  empty: boolean;
  emptyText: string;
  children: React.ReactNode;
}

function WidgetBox({ label, title, href, empty, emptyText, children }: WidgetBoxProps) {
  return (
    <Link
      to={href}
      className="group border-r border-b border-line p-5 sm:p-6 hover:bg-surface-muted transition-colors"
    >
      <div className="flex items-baseline justify-between">
        <p className="label">{label}</p>
        <span className="text-xs text-foreground-faint group-hover:text-foreground transition-colors">→</span>
      </div>
      <h3 className="mt-3 text-base font-normal">{title}</h3>

      {empty ? (
        <p className="mt-5 text-xs text-foreground-faint">{emptyText}</p>
      ) : (
        <div className="mt-4">{children}</div>
      )}
    </Link>
  );
}

interface RoomCardModernProps {
  room: Room;
  onClick: () => void;
}

function RoomCardModern({ room, onClick }: RoomCardModernProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left border-r border-b border-line p-6 hover:bg-surface-muted transition-colors group"
    >
      <div className="flex items-start gap-4">
        {/* AI 프로필 이미지 — PNG 유지 (사용자 요청) */}
        <img
          src={room.image}
          alt={room.aiName}
          className="w-14 h-14 object-cover shrink-0"
        />
        <div className="min-w-0 flex-1">
          <p className="label text-foreground-faint">{room.aiModel}</p>
          <h3 className="mt-1.5 text-base font-normal">{room.name}</h3>
          <p className="mt-1 text-sm text-primary-500">{room.aiName}</p>
        </div>
      </div>
      <p className="mt-5 text-xs text-foreground-muted leading-[1.7] line-clamp-2">
        {room.role}
      </p>
      <p className="mt-3 text-[10px] text-foreground-faint italic">
        {room.personality}
      </p>
    </button>
  );
}
