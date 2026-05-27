/**
 * @file src/components/records/RecordDetailView.tsx
 * @description 기록 상세 뷰 (전체화면 오버레이)
 * - SVG 아이콘 + 타입별 테마 색상
 * - 읽기 모드: 섹션별 카드 / 메모는 TiptapReadOnly
 * - 편집 모드: RecordForm 인라인
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RecordItem, ListField } from '../../types';
import { useProjects } from '../../hooks/useProjects';
import { recordTypeConfig } from '../../utils/recordTemplates';
import { useTheme } from '../../contexts/ThemeContext';
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
function ListItems({ items, bulletColor }: { items?: ListField[]; bulletColor: string }) {
  if (!items) return <p className="text-sm text-gray-300 italic">-</p>;
  const filled = items.filter((f) => f.text?.trim());
  if (filled.length === 0) return <p className="text-sm text-gray-300 italic">-</p>;
  return (
    <div className="space-y-1.5">
      {filled.map((f) => (
        <div key={f.id} className="flex items-start gap-2.5">
          <div className={`w-1.5 h-1.5 rounded-full ${bulletColor} mt-1.5 flex-shrink-0`} />
          <span className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{f.text}</span>
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
  const navigate = useNavigate();
  const { projects } = useProjects();
  const { theme } = useTheme();
  const isModern = theme === 'modern';
  const cfg = recordTypeConfig[record.recordType];

  const dateLabel = new Date(record.date).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
  });

  const handleSave = (data: Omit<RecordItem, 'id' | 'createdAt'> & { id?: string }) => {
    onUpdate({ ...record, ...data, id: record.id, createdAt: record.createdAt });
    setEditing(false);
  };

  /** 공통 섹션/리스트 props (모던에선 진초록 액센트로 통일) */
  const lc = isModern ? 'text-primary-500' : cfg.labelColor;
  const ic = isModern ? 'text-primary-500' : cfg.iconText;
  const bc = isModern ? 'bg-primary-500' : cfg.bulletColor;
  const bdc = isModern ? 'border-primary-500' : cfg.borderAccent;
  const bb = isModern ? 'bg-surface-muted' : cfg.bgColor;

  return (
    <div data-modal-overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col ${
        isModern
          ? 'bg-surface border border-line'
          : 'bg-[#fff5f7] rounded-3xl shadow-hover'
      }`}>
        {/* 헤더 — 모바일: 제목 줄 + 액션 줄 2단 / sm+: 한 줄 */}
        <div className={`px-6 pt-5 pb-4 flex-shrink-0 border-b border-line ${
          isModern ? 'bg-surface' : 'bg-white/80'
        }`}>
          {/* 1줄: 제목 + 닫기 */}
          <div className="flex items-start justify-between gap-3">
            <h2 className={`flex-1 min-w-0 text-lg flex items-center gap-2 ${
              isModern ? 'font-normal text-foreground' : `font-bold ${cfg.textColor}`
            }`}>
              <div className={`w-8 h-8 flex-shrink-0 flex items-center justify-center ${
                isModern ? 'bg-surface-muted' : `rounded-xl ${cfg.bgColor}`
              }`}>
                <RecordTypeIcon
                  type={record.recordType}
                  size={18}
                  className={isModern ? 'text-primary-500' : cfg.iconText}
                />
              </div>
              <span className="truncate">{record.title || cfg.label}</span>
            </h2>
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* sm 이상에서만 수정/삭제 인라인 */}
              <div className="hidden sm:flex items-center gap-2">
                {!editing && (
                  <button
                    onClick={() => setEditing(true)}
                    className={`text-xs px-2.5 py-1 transition-colors ${
                      isModern
                        ? 'text-foreground-muted hover:text-foreground'
                        : `${cfg.iconText} hover:${cfg.bgColor} rounded-lg font-medium`
                    }`}
                  >
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
                  className={`text-xs px-2 py-1 transition-colors ${
                    isModern
                      ? 'text-foreground-faint hover:text-primary-500'
                      : 'text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg'
                  }`}
                >
                  삭제
                </button>
              </div>
              <button
                onClick={onClose}
                className={`text-xl px-2 transition-colors ${
                  isModern ? 'text-foreground-faint hover:text-foreground' : 'text-gray-400 hover:text-gray-600'
                }`}
              >×</button>
            </div>
          </div>

          {/* 모바일 전용: 수정/삭제 아랫줄 */}
          <div className="mt-3 flex items-center gap-2 sm:hidden">
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className={`text-xs px-3 py-1.5 transition-colors ${
                  isModern
                    ? 'border border-line text-foreground-muted hover:border-foreground hover:text-foreground'
                    : `${cfg.iconText} ${cfg.bgColor} rounded-lg font-medium`
                }`}
              >
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
              className={`text-xs px-3 py-1.5 transition-colors ${
                isModern
                  ? 'border border-line text-foreground-faint hover:border-primary-500 hover:text-primary-500'
                  : 'text-red-400 bg-red-50 hover:bg-red-100 rounded-lg'
              }`}
            >
              삭제
            </button>
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
              <div className={isModern ? 'border border-line p-5' : 'bg-white rounded-2xl p-5 shadow-soft'}>
                <div className="flex items-center gap-3 mb-3 flex-wrap">
                  {isModern ? (
                    <span className="text-[10px] tracking-[0.18em] uppercase text-primary-500">
                      {cfg.label}
                    </span>
                  ) : (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${cfg.bgColor} ${cfg.textColor}`}>
                      {cfg.label}
                    </span>
                  )}
                  <span className="text-sm text-gray-500">{dateLabel}</span>
                  {record.time && <span className="text-sm text-gray-400">{record.time}</span>}
                </div>

                {(record.mood || record.energy) && (
                  <div className="flex items-center gap-3 mb-3">
                    {record.mood && <span className="text-2xl">{record.mood}</span>}
                    {record.energy && <EnergyGauge value={record.energy} />}
                  </div>
                )}

                {record.project && (() => {
                  const proj = projects.find((p) => p.name === record.project);
                  return (
                    <div className="flex items-center gap-1.5 mb-3">
                      <span className="text-xs text-gray-400">프로젝트</span>
                      <button
                        onClick={() => { onClose(); if (proj) navigate(`/project/${proj.id}`); }}
                        className={`inline-flex items-center gap-1 text-xs transition-colors ${
                          isModern
                            ? 'border border-line px-2 py-0.5 text-foreground-muted hover:border-foreground hover:text-foreground'
                            : 'px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 hover:bg-purple-100 font-medium'
                        }`}
                      >
                        {proj?.color && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: proj.color }} />}
                        {record.project} →
                      </button>
                    </div>
                  );
                })()}

                {record.tags && record.tags.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap">
                    {record.tags.map((tag) => (
                      <span
                        key={tag}
                        className={isModern
                          ? 'text-xs text-foreground-faint border border-line px-2 py-0.5'
                          : `text-xs px-2 py-0.5 rounded-full ${cfg.bgColor} ${cfg.textColor} font-medium`}
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* ── 아침 일기 ── */}
              {record.recordType === 'morning' && record.morningData && (
                <div className={isModern ? 'border border-line p-5 divide-y divide-line' : 'bg-white rounded-2xl p-5 shadow-soft divide-y divide-gray-100'}>
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
                <div className={isModern ? 'border border-line p-5 divide-y divide-line' : 'bg-white rounded-2xl p-5 shadow-soft divide-y divide-gray-100'}>
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
                <div className={isModern ? 'border border-line p-5 divide-y divide-line' : 'bg-white rounded-2xl p-5 shadow-soft divide-y divide-gray-100'}>
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
                <div className={isModern ? 'border border-line p-5' : 'bg-white rounded-2xl p-5 shadow-soft'}>
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
