/**
 * @file src/components/records/RecordForm.tsx
 * @description 기록 추가/수정 폼 (타입별 동적 렌더링)
 * - SVG 아이콘 + 타입별 테마 색상
 * - 기분(이모지) + 에너지(게이지바) 각각 독립 행
 */
import { useState } from 'react';
import { RecordItem, RecordType, MorningTemplate, EveningTemplate, WeeklyTemplate } from '../../types';
import {
  recordTypeConfig, moods,
  emptyMorningTemplate, emptyEveningTemplate, emptyWeeklyTemplate,
} from '../../utils/recordTemplates';
import { ListFieldEditor } from './ListFieldEditor';
import { EnergySelector } from './EnergySelector';
import { TiptapEditor } from '../tiptap/TiptapEditor';
import {
  RecordTypeIcon,
  GratitudeIcon, SparkleIcon, AffirmationIcon, IdeaIcon, RocketIcon,
  TrophyIcon, ImproveIcon, BookIcon, ThoughtIcon, TargetIcon,
} from './RecordIcons';

interface RecordFormProps {
  recordType: RecordType;
  initialData?: RecordItem;
  onSave: (record: Omit<RecordItem, 'id' | 'createdAt'> & { id?: string }) => void;
  onCancel: () => void;
}

/** 섹션 카드 (타입별 테마 색상, 라벨 배지) */
function FormSection({ icon, label, sectionBg, labelColor, badgeBg, children }: {
  icon: React.ReactNode; label: string; sectionBg: string; labelColor: string; badgeBg: string; children: React.ReactNode;
}) {
  return (
    <div className={`${sectionBg} rounded-xl p-3.5 space-y-2`}>
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${badgeBg}`}>
        {icon}
        <span className={`text-[11px] font-semibold ${labelColor}`}>{label}</span>
      </span>
      {children}
    </div>
  );
}

export function RecordForm({ recordType, initialData, onSave, onCancel }: RecordFormProps) {
  const cfg = recordTypeConfig[recordType];

  const [title, setTitle] = useState(initialData?.title || '');
  const [date, setDate] = useState(initialData?.date || new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState(initialData?.time || new Date().toTimeString().slice(0, 5));
  const [mood, setMood] = useState(initialData?.mood || '');
  const [energy, setEnergy] = useState(initialData?.energy || 0);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(initialData?.tags || []);

  const [morningData, setMorningData] = useState<MorningTemplate>(
    initialData?.morningData || emptyMorningTemplate()
  );
  const [eveningData, setEveningData] = useState<EveningTemplate>(
    initialData?.eveningData || emptyEveningTemplate()
  );
  const [weeklyData, setWeeklyData] = useState<WeeklyTemplate>(
    initialData?.weeklyData || emptyWeeklyTemplate()
  );
  const [memoBody, setMemoBody] = useState<Record<string, unknown>>(
    initialData?.memoBody || {}
  );

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
      setTagInput('');
    }
  };

  const handleSubmit = () => {
    const base = {
      id: initialData?.id,
      recordType,
      date,
      time: time || undefined,
      title,
      mood: mood || undefined,
      energy: energy || undefined,
      tags: tags.length > 0 ? tags : undefined,
      conversationId: initialData?.conversationId,
    };

    if (recordType === 'morning') onSave({ ...base, morningData });
    else if (recordType === 'evening') onSave({ ...base, eveningData });
    else if (recordType === 'weekly') onSave({ ...base, weeklyData });
    else onSave({ ...base, memoBody });
  };

  /** 공통 섹션 props */
  const sp = { sectionBg: cfg.sectionBg, labelColor: cfg.labelColor, badgeBg: cfg.bgColor };

  return (
    <div className="bg-white rounded-2xl p-4 shadow-soft space-y-4">
      {/* 헤더 */}
      <div className="flex items-center gap-2">
        <div className={`w-8 h-8 rounded-xl ${cfg.bgColor} flex items-center justify-center`}>
          <RecordTypeIcon type={recordType} size={18} className={cfg.iconText} />
        </div>
        <span className={`text-sm font-bold ${cfg.textColor}`}>{cfg.label}</span>
      </div>

      {/* 제목 */}
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={`${cfg.label} 제목`}
        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-pink-200"
      />

      {/* 날짜 + 시간 */}
      <div className="flex gap-2">
        <div className="flex-1">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-200" />
        </div>
        {recordType !== 'weekly' && (
          <div className="w-28">
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-200" />
          </div>
        )}
      </div>

      {/* 기분 + 에너지 (메모 제외) - 2열 그리드, 모바일 1열 */}
      {recordType !== 'memo' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-gray-600 block mb-1.5">기분</label>
            <div className="flex gap-1">
              {moods.map((m) => (
                <button
                  key={m}
                  onClick={() => setMood(mood === m ? '' : m)}
                  className={`text-xl w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                    mood === m ? `${cfg.bgColor} scale-110 shadow-sm` : 'hover:bg-gray-50'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <EnergySelector value={energy} onChange={setEnergy} />
        </div>
      )}

      {/* ── 아침 일기 섹션 ── */}
      {recordType === 'morning' && (
        <div className="space-y-5">
          <FormSection icon={<GratitudeIcon size={14} className={cfg.iconText} />} label="감사하게 여기는 것들" {...sp}>
            <ListFieldEditor label="" fields={morningData.gratitude}
              onChange={(f) => setMorningData({ ...morningData, gratitude: f })} placeholder="감사한 것..." accentColor={cfg.accent} />
          </FormSection>
          <FormSection icon={<SparkleIcon size={14} className={cfg.iconText} />} label="오늘을 기분 좋게 만드는 것" {...sp}>
            <ListFieldEditor label="" fields={morningData.goodThings}
              onChange={(f) => setMorningData({ ...morningData, goodThings: f })} placeholder="기분 좋은 것..." accentColor={cfg.accent} />
          </FormSection>
          <FormSection icon={<AffirmationIcon size={14} className={cfg.iconText} />} label="오늘의 다짐" {...sp}>
            <input type="text" value={morningData.affirmation}
              onChange={(e) => setMorningData({ ...morningData, affirmation: e.target.value })}
              placeholder="오늘은..."
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-200" />
          </FormSection>
          <FormSection icon={<IdeaIcon size={14} className={cfg.iconText} />} label="아이디어 주제" {...sp}>
            <ListFieldEditor label="" fields={morningData.ideaTopics}
              onChange={(f) => setMorningData({ ...morningData, ideaTopics: f })} placeholder="아이디어..." accentColor={cfg.accent} />
          </FormSection>
          <FormSection icon={<RocketIcon size={14} className={cfg.iconText} />} label="실행할 첫 단계" {...sp}>
            <ListFieldEditor label="" fields={morningData.ideaFirstSteps}
              onChange={(f) => setMorningData({ ...morningData, ideaFirstSteps: f })} placeholder="첫 단계..." accentColor={cfg.accent} />
          </FormSection>
        </div>
      )}

      {/* ── 저녁 일기 섹션 ── */}
      {recordType === 'evening' && (
        <div className="space-y-5">
          <FormSection icon={<TrophyIcon size={14} className={cfg.iconText} />} label="오늘 굉장한 일" {...sp}>
            <ListFieldEditor label="" fields={eveningData.greatThings}
              onChange={(f) => setEveningData({ ...eveningData, greatThings: f })} placeholder="굉장한 일..." accentColor={cfg.accent} />
          </FormSection>
          <FormSection icon={<ImproveIcon size={14} className={cfg.iconText} />} label="더 좋은 날이 되려면" {...sp}>
            <textarea value={eveningData.improvement}
              onChange={(e) => setEveningData({ ...eveningData, improvement: e.target.value })}
              rows={2} placeholder="개선할 점..."
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-pink-200" />
          </FormSection>
          <FormSection icon={<BookIcon size={14} className={cfg.iconText} />} label="추가 / 오늘의 배움" {...sp}>
            <textarea value={eveningData.extra}
              onChange={(e) => setEveningData({ ...eveningData, extra: e.target.value })}
              rows={2} placeholder="오늘 배운 것..."
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-pink-200" />
          </FormSection>
        </div>
      )}

      {/* ── 주간 회고 섹션 ── */}
      {recordType === 'weekly' && (
        <div className="space-y-5">
          <FormSection icon={<TrophyIcon size={14} className={cfg.iconText} />} label="이번 주 성취" {...sp}>
            <ListFieldEditor label="" fields={weeklyData.achievements}
              onChange={(f) => setWeeklyData({ ...weeklyData, achievements: f })} placeholder="성취한 것..." accentColor={cfg.accent} />
          </FormSection>
          <FormSection icon={<ThoughtIcon size={14} className={cfg.iconText} />} label="아쉬웠던 점" {...sp}>
            <ListFieldEditor label="" fields={weeklyData.regrets}
              onChange={(f) => setWeeklyData({ ...weeklyData, regrets: f })} placeholder="아쉬웠던 것..." accentColor={cfg.accent} />
          </FormSection>
          <FormSection icon={<TargetIcon size={14} className={cfg.iconText} />} label="다음 주 목표" {...sp}>
            <ListFieldEditor label="" fields={weeklyData.nextGoals}
              onChange={(f) => setWeeklyData({ ...weeklyData, nextGoals: f })} placeholder="다음 주..." accentColor={cfg.accent} />
          </FormSection>
          <FormSection icon={<BookIcon size={14} className={cfg.iconText} />} label="배운 것" {...sp}>
            <textarea value={weeklyData.lessons}
              onChange={(e) => setWeeklyData({ ...weeklyData, lessons: e.target.value })}
              rows={2} placeholder="이번 주 배운 것..."
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-pink-200" />
          </FormSection>
        </div>
      )}

      {/* ── 메모 (Tiptap) ── */}
      {recordType === 'memo' && (
        <div>
          <label className="text-sm font-medium text-gray-600 block mb-1.5">본문</label>
          <TiptapEditor content={memoBody} onChange={setMemoBody} />
        </div>
      )}

      {/* 태그 */}
      {recordType !== 'memo' && (
        <div>
          <label className="text-sm font-medium text-gray-600 block mb-1.5">태그</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {tags.map((tag) => (
              <span key={tag} className={`inline-flex items-center gap-1 px-2.5 py-1 ${cfg.bgColor} ${cfg.textColor} rounded-full text-xs font-medium`}>
                #{tag}
                <button onClick={() => setTags(tags.filter((t) => t !== tag))} className="opacity-60 hover:opacity-100 ml-0.5">x</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input type="text" value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); handleAddTag(); } }}
              placeholder="태그 입력 후 Enter"
              className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-pink-200" />
          </div>
        </div>
      )}

      {/* 버튼 */}
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-xl">취소</button>
        <button onClick={handleSubmit} className={`px-4 py-2 text-sm text-white ${cfg.btnBg} ${cfg.btnHover} rounded-xl font-medium`}>
          {initialData ? '수정' : '추가'}
        </button>
      </div>
    </div>
  );
}
