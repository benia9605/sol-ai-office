/**
 * @file src/components/ItemDetailPopup.tsx
 * @description 4개 타입 공통 상세/수정 팝업 컴포넌트
 * - schedule: 시간, 종류(카테고리), 반복, 알림, 비고, 태그
 * - task: 상태(3단계), 카테고리, 우선순위, 뽀모도로, 메모, 반복, 태그, 즐겨찾기
 * - insight: 내용, 출처, 날짜, 태그
 * - reading: 저자, 종류, 진행률, 상태, 시작일
 * - 카테고리 관리: 더블클릭 → 컬러 피커, + 버튼으로도 커스텀 컬러
 */
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ScheduleItem, TaskItem, InsightItem, ReadingItem,
  ScheduleCategory, RepeatType, TaskStatus, InsightSource,
} from '../types';
import { categoryColorPresets, availableSourceImages, rooms } from '../data';
import { ProjectSelect } from './ProjectSelect';
import { GoalSelect } from './GoalSelect';
import { downloadIcs } from '../utils/icsExport';
import { uploadImage } from '../services/storage.service';
import { fetchMessagesByConversation, MessageRow } from '../services/conversations.service';
import { fetchAllGoals, GoalRow } from '../services/goals.service';
import { fetchProjects } from '../services/projects.service';
import { GoalBadge } from './GoalBadge';

type ItemType = 'schedule' | 'task' | 'insight' | 'reading';
type AnyItem = ScheduleItem | TaskItem | InsightItem | ReadingItem;

interface ItemDetailPopupProps {
  type: ItemType;
  item: AnyItem;
  categories?: ScheduleCategory[];
  insightSources?: InsightSource[];
  onSave: (updated: AnyItem) => void;
  onQuickUpdate?: (updated: AnyItem) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  onCategoriesChange?: (cats: ScheduleCategory[]) => void;
  onInsightSourcesChange?: (sources: InsightSource[]) => void;
  onStartPomodoro?: (task: TaskItem, workMin?: number, breakMin?: number) => void;
}

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

/** 타입별 테마 색상 */
const typeTheme = {
  schedule: { tag: 'bg-orange-100 text-orange-600', tagX: 'text-orange-400 hover:text-orange-600', ring: 'focus:ring-orange-200', manage: 'text-orange-500 hover:text-orange-600', saveBtn: 'bg-orange-500 hover:bg-orange-600', headerBg: 'bg-orange-50' },
  task:     { tag: 'bg-green-100 text-green-600',   tagX: 'text-green-400 hover:text-green-600',   ring: 'focus:ring-green-200',  manage: 'text-green-500 hover:text-green-600',   saveBtn: 'bg-green-500 hover:bg-green-600', headerBg: 'bg-green-50' },
  insight:  { tag: 'bg-amber-100 text-amber-600',   tagX: 'text-amber-400 hover:text-amber-600',   ring: 'focus:ring-amber-200',  manage: 'text-amber-500 hover:text-amber-600',   saveBtn: 'bg-amber-500 hover:bg-amber-600', headerBg: 'bg-amber-50' },
  reading:  { tag: 'bg-blue-100 text-blue-600',     tagX: 'text-blue-400 hover:text-blue-600',     ring: 'focus:ring-blue-200',   manage: 'text-blue-500 hover:text-blue-600',     saveBtn: 'bg-blue-500 hover:bg-blue-600', headerBg: 'bg-blue-50' },
} as const;

/** 뷰어 모드 라벨 섹션 */
function ViewSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-2">
      <span className="text-[11px] font-semibold text-gray-400 block mb-1">{label}</span>
      <div>{children}</div>
    </div>
  );
}

/** 뷰어 모드 태그 표시 */
function ViewTags({ tags, theme }: { tags: string[]; theme: string }) {
  if (!tags || tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((t) => (
        <span key={t} className={`px-2 py-0.5 rounded-full text-xs font-medium ${theme}`}>#{t}</span>
      ))}
    </div>
  );
}

/** AI 이름 → 프로필 이미지 매핑 */
const aiNameToImage: Record<string, string> = Object.fromEntries(
  rooms.map((r) => [r.aiName, r.image])
);

export function ItemDetailPopup({ type, item, categories = [], insightSources = [], onSave, onQuickUpdate, onDelete, onClose, onCategoriesChange, onInsightSourcesChange, onStartPomodoro }: ItemDetailPopupProps) {
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [data, setData] = useState<AnyItem>({ ...item });
  const [showCatManager, setShowCatManager] = useState(false);
  const [newCatLabel, setNewCatLabel] = useState('');
  const [newCatColor, setNewCatColor] = useState(categoryColorPresets[0]);
  const [tagInput, setTagInput] = useState('');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const [showSourceManager, setShowSourceManager] = useState(false);
  const [newSourceLabel, setNewSourceLabel] = useState('');
  const [convMessages, setConvMessages] = useState<MessageRow[]>([]);
  const [showConvMessages, setShowConvMessages] = useState(true);
  const [goalTitle, setGoalTitle] = useState<string | null>(null);
  const [goalProjectId, setGoalProjectId] = useState<string | null>(null);
  const [goalProjectColor, setGoalProjectColor] = useState<string | undefined>(undefined);
  const [scheduleProjectId, setScheduleProjectId] = useState<string | null>(null);
  const [insightProjectId, setInsightProjectId] = useState<string | null>(null);
  const [showPomodoroPopover, setShowPomodoroPopover] = useState(false);
  const pomodoroRef = useRef<HTMLDivElement>(null);

  // 대화 연동: conversationId가 있으면 메시지 로드
  useEffect(() => {
    if (type === 'task') {
      const t = item as TaskItem;
      if (t.conversationId) {
        fetchMessagesByConversation(t.conversationId)
          .then(setConvMessages)
          .catch(() => setConvMessages([]));
      }
    }
  }, [type, item]);

  // 목표 정보 로드
  useEffect(() => {
    if (type === 'task') {
      const t = item as TaskItem;
      if (t.goalId) {
        Promise.all([fetchAllGoals(), fetchProjects()]).then(([goalRows, projectRows]) => {
          const goal = goalRows.find((r: GoalRow) => r.id === t.goalId);
          if (goal) {
            setGoalTitle(goal.title);
            setGoalProjectId(goal.project_id);
            const project = projectRows.find((p) => p.id === goal.project_id);
            setGoalProjectColor(project?.color);
          }
        }).catch(() => {});
      }
    }
  }, [type, item]);

  // 일정/인사이트: 프로젝트 이름 → ID 매핑
  useEffect(() => {
    if (type === 'schedule' || type === 'insight') {
      const projectName = (item as ScheduleItem | InsightItem).project;
      if (projectName) {
        fetchProjects().then((rows) => {
          const p = rows.find((r) => r.name === projectName);
          if (p) {
            if (type === 'schedule') setScheduleProjectId(p.id);
            else setInsightProjectId(p.id);
          }
        }).catch(() => {});
      }
    }
  }, [type, item]);

  // 뽀모도로 팝오버 외부 클릭 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pomodoroRef.current && !pomodoroRef.current.contains(e.target as Node)) {
        setShowPomodoroPopover(false);
      }
    };
    if (showPomodoroPopover) {
      document.addEventListener('mousedown', handler);
    }
    return () => document.removeEventListener('mousedown', handler);
  }, [showPomodoroPopover]);

  const update = (patch: Partial<AnyItem>) => setData((prev) => ({ ...prev, ...patch }) as AnyItem);

  const handleAddTag = (currentTags: string[]) => {
    const tag = tagInput.trim();
    if (tag && !currentTags.includes(tag)) {
      return [...currentTags, tag];
    }
    return currentTags;
  };

  const handleAddCategory = () => {
    if (!newCatLabel.trim() || !onCategoriesChange) return;
    const newCat: ScheduleCategory = {
      id: `cat-${Date.now()}`,
      label: newCatLabel.trim(),
      color: newCatColor,
    };
    onCategoriesChange([...categories, newCat]);
    setNewCatLabel('');
    setNewCatColor(categoryColorPresets[0]);
  };

  const handleRemoveCategory = (catId: string) => {
    if (!onCategoriesChange) return;
    onCategoriesChange(categories.filter((c) => c.id !== catId));
  };

  const renderScheduleFields = () => {
    const s = data as ScheduleItem;
    return (
      <>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-sm font-medium text-gray-600 block mb-1.5">날짜</label>
            <input type="date" value={s.date} onChange={(e) => update({ date: e.target.value })}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-200" />
          </div>
          <div className="w-28">
            <label className="text-sm font-medium text-gray-600 block mb-1.5">시간</label>
            <input type="time" value={s.time} onChange={(e) => update({ time: e.target.value })}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-200" />
          </div>
        </div>

        {/* 종류 (카테고리) */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium text-gray-600">종류</label>
            <button onClick={() => setShowCatManager(!showCatManager)}
              className={`text-xs ${typeTheme[type].manage}`}>
              {showCatManager ? '닫기' : '관리'}
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {categories.map((cat) => (
              <button key={cat.id}
                onClick={() => update({ category: s.category === cat.id ? undefined : cat.id })}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  s.category === cat.id ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                style={s.category === cat.id ? { backgroundColor: cat.color } : undefined}>
                {cat.label}
              </button>
            ))}
          </div>
          {showCatManager && (
            <div className="mt-2 p-3 bg-gray-50 rounded-xl space-y-2">
              <div className="flex gap-2">
                <input type="text" placeholder="새 카테고리 이름" value={newCatLabel}
                  onChange={(e) => setNewCatLabel(e.target.value)}
                  className="flex-1 px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-orange-200" />
                <button onClick={handleAddCategory} disabled={!newCatLabel.trim()}
                  className="px-2 py-1.5 text-xs text-white bg-orange-400 hover:bg-orange-500 rounded-lg disabled:opacity-40">추가</button>
              </div>
              <div className="flex flex-wrap gap-1.5 items-center">
                {categoryColorPresets.map((c) => (
                  <button key={c}
                    onClick={() => setNewCatColor(c)}
                    onDoubleClick={() => { setShowColorPicker(true); setTimeout(() => colorInputRef.current?.click(), 0); }}
                    className={`w-6 h-6 rounded-full transition-all ${newCatColor === c ? 'ring-2 ring-offset-1 ring-gray-600' : ''}`}
                    style={{ backgroundColor: c }}
                    title="더블클릭: 커스텀 컬러" />
                ))}
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
                    <button onClick={() => handleRemoveCategory(cat.id)} className="text-gray-400 hover:text-red-500 ml-0.5">x</button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 프로젝트 */}
        <div>
          <label className="text-sm font-medium text-gray-600 block mb-1.5">프로젝트</label>
          <ProjectSelect value={s.project || ''} onChange={(v) => update({ project: v })} />
        </div>

        {/* 반복 */}
        <div>
          <label className="text-sm font-medium text-gray-600 block mb-1.5">반복</label>
          <select value={s.repeat || 'none'} onChange={(e) => update({ repeat: e.target.value as RepeatType })}
            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-200">
            {Object.entries(repeatLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>

        {/* 알림 */}
        <div>
          <label className="text-sm font-medium text-gray-600 block mb-1.5">알림</label>
          <select value={s.reminder || 'none'} onChange={(e) => update({ reminder: e.target.value })}
            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-200">
            {reminderOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* 비고 */}
        <div>
          <label className="text-sm font-medium text-gray-600 block mb-1.5">비고</label>
          <textarea value={s.notes || ''} onChange={(e) => update({ notes: e.target.value })} rows={2}
            placeholder="메모를 입력하세요"
            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-200" />
        </div>

        {/* 태그 */}
        {renderTagEditor(s.tags || [], (tags) => update({ tags }))}
      </>
    );
  };

  const renderTaskFields = () => {
    const t = data as TaskItem;
    const statusOptions: { value: TaskStatus; label: string; icon: JSX.Element }[] = [
      { value: 'pending', label: '대기', icon: (
        <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4">
          <circle cx="10" cy="10" r="9" fill="white" stroke="#d1d5db" strokeWidth="1.5" />
        </svg>
      )},
      { value: 'in_progress', label: '진행중', icon: (
        <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4">
          <circle cx="10" cy="10" r="9" fill="#dbeafe" stroke="#3b82f6" strokeWidth="1" />
          <path d="M10 5v5l3 3" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )},
      { value: 'completed', label: '완료', icon: (
        <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4">
          <circle cx="10" cy="10" r="9" fill="#4ade80" stroke="#22c55e" strokeWidth="1" />
          <path d="M6 10l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )},
    ];

    return (
      <>
        {/* 상태 */}
        <div>
          <label className="text-sm font-medium text-gray-600 block mb-1.5">상태</label>
          <div className="flex gap-2">
            {statusOptions.map((opt) => (
              <button key={opt.value}
                onClick={() => update({ status: opt.value })}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  t.status === opt.value ? 'bg-green-50 ring-2 ring-green-300' : 'bg-gray-50 hover:bg-gray-100'
                }`}>
                {opt.icon}
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 마감일 + 우선순위 */}
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-sm font-medium text-gray-600 block mb-1.5">마감일</label>
            <input type="date" value={t.date || ''} onChange={(e) => update({ date: e.target.value })}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-200" />
          </div>
          <div className="w-28">
            <label className="text-sm font-medium text-gray-600 block mb-1.5">우선순위</label>
            <select value={t.priority} onChange={(e) => update({ priority: e.target.value as TaskItem['priority'] })}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-200">
              <option value="high">높음</option>
              <option value="medium">보통</option>
              <option value="low">낮음</option>
            </select>
          </div>
        </div>

        {/* 상위 목표 */}
        <div>
          <label className="text-sm font-medium text-gray-600 block mb-1.5">상위 목표</label>
          <GoalSelect value={t.goalId} onChange={(v) => update({ goalId: v })} />
        </div>

        {/* 종류 (카테고리) */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium text-gray-600">종류</label>
            <button onClick={() => setShowCatManager(!showCatManager)}
              className={`text-xs ${typeTheme[type].manage}`}>
              {showCatManager ? '닫기' : '관리'}
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {categories.map((cat) => (
              <button key={cat.id}
                onClick={() => update({ category: t.category === cat.id ? undefined : cat.id })}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  t.category === cat.id ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                style={t.category === cat.id ? { backgroundColor: cat.color } : undefined}>
                {cat.label}
              </button>
            ))}
          </div>
          {showCatManager && (
            <div className="mt-2 p-3 bg-gray-50 rounded-xl space-y-2">
              <div className="flex gap-2">
                <input type="text" placeholder="새 카테고리 이름" value={newCatLabel}
                  onChange={(e) => setNewCatLabel(e.target.value)}
                  className="flex-1 px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-green-200" />
                <button onClick={handleAddCategory} disabled={!newCatLabel.trim()}
                  className="px-2 py-1.5 text-xs text-white bg-green-400 hover:bg-green-500 rounded-lg disabled:opacity-40">추가</button>
              </div>
              <div className="flex flex-wrap gap-1.5 items-center">
                {categoryColorPresets.map((c) => (
                  <button key={c}
                    onClick={() => setNewCatColor(c)}
                    onDoubleClick={() => { setShowColorPicker(true); setTimeout(() => colorInputRef.current?.click(), 0); }}
                    className={`w-6 h-6 rounded-full transition-all ${newCatColor === c ? 'ring-2 ring-offset-1 ring-gray-600' : ''}`}
                    style={{ backgroundColor: c }}
                    title="더블클릭: 커스텀 컬러" />
                ))}
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
                    <button onClick={() => handleRemoveCategory(cat.id)} className="text-gray-400 hover:text-red-500 ml-0.5">x</button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 메모 */}
        <div>
          <label className="text-sm font-medium text-gray-600 block mb-1.5">메모</label>
          <textarea value={t.notes || ''} onChange={(e) => update({ notes: e.target.value })} rows={2}
            placeholder="메모를 입력하세요"
            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-200" />
        </div>

        {/* 반복 */}
        <div>
          <label className="text-sm font-medium text-gray-600 block mb-1.5">반복</label>
          <select value={t.repeat || 'none'} onChange={(e) => update({ repeat: e.target.value as RepeatType })}
            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-200">
            {Object.entries(repeatLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>

        {/* 태그 */}
        {renderTagEditor(t.tags || [], (tags) => update({ tags }))}

        {/* 프로젝트 표시 */}
        {t.project && <div className="text-xs text-gray-400">프로젝트: {t.project}</div>}
      </>
    );
  };

  const [newSourceImage, setNewSourceImage] = useState('');
  const [newSourceEmoji, setNewSourceEmoji] = useState('');
  const [sourceImageMode, setSourceImageMode] = useState<'image' | 'emoji'>('image');
  const [sourceImageUploading, setSourceImageUploading] = useState(false);
  const sourceImageFileRef = useRef<HTMLInputElement>(null);

  /** 이미지 경로인지 이모지인지 판별 */
  const isImagePath = (v: string) => v.startsWith('/') || v.startsWith('http');

  /** 경로에서 파일명 추출 (확장자 제외) */
  const getFileName = (path: string) => {
    const name = path.split('/').pop() || '';
    return name.replace(/\.[^.]+$/, '');
  };

  /** 출처 아이콘 렌더 (이미지 경로 또는 이모지) */
  const renderSourceImg = (image: string, label: string, size = 'w-4 h-4') => {
    if (isImagePath(image)) {
      return <img src={image} alt={label} className={`${size} rounded-full object-cover`} />;
    }
    return <span className={`${size} flex items-center justify-center text-sm leading-none`}>{image}</span>;
  };

  const handleAddInsightSource = () => {
    if (!newSourceLabel.trim() || !onInsightSourcesChange) return;
    const icon = sourceImageMode === 'emoji' ? newSourceEmoji : newSourceImage;
    if (!icon) return;
    const newSrc: InsightSource = {
      id: `src-${Date.now()}`,
      label: newSourceLabel.trim(),
      image: icon,
    };
    onInsightSourcesChange([...insightSources, newSrc]);
    setNewSourceLabel('');
    setNewSourceImage('');
    setNewSourceEmoji('');
  };

  const handleRemoveInsightSource = (srcId: string) => {
    if (!onInsightSourcesChange) return;
    onInsightSourcesChange(insightSources.filter((s) => s.id !== srcId));
  };

  const renderInsightFields = () => {
    const i = data as InsightItem;
    return (
      <>
        {/* 출처 */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium text-gray-600">출처</label>
            <button onClick={() => setShowSourceManager(!showSourceManager)}
              className={`text-xs ${typeTheme.insight.manage}`}>
              {showSourceManager ? '닫기' : '관리'}
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {insightSources.map((src) => (
              <button key={src.id}
                onClick={() => update({ source: i.source === src.id ? '' : src.id })}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                  i.source === src.id ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-300' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {renderSourceImg(src.image, src.label)}
                {src.label}
              </button>
            ))}
          </div>
          {showSourceManager && (
            <div className="mt-2 p-3 bg-gray-50 rounded-xl space-y-3">
              {/* 새 출처 추가 */}
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input type="text" placeholder="새 출처 이름" value={newSourceLabel}
                    onChange={(e) => setNewSourceLabel(e.target.value)}
                    className="flex-1 px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-200" />
                  <button onClick={handleAddInsightSource}
                    disabled={!newSourceLabel.trim() || (sourceImageMode === 'image' ? !newSourceImage : !newSourceEmoji)}
                    className="px-2 py-1.5 text-xs text-white bg-amber-400 hover:bg-amber-500 rounded-lg disabled:opacity-40">추가</button>
                </div>
                {/* 이미지 / 이모지 탭 */}
                <div className="flex gap-1 mb-1">
                  <button onClick={() => setSourceImageMode('image')}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                      sourceImageMode === 'image' ? 'bg-amber-200 text-amber-800' : 'bg-gray-200 text-gray-500'
                    }`}>이미지</button>
                  <button onClick={() => setSourceImageMode('emoji')}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                      sourceImageMode === 'emoji' ? 'bg-amber-200 text-amber-800' : 'bg-gray-200 text-gray-500'
                    }`}>이모지</button>
                </div>
                {sourceImageMode === 'image' ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      {availableSourceImages.map((path) => (
                        <button key={path}
                          onClick={() => setNewSourceImage(path)}
                          className={`w-8 h-8 rounded-lg overflow-hidden border-2 transition-all ${
                            newSourceImage === path ? 'border-amber-400 ring-1 ring-amber-300' : 'border-gray-200 hover:border-gray-400'
                          }`}
                          title={getFileName(path)}>
                          <img src={path} alt={getFileName(path)} className="w-full h-full object-cover" />
                        </button>
                      ))}
                      {/* 업로드 버튼 */}
                      <button
                        onClick={() => sourceImageFileRef.current?.click()}
                        disabled={sourceImageUploading}
                        className="w-8 h-8 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-amber-400 hover:text-amber-500 transition-all"
                        title="이미지 업로드"
                      >
                        {sourceImageUploading
                          ? <span className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                          : <span className="text-xs">+</span>}
                      </button>
                      <input
                        ref={sourceImageFileRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setSourceImageUploading(true);
                          try {
                            const url = await uploadImage(file, 'sources');
                            setNewSourceImage(url);
                          } catch (err) {
                            alert(err instanceof Error ? err.message : '이미지 업로드 실패');
                          } finally {
                            setSourceImageUploading(false);
                            e.target.value = '';
                          }
                        }}
                      />
                    </div>
                    {/* 업로드된 이미지 미리보기 */}
                    {newSourceImage && isImagePath(newSourceImage) && !availableSourceImages.includes(newSourceImage) && (
                      <div className="flex items-center gap-2 px-2 py-1 bg-amber-50 rounded-lg">
                        <img src={newSourceImage} alt="업로드됨" className="w-6 h-6 rounded-full object-cover" />
                        <span className="text-[10px] text-amber-600 truncate flex-1">업로드된 이미지</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex gap-2 items-center">
                    <input type="text" placeholder="이모지 입력 (예: 📱)" value={newSourceEmoji}
                      onChange={(e) => setNewSourceEmoji(e.target.value)}
                      className="w-20 px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-center text-sm focus:outline-none focus:ring-2 focus:ring-amber-200" />
                    {newSourceEmoji && <span className="text-lg">{newSourceEmoji}</span>}
                  </div>
                )}
              </div>
              {/* 등록된 출처 목록 (모두 삭제 가능) */}
              <div>
                <span className="text-[10px] text-gray-400 block mb-1">등록된 출처</span>
                <div className="flex flex-wrap gap-1">
                  {insightSources.map((src) => (
                    <span key={src.id} className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-white rounded-full border">
                      {renderSourceImg(src.image, src.label, 'w-3.5 h-3.5')}
                      {src.label}
                      <button onClick={() => handleRemoveInsightSource(src.id)} className="text-gray-400 hover:text-red-500 ml-0.5">x</button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 링크 */}
        <div>
          <label className="text-sm font-medium text-gray-600 block mb-1.5">링크</label>
          <input type="url" value={i.link || ''} onChange={(e) => update({ link: e.target.value })}
            placeholder="https://"
            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-200" />
        </div>

        {/* 날짜 + 시간 + 중요도 */}
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-sm font-medium text-gray-600 block mb-1.5">기록일</label>
            <input type="date" value={i.createdAt} onChange={(e) => update({ createdAt: e.target.value })}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-200" />
          </div>
          <div className="w-24">
            <label className="text-sm font-medium text-gray-600 block mb-1.5">시간</label>
            <input type="time" value={i.time || ''} onChange={(e) => update({ time: e.target.value })}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-200" />
          </div>
          <div className="w-28">
            <label className="text-sm font-medium text-gray-600 block mb-1.5">중요도</label>
            <select value={i.priority || 'medium'} onChange={(e) => update({ priority: e.target.value as InsightItem['priority'] })}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-200">
              <option value="high">높음</option>
              <option value="medium">보통</option>
              <option value="low">낮음</option>
            </select>
          </div>
        </div>

        {/* 프로젝트 */}
        <div>
          <label className="text-sm font-medium text-gray-600 block mb-1.5">프로젝트</label>
          <ProjectSelect value={i.project || ''} onChange={(v) => update({ project: v })} placeholder="선택 안함" />
        </div>

        {/* 내용 */}
        <div>
          <label className="text-sm font-medium text-gray-600 block mb-1.5">내용</label>
          <textarea value={i.content} onChange={(e) => update({ content: e.target.value })} rows={3}
            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-200" />
        </div>

        {/* 태그 */}
        {renderTagEditor(i.tags, (tags) => update({ tags }))}
      </>
    );
  };

  const renderReadingFields = () => {
    const r = data as ReadingItem;
    return (
      <>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-sm font-medium text-gray-600 block mb-1.5">저자/강사</label>
            <input type="text" value={r.author} onChange={(e) => update({ author: e.target.value })}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
          </div>
          <div className="w-24">
            <label className="text-sm font-medium text-gray-600 block mb-1.5">상태</label>
            <select value={r.status} onChange={(e) => update({ status: e.target.value as ReadingItem['status'] })}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200">
              <option value="planned">예정</option>
              <option value="reading">읽는 중</option>
              <option value="completed">완독</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-sm font-medium text-gray-600 block mb-1.5">시작일</label>
            <input type="date" value={r.startDate || ''} onChange={(e) => update({ startDate: e.target.value })}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
          </div>
          <div className="flex-1">
            <label className="text-sm font-medium text-gray-600 block mb-1.5">완료일</label>
            <input type="date" value={r.completedDate || ''} onChange={(e) => update({ completedDate: e.target.value })}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
          </div>
        </div>
        {/* 링크 */}
        <div>
          <label className="text-sm font-medium text-gray-600 block mb-1.5">링크</label>
          <input type="url" value={r.link || ''} onChange={(e) => update({ link: e.target.value })}
            placeholder="https://"
            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
        </div>
        {/* 한줄평 */}
        <div>
          <label className="text-sm font-medium text-gray-600 block mb-1.5">한줄평</label>
          <input type="text" value={r.review || ''} onChange={(e) => update({ review: e.target.value })}
            placeholder="이 책/강의에 대한 한줄 감상"
            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
        </div>
        {/* 태그 */}
        {renderTagEditor(r.tags || [], (tags) => update({ tags }))}
      </>
    );
  };

  const theme = typeTheme[type];

  const renderTagEditor = (currentTags: string[], onChange: (tags: string[]) => void) => (
    <div>
      <label className="text-sm font-medium text-gray-600 block mb-1.5">태그</label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {currentTags.map((tag) => (
          <span key={tag} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${theme.tag}`}>
            #{tag}
            <button onClick={() => onChange(currentTags.filter((t) => t !== tag))}
              className={`ml-0.5 ${theme.tagX}`}>x</button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault();
              const newTags = handleAddTag(currentTags);
              onChange(newTags);
              setTagInput('');
            }
          }}
          placeholder="태그 입력 후 Enter"
          className={`flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 ${theme.ring}`} />
      </div>
    </div>
  );

  // ── 뷰어 모드 렌더 함수들 ──

  const renderScheduleViewer = () => {
    const s = data as ScheduleItem;
    const cat = categories.find((c) => c.id === s.category);
    return (
      <div>
        {/* 날짜 + 시간 — 2열 그리드 */}
        <div className="grid grid-cols-2 gap-4 py-4 border-t border-gray-100">
          <ViewSection label="날짜"><span className="text-sm text-gray-800">{s.date}</span></ViewSection>
          {s.time ? <ViewSection label="시간"><span className="text-sm text-gray-800">{s.time}</span></ViewSection> : <div />}
        </div>
        {/* 프로젝트 + 종류 — 2열 그리드 */}
        {(s.project || cat) && (
          <div className="grid grid-cols-2 gap-4 py-4 border-t border-gray-100">
            {s.project ? (
              <ViewSection label="프로젝트">
                <button
                  onClick={() => {
                    onClose();
                    if (scheduleProjectId) navigate(`/project/${scheduleProjectId}`);
                  }}
                  className="text-sm text-orange-600 hover:text-orange-700 font-medium hover:underline transition-colors"
                >
                  {s.project} &rarr;
                </button>
              </ViewSection>
            ) : <div />}
            {cat ? (
              <ViewSection label="종류">
                <span className="inline-flex items-center gap-1.5 text-sm text-gray-800">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                  {cat.label}
                </span>
              </ViewSection>
            ) : <div />}
          </div>
        )}
        {s.repeat && s.repeat !== 'none' && (
          <div className="py-4 border-t border-gray-100">
            <span className="text-[11px] font-semibold text-gray-400 block mb-1">반복</span>
            <span className="text-sm text-gray-800">{repeatLabels[s.repeat]}</span>
          </div>
        )}
        {s.reminder && s.reminder !== 'none' && (
          <div className="py-4 border-t border-gray-100">
            <span className="text-[11px] font-semibold text-gray-400 block mb-1">알림</span>
            <span className="text-sm text-gray-800">{reminderOptions.find((o) => o.value === s.reminder)?.label}</span>
          </div>
        )}
        {s.notes && (
          <div className="py-4 border-t border-gray-100">
            <span className="text-[11px] font-semibold text-gray-400 block mb-1">비고</span>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{s.notes}</p>
          </div>
        )}
        {s.tags && s.tags.length > 0 && (
          <div className="pt-4 border-t border-gray-100">
            <ViewTags tags={s.tags} theme={theme.tag} />
          </div>
        )}
      </div>
    );
  };

  const renderTaskViewer = () => {
    const t = data as TaskItem;
    const cat = categories.find((c) => c.id === t.category);
    const statusMap: Record<string, { label: string; cls: string }> = {
      pending: { label: '대기', cls: 'bg-gray-100 text-gray-500' },
      in_progress: { label: '진행중', cls: 'bg-blue-100 text-blue-600' },
      completed: { label: '완료', cls: 'bg-green-100 text-green-600' },
    };
    const st = statusMap[t.status] || statusMap.pending;
    const prioMap: Record<string, { label: string; cls: string }> = {
      high: { label: '높음', cls: 'text-red-500' },
      medium: { label: '보통', cls: 'text-amber-500' },
      low: { label: '낮음', cls: 'text-gray-400' },
    };
    const prio = prioMap[t.priority] || prioMap.medium;
    return (
      <div>
        {/* 제목 */}
        <h2 className="text-base font-bold text-gray-900 pb-4">{t.title || '(제목 없음)'}</h2>

        {/* 상태 + 우선순위 + 마감일 */}
        <div className="flex gap-6 py-4 border-t border-gray-100 flex-wrap">
          <ViewSection label="상태">
            <button
              onClick={() => {
                const cycle: Record<string, string> = { pending: 'in_progress', in_progress: 'completed', completed: 'pending' };
                const next = cycle[t.status] || 'pending';
                const updated = { ...data, status: next } as TaskItem;
                setData(updated);
                (onQuickUpdate || onSave)(updated);
              }}
              className={`text-xs px-2.5 py-1 rounded-full font-medium cursor-pointer hover:opacity-80 transition-opacity ${st.cls}`}
            >
              {st.label}
            </button>
          </ViewSection>
          <ViewSection label="우선순위">
            <span className={`text-sm font-medium ${prio.cls}`}>{prio.label}</span>
          </ViewSection>
          {t.date && <ViewSection label="마감일"><span className="text-sm text-gray-800">{t.date}</span></ViewSection>}
        </div>

        {/* 연결목표 + 종류 — 2열 그리드 */}
        {(goalTitle || cat) && (
          <div className="grid grid-cols-2 gap-4 py-3 border-t border-gray-100">
            {goalTitle ? (
              <ViewSection label="연결 목표">
                <button
                  onClick={() => {
                    onClose();
                    if (goalProjectId) navigate(`/project/${goalProjectId}`);
                  }}
                  className="hover:opacity-80 transition-opacity"
                >
                  <GoalBadge title={goalTitle} projectColor={goalProjectColor} size="md" />
                </button>
              </ViewSection>
            ) : <div />}
            {cat ? (
              <ViewSection label="종류">
                <span className="inline-flex items-center gap-1.5 text-sm text-gray-800">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                  {cat.label}
                </span>
              </ViewSection>
            ) : <div />}
          </div>
        )}

        {/* 메모 */}
        {t.notes && (
          <div className="py-4 border-t border-gray-100">
            <span className="text-[11px] font-semibold text-gray-400 block mb-1">메모</span>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{t.notes}</p>
          </div>
        )}

        {/* 반복 */}
        {t.repeat && t.repeat !== 'none' && (
          <div className="py-4 border-t border-gray-100">
            <span className="text-[11px] font-semibold text-gray-400 block mb-1">반복</span>
            <span className="text-sm text-gray-800">{repeatLabels[t.repeat]}</span>
          </div>
        )}

        {/* AI 대화 참고 */}
        {convMessages.length > 0 && (() => {
          const aiMsg = convMessages.find((m) => m.role === 'assistant' && m.ai_name);
          const aiImage = aiMsg?.ai_name ? aiNameToImage[aiMsg.ai_name] : undefined;
          const aiName = aiMsg?.ai_name || 'AI';
          return (
            <div className="pt-4 pb-5 border-t border-gray-100">
              <button
                onClick={() => setShowConvMessages(!showConvMessages)}
                className="text-xs font-medium text-green-500 hover:text-green-600 flex items-center gap-1.5 transition-colors"
              >
                {aiImage
                  ? <img src={aiImage} alt={aiName} className="w-4 h-4 rounded-full object-cover" />
                  : <span>💬</span>}
                {aiName} 대화 참고 {showConvMessages ? '▲' : '▼'}
              </button>
              {showConvMessages && (
                <div className="mt-2.5 space-y-2 max-h-48 overflow-y-auto">
                  {convMessages.map((m) => (
                    <div
                      key={m.id}
                      className={`text-xs px-3 py-2 rounded-xl ${
                        m.role === 'assistant'
                          ? 'bg-green-50 text-gray-700'
                          : 'bg-gray-100 text-gray-600 ml-6'
                      }`}
                    >
                      {m.role === 'user' && <span className="font-medium text-gray-500 mr-1">나</span>}
                      <span className="whitespace-pre-wrap">{m.content}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* 태그 */}
        {t.tags && t.tags.length > 0 && (
          <div className="pt-4 border-t border-gray-100">
            <ViewTags tags={t.tags} theme={theme.tag} />
          </div>
        )}
      </div>
    );
  };

  const renderInsightViewer = () => {
    const i = data as InsightItem;
    const src = insightSources.find((s) => s.id === i.source);
    return (
      <div>
        {/* 프로젝트 + 출처 + 기록일 */}
        <div className="flex gap-6 py-4 border-t border-gray-100 flex-wrap">
          {i.project && (
            <ViewSection label="프로젝트">
              <button
                onClick={() => {
                  onClose();
                  if (insightProjectId) navigate(`/project/${insightProjectId}`);
                }}
                className="text-sm text-amber-600 hover:text-amber-700 font-medium hover:underline transition-colors"
              >
                {i.project} &rarr;
              </button>
            </ViewSection>
          )}
          {src && (
            <ViewSection label="출처">
              <span className="inline-flex items-center gap-1.5 text-sm text-gray-800">
                {renderSourceImg(src.image, src.label, 'w-4 h-4')}
                {src.label}
              </span>
            </ViewSection>
          )}
          {i.createdAt && (
            <ViewSection label="기록일">
              <span className="text-sm text-gray-800">{i.createdAt}{i.time ? ` ${i.time}` : ''}</span>
            </ViewSection>
          )}
        </div>
        {/* 내용 */}
        {i.content && (
          <div className="py-4 border-t border-gray-100">
            <span className="text-[11px] font-semibold text-gray-400 block mb-1">내용</span>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{i.content}</p>
          </div>
        )}
        {/* 태그 */}
        {i.tags && i.tags.length > 0 && (
          <div className="pt-4 border-t border-gray-100">
            <ViewTags tags={i.tags} theme={theme.tag} />
          </div>
        )}
      </div>
    );
  };

  const renderReadingViewer = () => {
    const r = data as ReadingItem;
    const statusMap: Record<string, string> = { planned: '예정', reading: '읽는 중', completed: '완독' };
    return (
      <div className="divide-y divide-gray-100">
        <div className="flex gap-4 py-2 flex-wrap">
          {r.author && <ViewSection label="저자/강사"><span className="text-sm text-gray-800">{r.author}</span></ViewSection>}
          <ViewSection label="상태"><span className="text-sm text-gray-800">{statusMap[r.status] || r.status}</span></ViewSection>
        </div>
        <div className="flex gap-4 py-2 flex-wrap">
          {r.startDate && <ViewSection label="시작일"><span className="text-sm text-gray-800">{r.startDate}</span></ViewSection>}
          {r.completedDate && <ViewSection label="완료일"><span className="text-sm text-gray-800">{r.completedDate}</span></ViewSection>}
        </div>
        {r.link && (
          <ViewSection label="링크">
            <a href={r.link} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors font-medium">
              바로가기 &rarr;
            </a>
          </ViewSection>
        )}
        {r.review && (
          <ViewSection label="한줄평">
            <p className="text-sm text-gray-700 leading-relaxed italic border-l-2 border-blue-200 pl-3">{r.review}</p>
          </ViewSection>
        )}
        {r.tags && r.tags.length > 0 && (
          <ViewSection label="태그"><ViewTags tags={r.tags} theme={theme.tag} /></ViewSection>
        )}
      </div>
    );
  };

  const typeLabels: Record<ItemType, { label: string; image: string; color: string }> = {
    schedule: { label: '일정 상세', image: '/images/schedule.png', color: 'text-orange-600' },
    task:     { label: '할일 상세', image: '/images/todo.png',     color: 'text-green-600' },
    insight:  { label: '인사이트 상세', image: '/images/insight.png', color: 'text-amber-600' },
    reading:  { label: '스터디 상세', image: '/images/book.png',     color: 'text-blue-600' },
  };

  const tl = typeLabels[type];

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-3xl shadow-hover w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className={`px-6 pt-5 pb-3 flex items-center justify-between flex-shrink-0 ${theme.headerBg} border-b border-gray-100`}>
          <h3 className={`text-lg font-bold flex items-center gap-2 ${tl.color}`}>
            <img src={tl.image} alt={tl.label} className="w-5 h-5 object-contain" />
            <span>{tl.label}</span>
            {type === 'task' && (
              <button
                onClick={() => { update({ starred: !(data as TaskItem).starred }); }}
                className={`text-xl transition-all ${(data as TaskItem).starred ? 'text-amber-400 scale-110' : 'text-gray-300 hover:text-amber-300'}`}
                title={(data as TaskItem).starred ? '즐겨찾기 해제' : '즐겨찾기'}
              >
                {(data as TaskItem).starred ? '★' : '☆'}
              </button>
            )}
          </h3>
          <div className="flex items-center gap-2">
            {editing && type === 'schedule' && (
              <button onClick={() => downloadIcs(data as ScheduleItem)}
                className="text-xs px-2.5 py-1 rounded-lg font-medium transition-colors text-orange-500 hover:bg-orange-50 flex items-center gap-1"
                title="Apple 캘린더에 추가"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                캘린더
              </button>
            )}
            {!editing && (
              <>
                <button onClick={() => setEditing(true)}
                  className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${tl.color} hover:bg-gray-100`}>
                  수정
                </button>
                <button onClick={onClose}
                  className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${tl.color} hover:bg-gray-100`}>
                  닫기
                </button>
              </>
            )}
          </div>
        </div>

        {/* 본문 - 스크롤 영역 */}
        <div className={`px-6 pb-4 overflow-y-auto flex-1 ${type === 'reading' ? 'pt-5' : 'pt-4'}`}>
          {editing ? (
            <div className="space-y-5">
              {/* 제목 (편집) */}
              <div>
                <label className="text-sm font-medium text-gray-600 block mb-1.5">제목</label>
                <input type="text" value={(data as { title?: string }).title || ''}
                  onChange={(e) => update({ title: e.target.value })}
                  className={`w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 ${theme.ring}`} />
              </div>
              {type === 'schedule' && renderScheduleFields()}
              {type === 'task' && renderTaskFields()}
              {type === 'insight' && renderInsightFields()}
              {type === 'reading' && renderReadingFields()}
            </div>
          ) : (
            <div>
              {/* 제목 (뷰어) — task 타입은 renderTaskViewer 안에서 렌더 */}
              {type !== 'task' && (
                <div className="flex items-center gap-2 pb-4">
                  <h2 className="text-base font-bold text-gray-900 flex-1 min-w-0 truncate">
                    {(data as { title?: string }).title || '(제목 없음)'}
                  </h2>
                  {type === 'insight' && (data as InsightItem).priority && (() => {
                    const p = (data as InsightItem).priority;
                    const cfg = p === 'high' ? { l: '높음', c: 'bg-red-100 text-red-500' }
                      : p === 'low' ? { l: '낮음', c: 'bg-gray-100 text-gray-400' }
                      : { l: '보통', c: 'bg-amber-100 text-amber-500' };
                    return <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${cfg.c}`}>{cfg.l}</span>;
                  })()}
                </div>
              )}
              {type === 'schedule' && renderScheduleViewer()}
              {type === 'task' && renderTaskViewer()}
              {type === 'insight' && renderInsightViewer()}
              {type === 'reading' && renderReadingViewer()}
            </div>
          )}
        </div>

        {/* 하단 버튼 */}
        <div className="px-6 py-4 flex gap-3 justify-between border-t border-gray-100 flex-shrink-0">
          {editing ? (
            <>
              <div className="flex gap-2">
                <button onClick={() => onDelete(item.id)}
                  className="px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                  삭제
                </button>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setEditing(false)}
                  className="px-5 py-2.5 text-sm text-gray-500 hover:bg-gray-100 rounded-xl transition-colors">
                  취소
                </button>
                <button onClick={() => { onSave(data); setEditing(false); }}
                  className={`px-5 py-2.5 text-sm text-white rounded-xl font-medium transition-colors ${theme.saveBtn}`}>
                  저장
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 ml-auto">
              {type === 'insight' && (data as InsightItem).link && (
                <a href={(data as InsightItem).link} target="_blank" rel="noopener noreferrer"
                  className="px-5 py-2.5 text-sm text-amber-500 hover:bg-amber-50 rounded-xl transition-colors flex items-center gap-1.5">
                  링크바로가기 &rarr;
                </a>
              )}
              {type === 'schedule' && (
                <button onClick={() => downloadIcs(data as ScheduleItem)}
                  className="px-3 py-2.5 text-sm text-orange-500 hover:bg-orange-50 rounded-xl transition-colors flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                    <path d="M12 14l-2 2 2 2" />
                    <path d="M16 16h-6" />
                  </svg>
                  캘린더 추가
                </button>
              )}
              {/* 뽀모도로 (할일 전용) */}
              {type === 'task' && (
                <div ref={pomodoroRef} className="relative">
                  <button
                    onClick={() => setShowPomodoroPopover(!showPomodoroPopover)}
                    className="px-5 py-2.5 text-sm text-gray-500 hover:bg-gray-100 rounded-xl transition-colors flex items-center gap-1.5"
                  >
                    {'\uD83C\uDF45'} 뽀모도로
                  </button>
                  {showPomodoroPopover && (() => {
                    const t = data as TaskItem;
                    return (
                      <div className="absolute right-0 bottom-12 w-60 bg-white rounded-2xl shadow-hover border border-gray-100 p-4 z-30 space-y-3">
                        <div className="text-xs font-semibold text-gray-500">뽀모도로 설정</div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-600">작업 시간</span>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min={5}
                                max={60}
                                step={5}
                                value={t.pomodoroEstimate ?? 25}
                                onChange={(e) => {
                                  const v = Math.max(5, Math.min(60, Number(e.target.value) || 25));
                                  const updated = { ...data, pomodoroEstimate: v } as TaskItem;
                                  setData(updated);
                                  onSave(updated);
                                }}
                                className="w-14 px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-red-200"
                              />
                              <span className="text-xs text-gray-400">분</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-600">휴식 시간</span>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min={1}
                                max={30}
                                value={t.pomodoroBreakMin ?? 5}
                                onChange={(e) => {
                                  const v = Math.max(1, Math.min(30, Number(e.target.value) || 5));
                                  const updated = { ...data, pomodoroBreakMin: v } as TaskItem;
                                  setData(updated);
                                  onSave(updated);
                                }}
                                className="w-14 px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-green-200"
                              />
                              <span className="text-xs text-gray-400">분</span>
                            </div>
                          </div>
                        </div>
                        {(t.pomodoroCompleted ?? 0) > 0 && (
                          <div className="text-xs text-gray-400 text-center">완료 세션: {t.pomodoroCompleted}</div>
                        )}
                        {onStartPomodoro && t.status !== 'completed' && (
                          <button
                            onClick={() => {
                              onStartPomodoro(t, t.pomodoroEstimate ?? 25, t.pomodoroBreakMin ?? 5);
                              setShowPomodoroPopover(false);
                            }}
                            className="w-full py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors flex items-center justify-center gap-1.5"
                          >
                            <span>{'\u25B6'}</span> 시작
                          </button>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
