/**
 * @file src/pages/RecordsPage.tsx
 * @description 기록 페이지
 * - 캘린더 뷰: 월별 달력에서 기록 도트 확인, 날짜 필터링
 * - 필터 탭: SVG 아이콘 핑크 테마
 * - 타임라인: 핑크 테마 유지, 타입별 도트 색상 분기
 * - +추가 → RecordTypeSelector → RecordForm
 * - 카드 클릭 → RecordDetailView
 */
import { useState } from 'react';
import { RecordItem, RecordType } from '../types';
import { useRecords } from '../hooks/useRecords';
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
  const { records, add: addRecord, update: updateRecord, remove: removeRecord } = useRecords();
  const [filter, setFilter] = useState<FilterTab>('all');
  const [showCalendar, setShowCalendar] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showSelector, setShowSelector] = useState(false);
  const [formType, setFormType] = useState<RecordType | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<RecordItem | null>(null);

  // 타입 필터 → 날짜 필터 순서로 적용
  const byType = filter === 'all' ? records : records.filter((r) => r.recordType === filter);
  const filtered = selectedDate ? byType.filter((r) => r.date === selectedDate) : byType;
  const sorted = [...filtered].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

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
              className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all ${
                showCalendar ? 'bg-pink-500 text-white shadow-sm' : 'bg-white text-pink-500 shadow-soft hover:shadow-hover'
              }`}
              title="캘린더 보기"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="12" height="11" rx="1.5" />
                <path d="M2 6.5h12" />
                <path d="M5 1.5v3" />
                <path d="M11 1.5v3" />
              </svg>
            </button>
            <button
              onClick={() => { setShowSelector(!showSelector); setFormType(null); }}
              className="px-3 py-1.5 text-sm font-medium text-pink-600 bg-white rounded-xl shadow-soft hover:shadow-hover transition-all"
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
              if (item.recordType === 'morning' && item.morningData) {
                const filled = item.morningData.gratitude.filter((f) => f.text.trim());
                preview = filled.length > 0 ? filled.map((f) => f.text).join(', ') : '';
              } else if (item.recordType === 'evening' && item.eveningData) {
                const filled = item.eveningData.greatThings.filter((f) => f.text.trim());
                preview = filled.length > 0 ? filled.map((f) => f.text).join(', ') : '';
              } else if (item.recordType === 'weekly' && item.weeklyData) {
                const filled = item.weeklyData.achievements.filter((f) => f.text.trim());
                preview = filled.length > 0 ? filled.map((f) => f.text).join(', ') : '';
              } else if (item.recordType === 'memo') {
                preview = '메모';
              }

              return (
                <div key={item.id} className="relative cursor-pointer" onClick={() => setSelectedRecord(item)}>
                  {/* 도트 (타입별 색상) */}
                  <div className="absolute -left-10 top-4 w-8 flex justify-center">
                    <div className={`w-3 h-3 rounded-full ${cfg.color} ring-4 ring-pink-100`} />
                  </div>
                  <div className="bg-white rounded-2xl p-5 shadow-soft hover:shadow-hover transition-all">
                    <div className="flex items-center gap-2 mb-2">
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
