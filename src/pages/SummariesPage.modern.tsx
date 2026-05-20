/**
 * @file src/pages/SummariesPage.modern.tsx
 * @description 대화 요약 — 모던 테마 (MUJI 톤)
 * - 헤더: SUMMARIES 레이블 + font-light 헤딩
 * - 방별 chip 필터
 * - 좌측 날짜 + 우측 divide-y 요약 카드 패턴 (일정/할일/기록과 통일)
 */
import { useState, useEffect, useMemo } from 'react';
import { fetchSummaries, SummaryRow, ROOM_LABELS, ROOM_ICONS } from '../services/summary.service';

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
const MONTHS_EN = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const FILTER_TABS: { id: string; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'strategy', label: '플래니' },
  { id: 'marketing', label: '마키' },
  { id: 'dev', label: '데비' },
  { id: 'research', label: '서치' },
  { id: 'secretary', label: '모디' },
];

export function SummariesPageModern() {
  const [summaries, setSummaries] = useState<SummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    setLoading(true);
    fetchSummaries(30).then((data) => {
      setSummaries(data);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(
    () => (filter === 'all' ? summaries : summaries.filter((s) => s.room_id === filter)),
    [summaries, filter],
  );

  // 날짜별 그룹핑 (내림차순)
  const dateGroups = useMemo(() => {
    const map = new Map<string, SummaryRow[]>();
    filtered.forEach((s) => {
      const arr = map.get(s.date) ?? [];
      arr.push(s);
      map.set(s.date, arr);
    });
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  return (
    <main className="min-h-full bg-surface text-foreground">
      <div className="mx-auto max-w-4xl px-5 sm:px-8 py-10 sm:py-14 space-y-12 sm:space-y-14">

        {/* ── 헤더 ── */}
        <section>
          <p className="label">Summaries</p>
          <h1 className="mt-5 text-4xl font-light leading-[1.25] sm:text-5xl">
            대화 요약
          </h1>
          <p className="mt-4 text-sm text-foreground-muted">
            지난 30일 · 전체 {summaries.length}건
            {filter !== 'all' && (
              <> · 필터 <span className="text-foreground">
                {FILTER_TABS.find((t) => t.id === filter)?.label}
              </span></>
            )}
          </p>
        </section>

        {/* ── 방 필터 chip ── */}
        <section className="flex flex-wrap gap-2">
          {FILTER_TABS.map((tab) => (
            <FilterChip
              key={tab.id}
              active={filter === tab.id}
              onClick={() => setFilter(tab.id)}
              label={tab.label}
            />
          ))}
        </section>

        {/* ── 요약 리스트 ── */}
        <section>
          <div className="flex items-baseline justify-between border-b border-line pb-3">
            <h2 className="text-base font-normal">기록</h2>
            <p className="text-xs text-foreground-faint tabular-nums">
              {filtered.length}건 · {dateGroups.length}개 날짜
            </p>
          </div>

          {loading ? (
            <EmptyRow message="불러오는 중…" />
          ) : dateGroups.length === 0 ? (
            <EmptyRow message="저장된 요약이 없습니다." />
          ) : (
            <div>
              {dateGroups.map(([date, items]) => (
                <SummaryDateGroup key={date} date={date} items={items} />
              ))}
            </div>
          )}
        </section>

      </div>
    </main>
  );
}

/* ─────────────────────────────────────────────────────── */

function EmptyRow({ message }: { message: string }) {
  return (
    <div className="border-b border-line py-16 text-center">
      <p className="text-sm text-foreground-faint">{message}</p>
    </div>
  );
}

function FilterChip({
  active, onClick, label,
}: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-1.5 text-xs border transition-colors ${
        active
          ? 'bg-foreground text-surface border-foreground'
          : 'bg-surface text-foreground-muted border-line hover:border-foreground hover:text-foreground'
      }`}
    >
      {label}
    </button>
  );
}

/* ─── 날짜 그룹 ─── */

function SummaryDateGroup({
  date,
  items,
}: {
  date: string;
  items: SummaryRow[];
}) {
  const d = new Date(date + 'T00:00:00');

  return (
    <div className="grid grid-cols-[64px_1fr] sm:grid-cols-[80px_1fr] gap-3 sm:gap-5 py-3 border-b border-line">
      {/* 좌측: 날짜 */}
      <div>
        <p className="text-[9px] tracking-[0.2em] uppercase text-primary-500">
          {MONTHS_EN[d.getMonth()]}
        </p>
        <p className="mt-0.5 text-xl font-light leading-none tabular-nums text-foreground-muted">
          {String(d.getDate()).padStart(2, '0')}
        </p>
        <p className="mt-1 text-[9px] tracking-[0.15em] text-foreground-faint">
          {DAY_NAMES[d.getDay()]}
        </p>
      </div>

      {/* 우측: 상단 N건 + 요약 카드 */}
      <div className="min-w-0">
        <p className="text-right text-[10px] tabular-nums text-foreground-faint mb-0.5">
          {items.length}건
        </p>
        <ul className="divide-y divide-line">
          {items.map((s) => (
            <SummaryListRow key={s.id} summary={s} />
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ─── 요약 한 행 ─── */

function SummaryListRow({ summary }: { summary: SummaryRow }) {
  const icon = ROOM_ICONS[summary.room_id];
  const label = ROOM_LABELS[summary.room_id] || summary.room_id;

  return (
    <li>
      <div className="py-3 px-2 hover:bg-surface-muted transition-colors">
        <div className="flex items-center gap-2 mb-2">
          {icon && (
            <img src={icon.image} alt="" className="w-6 h-6 object-cover rounded-full shrink-0" />
          )}
          <span className="text-[10px] tracking-[0.18em] uppercase text-primary-500">
            {label}
          </span>
        </div>
        <p className="text-sm text-foreground-muted leading-[1.7] whitespace-pre-line">
          {summary.summary}
        </p>
      </div>
    </li>
  );
}
