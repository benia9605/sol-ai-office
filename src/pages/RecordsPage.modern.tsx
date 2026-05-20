/**
 * @file src/pages/RecordsPage.modern.tsx
 * @description 기록 페이지 — 모던 테마 (MUJI 톤)
 * - 헤더: RECORDS 레이블 + font-light + 통계
 * - 유형 chip 5종 (전체/아침/저녁/주간/메모) + 검색
 * - 날짜별(YYYY-MM-DD) 그룹 + 페이지네이션
 * - 행: 큰 날짜 + 유형 컬러 dot + 제목 + 무드 이모지 + 에너지 + 태그
 * - 상세/추가는 모디 RecordForm / RecordDetailView 그대로 호출
 */
import { useState, useMemo, useEffect, useCallback } from 'react';
import { RecordItem, RecordType } from '../types';
import { useRecords } from '../hooks/useRecords';
import { RecordTypeSelector } from '../components/records/RecordTypeSelector';
import { RecordForm } from '../components/records/RecordForm';
import { RecordDetailView } from '../components/records/RecordDetailView';

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
const MONTHS_EN = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const PAGE_SIZE = 10;

interface TypeMeta { labelKo: string; labelEn: string; description: string }

const typeMeta: Record<RecordType, TypeMeta> = {
  morning: { labelKo: '아침',  labelEn: 'Morning', description: '감사·다짐·아이디어' },
  evening: { labelKo: '저녁',  labelEn: 'Evening', description: '굉장한 일·배움·내일' },
  weekly:  { labelKo: '주간',  labelEn: 'Weekly',  description: '한 주 회고' },
  memo:    { labelKo: '메모',  labelEn: 'Memo',    description: '자유 기록' },
};

const fallbackMeta: TypeMeta = { labelKo: '기록', labelEn: 'Record', description: '' };

function getMeta(type: RecordType | string | undefined): TypeMeta {
  if (!type) return fallbackMeta;
  return typeMeta[type as RecordType] ?? fallbackMeta;
}

type TypeFilter = 'all' | RecordType;

export function RecordsPageModern() {
  const { records, loading, add, update, remove } = useRecords();

  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);

  // 추가 흐름
  const [showSelector, setShowSelector] = useState(false);
  const [formType, setFormType] = useState<RecordType | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<RecordItem | null>(null);

  useEffect(() => { setPage(0); }, [typeFilter, searchQuery]);

  // 유형별 카운트
  const counts = useMemo(() => ({
    all: records.length,
    morning: records.filter((r) => r.recordType === 'morning').length,
    evening: records.filter((r) => r.recordType === 'evening').length,
    weekly:  records.filter((r) => r.recordType === 'weekly').length,
    memo:    records.filter((r) => r.recordType === 'memo').length,
  }), [records]);

  // 필터링
  const filtered = useMemo(() => {
    let result = [...records];
    if (typeFilter !== 'all') result = result.filter((r) => r.recordType === typeFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((r) =>
        r.title.toLowerCase().includes(q) ||
        r.tags?.some((t) => t.toLowerCase().includes(q)) ||
        r.project?.toLowerCase().includes(q),
      );
    }
    // 최신 날짜 → 시간 내림차순
    result.sort((a, b) => {
      const dateCmp = (b.date || '').localeCompare(a.date || '');
      if (dateCmp !== 0) return dateCmp;
      return (b.time || '').localeCompare(a.time || '');
    });
    return result;
  }, [records, typeFilter, searchQuery]);

  // 날짜별 그룹핑
  const dateGroups = useMemo(() => {
    const map = new Map<string, RecordItem[]>();
    filtered.forEach((r) => {
      const arr = map.get(r.date) ?? [];
      arr.push(r);
      map.set(r.date, arr);
    });
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(dateGroups.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pagedGroups = dateGroups.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  // 이번 주 / 이번 달 통계
  const stats = useMemo(() => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const weekCount = records.filter((r) => {
      const d = new Date(r.date);
      return d.getTime() >= startOfWeek.getTime();
    }).length;
    const monthCount = records.filter((r) => {
      const d = new Date(r.date);
      return d.getTime() >= startOfMonth.getTime();
    }).length;
    return { weekCount, monthCount };
  }, [records]);

  // 추가 흐름 — RecordTypeSelector 통해 폼 진입
  const handleSelectorPick = useCallback((t: RecordType) => {
    setShowSelector(false);
    setFormType(t);
  }, []);

  return (
    <main className="min-h-full bg-surface text-foreground">
      <div className="mx-auto max-w-5xl px-5 sm:px-8 py-10 sm:py-14 space-y-12 sm:space-y-14">

        {/* ── Header ── */}
        <section className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <p className="label">Records</p>
            <h1 className="mt-5 text-4xl font-light leading-[1.25] sm:text-5xl">
              기록
            </h1>
            <p className="mt-4 text-sm text-foreground-muted">
              전체 {counts.all}건 ·
              이번 주 <span className="text-foreground">{stats.weekCount}</span> ·
              이번 달 <span className="text-foreground">{stats.monthCount}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowSelector(true)}
            className="border border-foreground px-6 py-2.5 text-sm hover:bg-foreground hover:text-surface transition-colors"
          >
            + 새 기록
          </button>
        </section>

        {/* ── 유형별 진입 카드 (한 줄, MUJI 톤) ── */}
        <section className="grid grid-cols-2 sm:grid-cols-4 border-l border-t border-line">
          {(['morning', 'evening', 'weekly', 'memo'] as RecordType[]).map((t) => {
            const meta = typeMeta[t];
            const count = counts[t];
            return (
              <button
                key={t}
                type="button"
                onClick={() => setFormType(t)}
                className="group text-left border-r border-b border-line px-4 sm:px-5 py-5 hover:bg-surface-muted transition-colors"
              >
                <p className="text-[10px] tracking-[0.22em] uppercase text-primary-500">
                  {meta.labelEn}
                </p>
                <h3 className="mt-2 text-base text-foreground-muted group-hover:text-foreground transition-colors">
                  {meta.labelKo}
                </h3>
                <p className="mt-0.5 text-[11px] text-foreground-faint">{meta.description}</p>
                <p className="mt-3 text-xs tabular-nums">
                  <span className="text-primary-500">{count}</span>
                  <span className="text-foreground-faint"> 건</span>
                </p>
              </button>
            );
          })}
        </section>

        {/* ── 필터 + 검색 ── */}
        <section className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <FilterChip
              active={typeFilter === 'all'}
              onClick={() => setTypeFilter('all')}
              label={`전체 ${counts.all}`}
            />
            {(['morning', 'evening', 'weekly', 'memo'] as RecordType[]).map((t) => {
              const meta = typeMeta[t];
              return (
                <FilterChip
                  key={t}
                  active={typeFilter === t}
                  onClick={() => setTypeFilter(typeFilter === t ? 'all' : t)}
                  label={`${meta.labelKo} ${counts[t]}`}
                />
              );
            })}
          </div>

          <div className="relative">
            <svg viewBox="0 0 20 20" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-foreground-faint" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="9" cy="9" r="6" />
              <path d="M14 14l3 3" strokeLinecap="round" />
            </svg>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="제목 · 태그 · 프로젝트 검색"
              className="w-full pl-10 pr-4 py-2.5 bg-surface border border-line text-sm placeholder:text-foreground-faint focus:border-foreground focus:outline-none transition-colors"
            />
          </div>
        </section>

        {/* ── 기록 리스트 (날짜별 그룹) ── */}
        <section>
          <div className="flex items-baseline justify-between border-b border-line pb-3">
            <h2 className="text-base font-normal">기록 보관함</h2>
            <p className="text-xs text-foreground-faint tabular-nums">
              {filtered.length}건 · {dateGroups.length}개 날짜
            </p>
          </div>

          {loading ? (
            <EmptyRow message="불러오는 중…" />
          ) : filtered.length === 0 ? (
            <EmptyRow message="조건에 맞는 기록이 없습니다." />
          ) : (
            <div>
              {pagedGroups.map(([date, items]) => (
                <RecordDateGroup
                  key={date}
                  date={date}
                  items={items}
                  onItemClick={setSelectedRecord}
                />
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <nav className="mt-10 flex items-center justify-between border-t border-line pt-5">
              <button
                type="button"
                onClick={() => setPage(Math.max(0, safePage - 1))}
                disabled={safePage === 0}
                className={`inline-flex items-center gap-2 text-xs transition-colors ${
                  safePage === 0 ? 'text-foreground-faint cursor-not-allowed' : 'text-foreground-muted hover:text-foreground'
                }`}
              >
                <span aria-hidden>←</span> 이전
              </button>
              <p className="text-xs tabular-nums">
                <span className="text-foreground">{safePage + 1}</span>
                <span className="text-foreground-faint"> / {totalPages}</span>
              </p>
              <button
                type="button"
                onClick={() => setPage(Math.min(totalPages - 1, safePage + 1))}
                disabled={safePage >= totalPages - 1}
                className={`inline-flex items-center gap-2 text-xs transition-colors ${
                  safePage >= totalPages - 1 ? 'text-foreground-faint cursor-not-allowed' : 'text-foreground-muted hover:text-foreground'
                }`}
              >
                다음 <span aria-hidden>→</span>
              </button>
            </nav>
          )}
        </section>

      </div>

      {/* 유형 선택 — 오버레이 모달 */}
      {showSelector && (
        <div
          className="fixed inset-0 z-50 bg-foreground/40 flex items-center justify-center p-5"
          onClick={(e) => { if (e.target === e.currentTarget) setShowSelector(false); }}
        >
          <div className="bg-surface border border-line w-full max-w-md p-6">
            <div className="flex items-baseline justify-between mb-5">
              <p className="label">New Record</p>
              <button
                type="button"
                onClick={() => setShowSelector(false)}
                className="text-xs text-foreground-muted hover:text-foreground transition-colors"
              >
                닫기
              </button>
            </div>
            <h3 className="text-2xl font-light leading-snug mb-5">
              어떤 기록을 남기시겠어요?
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {(['morning', 'evening', 'weekly', 'memo'] as RecordType[]).map((t) => {
                const meta = typeMeta[t];
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleSelectorPick(t)}
                    className="text-left border border-line p-4 hover:border-foreground hover:bg-surface-muted transition-colors"
                  >
                    <p className="text-[10px] tracking-[0.22em] uppercase text-primary-500">
                      {meta.labelEn}
                    </p>
                    <p className="mt-2 text-base">{meta.labelKo}</p>
                    <p className="mt-1 text-[11px] text-foreground-faint">{meta.description}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 작성 폼 (RecordForm — 모디 톤 호출) */}
      {formType && (
        <RecordForm
          recordType={formType}
          onSave={async (record) => {
            await add(record);
            setFormType(null);
          }}
          onCancel={() => setFormType(null)}
        />
      )}

      {/* 상세 (RecordDetailView — 모디 톤 호출) */}
      {selectedRecord && (
        <RecordDetailView
          record={selectedRecord}
          onUpdate={async (updated) => {
            await update(updated.id, updated);
            setSelectedRecord(null);
          }}
          onDelete={async (id) => {
            await remove(id);
            setSelectedRecord(null);
          }}
          onClose={() => setSelectedRecord(null)}
        />
      )}
    </main>
  );
}

/* ─────────────────────────────────────────────────────── */
/*  서브 컴포넌트                                            */
/* ─────────────────────────────────────────────────────── */

function EmptyRow({ message }: { message: string }) {
  return (
    <div className="border-b border-line py-16 text-center">
      <p className="text-sm text-foreground-faint">{message}</p>
    </div>
  );
}

function FilterChip({
  active, onClick, label, dotColor,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  dotColor?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 py-1.5 text-xs border transition-colors ${
        active
          ? 'bg-foreground text-surface border-foreground'
          : 'bg-surface text-foreground-muted border-line hover:border-foreground hover:text-foreground'
      }`}
    >
      {dotColor && (
        <span className="w-1.5 h-1.5 shrink-0" style={{ backgroundColor: dotColor }} aria-hidden />
      )}
      {label}
    </button>
  );
}

/* ─── 날짜 그룹 (좌측 날짜 + 우측 divide-y) ─── */

function RecordDateGroup({
  date,
  items,
  onItemClick,
}: {
  date: string;
  items: RecordItem[];
  onItemClick: (r: RecordItem) => void;
}) {
  const d = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const dayDiff = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  // 같은 날 안에서는 시간 늦은 순 (저녁 → 아침)
  const sortedItems = [...items].sort((a, b) => (b.time || '').localeCompare(a.time || ''));

  return (
    <div className="grid grid-cols-[64px_1fr] sm:grid-cols-[80px_1fr] gap-3 sm:gap-5 py-3 border-b border-line">
      {/* 좌측: 날짜만 (월/일/요일) */}
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

      {/* 우측: 상단 N건 + 같은 날 행 사이 구분선 */}
      <div className="min-w-0">
        <p className="text-right text-[10px] tabular-nums text-foreground-faint mb-0.5">
          {items.length}건
        </p>
        <ul className="divide-y divide-line">
          {sortedItems.map((r) => (
            <RecordRow key={r.id} record={r} onClick={() => onItemClick(r)} />
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ─── 기록 한 줄 (컴팩트) ─── */

function RecordRow({ record, onClick }: { record: RecordItem; onClick: () => void }) {
  const meta = getMeta(record.recordType);
  const energy = record.energy ?? 0;
  const hasMood = !!record.mood;

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="w-full flex items-center gap-2.5 sm:gap-3 py-1.5 px-2 hover:bg-surface-muted transition-colors text-left"
      >
        {/* 시간 */}
        <span className="text-[11px] tabular-nums text-foreground-faint w-10 shrink-0">
          {record.time || '—'}
        </span>

        {/* 유형 영문 라벨 */}
        <span className="text-[9px] tracking-[0.16em] uppercase text-primary-500 w-12 shrink-0">
          {meta.labelEn}
        </span>

        {/* 제목 */}
        <span className="flex-1 min-w-0 text-[13px] text-foreground-muted truncate">
          {record.title}
        </span>

        {/* 에너지 */}
        {energy > 0 && (
          <span className="hidden sm:inline-flex items-center gap-0.5 shrink-0" aria-label={`에너지 ${energy}/5`}>
            {[1, 2, 3, 4, 5].map((n) => (
              <span
                key={n}
                className={`w-0.5 h-2 ${n <= energy ? 'bg-primary-500' : 'bg-line'}`}
                aria-hidden
              />
            ))}
          </span>
        )}

        {/* 무드 */}
        {hasMood && (
          <span className="text-sm leading-none shrink-0">{record.mood}</span>
        )}
      </button>
    </li>
  );
}
