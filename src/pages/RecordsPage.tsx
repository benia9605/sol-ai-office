/**
 * @file src/pages/RecordsPage.tsx
 * @description 기록 페이지
 * - 캘린더 뷰: 월별 달력에서 기록 도트 확인, 날짜 필터링
 * - 필터 탭: SVG 아이콘 핑크 테마
 * - 검색 + 프로젝트 필터 + 선택 모드
 * - 타임라인: 핑크 테마 유지, 타입별 도트 색상 분기
 * - +추가 → RecordTypeSelector → RecordForm
 * - 카드 클릭 → RecordDetailView
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { RecordItem, RecordType } from '../types';
import { useRecords } from '../hooks/useRecords';
import { useProjects } from '../hooks/useProjects';
import { recordTypeConfig } from '../utils/recordTemplates';
import { RecordTypeSelector } from '../components/records/RecordTypeSelector';
import { RecordForm } from '../components/records/RecordForm';
import { RecordDetailView } from '../components/records/RecordDetailView';
import { EnergyGauge } from '../components/records/EnergySelector';
import { RecordCalendar } from '../components/records/RecordCalendar';

type FilterTab = 'all' | RecordType;

/** 필터 탭 SVG 아이콘 (핑크 계열) */
const TabIcon = ({ id, active }: { id: FilterTab; active: boolean }) => {
  const stroke = active ? 'white' : '#ec4899';
  const props = { width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none', stroke, strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

  switch (id) {
    case 'all':
      return (
        <svg {...props}>
          <rect x="2" y="2" width="5" height="5" rx="1" />
          <rect x="9" y="2" width="5" height="5" rx="1" />
          <rect x="2" y="9" width="5" height="5" rx="1" />
          <rect x="9" y="9" width="5" height="5" rx="1" />
        </svg>
      );
    case 'morning':
      return (
        <svg {...props}>
          <path d="M8 2v2" />
          <path d="M3.5 3.5l1.4 1.4" />
          <path d="M2 8h2" />
          <path d="M12 8h2" />
          <path d="M12.5 3.5l-1.4 1.4" />
          <path d="M4 12h8" />
          <circle cx="8" cy="8" r="3" />
        </svg>
      );
    case 'evening':
      return (
        <svg {...props}>
          <path d="M13.5 8.5a5.5 5.5 0 01-7.5-7.5 6.5 6.5 0 107.5 7.5z" />
          <circle cx="10" cy="4" r="0.5" fill={stroke} stroke="none" />
          <circle cx="12" cy="6.5" r="0.5" fill={stroke} stroke="none" />
        </svg>
      );
    case 'weekly':
      return (
        <svg {...props}>
          <path d="M2 8a6 6 0 0110.5-4" />
          <path d="M14 8a6 6 0 01-10.5 4" />
          <path d="M11 2l1.5 2L14 2" />
          <path d="M5 14l-1.5-2L2 14" />
        </svg>
      );
    case 'memo':
      return (
        <svg {...props}>
          <path d="M12 2l2 2-8 8H4v-2l8-8z" />
          <path d="M4 14h8" />
        </svg>
      );
  }
};

const tabs: { id: FilterTab; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'morning', label: '아침' },
  { id: 'evening', label: '저녁' },
  { id: 'weekly', label: '주간' },
  { id: 'memo', label: '메모' },
];

export function RecordsPage() {
  const { records, loading, add: addRecord, update: updateRecord, remove: removeRecord } = useRecords();
  const { projects } = useProjects();
  const [filter, setFilter] = useState<FilterTab>('all');
  const [showCalendar, setShowCalendar] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showSelector, setShowSelector] = useState(false);
  const [formType, setFormType] = useState<RecordType | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<RecordItem | null>(null);

  // 검색, 필터, 선택 모드
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 필터 드롭다운 외부 클릭 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setShowFilterDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 타입 필터 → 날짜 필터 → 검색 → 프로젝트 필터
  const byType = filter === 'all' ? records : records.filter((r) => r.recordType === filter);
  const byDate = selectedDate ? byType.filter((r) => r.date === selectedDate) : byType;

  const bySearch = searchQuery.trim()
    ? byDate.filter((r) => {
        const q = searchQuery.trim().toLowerCase();
        const titleMatch = r.title?.toLowerCase().includes(q);
        const tagMatch = r.tags?.some((t) => t.toLowerCase().includes(q));
        const projectMatch = r.project?.toLowerCase().includes(q);
        return titleMatch || tagMatch || projectMatch;
      })
    : byDate;

  const byProject = projectFilter === 'all' ? bySearch : bySearch.filter((r) => r.project === projectFilter);

  const sorted = [...byProject].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleSelectType = (type: RecordType) => {
    setShowSelector(false);
    setFormType(type);
  };

  const handleAdd = (data: Omit<RecordItem, 'id' | 'createdAt'> & { id?: string }) => {
    addRecord(data);
    setFormType(null);
  };

  const handleUpdate = (updated: RecordItem) => {
    updateRecord(updated.id, updated);
    setSelectedRecord(null);
  };

  const handleDelete = (id: string) => {
    removeRecord(id);
    setSelectedRecord(null);
  };

  const toggleSelectMode = useCallback(() => {
    setSelectMode((prev) => !prev);
    setSelectedIds(new Set());
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === sorted.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sorted.map((r) => r.id)));
    }
  }, [sorted, selectedIds.size]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    const ok = window.confirm(`${selectedIds.size}건의 기록을 삭제하시겠습니까?`);
    if (!ok) return;
    for (const id of selectedIds) {
      await removeRecord(id);
    }
    setSelectedIds(new Set());
    setSelectMode(false);
  }, [selectedIds, removeRecord]);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // 로딩 상태
  if (loading) return (
    <div className="min-h-full bg-[#fff5f7] p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto flex items-center justify-center py-20">
        <span className="text-sm text-gray-400">불러오는 중...</span>
      </div>
    </div>
  );

  // 프로젝트 목록 (필터 드롭다운용)
  const usedProjects = Array.from(new Set(records.map((r) => r.project).filter(Boolean))) as string[];

  return (
    <div className="min-h-full bg-[#fff5f7] p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <img src="/images/diary.png" alt="기록" className="w-6 h-6 object-contain" />
            기록
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCalendar(!showCalendar)}
              className={`px-2.5 py-1 text-xs rounded-lg transition-all flex items-center gap-0.5 ${
                showCalendar ? 'bg-pink-500 text-white shadow-sm font-medium' : 'bg-white text-pink-500 shadow-soft hover:shadow-hover'
              }`}
              title="캘린더 보기"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="12" height="11" rx="1.5" />
                <path d="M2 6.5h12" />
                <path d="M5 1.5v3" />
                <path d="M11 1.5v3" />
              </svg>
              캘린더
            </button>
            <button
              onClick={() => { setShowSelector(!showSelector); setFormType(null); }}
              className="px-2.5 py-1 text-xs font-medium text-pink-600 bg-white rounded-lg shadow-soft hover:shadow-hover transition-all"
            >
              + 추가
            </button>
          </div>
        </div>

        {/* 캘린더 뷰 */}
        {showCalendar && (
          <RecordCalendar
            records={records}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
        )}

        {/* 선택된 날짜 표시 */}
        {selectedDate && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-pink-600">
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
            </span>
            <button
              onClick={() => setSelectedDate(null)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              ✕ 날짜 필터 해제
            </button>
          </div>
        )}

        {/* 타입 선택기 */}
        {showSelector && !formType && (
          <RecordTypeSelector
            onSelect={handleSelectType}
            onCancel={() => setShowSelector(false)}
          />
        )}

        {/* 추가 폼 */}
        {formType && (
          <RecordForm
            recordType={formType}
            onSave={handleAdd}
            onCancel={() => { setFormType(null); setShowSelector(false); }}
          />
        )}

        {/* 필터 탭 (SVG 아이콘 + 핑크) */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {tabs.map((tab) => {
            const active = filter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                  active
                    ? 'bg-pink-500 text-white shadow-sm'
                    : 'bg-white text-pink-500 hover:bg-pink-50 border border-pink-100'
                }`}
              >
                <TabIcon id={tab.id} active={active} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* 필터/선택 + 검색 */}
        <div className="space-y-1.5">
        <div className="flex items-center justify-end gap-2">
          {/* 프로젝트 필터 */}
          <div className="relative" ref={filterRef}>
            <button
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg shadow-soft hover:shadow-hover transition-all ${
                projectFilter !== 'all'
                  ? 'text-pink-600 bg-pink-50 font-medium'
                  : 'text-gray-600 bg-white'
              }`}
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 4h12" />
                <path d="M4 8h8" />
                <path d="M6 12h4" />
              </svg>
              필터
              {projectFilter !== 'all' && (
                <span className="bg-white/30 rounded-full px-1 text-[10px]">1</span>
              )}
            </button>
            {showFilterDropdown && (
              <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-100 py-2 z-20 min-w-[180px]">
                <p className="px-3 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">프로젝트별</p>
                <button
                  onClick={() => { setProjectFilter('all'); setShowFilterDropdown(false); }}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-pink-50 transition-colors ${
                    projectFilter === 'all' ? 'text-pink-600 font-semibold' : 'text-gray-700'
                  }`}
                >
                  전체
                </button>
                {usedProjects.map((pName) => {
                  const proj = projects.find((p) => p.name === pName);
                  return (
                    <button
                      key={pName}
                      onClick={() => { setProjectFilter(pName); setShowFilterDropdown(false); }}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-pink-50 transition-colors flex items-center gap-1.5 ${
                        projectFilter === pName ? 'text-pink-600 font-semibold' : 'text-gray-700'
                      }`}
                    >
                      {proj?.color && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: proj.color }} />}
                      {pName}
                    </button>
                  );
                })}
                {usedProjects.length === 0 && (
                  <p className="px-3 py-1.5 text-xs text-gray-400">연결된 프로젝트 없음</p>
                )}
              </div>
            )}
          </div>

          {/* 선택 모드 토글 */}
          <button
            onClick={toggleSelectMode}
            className={`px-2.5 py-1 text-xs rounded-lg shadow-soft hover:shadow-hover transition-all ${
              selectMode
                ? 'text-white bg-pink-500 font-medium'
                : 'text-gray-600 bg-white'
            }`}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="12" height="12" rx="2" />
              {selectMode && <path d="M5 8l2 2 4-4" />}
            </svg>
            {selectMode ? '취소' : '선택'}
          </button>
        </div>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.5 10.5L14 14" />
          </svg>
          <input
            type="text"
            placeholder="제목, 태그 검색"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-200 placeholder-gray-400"
          />
        </div>
        </div>

        {/* 선택 모드 액션 바 */}
        {selectMode && (
          <div className="bg-pink-50 rounded-lg px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={handleSelectAll}
                className="text-xs font-medium text-pink-700 hover:text-pink-900 transition-colors"
              >
                {selectedIds.size === sorted.length && sorted.length > 0 ? '전체 해제' : '전체 선택'}
              </button>
              <span className="text-xs text-pink-500">
                {selectedIds.size}건 선택
              </span>
            </div>
            <button
              onClick={handleBulkDelete}
              disabled={selectedIds.size === 0}
              className={`text-xs font-medium px-3 py-1 rounded-lg transition-all ${
                selectedIds.size > 0
                  ? 'bg-pink-500 text-white hover:bg-pink-600 shadow-sm'
                  : 'bg-pink-100 text-pink-300 cursor-not-allowed'
              }`}
            >
              삭제
            </button>
          </div>
        )}

        {/* 타임라인 */}
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-pink-200" />
          <div className="space-y-4 pl-10">
            {sorted.map((item) => {
              const cfg = recordTypeConfig[item.recordType];
              const date = new Date(item.date);
              const dateLabel = date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });

              // 미리보기 텍스트 생성
              let preview = '';
              if (item.recordType === 'morning' && item.morningData?.gratitude) {
                const filled = item.morningData.gratitude.filter((f) => f.text?.trim());
                preview = filled.length > 0 ? filled.map((f) => f.text).join(', ') : '';
              } else if (item.recordType === 'evening' && item.eveningData?.greatThings) {
                const filled = item.eveningData.greatThings.filter((f) => f.text?.trim());
                preview = filled.length > 0 ? filled.map((f) => f.text).join(', ') : '';
              } else if (item.recordType === 'weekly' && item.weeklyData?.achievements) {
                const filled = item.weeklyData.achievements.filter((f) => f.text?.trim());
                preview = filled.length > 0 ? filled.map((f) => f.text).join(', ') : '';
              } else if (item.recordType === 'memo') {
                preview = '메모';
              }

              const isSelected = selectedIds.has(item.id);

              return (
                <div
                  key={item.id}
                  className="relative cursor-pointer"
                  onClick={() => {
                    if (selectMode) {
                      toggleSelection(item.id);
                    } else {
                      setSelectedRecord(item);
                    }
                  }}
                >
                  {/* 도트 (타입별 색상) */}
                  <div className="absolute -left-10 top-4 w-8 flex justify-center">
                    <div className={`w-3 h-3 rounded-full ${cfg.color} ring-4 ring-pink-100`} />
                  </div>
                  <div className={`bg-white rounded-2xl p-5 shadow-soft hover:shadow-hover transition-all ${
                    isSelected ? 'ring-2 ring-pink-400' : ''
                  }`}>
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      {selectMode && (
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                          isSelected ? 'bg-pink-500 border-pink-500' : 'border-gray-300 bg-white'
                        }`}>
                          {isSelected && (
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M4 8l3 3 5-5" />
                            </svg>
                          )}
                        </div>
                      )}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${cfg.bgColor} ${cfg.textColor}`}>
                        {cfg.label}
                      </span>
                      {item.mood && <span className="text-lg">{item.mood}</span>}
                      <span className="text-sm font-semibold text-gray-700">{dateLabel}</span>
                      {item.time && <span className="text-xs text-gray-400">{item.time}</span>}
                    </div>
                    {item.title && (
                      <p className="text-sm font-medium text-gray-800 mb-1">{item.title}</p>
                    )}
                    {preview && (
                      <p className="text-sm text-gray-500 line-clamp-2">{preview}</p>
                    )}
                    {/* 프로젝트 */}
                    {item.project && (() => {
                      const proj = projects.find((p) => p.name === item.project);
                      return (
                        <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-600 font-medium mt-1">
                          {proj?.color && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: proj.color }} />}
                          {item.project}
                        </span>
                      );
                    })()}
                    {/* 에너지 게이지 + 태그 */}
                    {(item.energy || (item.tags && item.tags.length > 0)) && (
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        {item.energy && <EnergyGauge value={item.energy} />}
                        {item.tags && item.tags.length > 0 && (
                          <div className="flex gap-1.5 flex-wrap">
                            {item.tags.map((tag) => (
                              <span key={tag} className={`text-xs px-2 py-0.5 rounded-full ${cfg.bgColor} ${cfg.textColor} font-medium`}>#{tag}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {sorted.length === 0 && (
              <div className="text-center py-12 text-gray-400 text-sm">
                아직 기록이 없습니다. 위의 "+ 추가" 버튼으로 시작하세요.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 상세 뷰 */}
      {selectedRecord && (
        <RecordDetailView
          record={selectedRecord}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onClose={() => setSelectedRecord(null)}
        />
      )}
    </div>
  );
}
