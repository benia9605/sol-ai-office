/**
 * @file src/components/SaveModal.tsx
 * @description AI 채팅 → 할일/인사이트 저장 모달
 * - 할일: 제목, 프로젝트, 목표연결, 우선순위, 마감일, 종류, 태그, 더보기(메모/반복/뽀모도로)
 * - 인사이트: 제목, 내용, 출처(AI 자동선택), 링크, 기록일+시간, 프로젝트, 중요도, 태그
 * - AI 대화 내용 프리필 + 참고 대화 토글
 */
import { useState } from 'react';
import { SaveModalConfig, SaveData, ScheduleCategory, RepeatType, InsightSource } from '../types';
import { defaultTaskCategories } from '../data';
import { ProjectSelect } from './ProjectSelect';
import { GoalSelect } from './GoalSelect';
import { useInsightSources } from '../hooks/useInsightSources';

const isImagePath = (v: string) => v.startsWith('/') || v.startsWith('http');

/** AI 이름 → 출처 ID 매핑 */
const aiNameToSourceId: Record<string, string> = {
  '플래니': 'plani', '마키': 'maki', '데비': 'devi', '서치': 'searchi', '모디': 'modi',
};

interface SaveModalProps {
  config: SaveModalConfig;
  onSave: (data: SaveData) => void;
  onClose: () => void;
}

const typeConfig: Record<string, { image: string; label: string; titlePlaceholder: string; accent: string; ring: string; saveBtn: string; headerBg: string; tagCls: string }> = {
  task: {
    image: '/images/todo.png', label: '할일 추가', titlePlaceholder: '할일 제목',
    accent: 'text-green-600', ring: 'focus:ring-green-200', saveBtn: 'bg-green-500 hover:bg-green-600',
    headerBg: 'bg-green-50', tagCls: 'bg-green-100 text-green-600',
  },
  insight: {
    image: '/images/insight.png', label: '인사이트 저장', titlePlaceholder: '인사이트 제목',
    accent: 'text-amber-600', ring: 'focus:ring-amber-200', saveBtn: 'bg-amber-500 hover:bg-amber-600',
    headerBg: 'bg-amber-50', tagCls: 'bg-amber-100 text-amber-600',
  },
};

const repeatLabels: Record<RepeatType, string> = {
  none: '없음', daily: '매일', weekly: '매주', monthly: '매월', yearly: '매년',
};

function renderSourceImg(image: string, label: string, size = 'w-3.5 h-3.5') {
  if (isImagePath(image)) {
    return <img src={image} alt={label} className={`${size} rounded-full object-cover`} />;
  }
  return <span className={`${size} flex items-center justify-center text-sm leading-none`}>{image}</span>;
}

export function SaveModal({ config, onSave, onClose }: SaveModalProps) {
  const { type, message, room } = config;
  const tc = typeConfig[type] || typeConfig.task;

  // 인사이트 출처
  const { sources: insightSources } = useInsightSources();
  const defaultSourceId = aiNameToSourceId[room.aiName] || '';

  // 공통
  const [title, setTitle] = useState('');
  const [project, setProject] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [showChat, setShowChat] = useState(false);

  // 할일 전용
  const [taskDate, setTaskDate] = useState('');
  const [taskPriority, setTaskPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [taskCategory, setTaskCategory] = useState('');
  const [taskNotes, setTaskNotes] = useState('');
  const [taskRepeat, setTaskRepeat] = useState<RepeatType>('none');
  const [taskPomodoroEstimate] = useState(0);
  const [showTaskAdvanced, setShowTaskAdvanced] = useState(false);
  const [goalId, setGoalId] = useState<string | undefined>();
  const [tCategories] = useState<ScheduleCategory[]>(defaultTaskCategories);

  // 인사이트 전용
  const [content, setContent] = useState(message.content);
  const [insightSource, setInsightSource] = useState(defaultSourceId);
  const [insightLink, setInsightLink] = useState('');
  const [insightPriority, setInsightPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [insightDate, setInsightDate] = useState(new Date().toISOString().slice(0, 10));
  const [insightTime, setInsightTime] = useState(new Date().toTimeString().slice(0, 5));

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
      setTagInput('');
    }
  };

  const handleSubmit = () => {
    if (!title.trim()) return;
    const data: SaveData = {
      title,
      content: type === 'insight' ? content : '',
      source: type === 'insight' ? (insightSource || defaultSourceId || 'thought') : `ai_${room.aiName}`,
      project,
      tags,
    };
    if (type === 'task') {
      data.date = taskDate || undefined;
      data.priority = taskPriority;
      data.category = taskCategory || undefined;
      data.notes = taskNotes || undefined;
      data.repeat = taskRepeat !== 'none' ? taskRepeat : undefined;
      data.pomodoroEstimate = taskPomodoroEstimate || undefined;
      data.goalId = goalId;
    }
    if (type === 'insight') {
      data.link = insightLink || undefined;
      data.priority = insightPriority;
      data.date = insightDate;
      data.time = insightTime;
    }
    onSave(data);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-3xl shadow-hover w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className={`px-6 pt-5 pb-3 flex-shrink-0 ${tc.headerBg} border-b border-gray-100`}>
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <img src={tc.image} alt={tc.label} className="w-5 h-5 object-contain" />
            <span>{tc.label}</span>
          </h3>
        </div>

        {/* 본문 - 스크롤 영역 */}
        <div className="px-6 pt-4 pb-6 space-y-5 overflow-y-auto flex-1">
          {/* 제목 */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">제목</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder={tc.titlePlaceholder}
              className={`w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 ${tc.ring}`} />
          </div>

          {/* ── 인사이트 전용: 내용 ── */}
          {type === 'insight' && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">내용</label>
              <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={3}
                placeholder="인사이트 내용"
                className={`w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 ${tc.ring}`} />
            </div>
          )}

          {/* 참고 대화 */}
          <div>
            <button type="button" onClick={() => setShowChat(!showChat)}
              className={`text-xs font-medium flex items-center gap-1.5 ${tc.accent} hover:opacity-80 transition-colors`}>
              <img src={room.image} alt={room.aiName} className="w-4 h-4 rounded-full" />
              {room.aiName} 대화 참고 {showChat ? '▲' : '▼'}
            </button>
            {showChat && (
              <div className="mt-1.5 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-xs text-gray-600 max-h-28 overflow-y-auto whitespace-pre-wrap">
                {message.content}
              </div>
            )}
          </div>

          {/* ── 인사이트 전용: 출처 ── */}
          {type === 'insight' && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">출처</label>
              <div className="flex flex-wrap gap-1.5">
                {insightSources.map((src: InsightSource) => (
                  <button key={src.id} type="button"
                    onClick={() => setInsightSource(insightSource === src.id ? '' : src.id)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                      insightSource === src.id ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-300' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}>
                    {renderSourceImg(src.image, src.label)}
                    {src.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── 인사이트 전용: 링크 ── */}
          {type === 'insight' && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">링크 (선택)</label>
              <input type="url" placeholder="https://" value={insightLink}
                onChange={(e) => setInsightLink(e.target.value)}
                className={`w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 ${tc.ring}`} />
            </div>
          )}

          {/* ── 인사이트 전용: 기록일 + 시간 + 프로젝트 + 중요도 ── */}
          {type === 'insight' && (
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-1 block">기록일</label>
                <input type="date" value={insightDate}
                  onChange={(e) => setInsightDate(e.target.value)}
                  className={`w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 ${tc.ring}`} />
              </div>
              <div className="w-24">
                <label className="text-xs text-gray-500 mb-1 block">시간</label>
                <input type="time" value={insightTime}
                  onChange={(e) => setInsightTime(e.target.value)}
                  className={`w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 ${tc.ring}`} />
              </div>
              <div className="w-24">
                <label className="text-xs text-gray-500 mb-1 block">중요도</label>
                <select value={insightPriority} onChange={(e) => setInsightPriority(e.target.value as 'high' | 'medium' | 'low')}
                  className={`w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 ${tc.ring}`}>
                  <option value="high">높음</option>
                  <option value="medium">보통</option>
                  <option value="low">낮음</option>
                </select>
              </div>
            </div>
          )}

          {/* ── 할일 전용: 마감일 + 우선순위 ── */}
          {type === 'task' && (
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-1 block">마감일</label>
                <input type="date" value={taskDate} onChange={(e) => setTaskDate(e.target.value)}
                  className={`w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 ${tc.ring}`} />
              </div>
              <div className="w-24">
                <label className="text-xs text-gray-500 mb-1 block">우선순위</label>
                <select value={taskPriority} onChange={(e) => setTaskPriority(e.target.value as 'high' | 'medium' | 'low')}
                  className={`w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 ${tc.ring}`}>
                  <option value="high">높음</option>
                  <option value="medium">보통</option>
                  <option value="low">낮음</option>
                </select>
              </div>
            </div>
          )}

          {/* 프로젝트 - 할일은 목표 선택 시 자동 설정 */}
          {type !== 'task' && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">프로젝트</label>
              <ProjectSelect value={project} onChange={setProject} placeholder="선택 안함" />
            </div>
          )}

          {/* ── 할일 전용: 목표 연결 (프로젝트 자동 설정) ── */}
          {type === 'task' && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">목표 연결</label>
              <GoalSelect value={goalId} onChange={(gid, pName) => { setGoalId(gid); if (pName) setProject(pName); }} />
            </div>
          )}

          {/* ── 할일 전용: 종류(카테고리) ── */}
          {type === 'task' && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">종류</label>
              <div className="flex flex-wrap gap-1.5">
                {tCategories.map((cat) => (
                  <button key={cat.id}
                    onClick={() => setTaskCategory(taskCategory === cat.id ? '' : cat.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      taskCategory === cat.id ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                    style={taskCategory === cat.id ? { backgroundColor: cat.color } : undefined}>
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── 할일 전용: 더 보기 ── */}
          {type === 'task' && (
            <>
              <button onClick={() => setShowTaskAdvanced(!showTaskAdvanced)}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                {showTaskAdvanced ? '간단히 보기 ▲' : '더 보기 (메모/반복) ▼'}
              </button>
              {showTaskAdvanced && (
                <div className="space-y-5">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">메모</label>
                    <textarea value={taskNotes} onChange={(e) => setTaskNotes(e.target.value)} rows={3}
                      placeholder="메모를 입력하세요"
                      className={`w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 ${tc.ring}`} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">반복</label>
                    <select value={taskRepeat} onChange={(e) => setTaskRepeat(e.target.value as RepeatType)}
                      className={`w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 ${tc.ring}`}>
                      {Object.entries(repeatLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </>
          )}

          {/* 태그 */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">태그</label>
            <div className="flex gap-2 items-center flex-wrap">
              <input type="text" value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); handleAddTag(); } }}
                placeholder="태그 입력 후 Enter"
                className={`flex-1 min-w-[140px] px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 ${tc.ring}`} />
              {tags.map((t) => (
                <span key={t} className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${tc.tagCls}`}>
                  #{t}
                  <button onClick={() => setTags(tags.filter((tt) => tt !== t))} className="opacity-60 hover:opacity-100">x</button>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className="px-6 py-4 flex gap-3 justify-end border-t border-gray-100 flex-shrink-0">
          <button onClick={onClose}
            className="px-5 py-2.5 text-sm text-gray-500 hover:bg-gray-100 rounded-xl transition-colors">
            취소
          </button>
          <button onClick={handleSubmit} disabled={!title.trim()}
            className={`px-5 py-2.5 text-sm text-white rounded-xl font-medium transition-colors disabled:opacity-40 ${tc.saveBtn}`}>
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
