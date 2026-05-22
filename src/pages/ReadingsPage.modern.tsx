/**
 * @file src/pages/ReadingsPage.modern.tsx
 * @description 독서/스터디 페이지 — 모던 테마 (MUJI 톤)
 * - 헤더: STUDY 레이블 + font-light 헤딩 + 통계
 * - 입력 2-toggle: 도서 검색 추가 (알라딘) / 직접 추가
 * - 상태 chip + 카테고리 chip
 * - 검색
 * - 카드 그리드 (커버 + 제목 + 진행률 hairline 바)
 * - 상세는 모디 ReadingDetailView 호출 (Tiptap 통합)
 * - 페이지네이션
 */
import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { ReadingItem, ReadingCategory, StudyNote } from '../types';
import { defaultReadingCategories } from '../data';
import { useReadings } from '../hooks/useReadings';
import { calcReadingProgress, progressLabel } from '../utils/readingProgress';
import { ReadingDetailView } from '../components/readings/ReadingDetailView';
import { searchBooks, getBookDetail, parseCategoryToTags, AladinSearchItem } from '../services/aladinApi';
import { generateBookToc } from '../services/claudeApi';
import { getBadgeColors } from '../utils/colorUtils';

const PAGE_SIZE = 12;

const statusOptions: { key: 'all' | ReadingItem['status']; label: string }[] = [
  { key: 'all',       label: '전체' },
  { key: 'reading',   label: '읽는 중' },
  { key: 'completed', label: '완독' },
  { key: 'planned',   label: '예정' },
];

export function ReadingsPageModern() {
  const {
    readings, studyNotes,
    addReading, updateReading, removeReading,
    addNote, updateNote, removeNote,
  } = useReadings();
  const [categories] = useState<ReadingCategory[]>(defaultReadingCategories);

  // 필터/검색
  const [statusFilter, setStatusFilter] = useState<'all' | ReadingItem['status']>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // 페이지네이션
  const [page, setPage] = useState(0);
  useEffect(() => { setPage(0); }, [statusFilter, categoryFilter, searchQuery]);

  // 상세
  const [selectedReading, setSelectedReading] = useState<ReadingItem | null>(null);

  // 입력 모드
  type InputMode = 'search' | 'manual';
  const [inputMode, setInputMode] = useState<InputMode | null>(null);
  const [form, setForm] = useState({
    title: '', author: '', category: 'rcat-book' as string,
    coverEmoji: '📖', coverImage: '' as string,
    startDate: new Date().toISOString().slice(0, 10),
    totalPages: '', totalLessons: '',
    tagInput: '', tags: [] as string[], link: '',
    price: '', isbn13: '', chapters: [] as string[],
  });

  // 알라딘 검색
  const [aladinQuery, setAladinQuery] = useState('');
  const [aladinResults, setAladinResults] = useState<AladinSearchItem[]>([]);
  const [aladinLoading, setAladinLoading] = useState(false);
  const [aladinError, setAladinError] = useState('');
  const [aladinSelected, setAladinSelected] = useState(false);
  const [tocLoading, setTocLoading] = useState(false);

  // 통계
  const counts = useMemo(() => ({
    all: readings.length,
    reading: readings.filter((r) => r.status === 'reading').length,
    completed: readings.filter((r) => r.status === 'completed').length,
    planned: readings.filter((r) => r.status === 'planned').length,
  }), [readings]);

  // 필터링
  const filtered = useMemo(() => {
    let result = [...readings];
    if (statusFilter !== 'all') result = result.filter((r) => r.status === statusFilter);
    if (categoryFilter !== 'all') result = result.filter((r) => r.category === categoryFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((r) =>
        r.title.toLowerCase().includes(q) ||
        r.author?.toLowerCase().includes(q) ||
        r.tags?.some((t) => t.toLowerCase().includes(q)),
      );
    }
    // 진행 중 우선 → 완독 → 예정, 그 안에서 최근 시작일 순
    result.sort((a, b) => {
      const statusW: Record<string, number> = { reading: 0, planned: 1, completed: 2 };
      const sw = (statusW[a.status] ?? 3) - (statusW[b.status] ?? 3);
      if (sw !== 0) return sw;
      return (b.startDate || '').localeCompare(a.startDate || '');
    });
    return result;
  }, [readings, statusFilter, categoryFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageItems = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const resetForm = () => {
    setForm({
      title: '', author: '', category: 'rcat-book',
      coverEmoji: '📖', coverImage: '',
      startDate: new Date().toISOString().slice(0, 10),
      totalPages: '', totalLessons: '',
      tagInput: '', tags: [], link: '',
      price: '', isbn13: '', chapters: [],
    });
    setAladinQuery('');
    setAladinResults([]);
    setAladinError('');
    setAladinSelected(false);
  };

  const handleAladinSearch = async () => {
    if (!aladinQuery.trim()) return;
    setAladinLoading(true);
    setAladinError('');
    setAladinResults([]);
    setAladinSelected(false);
    try {
      const results = await searchBooks(aladinQuery);
      setAladinResults(results);
      if (results.length === 0) setAladinError('검색 결과가 없습니다');
    } catch {
      setAladinError('검색 중 오류가 발생했습니다');
    } finally {
      setAladinLoading(false);
    }
  };

  const handleAladinSelect = async (item: AladinSearchItem) => {
    setAladinLoading(true);
    try {
      const detail = await getBookDetail(item.isbn13);
      const tags = parseCategoryToTags(item.categoryName);
      setForm((prev) => ({
        ...prev,
        title: item.title.replace(/ - .*$/, ''),
        author: item.author.replace(/ \(지은이\).*$/, '').replace(/ \(옮긴이\).*$/, ''),
        coverImage: item.cover,
        coverEmoji: '📖',
        tags,
        tagInput: '',
        link: item.link,
        totalPages: detail?.subInfo?.itemPage ? String(detail.subInfo.itemPage) : '',
        price: item.priceSales ? String(item.priceSales) : String(item.priceStandard),
        isbn13: item.isbn13,
      }));
      setAladinSelected(true);
      setAladinResults([]);
    } catch {
      setAladinError('상세 정보를 가져오지 못했습니다');
    } finally {
      setAladinLoading(false);
    }
  };

  const handleGenerateToc = async () => {
    if (!form.title.trim()) return;
    setTocLoading(true);
    try {
      const chapters = await generateBookToc(form.title, form.author, form.isbn13 || undefined);
      setForm((prev) => ({ ...prev, chapters }));
    } catch {
      alert('목차 생성에 실패했습니다.');
    } finally {
      setTocLoading(false);
    }
  };

  const handleAddTag = () => {
    const tag = form.tagInput.trim();
    if (tag && !form.tags.includes(tag)) {
      setForm({ ...form, tags: [...form.tags, tag], tagInput: '' });
    }
  };

  const handleAdd = async () => {
    if (!form.title.trim()) return;
    const isCourse = form.category === 'rcat-course';
    const isBook = form.category === 'rcat-book';
    try {
      await addReading({
        title: form.title,
        author: form.author,
        category: form.category,
        status: 'planned',
        coverEmoji: form.coverEmoji,
        coverImage: form.coverImage || undefined,
        startDate: form.startDate,
        totalPages: !isCourse && form.totalPages ? Number(form.totalPages) : undefined,
        totalLessons: isCourse && form.totalLessons ? Number(form.totalLessons) : undefined,
        tags: form.tags.length > 0 ? form.tags : undefined,
        link: form.link || undefined,
        price: isBook && form.price ? Number(form.price) : undefined,
        chapters: isBook && form.chapters.length > 0 ? form.chapters : undefined,
        isbn13: isBook && form.isbn13 ? form.isbn13 : undefined,
      });
      resetForm();
      setInputMode(null);
    } catch {
      alert('추가에 실패했습니다.');
    }
  };

  // 스터디 노트 핸들러 (상세 뷰로 전달)
  const notesForSelected = useMemo(() => {
    if (!selectedReading) return [];
    return studyNotes.filter((n) => n.readingId === selectedReading.id);
  }, [studyNotes, selectedReading]);

  return (
    <main className="min-h-full bg-surface text-foreground">
      <div className="mx-auto max-w-5xl px-5 sm:px-8 py-10 sm:py-14 space-y-12 sm:space-y-14">

        {/* ── Page Header ── */}
        <section>
          <p className="label">Study</p>
          <h1 className="mt-5 text-4xl font-light leading-[1.25] sm:text-5xl">
            독서 · 강좌
          </h1>
          <p className="mt-4 text-sm text-foreground-muted">
            전체 {counts.all}건 · 읽는 중 <span className="text-primary-500">{counts.reading}</span> ·
            완독 {counts.completed} · 예정 {counts.planned}
          </p>
        </section>

        {/* ── 입력 2-toggle ── */}
        <section className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <InputToggleButton
              active={inputMode === 'search'}
              onClick={() => { setInputMode(inputMode === 'search' ? null : 'search'); }}
              labelEn="Search"
              labelKo="도서 검색 추가"
              hint="알라딘에서 자동 입력"
            />
            <InputToggleButton
              active={inputMode === 'manual'}
              onClick={() => { setInputMode(inputMode === 'manual' ? null : 'manual'); }}
              labelEn="Manual"
              labelKo="직접 추가"
              hint="강좌 · 아티클 · 팟캐스트"
            />
          </div>

          {(inputMode === 'search' || inputMode === 'manual') && (
            <AddForm
              mode={inputMode}
              form={form}
              setForm={setForm}
              categories={categories}
              aladinQuery={aladinQuery}
              setAladinQuery={setAladinQuery}
              aladinResults={aladinResults}
              aladinLoading={aladinLoading}
              aladinError={aladinError}
              aladinSelected={aladinSelected}
              tocLoading={tocLoading}
              onAladinSearch={handleAladinSearch}
              onAladinSelect={handleAladinSelect}
              onGenerateToc={handleGenerateToc}
              onAddTag={handleAddTag}
              onCancel={() => { resetForm(); setInputMode(null); }}
              onSubmit={handleAdd}
            />
          )}
        </section>

        {/* ── 필터 ── */}
        <section className="space-y-4">
          {/* 상태 chip */}
          <div className="flex flex-wrap gap-2">
            {statusOptions.map((s) => (
              <FilterChip
                key={s.key}
                active={statusFilter === s.key}
                onClick={() => setStatusFilter(s.key)}
                label={`${s.label} ${counts[s.key]}`}
              />
            ))}
          </div>

          {/* 카테고리 chip */}
          <div className="flex flex-wrap gap-2">
            <FilterChip
              active={categoryFilter === 'all'}
              onClick={() => setCategoryFilter('all')}
              label="모든 종류"
            />
            {categories.map((cat) => (
              <FilterChip
                key={cat.id}
                active={categoryFilter === cat.id}
                onClick={() => setCategoryFilter(categoryFilter === cat.id ? 'all' : cat.id)}
                label={cat.label}
                dotColor={cat.color}
              />
            ))}
          </div>

          {/* 검색 */}
          <div className="relative">
            <svg viewBox="0 0 20 20" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-foreground-faint" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="9" cy="9" r="6" />
              <path d="M14 14l3 3" strokeLinecap="round" />
            </svg>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="제목 · 저자 · 태그 검색"
              className="w-full pl-10 pr-4 py-2.5 bg-surface border border-line text-sm placeholder:text-foreground-faint focus:border-foreground focus:outline-none transition-colors"
            />
          </div>
        </section>

        {/* ── 그리드 ── */}
        <section>
          <div className="flex items-baseline justify-between border-b border-line pb-3">
            <h2 className="text-base font-normal">스터디 보관함</h2>
            <p className="text-xs text-foreground-faint tabular-nums">
              {filtered.length}건
            </p>
          </div>

          {filtered.length === 0 ? (
            <EmptyRow message="조건에 맞는 자료가 없습니다." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 border-l border-line">
              {pageItems.map((item) => (
                <ReadingCard
                  key={item.id}
                  item={item}
                  categories={categories}
                  noteCount={studyNotes.filter((n) => n.readingId === item.id).length}
                  onClick={() => setSelectedReading(item)}
                />
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <nav className="mt-6 flex items-center justify-between">
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

      {/* 상세 (모디 ReadingDetailView 그대로 — Tiptap 통합) */}
      {selectedReading && (
        <ReadingDetailView
          reading={selectedReading}
          studyNotes={notesForSelected}
          categories={categories}
          onClose={() => setSelectedReading(null)}
          onUpdateReading={(updated: ReadingItem) => updateReading(updated.id, updated)}
          onDeleteReading={(id: string) => { removeReading(id); setSelectedReading(null); }}
          onAddNote={addNote}
          onUpdateNote={(note: StudyNote) => updateNote(note.id, note)}
          onDeleteNote={removeNote}
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

/* ─── 독서 카드 ─── */

function ReadingCard({
  item,
  categories,
  noteCount,
  onClick,
}: {
  item: ReadingItem;
  categories: ReadingCategory[];
  noteCount: number;
  onClick: () => void;
}) {
  const cat = categories.find((c) => c.id === item.category);
  const cc = cat ? getBadgeColors(cat.color) : null;
  const progress = calcReadingProgress(item);
  const pLabel = progressLabel(item);
  const statusLabel = item.status === 'reading' ? '읽는 중' : item.status === 'completed' ? '완독' : '예정';

  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left border-r border-b border-line p-5 hover:bg-surface-muted transition-colors"
    >
      <div className="flex items-start gap-4">
        {/* 표지 — 도서는 세로형, 강좌는 정방형 */}
        <div className={`bg-surface-muted flex items-center justify-center shrink-0 overflow-hidden ${
          item.category === 'rcat-course' ? 'w-16 h-16' : 'w-14 h-20'
        }`}>
          {item.coverImage
            ? <img src={item.coverImage} alt={item.title} className="w-full h-full object-cover" />
            : <span className="text-2xl">{item.coverEmoji}</span>}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[10px] tracking-[0.18em] uppercase text-foreground-faint">
            {statusLabel}
          </p>
          <h3 className="mt-1 text-sm font-normal leading-snug line-clamp-2">
            {item.title}
          </h3>
          {item.author && (
            <p className="mt-1 text-xs text-foreground-muted truncate">{item.author}</p>
          )}
          {cat && cc && (
            <span
              className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-medium px-1.5 py-0.5 leading-none"
              style={{ backgroundColor: cc.bg, color: cc.text }}
            >
              <span className="w-1.5 h-1.5 shrink-0" style={{ backgroundColor: cc.dot }} aria-hidden />
              {cat.label}
            </span>
          )}
        </div>
      </div>

      {/* 진행률 */}
      {pLabel && (
        <div className="mt-4">
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-[10px] tracking-[0.18em] uppercase text-foreground-faint">
              Progress
            </span>
            <span className="text-xs tabular-nums text-foreground">
              {pLabel}
              <span className="text-foreground-faint ml-1">({progress}%)</span>
            </span>
          </div>
          <div className="h-px bg-line relative">
            <div
              className="absolute inset-y-0 left-0 bg-primary-500"
              style={{ width: `${progress}%`, height: '1px' }}
            />
          </div>
        </div>
      )}

      {/* 메타 */}
      <div className="mt-4 flex items-baseline justify-between text-[10px] text-foreground-faint">
        <span className="tabular-nums">
          {item.startDate && item.startDate.slice(5).replace('-', '/')}
          {item.completedDate && ` → ${item.completedDate.slice(5).replace('-', '/')}`}
        </span>
        {noteCount > 0 && (
          <span>노트 {noteCount}</span>
        )}
      </div>
    </button>
  );
}

/* ─── 추가 폼 ─── */

interface AddFormProps {
  mode: 'search' | 'manual';
  form: {
    title: string; author: string; category: string;
    coverEmoji: string; coverImage: string;
    startDate: string; totalPages: string; totalLessons: string;
    tagInput: string; tags: string[]; link: string;
    price: string; isbn13: string; chapters: string[];
  };
  setForm: React.Dispatch<React.SetStateAction<AddFormProps['form']>>;
  categories: ReadingCategory[];
  aladinQuery: string;
  setAladinQuery: (v: string) => void;
  aladinResults: AladinSearchItem[];
  aladinLoading: boolean;
  aladinError: string;
  aladinSelected: boolean;
  tocLoading: boolean;
  onAladinSearch: () => void;
  onAladinSelect: (item: AladinSearchItem) => void;
  onGenerateToc: () => void;
  onAddTag: () => void;
  onCancel: () => void;
  onSubmit: () => void;
}

function AddForm({
  mode, form, setForm, categories,
  aladinQuery, setAladinQuery, aladinResults, aladinLoading, aladinError, aladinSelected,
  tocLoading,
  onAladinSearch, onAladinSelect, onGenerateToc, onAddTag, onCancel, onSubmit,
}: AddFormProps) {
  const isBook = form.category === 'rcat-book';
  const isCourse = form.category === 'rcat-course';

  return (
    <section className="border border-line p-6 sm:p-8 space-y-6 bg-surface">
      <p className="label">{mode === 'search' ? 'Aladin Search' : 'New Entry'}</p>

      {/* 종류 */}
      <div className="space-y-2">
        <p className="label">종류</p>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => {
            const active = form.category === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setForm({ ...form, category: cat.id })}
                className={`inline-flex items-center gap-2 px-4 py-1.5 text-xs border transition-colors ${
                  active
                    ? 'bg-foreground text-surface border-foreground'
                    : 'bg-surface text-foreground-muted border-line hover:border-foreground hover:text-foreground'
                }`}
              >
                <span className="w-1.5 h-1.5 shrink-0" style={{ backgroundColor: cat.color }} aria-hidden />
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 알라딘 검색 (search 모드 + book일 때만) */}
      {mode === 'search' && isBook && !aladinSelected && (
        <div className="space-y-3">
          <label className="block space-y-2">
            <span className="label">알라딘 도서 검색</span>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="책 제목 입력 후 Enter"
                value={aladinQuery}
                onChange={(e) => setAladinQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    onAladinSearch();
                  }
                }}
                className="flex-1 border border-line bg-surface px-4 py-2.5 text-sm placeholder:text-foreground-faint focus:border-foreground focus:outline-none transition-colors"
              />
              <button
                type="button"
                onClick={onAladinSearch}
                disabled={aladinLoading || !aladinQuery.trim()}
                className="border border-foreground bg-foreground px-5 py-2.5 text-sm text-surface hover:bg-foreground-muted hover:border-foreground-muted disabled:opacity-40 transition-colors"
              >
                {aladinLoading ? '검색 중…' : '검색'}
              </button>
            </div>
          </label>
          {aladinError && (
            <p className="text-xs text-primary-500">{aladinError}</p>
          )}
          {aladinResults.length > 0 && (
            <ul className="divide-y divide-line border border-line">
              {aladinResults.map((item) => (
                <li key={item.isbn13}>
                  <button
                    type="button"
                    onClick={() => onAladinSelect(item)}
                    className="w-full text-left flex items-start gap-3 p-3 hover:bg-surface-muted transition-colors"
                  >
                    {item.cover ? (
                      <img src={item.cover} alt={item.title} className="w-12 h-16 object-cover shrink-0" />
                    ) : (
                      <div className="w-12 h-16 bg-surface-muted shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{item.title.replace(/ - .*$/, '')}</p>
                      <p className="text-xs text-foreground-muted truncate mt-0.5">
                        {item.author.replace(/ \(지은이\).*$/, '')}
                      </p>
                      <p className="text-[10px] text-foreground-faint mt-1 truncate">
                        {item.publisher} · {item.pubDate}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* 제목 / 저자 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="block space-y-2">
          <span className="label">제목</span>
          <input
            type="text"
            placeholder={isBook ? '책 제목' : isCourse ? '강좌 제목' : '제목'}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full border border-line bg-surface px-4 py-3 text-base placeholder:text-foreground-faint focus:border-foreground focus:outline-none transition-colors"
          />
        </label>
        <label className="block space-y-2">
          <span className="label">{isCourse ? '강사' : '저자'}</span>
          <input
            type="text"
            placeholder={isCourse ? '강사 이름' : '저자 이름'}
            value={form.author}
            onChange={(e) => setForm({ ...form, author: e.target.value })}
            className="w-full border border-line bg-surface px-4 py-3 text-sm placeholder:text-foreground-faint focus:border-foreground focus:outline-none transition-colors"
          />
        </label>
      </div>

      {/* 시작일 / 분량 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <label className="block space-y-2">
          <span className="label">시작일</span>
          <input
            type="date"
            value={form.startDate}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            className="w-full border border-line bg-surface px-3 py-2.5 text-sm focus:border-foreground focus:outline-none transition-colors"
          />
        </label>
        {!isCourse && (
          <label className="block space-y-2">
            <span className="label">총 페이지</span>
            <input
              type="number"
              placeholder="320"
              value={form.totalPages}
              onChange={(e) => setForm({ ...form, totalPages: e.target.value })}
              className="w-full border border-line bg-surface px-3 py-2.5 text-sm placeholder:text-foreground-faint focus:border-foreground focus:outline-none transition-colors"
            />
          </label>
        )}
        {isCourse && (
          <label className="block space-y-2">
            <span className="label">총 회차</span>
            <input
              type="number"
              placeholder="20"
              value={form.totalLessons}
              onChange={(e) => setForm({ ...form, totalLessons: e.target.value })}
              className="w-full border border-line bg-surface px-3 py-2.5 text-sm placeholder:text-foreground-faint focus:border-foreground focus:outline-none transition-colors"
            />
          </label>
        )}
        <label className="block space-y-2">
          <span className="label">외부 링크</span>
          <input
            type="url"
            placeholder="https://..."
            value={form.link}
            onChange={(e) => setForm({ ...form, link: e.target.value })}
            className="w-full border border-line bg-surface px-3 py-2.5 text-sm placeholder:text-foreground-faint focus:border-foreground focus:outline-none transition-colors"
          />
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

      {/* 목차 (도서만) */}
      {isBook && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="label">
              목차
              {form.chapters.length > 0 && (
                <span className="ml-2 text-foreground"> · {form.chapters.length}개</span>
              )}
            </p>
            <button
              type="button"
              onClick={onGenerateToc}
              disabled={tocLoading || !form.title.trim()}
              className="text-[11px] text-foreground-muted hover:text-foreground border border-line-strong hover:border-foreground px-2.5 py-1 transition-colors disabled:opacity-40"
            >
              {tocLoading ? '생성 중…' : 'AI 목차 생성'}
            </button>
          </div>
          <textarea
            placeholder={'한 줄에 한 챕터씩\n0-1 프롤로그\n1-1 첫 소제목\n1-2 두 번째 소제목'}
            value={form.chapters.join('\n')}
            onChange={(e) => setForm({ ...form, chapters: e.target.value.split('\n').filter((line) => line.trim()) })}
            rows={5}
            className="w-full border border-line bg-surface px-4 py-3 text-sm placeholder:text-foreground-faint focus:border-foreground focus:outline-none transition-colors resize-y"
          />
        </div>
      )}

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
          추가
        </button>
      </div>
    </section>
  );
}
