/**
 * @file src/pages/InsightsPage.tsx
 * @description 인사이트 페이지
 * - 태그별 필터/그룹화 + 태그 관리
 * - 출처 선택 (AI 프로필 + 유튜브/웹/책/내생각 + 커스텀)
 * - 링크, 프로젝트, 중요도 필드
 * - 검색, 필터 드롭다운, 선택 모드 (일괄 삭제)
 * - 아이템 클릭 시 ItemDetailPopup 오픈
 */
import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { InsightItem, InsightSource } from '../types';
import { useInsights } from '../hooks/useInsights';
import { useProjects } from '../hooks/useProjects';
import { useInsightSources } from '../hooks/useInsightSources';
import { ItemDetailPopup } from '../components/ItemDetailPopup';
import { ProjectSelect } from '../components/ProjectSelect';
import { useTheme } from '../contexts/ThemeContext';
import { InsightsPageModern } from './InsightsPage.modern';

const isImagePath = (v: string) => v.startsWith('/') || v.startsWith('http');

function renderSourceImg(image: string, label: string, size = 'w-4 h-4') {
  if (isImagePath(image)) {
    return <img src={image} alt={label} className={`${size} rounded-full object-cover`} />;
  }
  return <span className={`${size} flex items-center justify-center text-sm leading-none`}>{image}</span>;
}

function renderSourceBadge(sourceId: string, sources: InsightSource[]) {
  const src = sources.find((s) => s.id === sourceId);
  if (!src) return <span className="text-xs text-gray-400">{sourceId}</span>;

  return (
    <span className="inline-flex items-center gap-1">
      {renderSourceImg(src.image, src.label)}
      <span className="text-xs text-gray-500">{src.label}</span>
    </span>
  );
}

const priorityBadge: Record<string, { label: string; cls: string }> = {
  high:   { label: '높음', cls: 'bg-red-100 text-red-600' },
  medium: { label: '보통', cls: 'bg-amber-100 text-amber-600' },
  low:    { label: '낮음', cls: 'bg-gray-100 text-gray-500' },
};

const priorityWeight: Record<string, number> = { high: 0, medium: 1, low: 2 };

const defaultPresetTags = ['트렌드', 'AI', '마케팅', '개발', '아이디어', '전략'];

export function InsightsPage() {
  const { theme } = useTheme();
  if (theme === 'modern') {
    return <InsightsPageModern />;
  }
  return <InsightsPageModi />;
}

function InsightsPageModi() {
  const { insights, add: addInsight, update: updateInsight, remove: removeInsight } = useInsights();
  const { projects } = useProjects();
  const projectColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    projects.forEach((p) => { map[p.name] = p.color; });
    return map;
  }, [projects]);
  const { sources: insightSources, setSources: setInsightSources, addSource: addInsightSource, removeSource: removeInsightSource } = useInsightSources();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: '', content: '', source: '',
    link: '', project: '', priority: 'medium' as InsightItem['priority'],
    date: new Date().toISOString().slice(0, 10),
    time: new Date().toTimeString().slice(0, 5),
    tagInput: '', tags: [] as string[],
  });
  const [selectedItem, setSelectedItem] = useState<InsightItem | null>(null);

  // 태그 필터/그룹화
  const [activeTag, setActiveTag] = useState<string>('all');
  const [presetTags] = useState<string[]>(defaultPresetTags);

  // 검색 + 필터 + 정렬 + 선택 모드
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [sortMode, setSortMode] = useState<'date' | 'name' | 'priority'>('date');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 필터 드롭다운 외부 클릭 닫기
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setShowFilterDropdown(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // 모든 태그 수집 (프리셋 + 인사이트에서 발견된 태그)
  const allTags = useMemo(() => {
    const tagSet = new Set(presetTags);
    insights.forEach((i) => i.tags.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet);
  }, [insights, presetTags]);

  // 고유 프로젝트 이름
  const projectNames = useMemo(() => {
    const names = new Set(insights.map((i) => i.project).filter(Boolean) as string[]);
    return Array.from(names);
  }, [insights]);

  // 고유 출처 목록
  const uniqueSources = useMemo(() => {
    const srcIds = new Set(insights.map((i) => i.source).filter(Boolean));
    return Array.from(srcIds);
  }, [insights]);

  const hasActiveFilter = projectFilter !== 'all' || sourceFilter !== 'all' || priorityFilter !== 'all';

  // 검색 + 필터 + 정렬 파이프라인 (태그 필터 전에 적용)
  const searchAndFilteredInsights = useMemo(() => {
    let result = [...insights];

    // 1. 검색 필터
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((i) => {
        if (i.title.toLowerCase().includes(q)) return true;
        if (i.content.toLowerCase().includes(q)) return true;
        if (i.tags.some((tag) => tag.toLowerCase().includes(q))) return true;
        if (i.project?.toLowerCase().includes(q)) return true;
        return false;
      });
    }

    // 2. 프로젝트 필터
    if (projectFilter !== 'all') {
      result = result.filter((i) => i.project === projectFilter);
    }

    // 3. 출처 필터
    if (sourceFilter !== 'all') {
      result = result.filter((i) => i.source === sourceFilter);
    }

    // 4. 중요도 필터
    if (priorityFilter !== 'all') {
      result = result.filter((i) => i.priority === priorityFilter);
    }

    // 5. 정렬
    result.sort((a, b) => {
      if (sortMode === 'date') {
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      }
      if (sortMode === 'name') {
        return a.title.localeCompare(b.title, 'ko', { numeric: true });
      }
      if (sortMode === 'priority') {
        return (priorityWeight[a.priority || 'medium'] ?? 1) - (priorityWeight[b.priority || 'medium'] ?? 1);
      }
      return 0;
    });

    return result;
  }, [insights, searchQuery, projectFilter, sourceFilter, priorityFilter, sortMode]);

  // 태그별 필터된 인사이트 (검색/필터 적용 후)
  const filteredInsights = useMemo(() => {
    if (activeTag === 'all') return searchAndFilteredInsights;
    return searchAndFilteredInsights.filter((i) => i.tags.includes(activeTag));
  }, [searchAndFilteredInsights, activeTag]);

  // 태그별 그룹화 (activeTag === 'all'일 때 사용)
  const groupedByTag = useMemo(() => {
    if (activeTag !== 'all') return null;
    const groups: { tag: string; items: InsightItem[] }[] = [];
    const assigned = new Set<string>();

    // 프리셋 태그 순서대로 그룹 생성
    for (const tag of allTags) {
      const items = searchAndFilteredInsights.filter((i) => i.tags.includes(tag));
      if (items.length > 0) {
        groups.push({ tag, items });
        items.forEach((i) => assigned.add(i.id));
      }
    }

    // 태그 없는 아이템
    const untagged = searchAndFilteredInsights.filter((i) => !assigned.has(i.id));
    if (untagged.length > 0) {
      groups.push({ tag: '태그 없음', items: untagged });
    }

    return groups;
  }, [searchAndFilteredInsights, allTags, activeTag]);

  const handleAddTag = () => {
    const tag = form.tagInput.trim();
    if (tag && !form.tags.includes(tag)) {
      setForm({ ...form, tags: [...form.tags, tag], tagInput: '' });
    }
  };

  const handleAdd = () => {
    if (!form.title.trim()) return;
    addInsight({
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
    setShowForm(false);
  };

  const handlePopupSave = (updated: InsightItem) => {
    updateInsight(updated.id, updated);
    setSelectedItem(null);
  };

  const handlePopupDelete = (id: string) => {
    removeInsight(id);
    setSelectedItem(null);
  };

  // 선택 모드 토글
  const toggleSelectMode = useCallback(() => {
    setSelectMode((prev) => {
      if (prev) {
        setSelectedIds(new Set());
      }
      return !prev;
    });
  }, []);

  // 아이템 선택 토글
  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // 전체 선택/해제
  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredInsights.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredInsights.map((i) => i.id)));
    }
  }, [selectedIds.size, filteredInsights]);

  // 일괄 삭제
  const handleBulkDelete = useCallback(async () => {
    if (!window.confirm(`${selectedIds.size}개 인사이트를 삭제하시겠습니까?`)) return;
    for (const id of selectedIds) {
      await removeInsight(id);
    }
    setSelectMode(false);
    setSelectedIds(new Set());
  }, [selectedIds, removeInsight]);

  // 출처 라벨 가져오기
  const getSourceLabel = (sourceId: string) => {
    const src = insightSources.find((s) => s.id === sourceId);
    return src?.label || sourceId;
  };

  const renderCard = (item: InsightItem) => (
    <div key={item.id}
      onClick={() => {
        if (selectMode) {
          handleToggleSelect(item.id);
        } else {
          setSelectedItem(item);
        }
      }}
      className={`bg-white rounded-2xl p-5 shadow-soft hover:shadow-hover transition-all duration-300 flex flex-col cursor-pointer relative ${
        selectMode && selectedIds.has(item.id) ? 'ring-2 ring-amber-400' : ''
      }`}>
      {/* 선택 모드 체크박스 오버레이 */}
      {selectMode && (
        <div className="absolute top-3 right-3 z-10">
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
            selectedIds.has(item.id)
              ? 'bg-amber-500 border-amber-500'
              : 'border-gray-300 bg-white'
          }`}>
            {selectedIds.has(item.id) && (
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 6l3 3 5-5" />
              </svg>
            )}
          </div>
        </div>
      )}
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-bold text-gray-800 text-sm flex-1">{item.title}</h3>
        {item.priority && !selectMode && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ml-2 flex-shrink-0 ${priorityBadge[item.priority]?.cls || ''}`}>
            {priorityBadge[item.priority]?.label}
          </span>
        )}
      </div>
      <div className="text-xs text-gray-600 flex-1 leading-relaxed line-clamp-3 markdown-body">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.content}</ReactMarkdown>
      </div>
      <div className="mt-3 pt-3 border-t border-gray-100">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          {renderSourceBadge(item.source, insightSources)}
          <span className="text-xs text-gray-300">·</span>
          <span className="text-xs text-gray-400">{item.createdAt}</span>
          {item.project && (
            <>
              <span className="text-xs text-gray-300">·</span>
              <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600">
                {projectColorMap[item.project] && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: projectColorMap[item.project] }} />}
                {item.project}
              </span>
            </>
          )}
          {item.link && (
            <a href={item.link} target="_blank" rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-600 hover:bg-amber-200 transition-colors font-medium">
              바로가기 &rarr;
            </a>
          )}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {item.tags.map((tag) => (
            <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">{tag}</span>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-full bg-[#fffef5] p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <img src="/images/insight.png" alt="인사이트" className="w-6 h-6 object-contain" />
            인사이트
          </h1>
          <button
            onClick={() => { if (!showForm) setForm((f) => ({ ...f, date: new Date().toISOString().slice(0, 10), time: new Date().toTimeString().slice(0, 5) })); setShowForm(!showForm); }}
            className="px-2.5 py-1 text-xs font-medium text-amber-600 bg-white rounded-lg shadow-soft hover:shadow-hover transition-all"
          >
            + 추가
          </button>
        </div>

        {/* 추가 폼 */}
        {showForm && (
          <div className="bg-white rounded-2xl p-4 shadow-soft space-y-5">
            {/* 제목 */}
            <div>
              <label className="text-sm font-medium text-gray-600 block mb-1.5">제목</label>
              <input
                type="text" placeholder="인사이트 제목" value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
              />
            </div>
            {/* 내용 */}
            <div>
              <label className="text-sm font-medium text-gray-600 block mb-1.5">내용</label>
              <textarea
                placeholder="내용을 입력하세요" value={form.content} rows={3}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-200"
              />
            </div>

            {/* 출처 선택 */}
            <div>
              <label className="text-sm font-medium text-gray-600 block mb-1.5">출처</label>
              <div className="flex flex-wrap gap-1.5">
                {insightSources.map((src) => (
                  <button key={src.id}
                    onClick={() => setForm({ ...form, source: form.source === src.id ? '' : src.id })}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                      form.source === src.id ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-300' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}>
                    {renderSourceImg(src.image, src.label, 'w-3.5 h-3.5')}
                    {src.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 링크 */}
            <div>
              <label className="text-sm font-medium text-gray-600 block mb-1.5">링크 (선택)</label>
              <input type="url" placeholder="https://" value={form.link}
                onChange={(e) => setForm({ ...form, link: e.target.value })}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-200" />
            </div>

            {/* 프로젝트 */}
            <div>
              <label className="text-sm font-medium text-gray-600 block mb-1.5">프로젝트</label>
              <ProjectSelect value={form.project} onChange={(v) => setForm({ ...form, project: v })} placeholder="선택 안함" />
            </div>

            {/* 기록일 + 시간 + 중요도 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="text-sm font-medium text-gray-600 block mb-1.5">기록일</label>
                <input type="date" value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full px-2 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-200" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 block mb-1.5">시간</label>
                <input type="time" value={form.time}
                  onChange={(e) => setForm({ ...form, time: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-200" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 block mb-1.5">중요도</label>
                <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as InsightItem['priority'] })}
                  className="w-full px-2 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-200">
                  <option value="high">높음</option>
                  <option value="medium">보통</option>
                  <option value="low">낮음</option>
                </select>
              </div>
            </div>

            {/* 태그 - 프리셋 빠른 추가 + 직접 입력 */}
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">태그</label>
              <div className="flex flex-wrap gap-1 mb-2">
                {presetTags.map((pt) => (
                  <button key={pt}
                    onClick={() => {
                      if (!form.tags.includes(pt)) setForm({ ...form, tags: [...form.tags, pt] });
                    }}
                    className={`px-2 py-0.5 rounded-full text-xs transition-all ${
                      form.tags.includes(pt) ? 'bg-amber-200 text-amber-800 font-medium' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}>
                    #{pt}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 items-center flex-wrap">
                <input
                  type="text" placeholder="직접 입력 후 Enter" value={form.tagInput}
                  onChange={(e) => setForm({ ...form, tagInput: e.target.value })}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); handleAddTag(); } }}
                  className="flex-1 min-w-[140px] px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
                />
                {form.tags.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-full">
                    #{t}
                    <button onClick={() => setForm({ ...form, tags: form.tags.filter((tt) => tt !== t) })}
                      className="text-amber-400 hover:text-amber-600">x</button>
                  </span>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg">취소</button>
              <button onClick={handleAdd} className="px-4 py-2 text-sm text-white bg-amber-500 hover:bg-amber-600 rounded-lg font-medium">추가</button>
            </div>
          </div>
        )}

        {/* 태그 필터 바 */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setActiveTag('all')}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
              activeTag === 'all' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}>
            전체
          </button>
          {allTags.map((tag) => {
            const count = insights.filter((i) => i.tags.includes(tag)).length;
            if (count === 0) return null;
            return (
              <button key={tag}
                onClick={() => setActiveTag(activeTag === tag ? 'all' : tag)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                  activeTag === tag ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}>
                #{tag}
                <span className="ml-1 opacity-70">{count}</span>
              </button>
            );
          })}
        </div>

        {/* 필터/선택 + 검색 */}
        <div className="space-y-1.5">
        <div className="flex items-center justify-end gap-2">
          {/* 필터 */}
          <div ref={filterRef} className="relative">
            <button
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className={`px-2.5 py-1 text-xs rounded-lg shadow-soft hover:shadow-hover transition-all flex items-center gap-1 ${
                hasActiveFilter ? 'text-amber-700 bg-amber-50 font-medium' : 'text-gray-600 bg-white'
              }`}
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="2" y1="4" x2="14" y2="4" /><line x1="4" y1="8" x2="12" y2="8" /><line x1="6" y1="12" x2="10" y2="12" /></svg>
              필터
            </button>
            {showFilterDropdown && (
              <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-100 p-4 z-20 min-w-[220px] space-y-3">
                {/* 프로젝트별 */}
                <div>
                  <label className="text-xs text-gray-500 font-medium mb-1.5 block">프로젝트별</label>
                  <div className="flex flex-wrap gap-1.5">
                    <button onClick={() => setProjectFilter('all')} className={`px-2.5 py-1 text-xs rounded-full transition-all ${projectFilter === 'all' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>전체</button>
                    {projectNames.map((name) => (
                      <button key={name} onClick={() => setProjectFilter(projectFilter === name ? 'all' : name)} className={`px-2.5 py-1 text-xs rounded-full transition-all ${projectFilter === name ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{name}</button>
                    ))}
                  </div>
                </div>
                {/* 출처별 */}
                <div>
                  <label className="text-xs text-gray-500 font-medium mb-1.5 block">출처별</label>
                  <div className="flex flex-wrap gap-1.5">
                    <button onClick={() => setSourceFilter('all')} className={`px-2.5 py-1 text-xs rounded-full transition-all ${sourceFilter === 'all' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>전체</button>
                    {uniqueSources.map((srcId) => (
                      <button key={srcId} onClick={() => setSourceFilter(sourceFilter === srcId ? 'all' : srcId)} className={`px-2.5 py-1 text-xs rounded-full transition-all ${sourceFilter === srcId ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{getSourceLabel(srcId)}</button>
                    ))}
                  </div>
                </div>
                {/* 우선순위별 */}
                <div>
                  <label className="text-xs text-gray-500 font-medium mb-1.5 block">우선순위별</label>
                  <div className="flex flex-wrap gap-1.5">
                    <button onClick={() => setPriorityFilter('all')} className={`px-2.5 py-1 text-xs rounded-full transition-all ${priorityFilter === 'all' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>전체</button>
                    {(['high', 'medium', 'low'] as const).map((p) => (
                      <button key={p} onClick={() => setPriorityFilter(priorityFilter === p ? 'all' : p)} className={`px-2.5 py-1 text-xs rounded-full transition-all ${priorityFilter === p ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{priorityBadge[p].label}</button>
                    ))}
                  </div>
                </div>
                {/* 정렬 */}
                <div>
                  <label className="text-xs text-gray-500 font-medium mb-1.5 block">정렬</label>
                  <div className="flex flex-wrap gap-1.5">
                    {([['date', '날짜순'], ['name', '이름순'], ['priority', '우선순위순']] as const).map(([key, label]) => (
                      <button key={key} onClick={() => setSortMode(key)} className={`px-2.5 py-1 text-xs rounded-full transition-all ${sortMode === key ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{label}</button>
                    ))}
                  </div>
                </div>
                {hasActiveFilter && (
                  <button onClick={() => { setProjectFilter('all'); setSourceFilter('all'); setPriorityFilter('all'); }} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">필터 초기화</button>
                )}
              </div>
            )}
          </div>

          {/* 선택 / 취소 */}
          <button
            onClick={toggleSelectMode}
            className={`px-2.5 py-1 text-xs rounded-lg shadow-soft hover:shadow-hover transition-all ${
              selectMode ? 'text-white bg-amber-500 font-medium' : 'text-gray-600 bg-white'
            }`}
          >
            {selectMode ? '취소' : '선택'}
          </button>
        </div>
        <div className="relative">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" className="absolute left-3 top-1/2 -translate-y-1/2">
            <circle cx="7" cy="7" r="5" /><line x1="11" y1="11" x2="14" y2="14" />
          </svg>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="제목, 내용, 태그 검색"
            className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 shadow-soft"
          />
        </div>
        </div>

        {/* 선택 모드 액션 바 */}
        {selectMode && (
          <div className="bg-amber-50 rounded-lg px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={handleSelectAll}
                className="text-xs text-amber-700 hover:text-amber-800 font-medium bg-white/70 px-2.5 py-1 rounded-lg"
              >
                {selectedIds.size === filteredInsights.length ? '전체 해제' : '전체 선택'}
              </button>
              <span className="text-xs text-amber-700 font-medium">{selectedIds.size}건 선택</span>
            </div>
            <button
              onClick={handleBulkDelete}
              disabled={selectedIds.size === 0}
              className="px-3 py-1.5 text-xs font-medium text-red-600 bg-white border border-red-200 hover:bg-red-50 rounded-lg transition-all disabled:opacity-40"
            >
              삭제
            </button>
          </div>
        )}

        {/* 카드 영역 */}
        {activeTag !== 'all' ? (
          /* 특정 태그 필터 - 플랫 그리드 */
          <div>
            <h2 className="text-sm font-semibold text-amber-700 mb-3 flex items-center gap-1.5">
              #{activeTag}
              <span className="text-xs text-amber-500 font-normal">({filteredInsights.length})</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredInsights.map(renderCard)}
            </div>
            {filteredInsights.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">해당 태그의 인사이트가 없습니다</p>
            )}
          </div>
        ) : groupedByTag && groupedByTag.length > 0 ? (
          /* 전체 - 태그별 그룹 */
          <div className="space-y-6">
            {groupedByTag.map(({ tag, items }) => (
              <div key={tag}>
                <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  {tag === '태그 없음' ? tag : `#${tag}`}
                  <span className="text-xs text-gray-400 font-normal">({items.length})</span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map(renderCard)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-8">인사이트가 없습니다</p>
        )}
      </div>

      {/* 상세 팝업 */}
      {selectedItem && (
        <ItemDetailPopup
          type="insight"
          item={selectedItem}
          insightSources={insightSources}
          onInsightSourcesChange={(next) => {
            // 추가 감지: next에만 있는 항목
            const added = next.filter((n) => !insightSources.some((s) => s.id === n.id));
            added.forEach((s) => addInsightSource(s));
            // 삭제 감지: insightSources에만 있는 항목
            const removed = insightSources.filter((s) => !next.some((n) => n.id === s.id));
            removed.forEach((s) => removeInsightSource(s.id));
            setInsightSources(next);
          }}
          onSave={(updated) => handlePopupSave(updated as InsightItem)}
          onDelete={handlePopupDelete}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
}
