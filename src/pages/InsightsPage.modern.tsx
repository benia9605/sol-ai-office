/**
 * @file src/pages/InsightsPage.modern.tsx
 * @description 인사이트 페이지 — 모던 테마 (MUJI 톤)
 * - 페이지 헤더: INSIGHTS 레이블 + font-light 헤딩
 * - 빠른 입력 + 상세 추가 (2-toggle, 인사이트는 인박스 개념 없음)
 * - 출처 chip (AI 캐릭터 이미지 + 기타 출처)
 * - 태그 chip + 검색
 * - 리스트: 좌측 출처 아이콘 + 제목 + 본문 미리 + 태그 + 우측 날짜/우선순위
 * - 10개씩 페이지네이션
 */
import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { InsightItem, InsightSource } from '../types';
import { useInsights } from '../hooks/useInsights';
import { useInsightSources } from '../hooks/useInsightSources';
import { ItemDetailPopup } from '../components/ItemDetailPopup';
import { ProjectSelect } from '../components/ProjectSelect';

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
const MONTHS_EN = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const priorityMeta: Record<'high' | 'medium' | 'low', { label: string; color: string }> = {
  high:   { label: '중요', color: '#dc2626' },
  medium: { label: '보통', color: '#f59e0b' },
  low:    { label: '가벼움', color: '#9ca3af' },
};

const priorityWeight: Record<string, number> = { high: 0, medium: 1, low: 2 };

const defaultPresetTags = ['트렌드', 'AI', '마케팅', '개발', '아이디어', '전략'];

const isImagePath = (v: string) => v.startsWith('/') || v.startsWith('http');

function SourceImg({ image, label, size = 40 }: { image: string; label: string; size?: number }) {
  if (isImagePath(image)) {
    return (
      <img
        src={image}
        alt={label}
        style={{ width: size, height: size }}
        className="object-cover shrink-0"
      />
    );
  }
  return (
    <span
      style={{ width: size, height: size }}
      className="bg-surface-muted flex items-center justify-center text-base shrink-0"
    >
      {image}
    </span>
  );
}

export function InsightsPageModern() {
  const { insights, add, update, remove } = useInsights();
  const { sources } = useInsightSources();

  // 입력 모드
  type InputMode = 'quick' | 'detail';
  const [inputMode, setInputMode] = useState<InputMode | null>(null);
  const [quickTitle, setQuickTitle] = useState('');
  const quickRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    title: '', content: '', source: '',
    link: '', project: '', priority: 'medium' as InsightItem['priority'],
    date: new Date().toISOString().slice(0, 10),
    time: new Date().toTimeString().slice(0, 5),
    tagInput: '', tags: [] as string[],
  });

  // 필터/정렬/검색
  const [activeTag, setActiveTag] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [sortMode, setSortMode] = useState<'date' | 'name' | 'priority'>('date');
  const [searchQuery, setSearchQuery] = useState('');

  // 페이지네이션
  const PAGE_SIZE = 10;
  const [page, setPage] = useState(0);
  useEffect(() => { setPage(0); }, [activeTag, sourceFilter, priorityFilter, sortMode, searchQuery]);

  // 상세 팝업
  const [selectedItem, setSelectedItem] = useState<InsightItem | null>(null);

  // 모든 태그 (프리셋 + 인사이트에서 발견)
  const allTags = useMemo(() => {
    const set = new Set<string>(defaultPresetTags);
    insights.forEach((i) => i.tags.forEach((t) => set.add(t)));
    return Array.from(set);
  }, [insights]);

  // 필터링 + 정렬
  const filtered = useMemo(() => {
    let result = [...insights];
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((i) =>
        i.title.toLowerCase().includes(q) ||
        i.content.toLowerCase().includes(q) ||
        i.tags.some((t) => t.toLowerCase().includes(q)) ||
        i.project?.toLowerCase().includes(q),
      );
    }
    if (sourceFilter !== 'all') result = result.filter((i) => i.source === sourceFilter);
    if (priorityFilter !== 'all') result = result.filter((i) => i.priority === priorityFilter);
    if (activeTag !== 'all') result = result.filter((i) => i.tags.includes(activeTag));

    result.sort((a, b) => {
      // ★ 즐겨찾기는 무조건 상단 고정
      if (!!a.starred !== !!b.starred) return a.starred ? -1 : 1;
      if (sortMode === 'date') return (b.createdAt || '').localeCompare(a.createdAt || '');
      if (sortMode === 'name') return a.title.localeCompare(b.title, 'ko', { numeric: true });
      if (sortMode === 'priority') {
        return (priorityWeight[a.priority || 'medium'] ?? 1) - (priorityWeight[b.priority || 'medium'] ?? 1);
      }
      return 0;
    });
    return result;
  }, [insights, searchQuery, sourceFilter, priorityFilter, activeTag, sortMode]);

  const starredCount = useMemo(() => insights.filter((i) => i.starred).length, [insights]);

  const handleToggleStar = useCallback((item: InsightItem) => {
    update(item.id, { starred: !item.starred });
  }, [update]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageItems = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const handleQuickAdd = useCallback(() => {
    if (!quickTitle.trim()) return;
    add({
      title: quickTitle.trim(),
      content: '',
      source: 'thought',
      tags: [],
      createdAt: new Date().toISOString().slice(0, 10),
      time: new Date().toTimeString().slice(0, 5),
      priority: 'medium',
    });
    setQuickTitle('');
    setTimeout(() => quickRef.current?.focus(), 50);
  }, [quickTitle, add]);

  const handleAddTag = () => {
    const tag = form.tagInput.trim();
    if (tag && !form.tags.includes(tag)) {
      setForm({ ...form, tags: [...form.tags, tag], tagInput: '' });
    }
  };

  const handleAdd = () => {
    if (!form.title.trim()) return;
    add({
      title: form.title,
      content: form.content,
      source: form.source || 'thought',
      link: form.link || undefined,
      tags: form.tags,
      createdAt: form.date,
      time: form.time,
      project: form.project || undefined,
      priority: form.priority,
    });
    setForm({
      title: '', content: '', source: '', link: '', project: '',
      priority: 'medium', date: new Date().toISOString().slice(0, 10),
      time: new Date().toTimeString().slice(0, 5),
      tagInput: '', tags: [],
    });
    setInputMode(null);
  };

  return (
    <main className="min-h-full bg-surface text-foreground">
      <div className="mx-auto max-w-5xl px-5 sm:px-8 py-10 sm:py-14 space-y-12 sm:space-y-14">

        {/* ── Page Header ── */}
        <section>
          <p className="label">Insights</p>
          <h1 className="mt-5 text-4xl font-light leading-[1.25] sm:text-5xl">
            인사이트
          </h1>
          <p className="mt-4 text-sm text-foreground-muted">
            {insights.length}건의 인사이트
            {starredCount > 0 && <> · 즐겨찾기 <span className="text-primary-500">{starredCount}</span></>}
            {activeTag !== 'all' && <> · <span className="text-foreground">#{activeTag}</span> 필터</>}
            {searchQuery && <> · 검색 결과 <span className="text-foreground">{filtered.length}건</span></>}
          </p>
        </section>

        {/* ── 입력 2-toggle ── */}
        <section className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <InputToggleButton
              active={inputMode === 'quick'}
              onClick={() => setInputMode(inputMode === 'quick' ? null : 'quick')}
              labelEn="Quick"
              labelKo="빠른 인사이트"
              hint="제목만 메모"
            />
            <InputToggleButton
              active={inputMode === 'detail'}
              onClick={() => setInputMode(inputMode === 'detail' ? null : 'detail')}
              labelEn="Detail"
              labelKo="상세 기록"
              hint="본문·출처·링크·태그"
            />
          </div>

          {inputMode === 'quick' && (
            <div className="border border-line bg-surface px-4 py-3 flex items-center gap-2">
              <input
                ref={quickRef}
                autoFocus
                type="text"
                placeholder="떠오른 생각 한 줄 — Enter로 즉시 기록"
                value={quickTitle}
                onChange={(e) => setQuickTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleQuickAdd();
                  if (e.key === 'Escape') setInputMode(null);
                }}
                className="flex-1 bg-transparent text-sm placeholder:text-foreground-faint focus:outline-none"
              />
              <button
                type="button"
                onClick={handleQuickAdd}
                disabled={!quickTitle.trim()}
                className="text-xs text-foreground-muted hover:text-foreground disabled:opacity-40"
              >
                기록
              </button>
            </div>
          )}

          {inputMode === 'detail' && (
            <InsightAddForm
              form={form}
              setForm={setForm}
              sources={sources}
              onAddTag={handleAddTag}
              onCancel={() => setInputMode(null)}
              onSubmit={handleAdd}
            />
          )}
        </section>

        {/* ── 출처 + 태그 chip 그룹 (한 섹션으로 묶어 여백 축소) ── */}
        <section className="space-y-5">
          {sources.length > 0 && (
            <div className="space-y-2">
              <p className="label">Source</p>
              <div className="flex flex-wrap gap-2">
                <FilterChip
                  active={sourceFilter === 'all'}
                  onClick={() => setSourceFilter('all')}
                  label="모든 출처"
                />
                {sources.map((s) => (
                  <SourceChip
                    key={s.id}
                    active={sourceFilter === s.id}
                    onClick={() => setSourceFilter(sourceFilter === s.id ? 'all' : s.id)}
                    source={s}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <p className="label">Tag</p>
            <div className="flex flex-wrap gap-2">
              <FilterChip
                active={activeTag === 'all'}
                onClick={() => setActiveTag('all')}
                label="모든 태그"
              />
              {allTags.map((tag) => (
                <FilterChip
                  key={tag}
                  active={activeTag === tag}
                  onClick={() => setActiveTag(activeTag === tag ? 'all' : tag)}
                  label={`#${tag}`}
                />
              ))}
            </div>
          </div>
        </section>

        {/* ── 정렬 + 우선순위 + 검색 ── */}
        <section className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2">
          <div className="relative">
            <svg viewBox="0 0 20 20" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-foreground-faint" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="9" cy="9" r="6" />
              <path d="M14 14l3 3" strokeLinecap="round" />
            </svg>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="제목·본문·태그·프로젝트 검색"
              className="w-full pl-10 pr-4 py-2.5 bg-surface border border-line text-sm placeholder:text-foreground-faint focus:border-foreground focus:outline-none transition-colors"
            />
          </div>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="border border-line bg-surface px-3 py-2.5 text-sm focus:border-foreground focus:outline-none transition-colors"
          >
            <option value="all">모든 중요도</option>
            <option value="high">중요</option>
            <option value="medium">보통</option>
            <option value="low">가벼움</option>
          </select>
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as typeof sortMode)}
            className="border border-line bg-surface px-3 py-2.5 text-sm focus:border-foreground focus:outline-none transition-colors"
          >
            <option value="date">최신순</option>
            <option value="priority">중요도순</option>
            <option value="name">이름순</option>
          </select>
        </section>

        {/* ── 인사이트 리스트 ── */}
        <section>
          <div className="flex items-baseline justify-between border-b border-line pb-3">
            <h2 className="text-base font-normal">기록</h2>
            <p className="text-xs text-foreground-faint tabular-nums">
              {filtered.length}건 · 최신순
            </p>
          </div>

          {filtered.length === 0 ? (
            <EmptyRow message="조건에 맞는 인사이트가 없습니다." />
          ) : (
            <ul className="divide-y divide-line border-b border-line">
              {pageItems.map((i) => (
                <InsightRow
                  key={i.id}
                  item={i}
                  sources={sources}
                  onClick={() => setSelectedItem(i)}
                  onToggleStar={() => handleToggleStar(i)}
                />
              ))}
            </ul>
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

      {selectedItem && (
        <ItemDetailPopup
          type="insight"
          item={selectedItem}
          onSave={(updated) => { update((updated as InsightItem).id, updated as InsightItem); setSelectedItem(null); }}
          onDelete={(id) => { remove(id); setSelectedItem(null); }}
          onClose={() => setSelectedItem(null)}
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

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
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
      {label}
    </button>
  );
}

function SourceChip({
  active,
  onClick,
  source,
}: {
  active: boolean;
  onClick: () => void;
  source: InsightSource;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 pl-1.5 pr-3.5 py-1 text-xs border transition-colors ${
        active
          ? 'bg-foreground text-surface border-foreground'
          : 'bg-surface text-foreground-muted border-line hover:border-foreground hover:text-foreground'
      }`}
    >
      <SourceImg image={source.image} label={source.label} size={18} />
      {source.label}
    </button>
  );
}

function InputToggleButton({
  active, onClick, labelEn, labelKo, hint,
}: {
  active: boolean;
  onClick: () => void;
  labelEn: string;
  labelKo: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-3 text-left border transition-colors ${
        active ? 'bg-foreground text-surface border-foreground' : 'bg-surface text-foreground border-line hover:border-foreground'
      }`}
    >
      <p className={`text-[10px] tracking-[0.22em] uppercase ${
        active ? 'text-surface/70' : 'text-foreground-faint'
      }`}>
        {labelEn}
      </p>
      <p className="mt-1.5 text-sm leading-tight">{labelKo}</p>
      <p className={`mt-1 text-[10px] ${active ? 'text-surface/60' : 'text-foreground-faint'}`}>
        {hint}
      </p>
    </button>
  );
}

/* ─── 인사이트 한 행 ─── */

function InsightRow({
  item,
  sources,
  onClick,
  onToggleStar,
}: {
  item: InsightItem;
  sources: InsightSource[];
  onClick: () => void;
  onToggleStar: () => void;
}) {
  const source = sources.find((s) => s.id === item.source);
  const priority = priorityMeta[item.priority || 'medium'];
  const date = new Date(item.createdAt);
  const dateLabel = `${MONTHS_EN[date.getMonth()]} ${String(date.getDate()).padStart(2, '0')}`;
  const yearLabel = date.getFullYear();
  const previewLength = 120;
  const preview = item.content.replace(/\n+/g, ' ').slice(0, previewLength);
  const hasMore = item.content.length > previewLength;
  const isStarred = !!item.starred;

  return (
    <li className={isStarred ? 'bg-surface-muted/40' : ''}>
      <div className="w-full grid grid-cols-[24px_48px_1fr_auto] items-start gap-3 sm:gap-4 py-5 pl-4 pr-3 sm:pl-6 hover:bg-surface-muted transition-colors">
        {/* 즐겨찾기 토글 (좌측 별 버튼) */}
        <button
          type="button"
          onClick={onToggleStar}
          aria-label={isStarred ? '즐겨찾기 해제' : '즐겨찾기'}
          className={`mt-1 w-5 h-5 flex items-center justify-center transition-colors ${
            isStarred ? 'text-primary-500' : 'text-foreground-faint hover:text-foreground'
          }`}
        >
          <StarIcon filled={isStarred} />
        </button>

        {/* 출처 이미지 */}
        <div className="pt-0.5">
          {source ? (
            <SourceImg image={source.image} label={source.label} size={40} />
          ) : (
            <div className="w-10 h-10 bg-surface-muted" />
          )}
        </div>

        {/* 본문 (전체 클릭 영역) */}
        <button
          type="button"
          onClick={onClick}
          className="text-left min-w-0"
        >
          <div className="flex items-baseline gap-2 flex-wrap">
            <p className="text-base font-normal">{item.title}</p>
            {isStarred && (
              <span className="text-[10px] tracking-[0.18em] uppercase text-primary-500">
                Pinned
              </span>
            )}
            {source && (
              <span className="text-[10px] tracking-[0.15em] uppercase text-foreground-faint">
                {source.label}
              </span>
            )}
          </div>

          {item.content && (
            <p className="mt-1.5 text-xs text-foreground-muted leading-[1.7] line-clamp-2">
              {preview}{hasMore && '…'}
            </p>
          )}

          {(item.tags.length > 0 || item.project) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {item.project && (
                <span className="text-[10px] text-foreground-muted border border-line px-1.5 py-0.5">
                  {item.project}
                </span>
              )}
              {item.tags.map((tag) => (
                <span key={tag} className="text-[10px] text-foreground-faint">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </button>

        {/* 우측: 날짜 + 우선순위 */}
        <button
          type="button"
          onClick={onClick}
          className="shrink-0 text-right cursor-pointer"
        >
          <p className="text-[10px] tracking-[0.18em] uppercase text-foreground-faint">
            {dateLabel}
          </p>
          <p className="mt-0.5 text-[10px] text-foreground-faint tabular-nums">
            {yearLabel}
          </p>
          {item.priority && (
            <span
              className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 leading-none"
              style={{
                backgroundColor: `${priority.color}1a`,
                color: priority.color,
              }}
            >
              <span className="w-1 h-1" style={{ backgroundColor: priority.color }} aria-hidden />
              {priority.label}
            </span>
          )}
        </button>
      </div>
    </li>
  );
}

/* 별 아이콘 (채움 / 빈 토글) */
function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className="w-4 h-4"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    >
      <path d="M10 2.5l2.4 4.85 5.35.77-3.87 3.77.91 5.31L10 14.7l-4.79 2.5.91-5.31L2.25 8.12l5.35-.77L10 2.5z" />
    </svg>
  );
}

/* ─── 상세 추가 폼 ─── */

interface AddFormProps {
  form: {
    title: string; content: string; source: string;
    link: string; project: string;
    priority: InsightItem['priority'];
    date: string; time: string;
    tagInput: string; tags: string[];
  };
  setForm: React.Dispatch<React.SetStateAction<AddFormProps['form']>>;
  sources: InsightSource[];
  onAddTag: () => void;
  onCancel: () => void;
  onSubmit: () => void;
}

function InsightAddForm({ form, setForm, sources, onAddTag, onCancel, onSubmit }: AddFormProps) {
  return (
    <section className="border border-line p-6 sm:p-8 space-y-6 bg-surface">
      <p className="label">New Insight</p>

      <label className="block space-y-2">
        <span className="label">제목</span>
        <input
          type="text"
          placeholder="인사이트 제목"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="w-full border border-line bg-surface px-4 py-3 text-base placeholder:text-foreground-faint focus:border-foreground focus:outline-none transition-colors"
        />
      </label>

      <label className="block space-y-2">
        <span className="label">본문</span>
        <textarea
          value={form.content}
          onChange={(e) => setForm({ ...form, content: e.target.value })}
          rows={4}
          placeholder="구체적인 내용을 적어주세요 (Markdown 지원)"
          className="w-full border border-line bg-surface px-4 py-3 text-sm resize-none placeholder:text-foreground-faint focus:border-foreground focus:outline-none transition-colors"
        />
      </label>

      {/* 출처 */}
      <div className="space-y-2">
        <p className="label">출처</p>
        <div className="flex flex-wrap gap-2">
          {sources.map((s) => {
            const active = form.source === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setForm({ ...form, source: active ? '' : s.id })}
                className={`inline-flex items-center gap-2 pl-1.5 pr-3 py-1 text-xs border transition-colors ${
                  active
                    ? 'bg-foreground text-surface border-foreground'
                    : 'bg-surface text-foreground-muted border-line hover:border-foreground hover:text-foreground'
                }`}
              >
                <SourceImg image={s.image} label={s.label} size={18} />
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 링크 + 프로젝트 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="block space-y-2">
          <span className="label">링크</span>
          <input
            type="url"
            placeholder="https://..."
            value={form.link}
            onChange={(e) => setForm({ ...form, link: e.target.value })}
            className="w-full border border-line bg-surface px-3 py-2.5 text-sm placeholder:text-foreground-faint focus:border-foreground focus:outline-none transition-colors"
          />
        </label>
        <label className="block space-y-2">
          <span className="label">프로젝트</span>
          <ProjectSelect value={form.project} onChange={(v) => setForm({ ...form, project: v })} />
        </label>
      </div>

      {/* 날짜 + 시간 + 중요도 */}
      <div className="grid grid-cols-3 gap-4">
        <label className="block space-y-2">
          <span className="label">날짜</span>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            className="w-full border border-line bg-surface px-3 py-2.5 text-sm focus:border-foreground focus:outline-none transition-colors"
          />
        </label>
        <label className="block space-y-2">
          <span className="label">시간</span>
          <input
            type="time"
            value={form.time}
            onChange={(e) => setForm({ ...form, time: e.target.value })}
            className="w-full border border-line bg-surface px-3 py-2.5 text-sm focus:border-foreground focus:outline-none transition-colors"
          />
        </label>
        <label className="block space-y-2">
          <span className="label">중요도</span>
          <select
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value as InsightItem['priority'] })}
            className="w-full border border-line bg-surface px-3 py-2.5 text-sm focus:border-foreground focus:outline-none transition-colors"
          >
            <option value="high">중요</option>
            <option value="medium">보통</option>
            <option value="low">가벼움</option>
          </select>
        </label>
      </div>

      {/* 태그 */}
      <div className="space-y-2">
        <p className="label">태그</p>
        {form.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {form.tags.map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1.5 text-xs border border-line px-2.5 py-1">
                #{tag}
                <button
                  type="button"
                  onClick={() => setForm({ ...form, tags: form.tags.filter((t) => t !== tag) })}
                  className="text-foreground-faint hover:text-foreground"
                >×</button>
              </span>
            ))}
          </div>
        )}
        <input
          type="text"
          placeholder="태그 입력 후 Enter"
          value={form.tagInput}
          onChange={(e) => setForm({ ...form, tagInput: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault();
              onAddTag();
            }
          }}
          className="w-full border border-line bg-surface px-4 py-2.5 text-sm placeholder:text-foreground-faint focus:border-foreground focus:outline-none transition-colors"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-line">
        <button
          type="button"
          onClick={onCancel}
          className="border border-line-strong px-6 py-2.5 text-sm text-foreground hover:border-foreground transition-colors"
        >
          취소
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!form.title.trim()}
          className="border border-foreground bg-foreground px-6 py-2.5 text-sm text-surface hover:bg-foreground-muted hover:border-foreground-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          기록
        </button>
      </div>
    </section>
  );
}
