/**
 * @file src/components/records/RecordDetailView.tsx
 * @description 기록 상세 뷰 (전체화면 오버레이)
 * - SVG 아이콘 + 타입별 테마 색상
 * - 읽기 모드: 섹션별 카드 / 메모는 TiptapReadOnly
 * - 편집 모드: RecordForm 인라인
 */
import { useState } from 'react';
import { RecordItem, ListField } from '../../types';
import { recordTypeConfig } from '../../utils/recordTemplates';
import { RecordForm } from './RecordForm';
import { EnergyGauge } from './EnergySelector';
import { TiptapReadOnly } from '../tiptap/TiptapReadOnly';
import {
  RecordTypeIcon,
  GratitudeIcon, SparkleIcon, AffirmationIcon, IdeaIcon, RocketIcon,
  TrophyIcon, ImproveIcon, BookIcon, ThoughtIcon, TargetIcon,
} from './RecordIcons';

interface RecordDetailViewProps {
  record: RecordItem;
  onUpdate: (updated: RecordItem) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

/** 섹션 with SVG 아이콘 (타입별 색상, 라벨 배지) */
function Section({ icon, label, labelColor, badgeBg, children }: {
  icon: React.ReactNode; label: string; labelColor: string; badgeBg: string; children: React.ReactNode;
}) {
  return (
    <div className="py-4 first:pt-0 last:pb-0 space-y-2">
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${badgeBg}`}>
        {icon}
        <span className={`text-[11px] font-semibold ${labelColor}`}>{label}</span>
      </span>
      <div className="pl-1">{children}</div>
    </div>
  );
}

/** 리스트 항목 (타입별 불릿 색상) */
function ListItems({ items, bulletColor }: { items: ListField[]; bulletColor: string }) {
  const filled = items.filter((f) => f.text.trim());
  if (filled.length === 0) return <p className="text-sm text-gray-300 italic">-</p>;
  return (
    <div className="space-y-1.5">
      {filled.map((f) => (
        <div key={f.id} className="flex items-start gap-2.5">
          <div className={`w-1.5 h-1.5 rounded-full ${bulletColor} mt-1.5 flex-shrink-0`} />
          <span className="text-sm text-gray-700 leading-relaxed">{f.text}</span>
        </div>
      ))}
    </div>
  );
}

/** 인용 스타일 텍스트 (타입별 보더 색상) */
function QuoteText({ text, borderColor }: { text?: string; borderColor: string }) {
  if (!text?.trim()) return null;
  return (
    <div className={`border-l-2 ${borderColor} pl-3 py-1`}>
      <p className="text-sm text-gray-700 leading-relaxed italic">{text}</p>
    </div>
  );
}

export function RecordDetailView({ record, onUpdate, onDelete, onClose }: RecordDetailViewProps) {
  const [editing, setEditing] = useState(false);
  const cfg = recordTypeConfig[record.recordType];

  const dateLabel = new Date(record.date).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
  });

  const handleSave = (data: Omit<RecordItem, 'id' | 'createdAt'> & { id?: string }) => {
    onUpdate({ ...record, ...data, id: record.id, createdAt: record.createdAt });
    setEditing(false);
  };

  /** 공통 섹션/리스트 props */
  const lc = cfg.labelColor;
  const ic = cfg.iconText;
  const bc = cfg.bulletColor;
  const bdc = cfg.borderAccent;
  const bb = cfg.bgColor;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#fff5f7] rounded-3xl shadow-hover w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="px-6 pt-5 pb-4 flex items-center justify-between flex-shrink-0 bg-white/80 border-b border-gray-100">
          <h2 className={`text-lg font-bold flex items-center gap-2 ${cfg.textColor}`}>
            <div className={`w-8 h-8 rounded-xl ${cfg.bgColor} flex items-center justify-center`}>
              <RecordTypeIcon type={record.recordType} size={18} className={cfg.iconText} />
            </div>
            {record.title || cfg.label}
          </h2>
          <div className="flex items-center gap-2">
            {!editing && (
              <button onClick={() => setEditing(true)}
                className={`text-xs px-2.5 py-1 ${cfg.iconText} hover:${cfg.bgColor} rounded-lg transition-colors font-medium`}>
                수정
              </button>
            )}
            <button
              onClick={() => {
                if (window.confirm('이 기록을 삭제하시겠습니까?')) {
                  onDelete(record.id);
                  onClose();
                }
              }}
              className="text-xs px-2 py-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              삭제
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl px-2">×</button>
          </div>
        </div>

        {/* 스크롤 영역 */}
        <div className="flex-1 overflow-y-auto px-6 pt-4 pb-6 space-y-4">
          {editing ? (
            <RecordForm
              recordType={record.recordType}
              initialData={record}
              onSave={handleSave}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <>
              {/* 메타 정보 */}
              <div className="bg-white rounded-2xl p-5 shadow-soft">
                <div className="flex items-center gap-3 mb-3 flex-wrap">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${cfg.bgColor} ${cfg.textColor}`}>
                    {cfg.label}
                  </span>
                  <span className="text-sm text-gray-500">{dateLabel}</span>
                  {record.time && <span className="text-sm text-gray-400">{record.time}</span>}
                </div>

                {(record.mood || record.energy) && (
                  <div className="flex items-center gap-3 mb-3">
                    {record.mood && <span className="text-2xl">{record.mood}</span>}
                    {record.energy && <EnergyGauge value={record.energy} />}
                  </div>
                )}

                {record.tags && record.tags.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap">
                    {record.tags.map((tag) => (
                      <span key={tag} className={`text-xs px-2 py-0.5 rounded-full ${cfg.bgColor} ${cfg.textColor} font-medium`}>#{tag}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* ── 아침 일기 ── */}
              {record.recordType === 'morning' && record.morningData && (
                <div className="bg-white rounded-2xl p-5 shadow-soft divide-y divide-gray-100">
                  <Section icon={<GratitudeIcon size={13} className={ic} />} label="감사하게 여기는 것들" labelColor={lc} badgeBg={bb}>
                    <ListItems items={record.morningData.gratitude} bulletColor={bc} />
                  </Section>
                  <Section icon={<SparkleIcon size={13} className={ic} />} label="오늘을 기분 좋게 만드는 것" labelColor={lc} badgeBg={bb}>
                    <ListItems items={record.morningData.goodThings} bulletColor={bc} />
                  </Section>
                  {record.morningData.affirmation && (
                    <Section icon={<AffirmationIcon size={13} className={ic} />} label="오늘의 다짐" labelColor={lc} badgeBg={bb}>
                      <QuoteText text={record.morningData.affirmation} borderColor={bdc} />
                    </Section>
                  )}
                  <Section icon={<IdeaIcon size={13} className={ic} />} label="아이디어 주제" labelColor={lc} badgeBg={bb}>
                    <ListItems items={record.morningData.ideaTopics} bulletColor={bc} />
                  </Section>
                  <Section icon={<RocketIcon size={13} className={ic} />} label="실행할 첫 단계" labelColor={lc} badgeBg={bb}>
                    <ListItems items={record.morningData.ideaFirstSteps} bulletColor={bc} />
                  </Section>
                </div>
              )}

              {/* ── 저녁 일기 ── */}
              {record.recordType === 'evening' && record.eveningData && (
                <div className="bg-white rounded-2xl p-5 shadow-soft divide-y divide-gray-100">
                  <Section icon={<TrophyIcon size={13} className={ic} />} label="오늘 굉장한 일" labelColor={lc} badgeBg={bb}>
                    <ListItems items={record.eveningData.greatThings} bulletColor={bc} />
                  </Section>
                  {record.eveningData.improvement && (
                    <Section icon={<ImproveIcon size={13} className={ic} />} label="더 좋은 날이 되려면" labelColor={lc} badgeBg={bb}>
                      <QuoteText text={record.eveningData.improvement} borderColor={bdc} />
                    </Section>
                  )}
                  {record.eveningData.extra && (
                    <Section icon={<BookIcon size={13} className={ic} />} label="추가 / 오늘의 배움" labelColor={lc} badgeBg={bb}>
                      <QuoteText text={record.eveningData.extra} borderColor={bdc} />
                    </Section>
                  )}
                </div>
              )}

              {/* ── 주간 회고 ── */}
              {record.recordType === 'weekly' && record.weeklyData && (
                <div className="bg-white rounded-2xl p-5 shadow-soft divide-y divide-gray-100">
                  <Section icon={<TrophyIcon size={13} className={ic} />} label="이번 주 성취" labelColor={lc} badgeBg={bb}>
                    <ListItems items={record.weeklyData.achievements} bulletColor={bc} />
                  </Section>
                  <Section icon={<ThoughtIcon size={13} className={ic} />} label="아쉬웠던 점" labelColor={lc} badgeBg={bb}>
                    <ListItems items={record.weeklyData.regrets} bulletColor={bc} />
                  </Section>
                  <Section icon={<TargetIcon size={13} className={ic} />} label="다음 주 목표" labelColor={lc} badgeBg={bb}>
                    <ListItems items={record.weeklyData.nextGoals} bulletColor={bc} />
                  </Section>
                  {record.weeklyData.lessons && (
                    <Section icon={<BookIcon size={13} className={ic} />} label="배운 것" labelColor={lc} badgeBg={bb}>
                      <QuoteText text={record.weeklyData.lessons} borderColor={bdc} />
                    </Section>
                  )}
                </div>
              )}

              {/* ── 메모 ── */}
              {record.recordType === 'memo' && record.memoBody && Object.keys(record.memoBody).length > 0 && (
                <div className="bg-white rounded-2xl p-5 shadow-soft">
                  <TiptapReadOnly content={record.memoBody} />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
