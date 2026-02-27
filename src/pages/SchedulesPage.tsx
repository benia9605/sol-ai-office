/**
 * @file src/pages/SchedulesPage.tsx
 * @description 일정 페이지
 * - 날짜별 그룹핑 일정 리스트
 * - 수동 추가 기능 (종류/반복/알림/비고/태그 포함)
 * - 카테고리 색상바 + 타이틀 옆 카테고리 라벨 (소형)
 * - 반복 아이콘 SVG 주황색
 * - 카테고리 관리: 더블클릭 시 컬러 피커
 * - 아이템 클릭 시 ItemDetailPopup 오픈
 */
import { useState, useRef, useMemo } from 'react';
import { ScheduleItem, ScheduleCategory, RepeatType } from '../types';
import { defaultScheduleCategories, categoryColorPresets } from '../data';
import { useSchedules } from '../hooks/useSchedules';
import { useProjects } from '../hooks/useProjects';
import { ItemDetailPopup } from '../components/ItemDetailPopup';
import { ProjectSelect } from '../components/ProjectSelect';
import { downloadIcs } from '../utils/icsExport';

const repeatLabels: Record<RepeatType, string> = {
  none: '없음', daily: '매일', weekly: '매주', monthly: '매월', yearly: '매년',
};

const reminderOptions = [
  { value: 'none', label: '없음' },
  { value: '10min', label: '10분 전' },
  { value: '30min', label: '30분 전' },
  { value: '1hour', label: '1시간 전' },
  { value: '1day', label: '1일 전' },
];

/** 반복 아이콘 SVG (주황 톤) */
function RepeatIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 1l4 4-4 4" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <path d="M7 23l-4-4 4-4" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

export function SchedulesPage() {
  const { schedules, add: addSchedule, update: updateSchedule, remove: removeSchedule } = useSchedules();
  const { projects } = useProjects();
  const projectColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    projects.forEach((p) => { map[p.name] = p.color; });
    return map;
  }, [projects]);
  const [categories, setCategories] = useState<ScheduleCategory[]>(defaultScheduleCategories);
  const [showForm, setShowForm] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [form, setForm] = useState({
    title: '', date: '', time: '', project: '',
    category: '', repeat: 'none' as RepeatType, reminder: 'none', notes: '', tagInput: '', tags: [] as string[],
  });
  const [selectedItem, setSelectedItem] = useState<ScheduleItem | null>(null);

  // 카테고리 관리 (폼 내)
  const [showCatManager, setShowCatManager] = useState(false);
  const [newCatLabel, setNewCatLabel] = useState('');
  const [newCatColor, setNewCatColor] = useState(categoryColorPresets[0]);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const colorInputRef = useRef<HTMLInputElement>(null);

  const grouped = schedules.reduce<Record<string, ScheduleItem[]>>((acc, item) => {
    if (!acc[item.date]) acc[item.date] = [];
    acc[item.date].push(item);
    return acc;
  }, {});

  const formatDateLabel = (dateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);
    const diff = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return '오늘';
    if (diff === 1) return '내일';
    return new Date(dateStr).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
  };

  const handleAddTag = () => {
    const tag = form.tagInput.trim();
    if (tag && !form.tags.includes(tag)) {
      setForm({ ...form, tags: [...form.tags, tag], tagInput: '' });
    }
  };

  const handleAdd = () => {
    if (!form.title.trim() || !form.date) return;
    const cat = categories.find((c) => c.id === form.category);
    addSchedule({
      title: form.title,
      date: form.date,
      time: form.time || '00:00',
      project: form.project,
      color: cat?.color || '#fb923c',
      category: form.category || undefined,
      repeat: form.repeat,
      reminder: form.reminder,
      notes: form.notes,
      tags: form.tags.length > 0 ? form.tags : undefined,
    });
    setForm({ title: '', date: '', time: '', project: '', category: '', repeat: 'none', reminder: 'none', notes: '', tagInput: '', tags: [] });
    setShowForm(false);
    setShowAdvanced(false);
  };

  const handleAddCategory = () => {
    if (!newCatLabel.trim()) return;
    const newCat: ScheduleCategory = { id: `cat-${Date.now()}`, label: newCatLabel.trim(), color: newCatColor };
    setCategories([...categories, newCat]);
    setNewCatLabel('');
    setNewCatColor(categoryColorPresets[0]);
  };

  const handleColorPresetClick = (c: string) => {
    setNewCatColor(c);
  };

  const handleColorPresetDoubleClick = () => {
    setShowColorPicker(true);
    setTimeout(() => colorInputRef.current?.click(), 0);
  };

  const handlePopupSave = (updated: ScheduleItem) => {
    updateSchedule(updated.id, updated);
    setSelectedItem(null);
  };

  const handlePopupDelete = (id: string) => {
    removeSchedule(id);
    setSelectedItem(null);
  };

  return (
    <div className="min-h-full bg-[#fff9f0] p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <img src="/images/schedule.png" alt="일정" className="w-6 h-6 object-contain" />
            일정
          </h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-3 py-1.5 text-sm font-medium text-orange-600 bg-white rounded-xl shadow-soft hover:shadow-hover transition-all"
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
                type="text" placeholder="일정 제목" value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
              />
            </div>
            {/* 날짜 */}
            <div>
              <label className="text-sm font-medium text-gray-600 block mb-1.5">날짜</label>
              <div className="flex gap-2">
                <input type="date" value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-200" />
                <input type="time" value={form.time}
                  onChange={(e) => setForm({ ...form, time: e.target.value })}
                  className="w-28 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-200" />
              </div>
            </div>
            {/* 프로젝트 */}
            <div>
              <label className="text-sm font-medium text-gray-600 block mb-1.5">프로젝트</label>
              <ProjectSelect value={form.project} onChange={(v) => setForm({ ...form, project: v })} />
            </div>

            {/* 종류 (카테고리) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-gray-600">종류</label>
                <button onClick={() => setShowCatManager(!showCatManager)}
                  className="text-xs text-orange-500 hover:text-orange-600">
                  {showCatManager ? '닫기' : '관리'}
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {categories.map((cat) => (
                  <button key={cat.id}
                    onClick={() => setForm({ ...form, category: form.category === cat.id ? '' : cat.id })}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      form.category === cat.id ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                    style={form.category === cat.id ? { backgroundColor: cat.color } : undefined}>
                    {cat.label}
                  </button>
                ))}
              </div>
              {showCatManager && (
                <div className="mt-2 p-3 bg-gray-50 rounded-xl space-y-2">
                  <div className="flex gap-2">
                    <input type="text" placeholder="새 카테고리" value={newCatLabel}
                      onChange={(e) => setNewCatLabel(e.target.value)}
                      className="flex-1 px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-orange-200" />
                    <button onClick={handleAddCategory} disabled={!newCatLabel.trim()}
                      className="px-2 py-1.5 text-xs text-white bg-orange-400 hover:bg-orange-500 rounded-lg disabled:opacity-40">추가</button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 items-center">
                    {categoryColorPresets.map((c) => (
                      <button key={c}
                        onClick={() => handleColorPresetClick(c)}
                        onDoubleClick={handleColorPresetDoubleClick}
                        className={`w-6 h-6 rounded-full transition-all ${newCatColor === c ? 'ring-2 ring-offset-1 ring-gray-600' : ''}`}
                        style={{ backgroundColor: c }}
                        title="더블클릭: 커스텀 컬러" />
                    ))}
                    {/* 커스텀 컬러 버튼 */}
                    <div className="relative">
                      <button
                        onClick={() => { setShowColorPicker(true); setTimeout(() => colorInputRef.current?.click(), 0); }}
                        className="w-6 h-6 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-gray-500 hover:text-gray-600 text-xs"
                        title="직접 색상 선택"
                      >+</button>
                      <input
                        ref={colorInputRef}
                        type="color"
                        value={newCatColor}
                        onChange={(e) => setNewCatColor(e.target.value)}
                        className="absolute top-0 left-0 w-0 h-0 opacity-0 pointer-events-none"
                      />
                    </div>
                    {showColorPicker && (
                      <span className="text-xs text-gray-400 ml-1">선택: {newCatColor}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {categories.map((cat) => (
                      <span key={cat.id} className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-white rounded-full border">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                        {cat.label}
                        <button onClick={() => setCategories(categories.filter((c) => c.id !== cat.id))}
                          className="text-gray-400 hover:text-red-500 ml-0.5">x</button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 태그 */}
            <div>
              <label className="text-sm font-medium text-gray-600 block mb-1.5">태그</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {form.tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-600 rounded-full text-xs font-medium">
                    #{tag}
                    <button onClick={() => setForm({ ...form, tags: form.tags.filter((t) => t !== tag) })}
                      className="text-orange-400 hover:text-orange-600 ml-0.5">x</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input type="text" placeholder="태그 입력 후 Enter" value={form.tagInput}
                  onChange={(e) => setForm({ ...form, tagInput: e.target.value })}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); handleAddTag(); } }}
                  className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-200" />
              </div>
            </div>

            {/* 고급 필드 토글 */}
            <button onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
              {showAdvanced ? '간단히 보기 ▲' : '더 보기 (반복/알림/비고) ▼'}
            </button>

            {showAdvanced && (
              <div className="space-y-5 pt-1">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 mb-1 block">반복</label>
                    <select value={form.repeat} onChange={(e) => setForm({ ...form, repeat: e.target.value as RepeatType })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-200">
                      {Object.entries(repeatLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 mb-1 block">알림</label>
                    <select value={form.reminder} onChange={(e) => setForm({ ...form, reminder: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-200">
                      {reminderOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">비고</label>
                  <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2}
                    placeholder="메모를 입력하세요"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-200" />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowForm(false); setShowAdvanced(false); }}
                className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-xl">취소</button>
              <button onClick={handleAdd}
                className="px-4 py-2 text-sm text-white bg-orange-400 hover:bg-orange-500 rounded-xl font-medium">추가</button>
            </div>
          </div>
        )}

        {Object.entries(grouped).map(([date, items]) => (
          <div key={date}>
            <h2 className="text-sm font-semibold text-orange-600 mb-3">{formatDateLabel(date)}</h2>
            <div className="space-y-2">
              {items.map((item) => {
                const cat = categories.find((c) => c.id === item.category);
                const barColor = cat?.color || '#fdba74';
                return (
                  <div key={item.id}
                    onClick={() => setSelectedItem(item)}
                    className="flex items-center gap-4 bg-white rounded-2xl p-4 shadow-soft cursor-pointer hover:shadow-hover transition-all">
                    <div className="w-1.5 h-10 rounded-full" style={{ backgroundColor: barColor }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-medium text-gray-800 text-sm">{item.title}</p>
                        {cat && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full text-white font-medium leading-none"
                            style={{ backgroundColor: cat.color }}>
                            {cat.label}
                          </span>
                        )}
                        {item.repeat && item.repeat !== 'none' && (
                          <RepeatIcon className="text-orange-400 flex-shrink-0" />
                        )}
                      </div>
                      <p className="inline-flex items-center gap-1 text-xs text-gray-500">
                        {projectColorMap[item.project] && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: projectColorMap[item.project] }} />}
                        {item.project}
                      </p>
                    </div>
                    <span className="text-sm font-medium text-gray-600 flex-shrink-0">{item.time}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); downloadIcs(item); }}
                      className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-orange-500 hover:bg-orange-50 transition-all"
                      title="Apple 캘린더에 추가"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                        <path d="M12 14l-2 2 2 2" />
                        <path d="M16 16h-6" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* 상세 팝업 */}
      {selectedItem && (
        <ItemDetailPopup
          type="schedule"
          item={selectedItem}
          categories={categories}
          onSave={(updated) => handlePopupSave(updated as ScheduleItem)}
          onDelete={handlePopupDelete}
          onClose={() => setSelectedItem(null)}
          onCategoriesChange={setCategories}
        />
      )}
    </div>
  );
}
