/**
 * @file src/components/office/StaffView.tsx
 * @description AI 직원 — 목록(오피스 플로어) ↔ 상세 + 채용 모달
 * - 상세: 이름 수정 · 산출물 영역(타입별) · 일일 리포트(실행/아카이브) · 일과 · 프롬프트 편집
 */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Staff, StaffRoutine, DailyReport, Workspace, StaffOutputAction, ReportComment, StaffModel, StaffSavedItem } from '../../types';
import { saveItem, fetchSavedItems, deleteSavedItem } from '../../services/staffSavedItems.service';
import { getStaffType } from '../../data/staffCatalog';
import { fetchStaff, fetchRoutines, setStaffState, deleteStaff, updateStaff, addRoutine, updateRoutine, deleteRoutine } from '../../services/staff.service';
import { fetchReportsByStaff, fetchReportById, addReportComment } from '../../services/dailyReports.service';
import { runStaffNow, runRoutineNow, previewStaffManual, saveStaffResult, StaffRunResult } from '../../services/staffRun.service';
import { fetchActions, approveAction, dismissAction } from '../../services/staffOutputActions.service';
import { getInputForm } from '../../data/staffInputForms';
import { ViewHead, Card, EmptyState } from './ui';
import { MarkdownView } from './MarkdownView';
import { StaffOutputView } from './StaffOutputView';
import { HireStaffModal, MODEL_OPTIONS } from './HireStaffModal';

function StatePill({ state }: { state: Staff['state'] }) {
  return state === 'working'
    ? <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary-100 text-primary-700 font-medium">● 근무 중</span>
    : <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 font-medium">대기</span>;
}

/* 직접 시키기 모드별 아이콘 (라벨 키워드 매칭) */
const MODE_ICON: Record<string, string> = {
  '분석': '🔍', '키워드': '🔑', '기획서': '📋', '기획': '📋',
  '문의': '💬', 'FAQ': '❓', '후기': '🛡', '리뷰': '🛡',
  '캘린더': '📅', '캡션': '✍️', '릴스': '🎬', '스크립트': '🎬',
};
function modeIcon(label: string): string {
  for (const k in MODE_ICON) if (label.includes(k)) return MODE_ICON[k];
  return '▶';
}

/* ── outputKind별 산출물 영역 (직원 타입마다 다른 구성) ── */
const OUTPUT_INFO: Record<string, { emoji: string; title: string; desc: string }> = {
  sns_queue:      { emoji: '📣', title: '발행 대기 큐', desc: '게시물 초안 카드(본문·해시태그·이미지 브리프) + 복사/발행 체크' },
  detail_builder: { emoji: '📄', title: '상세페이지 빌더', desc: '6섹션 에디터 + 섹션별 재생성 + 스마트스토어 HTML 복사' },
  ticket_list:    { emoji: '💬', title: '문의 티켓', desc: '유형·긴급도 분류 + 답변 초안 복사' },
  sourcing_brief: { emoji: '🔍', title: '소싱 브리프', desc: '분석/키워드/기획 탭 + 추천여부 배지' },
  copy_variants:  { emoji: '🎯', title: '광고 카피 세트', desc: '헤드라인·서브·CTA + A/B 3세트 비교' },
  monitor_digest: { emoji: '📡', title: '경쟁사 다이제스트', desc: '경쟁사 비교표 + 트렌드 (URL/텍스트 붙여넣기 입력)' },
  metric_digest:  { emoji: '📊', title: '지표 다이제스트', desc: 'KPI 집계·추이 차트 + 이상치 하이라이트 + 원인 가설' },
  image_brief:    { emoji: '📸', title: '비주얼 브리프', desc: '이미지 프롬프트(미드저니/나노바나나) + 목업 합성 + 필수 촬영컷 리스트' },
  generation_log: { emoji: '🧱', title: '생성 로그', desc: '건수·소요시간·성공/실패 타임라인' },
  ops_digest:     { emoji: '🧭', title: '운영 다이제스트', desc: '전 직원 취합 · 오늘 볼 것 3개 + 미완료·실행실패·중복 정리' },
};

function OutputKindArea({ outputKind }: { outputKind: string }) {
  const info = OUTPUT_INFO[outputKind] || { emoji: '🗂', title: '산출물', desc: '이 직원의 결과물이 여기 표시돼요' };
  return (
    <div className="mb-3">
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{info.title}</div>
      <Card className="p-6 text-center">
        <div className="text-3xl mb-2">{info.emoji}</div>
        <p className="text-sm font-semibold text-gray-600">{info.desc}</p>
        <p className="text-[11px] text-gray-300 mt-1.5">타입(outputKind)마다 다른 구성 · 인터랙티브 동작은 Phase 5</p>
      </Card>
    </div>
  );
}

/* ── 리포트 코멘트 (사장 의견) ── */
function ReportComments({ reportId, initial }: { reportId: string; initial?: ReportComment[] }) {
  const [comments, setComments] = useState<ReportComment[]>(initial || []);
  const [open, setOpen] = useState(true);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const add = async () => {
    if (!text.trim() || saving) return;
    setSaving(true);
    try { const next = await addReportComment(reportId, text); setComments(next); setText(''); }
    catch (e) { console.error(e); } finally { setSaving(false); }
  };
  return (
    <div className="border-t border-gray-100 pt-2.5">
      <button onClick={() => setOpen(o => !o)} className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors inline-flex items-center gap-1">
        💬 코멘트{comments.length > 0 && <span className="text-primary-500 font-semibold">{comments.length}</span>}
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {comments.map((c, i) => (
            <div key={i} className="text-sm text-gray-600 bg-gray-50 rounded-xl px-3 py-2 leading-relaxed">
              {c.text}
              <span className="block text-[10px] text-gray-300 mt-0.5">{c.at?.slice(0, 10)}</span>
            </div>
          ))}
          <div className="flex gap-1.5">
            <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add(); }}
              placeholder="내 의견 남기기…" className="flex-1 rounded-xl border border-gray-200 px-3 py-1.5 text-sm focus:border-primary-400 focus:outline-none" />
            <button onClick={add} disabled={saving} className="px-3 py-1.5 rounded-xl bg-primary-500 text-white text-xs font-medium hover:bg-primary-600 active:scale-95 transition-all disabled:opacity-50">남기기</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── 리포트 카드 (펼침) ── */
function ReportCard({ r, onSave }: { r: DailyReport; onSave?: (itemType: string, payload: any) => void }) {
  const [open, setOpen] = useState(false);
  const [full, setFull] = useState<DailyReport | null>(null); // 본문은 펼칠 때 단건 로드 (egress 절감)
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && !full) {
      setLoading(true);
      try { setFull(await fetchReportById(r.id)); }
      catch { /* 무시 — 본문 없이 표시 */ }
      finally { setLoading(false); }
    }
  };

  const d = full ?? r;
  return (
    <Card className="p-4">
      <button onClick={toggle} className="w-full text-left">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${r.trigger === 'manual' ? 'bg-violet-50 text-violet-500' : 'bg-gray-100 text-gray-400'}`}>{r.trigger === 'manual' ? '👤 수동' : '🕒 자동'}</span>
            <span className="text-sm font-bold text-gray-800 truncate">{r.title}</span>
          </div>
          <span className="text-[11px] text-gray-400 flex-shrink-0">{r.date}</span>
        </div>
        {r.summary && <p className="text-xs text-gray-500 mt-1">{r.summary}</p>}
      </button>
      {open && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
          {loading && <p className="text-xs text-gray-300 py-2 text-center">불러오는 중…</p>}
          {d.contentJson && (d.contentJson as { _demo?: boolean })._demo && (
            <div className="text-[10px] text-amber-600 bg-amber-50 rounded-lg px-2 py-1 inline-block">🧪 데모 미리보기 — API 키 설정 시 실제 데이터로 채워져요</div>
          )}
          {d.contentJson && (
            <StaffOutputView outputKind={d.outputKind} data={d.contentJson} onSave={onSave} />
          )}
          {d.body && (
            <Card className="p-3 space-y-1.5">
              {d.contentJson && <div className="text-[11px] font-semibold text-gray-400 tracking-wide">상세 보고서</div>}
              <MarkdownView text={d.body} className="report-md" />
            </Card>
          )}
          {!loading && <ReportComments reportId={r.id} initial={d.comments} />}
        </div>
      )}
    </Card>
  );
}

/* ── 직원 보관함 (⭐ 저장한 산출물 · 타입별 라벨) ── */
const SAVED_LABEL: Record<string, string> = {
  copy_variants: '저장된 카피', sns_queue: '콘텐츠 보관함', sourcing_brief: '상품 후보 보관함',
  image_brief: '이미지·프롬프트', detail_builder: '완성 페이지', ticket_list: 'FAQ·답변 모음',
  monitor_digest: '경쟁사 워치리스트', metric_digest: '지표 스냅샷', ops_digest: '보관함',
};
function SavedCard({ item, onDelete }: { item: StaffSavedItem; onDelete: (id: string) => void }) {
  const p = item.payload as any;
  const copyText = [p.headline, p.sub, p.detail, p.cta, p.body, p.text, p.coreLine].filter(Boolean).join('\n');
  return (
    <Card className="group p-3 relative space-y-1">
      <button onClick={() => onDelete(item.id)} className="absolute top-2 right-2 text-[11px] text-gray-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all">삭제</button>
      {p.type && <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary-50 text-primary-600">{p.type}</span>}
      {p.thumbnailUrl && <img src={p.thumbnailUrl} alt="" className="w-full rounded-lg border border-gray-100" />}
      {(p.headline || p.title || p.coreLine) && <div className="text-sm font-bold text-gray-800 pr-8">{p.headline || p.title || p.coreLine}</div>}
      {p.sub && <div className="text-xs text-gray-500">{p.sub}</div>}
      {p.detail && <div className="text-xs text-gray-400">{p.detail}</div>}
      {(p.body || p.text) && <div className="text-xs text-gray-600 whitespace-pre-wrap line-clamp-3">{p.body || p.text}</div>}
      {p.cta && <div className="text-xs text-primary-600 font-medium">→ {p.cta}</div>}
      <div className="flex items-center gap-2 pt-0.5">
        {copyText && <button onClick={() => navigator.clipboard?.writeText(copyText)} className="text-[11px] px-2 py-0.5 rounded-lg bg-gray-50 text-gray-500 hover:bg-gray-100 active:scale-95 transition-all">복사</button>}
        {p.variantId && <span className="text-[10px] text-gray-300">{p.variantId}</span>}
      </div>
    </Card>
  );
}
function SavedLibrary({ items, outputKind, onDelete }: { items: StaffSavedItem[]; outputKind?: string; onDelete: (id: string) => void }) {
  if (items.length === 0) return null;
  const label = SAVED_LABEL[outputKind || ''] || '보관함';
  return (
    <div className="mb-4">
      <div className="flex items-center h-9 mb-2">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">⭐ {label} <span className="text-gray-300">({items.length})</span></span>
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        {items.map(it => <SavedCard key={it.id} item={it} onDelete={onDelete} />)}
      </div>
    </div>
  );
}

/* ── 직접 시키기 모달 (몽글 팝업) ── */
function ManualRunModal({ staff, workspace, fields, presetMode, emoji, onClose, onDone }: {
  staff: Staff; workspace: Workspace; fields: ReturnType<typeof getInputForm>;
  presetMode?: string; emoji?: string; onClose: () => void; onDone: () => void;
}) {
  const [input, setInput] = useState<Record<string, string>>(presetMode ? { mode: presetMode } : {});
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<StaffRunResult | null>(null);
  const setField = (n: string, v: string) => setInput(p => ({ ...p, [n]: v }));
  const toggleMulti = (n: string, o: string) => {
    const cur = (input[n] || '').split(',').filter(Boolean);
    setField(n, (cur.includes(o) ? cur.filter(x => x !== o) : [...cur, o]).join(','));
  };
  const visible = fields.filter(f => f.name !== 'mode' && (!f.showFor || (presetMode != null && f.showFor.includes(presetMode))));
  const run = async () => {
    for (const f of visible) if (f.required && !(input[f.name] || '').trim()) { alert(`'${f.label}'을(를) 입력해주세요`); return; }
    setRunning(true);
    try { const r = await previewStaffManual(staff, workspace, input); setPreview(r); }
    catch (e) { console.error(e); alert('실행 실패'); } finally { setRunning(false); }
  };
  const save = async () => {
    if (!preview) return;
    setSaving(true);
    try { await saveStaffResult(staff, workspace, preview); await onDone(); onClose(); }
    catch (e) { console.error(e); alert('저장 실패'); } finally { setSaving(false); }
  };
  const cj = preview?.contentJson as { _demo?: boolean } | null;
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="w-full max-w-md max-h-[85vh] overflow-y-auto bg-white rounded-[28px] shadow-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">{emoji || '🎯'}</span>
          <div className="min-w-0">
            <div className="text-base font-extrabold text-gray-800 truncate">직접 시키기{presetMode ? ` · ${presetMode}` : ''}</div>
            <div className="text-xs text-gray-400">{preview ? '결과를 확인하고 저장하세요' : `${staff.name}에게 직접 작업을 시켜요`}</div>
          </div>
        </div>

        {!preview ? (
          <>
            <div className="space-y-3">
              {visible.map(f => (
                <div key={f.name}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}{f.required && <span className="text-rose-400"> *</span>}</label>
                  {f.type === 'textarea' ? (
                    <textarea value={input[f.name] || ''} onChange={e => setField(f.name, e.target.value)} rows={3} placeholder={f.placeholder}
                      className="w-full rounded-2xl border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-primary-400 focus:outline-none resize-none" />
                  ) : f.type === 'select' ? (
                    <select value={input[f.name] || ''} onChange={e => setField(f.name, e.target.value)}
                      className="w-full rounded-2xl border border-gray-200 px-3 py-2 text-sm text-gray-700 bg-white focus:border-primary-400 focus:outline-none">
                      <option value="">선택</option>
                      {f.options?.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : f.type === 'multiselect' ? (
                    <div className="flex flex-wrap gap-1.5">
                      {f.options?.map(o => {
                        const sel = (input[f.name] || '').split(',').filter(Boolean).includes(o);
                        return <button key={o} type="button" onClick={() => toggleMulti(f.name, o)}
                          className={`text-[11px] px-2.5 py-1 rounded-full transition-all active:scale-95 ${sel ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-500'}`}>{o}</button>;
                      })}
                    </div>
                  ) : f.type === 'duration' ? (() => {
                    const raw = input[f.name] || '';
                    const ftype = raw.startsWith('롱폼') ? '롱폼' : raw.startsWith('숏폼') ? '숏폼' : '';
                    const len = raw.replace(/^(숏폼|롱폼)\s*/, '');
                    const setDur = (tp: string, l: string) => setField(f.name, `${tp}${l ? ' ' + l : ''}`.trim());
                    return (
                      <div className="flex gap-2">
                        <div className="flex gap-1 flex-shrink-0">
                          {['숏폼', '롱폼'].map(o => (
                            <button key={o} type="button" onClick={() => setDur(o, len)}
                              className={`px-3 py-2 rounded-xl text-sm font-medium transition-all active:scale-95 ${ftype === o ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-500'}`}>{o}</button>
                          ))}
                        </div>
                        <input value={len} onChange={e => setDur(ftype || '숏폼', e.target.value)} placeholder={f.placeholder}
                          className="flex-1 min-w-0 rounded-2xl border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-primary-400 focus:outline-none" />
                      </div>
                    );
                  })() : (
                    <input type={f.type === 'number' ? 'number' : 'text'} value={input[f.name] || ''} onChange={e => setField(f.name, e.target.value)} placeholder={f.placeholder}
                      className="w-full rounded-2xl border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-primary-400 focus:outline-none" />
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-2xl bg-gray-100 text-gray-500 text-sm font-medium hover:bg-gray-200 transition-all">취소</button>
              <button onClick={run} disabled={running} className="flex-1 py-2.5 rounded-2xl bg-primary-500 text-white text-sm font-bold hover:bg-primary-600 active:scale-95 transition-all disabled:opacity-50">
                {running ? '실행 중…' : '▶ 실행'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-3">
              <div className="text-sm font-bold text-gray-800">{preview.title}</div>
              {preview.summary && <p className="text-xs text-gray-500">{preview.summary}</p>}
              {cj && !cj._demo && <StaffOutputView outputKind={preview.outputKind} data={preview.contentJson} />}
              {preview.body && <div className="border-t border-gray-100 pt-3"><MarkdownView text={preview.body} /></div>}
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setPreview(null)} className="flex-1 py-2.5 rounded-2xl bg-gray-100 text-gray-500 text-sm font-medium hover:bg-gray-200 transition-all">↺ 다시</button>
              <button onClick={save} disabled={saving} className="flex-1 py-2.5 rounded-2xl bg-primary-500 text-white text-sm font-bold hover:bg-primary-600 active:scale-95 transition-all disabled:opacity-50">
                {saving ? '저장 중…' : '💾 일일 리포트에 저장'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

/* ── 프롬프트 팝업 (몽글) ── */
const PMT_ANIM = `
@keyframes pmPop { from { opacity:0; transform: translateY(12px) scale(.96);} to {opacity:1; transform:none;} }
@keyframes pmFade { from {opacity:0;} to {opacity:1;} }`;

function PromptModal({ staff, onClose, onSaved }: { staff: Staff; onClose: () => void; onSaved: () => void }) {
  const [val, setVal] = useState(staff.prompt);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { await updateStaff(staff.id, { prompt: val }); onSaved(); onClose(); }
    catch (e) { console.error(e); alert('저장 실패'); }
    finally { setBusy(false); }
  };
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]"
      style={{ animation: 'pmFade .15s ease-out' }} onMouseDown={onClose}>
      <style>{PMT_ANIM}</style>
      <div className="bg-white rounded-[32px] shadow-2xl w-[480px] max-w-[92vw] p-7"
        style={{ animation: 'pmPop .22s cubic-bezier(.2,.9,.25,1)' }} onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[17px] font-extrabold text-gray-800">📝 프롬프트 · {staff.name}</h2>
          <button onClick={onClose} className="w-9 h-9 rounded-full hover:bg-gray-100 text-gray-400 flex items-center justify-center active:scale-90">✕</button>
        </div>
        <p className="text-[11px] text-gray-400 mb-3">실제 실행 = 타입 베이스 SOP + 브랜드 정보 + <b className="text-gray-500">이 프롬프트</b> 결합</p>
        <textarea autoFocus value={val} onChange={e => setVal(e.target.value)} rows={7}
          placeholder="이 직원의 성격·톤·세부 지시를 자세히…"
          className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-gray-100 text-sm leading-relaxed focus:outline-none focus:bg-white focus:border-primary-300 resize-none" />
        <div className="flex gap-2.5 pt-3">
          <button onClick={onClose} className="px-5 py-3 rounded-2xl text-sm text-gray-500 hover:bg-gray-100 transition-colors active:scale-95">취소</button>
          <button onClick={save} disabled={busy}
            className="flex-1 px-5 py-3 rounded-2xl text-sm font-bold bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-40 transition-all active:scale-[0.97]">
            {busy ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ── 일과 스케줄 ── */
const DOW = ['일', '월', '화', '수', '목', '금', '토'];
function formatSchedule(r: StaffRoutine): string {
  const t = r.runAt ? ' ' + r.runAt : '';
  if (r.schedule === 'weekly') return `매주 ${DOW[r.dayOfWeek ?? 1]}${t}`;
  if (r.schedule === 'monthly') return `매월 ${r.dayOfMonth ?? 1}일${t}`;
  if (r.schedule === 'realtime') return '실시간';
  return `매일${t}`;
}

type RoutineOpts = { schedule: StaffRoutine['schedule']; runAt?: string; dayOfWeek?: number; dayOfMonth?: number };

/**
 * 일과 일정 모달
 * - fixedLabel(수정): 내용 고정 + 일정만 조정
 * - labelOptions(추가): 직원 기본 업무 중에서 선택 (자유 입력 X — 실행 안정성)
 */
function RoutineScheduleModal({
  fixedLabel, labelOptions, initial, onClose, onSubmit,
}: {
  fixedLabel?: string;
  labelOptions?: string[];
  initial?: { schedule: 'daily' | 'weekly' | 'monthly'; runAt?: string; dayOfWeek?: number; dayOfMonth?: number };
  onClose: () => void;
  onSubmit: (label: string, opts: RoutineOpts) => Promise<void>;
}) {
  const isEdit = !!fixedLabel;
  const opts = labelOptions ?? [];
  const [label, setLabel] = useState(fixedLabel ?? opts[0] ?? '');
  const [schedule, setSchedule] = useState<'daily' | 'weekly' | 'monthly'>(initial?.schedule ?? 'daily');
  const [hasTime, setHasTime] = useState(initial ? !!initial.runAt : true);
  const [time, setTime] = useState(initial?.runAt || '09:00');
  const [dow, setDow] = useState(initial?.dayOfWeek ?? 1);
  const [dom, setDom] = useState(initial?.dayOfMonth ?? 1);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!label.trim() || busy) return;
    setBusy(true);
    const useTime = schedule === 'daily' ? hasTime : true;
    try {
      await onSubmit(label, {
        schedule,
        runAt: useTime ? time : undefined,
        dayOfWeek: schedule === 'weekly' ? dow : undefined,
        dayOfMonth: schedule === 'monthly' ? dom : undefined,
      });
      onClose();
    } finally { setBusy(false); }
  };

  const seg = (v: typeof schedule, t: string) => (
    <button onClick={() => setSchedule(v)}
      className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium transition-all active:scale-95 ${schedule === v ? 'bg-primary-500 text-white' : 'bg-gray-50 text-gray-500'}`}>{t}</button>
  );

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]"
      style={{ animation: 'pmFade .15s ease-out' }} onMouseDown={onClose}>
      <style>{PMT_ANIM}</style>
      <div className="bg-white rounded-[32px] shadow-2xl w-[440px] max-w-[92vw] p-7 space-y-4"
        style={{ animation: 'pmPop .22s cubic-bezier(.2,.9,.25,1)' }} onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-extrabold text-gray-800">{isEdit ? '일정 수정' : '＋ 일과 추가'}</h2>
          <button onClick={onClose} className="w-9 h-9 rounded-full hover:bg-gray-100 text-gray-400 flex items-center justify-center active:scale-90">✕</button>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5">일과 {isEdit ? '' : '(직원 기본 업무에서 선택)'}</label>
          {isEdit ? (
            <div className="px-4 py-3 rounded-2xl bg-gray-50 border border-gray-100 text-sm text-gray-700">{fixedLabel}</div>
          ) : opts.length === 0 ? (
            <p className="px-4 py-3 rounded-2xl bg-gray-50 border border-gray-100 text-sm text-gray-400">추가할 수 있는 기본 업무가 없어요 (이미 다 추가됨)</p>
          ) : (
            <select value={label} onChange={e => setLabel(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-gray-100 text-sm focus:outline-none focus:bg-white focus:border-primary-300">
              {opts.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5">주기</label>
          <div className="flex gap-2">{seg('daily', '매일')}{seg('weekly', '매주')}{seg('monthly', '매월')}</div>
        </div>

        {/* 매일 → 시간 여부 */}
        {schedule === 'daily' && (
          <div className="flex items-center gap-3">
            <button onClick={() => setHasTime(h => !h)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${hasTime ? 'bg-primary-50 border-primary-200 text-primary-600' : 'bg-gray-50 border-gray-100 text-gray-400'}`}>
              {hasTime ? '✓ 시간 지정' : '시간 지정 안 함'}
            </button>
            {hasTime && <input type="time" value={time} onChange={e => setTime(e.target.value)} className="px-3 py-2 rounded-xl bg-gray-50 border border-gray-100 text-sm focus:outline-none focus:border-primary-300" />}
          </div>
        )}

        {/* 매주 → 요일 + 시간 */}
        {schedule === 'weekly' && (
          <div className="space-y-2">
            <div className="flex gap-1.5">
              {DOW.map((d, i) => (
                <button key={i} onClick={() => setDow(i)}
                  className={`w-9 h-9 rounded-xl text-sm font-medium transition-all active:scale-90 ${dow === i ? 'bg-primary-500 text-white' : 'bg-gray-50 text-gray-500'}`}>{d}</button>
              ))}
            </div>
            <input type="time" value={time} onChange={e => setTime(e.target.value)} className="px-3 py-2 rounded-xl bg-gray-50 border border-gray-100 text-sm focus:outline-none focus:border-primary-300" />
          </div>
        )}

        {/* 매월 → 날짜 + 시간 */}
        {schedule === 'monthly' && (
          <div className="flex items-center gap-2">
            <select value={dom} onChange={e => setDom(Number(e.target.value))}
              className="px-3 py-2 rounded-xl bg-gray-50 border border-gray-100 text-sm focus:outline-none focus:border-primary-300">
              {Array.from({ length: 31 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}일</option>)}
            </select>
            <input type="time" value={time} onChange={e => setTime(e.target.value)} className="px-3 py-2 rounded-xl bg-gray-50 border border-gray-100 text-sm focus:outline-none focus:border-primary-300" />
          </div>
        )}

        <div className="flex gap-2.5 pt-1">
          <button onClick={onClose} className="px-5 py-3 rounded-2xl text-sm text-gray-500 hover:bg-gray-100 transition-colors active:scale-95">취소</button>
          <button onClick={submit} disabled={!label.trim() || busy}
            className="flex-1 px-5 py-3 rounded-2xl text-sm font-bold bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-40 transition-all active:scale-[0.97]">
            {busy ? '저장 중…' : (isEdit ? '저장' : '추가')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ── 상세 ── */
function StaffDetail({ staff, workspace, onBack, onChanged, onRan }: { staff: Staff; workspace: Workspace; onBack: () => void; onChanged: () => void; onRan?: () => void }) {
  const type = getStaffType(staff.typeKey);
  const [routines, setRoutines] = useState<StaffRoutine[]>([]);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [actions, setActions] = useState<StaffOutputAction[]>([]);
  const [savedItems, setSavedItems] = useState<StaffSavedItem[]>([]);
  const [state, setState] = useState(staff.state);
  const [running, setRunning] = useState(false);
  const [editName, setEditName] = useState(false);
  const [nameVal, setNameVal] = useState(staff.name);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showRoutine, setShowRoutine] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<StaffRoutine | null>(null);
  const [runningRoutineId, setRunningRoutineId] = useState<string | null>(null);
  const [showModel, setShowModel] = useState(false);
  const modelLabel = (m: string) => MODEL_OPTIONS.find(o => o.key === m)?.label || m;
  const changeModel = async (m: StaffModel) => {
    setShowModel(false);
    if (m === staff.model) return;
    await updateStaff(staff.id, { model: m }).catch(() => {});
    onChanged();
  };

  const loadRoutines = () => fetchRoutines(staff.id).then(setRoutines).catch(() => setRoutines([]));
  const loadReports = () => fetchReportsByStaff(staff.id).then(setReports).catch(() => setReports([]));
  const loadActions = () => fetchActions(workspace.id, 'suggested', staff.id)
    .then(setActions).catch(() => setActions([]));
  const loadSaved = () => fetchSavedItems(workspace.id, staff.id).then(setSavedItems).catch(() => setSavedItems([]));
  useEffect(() => {
    fetchRoutines(staff.id).then(setRoutines).catch(() => setRoutines([]));
    loadReports();
    loadActions();
    loadSaved();
    // eslint-disable-next-line
  }, [staff.id]);

  const onSaveItem = async (itemType: string, payload: any) => {
    await saveItem({ workspaceId: workspace.id, staffId: staff.id, outputKind: type?.outputKind, itemType, payload }).catch(() => {});
    loadSaved();
  };
  const onDeleteSaved = async (id: string) => { await deleteSavedItem(id).catch(() => {}); loadSaved(); };

  const approve = async (a: StaffOutputAction) => { await approveAction(a).catch(() => {}); await loadActions(); };
  const dismiss = async (id: string) => { await dismissAction(id).catch(() => {}); await loadActions(); };

  // ── 직접 시키기 (수동) — 모드 버튼 → 팝업 ──
  const inputForm = getInputForm(staff.typeKey);
  const modeOptions = inputForm.find(f => f.name === 'mode')?.options || [];
  const [manualMode, setManualMode] = useState<string | undefined>(undefined);
  const [manualOpen, setManualOpen] = useState(false);
  const openManual = (mode?: string) => { setManualMode(mode); setManualOpen(true); };
  const onManualDone = async () => { await loadReports(); await loadActions(); onRan?.(); };

  // ── 일일 리포트 페이지네이션 (10개씩) ──
  const PER = 10;
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(reports.length / PER));
  const pageReports = reports.slice(page * PER, page * PER + PER);

  const toggle = async () => {
    const next = state === 'working' ? 'idle' : 'working';
    setState(next);
    await setStaffState(staff.id, next).catch(() => setState(state));
    onChanged();
  };
  const remove = async () => {
    if (!confirm(`'${staff.name}' 직원을 해고할까요?`)) return;
    await deleteStaff(staff.id); onBack(); onChanged();
  };
  // 단일 일과만 실행 (여러 번 반복 가능)
  const runRoutine = async (r: StaffRoutine) => {
    if (runningRoutineId || running) return;
    setRunningRoutineId(r.id);
    try { await runRoutineNow(staff, workspace, r.label); await loadReports(); await loadActions(); onRan?.(); }
    catch (e) { console.error(e); alert('실행 실패'); }
    finally { setRunningRoutineId(null); }
  };
  const run = async () => {
    setRunning(true);
    try { await runStaffNow(staff, workspace); await loadReports(); await loadActions(); onRan?.(); }
    catch (e) { console.error(e); alert('실행 실패'); }
    finally { setRunning(false); }
  };
  const saveName = async () => {
    if (nameVal.trim()) { await updateStaff(staff.id, { name: nameVal }); onChanged(); }
    setEditName(false);
  };
  // ── 일과 편집 ──
  const toggleRoutine = async (r: StaffRoutine) => {
    setRoutines(prev => prev.map(x => x.id === r.id ? { ...x, enabled: !x.enabled } : x));
    await updateRoutine(r.id, { enabled: !r.enabled }).catch(loadRoutines);
  };
  const removeRoutine = async (id: string) => {
    setRoutines(prev => prev.filter(x => x.id !== id));
    await deleteRoutine(id).catch(loadRoutines);
  };
  const handleAddRoutine = async (label: string, opts: RoutineOpts) => {
    try { const r = await addRoutine(staff.id, workspace.id, label, opts); setRoutines(prev => [...prev, r]); }
    catch { loadRoutines(); }
  };
  const handleEditRoutine = async (label: string, opts: RoutineOpts) => {
    if (!editingRoutine) return;
    const id = editingRoutine.id;
    setRoutines(prev => prev.map(x => x.id === id ? { ...x, label, ...opts } : x));
    await updateRoutine(id, { schedule: opts.schedule, runAt: opts.runAt, dayOfWeek: opts.dayOfWeek, dayOfMonth: opts.dayOfMonth }).catch(loadRoutines);
  };
  // 추가 가능한 기본 업무 (이미 등록된 건 제외 — 자유 입력 대신 정해진 업무만)
  const existingLabels = new Set(routines.map(r => r.label));
  const availableRoutines = (type?.defaultRoutines ?? []).filter(l => !existingLabels.has(l));

  return (
    <>
      {/* 상단 라인: 뒤로 + 배지(프롬프트 · 일시정지 · 해고) */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={onBack} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">← AI 직원</button>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setShowPrompt(true)}
            className="px-3 py-1 rounded-full text-[11px] font-medium bg-primary-50 text-primary-600 hover:bg-primary-100 transition-all active:scale-95">📝 프롬프트</button>
          <button onClick={toggle}
            className="px-3 py-1 rounded-full text-[11px] font-medium border border-primary-200 text-primary-600 hover:bg-primary-50 transition-all active:scale-95">
            {state === 'working' ? '⏸ 일시정지' : '▶ 가동 시작'}
          </button>
          <button onClick={remove}
            className="px-3 py-1 rounded-full text-[11px] font-medium border border-rose-100 text-rose-400 hover:bg-rose-50 transition-all active:scale-95">🗑 해고</button>
        </div>
      </div>

      {/* 프로필 히어로 (이름 수정 가능) */}
      <div className="rounded-[24px] bg-primary-50 border border-primary-100 p-5 flex items-center gap-4 mb-4">
        <button onClick={onBack} title="직원 홈으로" className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center text-3xl shadow-sm hover:bg-gray-50 active:scale-95 transition-all">{type?.emoji || '🤖'}</button>
        <div className="flex-1 min-w-0">
          {editName ? (
            <div className="flex items-center gap-2">
              <input autoFocus value={nameVal} onChange={e => setNameVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') { setEditName(false); setNameVal(staff.name); } }}
                className="text-lg font-extrabold text-gray-800 px-2 py-1 rounded-lg border border-primary-300 focus:outline-none" />
              <button onClick={saveName} className="text-xs px-2 py-1 rounded-lg bg-primary-500 text-white">저장</button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-extrabold text-gray-800">{staff.name}</span>
              <button onClick={() => { setNameVal(staff.name); setEditName(true); }} className="text-gray-300 hover:text-gray-500 text-sm" title="이름 수정">✏️</button>
            </div>
          )}
          <div className="text-sm text-gray-500">{type?.roleLine || ''}</div>
          <div className="flex items-center gap-2 mt-1.5">
            <StatePill state={state} />
            <div className="relative">
              <button onClick={() => setShowModel(s => !s)}
                className="text-[11px] px-2 py-0.5 rounded-full bg-white text-gray-500 border border-gray-100 hover:border-primary-200 transition-colors">
                🧠 {modelLabel(staff.model)} ▾
              </button>
              {showModel && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowModel(false)} />
                  <div className="absolute z-20 top-7 left-0 w-56 bg-white rounded-2xl shadow-lg border border-gray-100 p-1.5">
                    {MODEL_OPTIONS.map(o => (
                      <button key={o.key} onClick={() => changeModel(o.key)}
                        className={`w-full text-left px-2.5 py-1.5 rounded-xl transition-colors ${staff.model === o.key ? 'bg-primary-50' : 'hover:bg-gray-50'}`}>
                        <div className="text-[12px] font-medium text-gray-700">{o.label}{staff.model === o.key && ' ✓'}</div>
                        <div className="text-[10px] text-gray-400">{o.desc}</div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 1. 매일 하는 일 (자동) — 최상단 */}
      <div className="mb-4">
        <div className="flex items-center justify-between h-9 mb-2">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">매일 하는 일 (자동)</span>
          <div className="flex items-center gap-1.5">
            <button onClick={run} disabled={running || runningRoutineId !== null} title="모든 활성 일과를 한 번에 실행"
              className="px-3 py-1.5 rounded-xl text-xs font-medium bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-50 transition-all active:scale-95">
              {running ? '실행 중…' : '▶ 전체 실행'}
            </button>
            <button onClick={() => setShowRoutine(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-medium bg-primary-50 text-primary-600 hover:bg-primary-100 transition-all active:scale-95">＋ 추가</button>
          </div>
        </div>
        <Card className="p-2">
          {routines.map(r => (
            <div key={r.id} className="group flex items-center gap-2 px-2 py-2 rounded-xl hover:bg-gray-50 transition-colors">
              <button onClick={() => toggleRoutine(r)} title={r.enabled ? '끄기' : '켜기'}
                className={`w-4 h-4 rounded-md flex items-center justify-center text-[10px] text-white transition-colors ${r.enabled ? 'bg-primary-500' : 'bg-gray-300'}`}>✓</button>
              <span className={`text-sm flex-1 ${r.enabled ? 'text-gray-700' : 'text-gray-300 line-through'}`}>{r.label}</span>
              <button onClick={() => setEditingRoutine(r)} title="일정 수정"
                className="text-[10px] text-gray-400 flex-shrink-0 hover:text-primary-500 transition-colors">{formatSchedule(r)} ✎</button>
              <button onClick={() => runRoutine(r)} disabled={runningRoutineId !== null || running} title="이 업무만 지금 실행"
                className="flex-shrink-0 px-2 py-0.5 rounded-lg text-[11px] font-medium bg-primary-50 text-primary-600 hover:bg-primary-100 disabled:opacity-40 transition-all active:scale-95">
                {runningRoutineId === r.id ? '실행 중…' : '▶ 실행'}
              </button>
              <button onClick={() => removeRoutine(r.id)} title="삭제"
                className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-rose-400 text-sm transition-all">×</button>
            </div>
          ))}
          {routines.length === 0 && <p className="text-xs text-gray-300 py-3 text-center">＋ 추가로 일과를 만들어보세요</p>}
        </Card>
      </div>

      {/* 2. 직접 시키기 (수동) — 모드 버튼 → 팝업 */}
      {inputForm.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center h-9 mb-2"><span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">직접 시키기 (수동)</span></div>
          {modeOptions.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {modeOptions.map(m => (
                <button key={m} onClick={() => openManual(m)}
                  className="flex flex-col items-center justify-center gap-2 py-6 px-2 rounded-[24px] bg-primary-50 border border-primary-100 hover:bg-primary-100 hover:shadow-md active:scale-95 transition-all">
                  <span className="text-3xl">{modeIcon(m)}</span>
                  <span className="text-xs font-bold text-primary-700 text-center leading-tight">{m}</span>
                </button>
              ))}
            </div>
          ) : (
            <button onClick={() => openManual()}
              className="w-full flex flex-col items-center justify-center gap-2 py-6 rounded-[24px] bg-primary-50 border border-primary-100 hover:bg-primary-100 hover:shadow-md active:scale-95 transition-all">
              <span className="text-3xl">{type?.emoji || '▶'}</span>
              <span className="text-sm font-bold text-primary-700">직접 시키기</span>
            </button>
          )}
        </div>
      )}

      {/* 3. 제안 액션 (승인 대기 — HITL) */}
      {actions.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center h-9 mb-2"><span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">제안 액션 · 승인 대기 {actions.length}건</span></div>
          <Card className="p-3 space-y-2">
            {actions.map(a => {
              const label = a.type === 'schedule' ? '일정' : a.type === 'task' ? '할일' : '인사이트';
              const title = String((a.payload as { title?: string })?.title || '');
              return (
                <div key={a.id} className="flex items-center gap-2 p-2 rounded-2xl bg-gray-50">
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary-50 text-primary-600 flex-shrink-0">{label}</span>
                  <span className="text-sm text-gray-700 flex-1 truncate">{title}</span>
                  <button onClick={() => approve(a)} className="text-[11px] px-2.5 py-1 rounded-lg bg-primary-500 text-white hover:bg-primary-600 active:scale-95 transition-all flex-shrink-0">승인</button>
                  <button onClick={() => dismiss(a.id)} className="text-[11px] px-2.5 py-1 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 active:scale-95 transition-all flex-shrink-0">반려</button>
                </div>
              );
            })}
          </Card>
        </div>
      )}

      {/* 4. 직원 보관함 (⭐ 저장 — 타입별 전용 작업공간) */}
      <SavedLibrary items={savedItems} outputKind={type?.outputKind} onDelete={onDeleteSaved} />

      {/* 5. 일일 리포트 1열 + 페이지네이션 */}
      <div className="mb-4">
        <div className="flex items-center justify-between h-9 mb-2">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">일일 리포트</span>
          {totalPages > 1 && (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-1.5 disabled:opacity-30 hover:text-gray-600 transition-colors">‹</button>
              <span className="tabular-nums">{page + 1}/{totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="px-1.5 disabled:opacity-30 hover:text-gray-600 transition-colors">›</button>
            </div>
          )}
        </div>
        <div className="space-y-2">
          {pageReports.map(r => <ReportCard key={r.id} r={r} onSave={onSaveItem} />)}
          {reports.length === 0 && <EmptyState emoji="📄" title="아직 리포트가 없어요" sub="일과가 돌거나 ‘지금 한 번’을 누르면 쌓여요" />}
        </div>
      </div>

      {manualOpen && <ManualRunModal staff={staff} workspace={workspace} fields={inputForm} presetMode={manualMode} emoji={type?.emoji} onClose={() => setManualOpen(false)} onDone={onManualDone} />}
      {showPrompt && <PromptModal staff={staff} onClose={() => setShowPrompt(false)} onSaved={onChanged} />}
      {showRoutine && <RoutineScheduleModal labelOptions={availableRoutines} onClose={() => setShowRoutine(false)} onSubmit={handleAddRoutine} />}
      {editingRoutine && (
        <RoutineScheduleModal
          fixedLabel={editingRoutine.label}
          initial={{
            schedule: editingRoutine.schedule === 'realtime' ? 'daily' : editingRoutine.schedule,
            runAt: editingRoutine.runAt,
            dayOfWeek: editingRoutine.dayOfWeek,
            dayOfMonth: editingRoutine.dayOfMonth,
          }}
          onClose={() => setEditingRoutine(null)}
          onSubmit={handleEditRoutine}
        />
      )}
    </>
  );
}

/* ── 메인 ── */
export function StaffView({ workspace, onRan }: { workspace: Workspace; onRan?: () => void }) {
  const [list, setList] = useState<Staff[]>([]);
  const [selected, setSelected] = useState<Staff | null>(null);
  const [showHire, setShowHire] = useState(false);

  const load = () => fetchStaff(workspace.id).then(setList).catch(() => setList([]));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [workspace.id]);

  // 목록 갱신 시 선택된 직원 정보도 최신화
  const refresh = async () => {
    const fresh = await fetchStaff(workspace.id);
    setList(fresh);
    if (selected) setSelected(fresh.find(s => s.id === selected.id) ?? null);
  };

  if (selected) {
    return <StaffDetail key={selected.id} staff={selected} workspace={workspace} onBack={() => setSelected(null)} onChanged={refresh} onRan={onRan} />;
  }

  const working = list.filter(s => s.state === 'working').length;

  return (
    <>
      <ViewHead eyebrow="HUMAN RESOURCES" title="AI 직원" sub={`${list.length}명 고용 · ${working}명 근무 중`} />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {list.map(s => {
          const type = getStaffType(s.typeKey);
          return (
            <button key={s.id} onClick={() => setSelected(s)}
              className="rounded-[24px] bg-white border border-gray-100 shadow-sm hover:shadow-md p-4 text-left transition-all active:scale-[0.98]">
              <div className="flex items-center justify-between mb-2">
                <span className="w-11 h-11 rounded-2xl bg-primary-50 flex items-center justify-center text-2xl">{type?.emoji || '🤖'}</span>
                <StatePill state={s.state} />
              </div>
              <div className="text-sm font-bold text-gray-800">{s.name}</div>
              <div className="text-[11px] text-gray-400 mt-0.5">{type?.roleLine || ''}</div>
              {s.prompt && <div className="text-[11px] text-gray-400 mt-2 line-clamp-2">{s.prompt}</div>}
            </button>
          );
        })}

        <button onClick={() => setShowHire(true)}
          className="rounded-[24px] border-2 border-dashed border-gray-200 hover:border-primary-300 hover:bg-primary-50/40
            p-4 flex flex-col items-center justify-center gap-2 text-gray-400 hover:text-primary-500 transition-all active:scale-[0.98] min-h-[140px]">
          <span className="text-3xl">＋</span>
          <span className="text-sm font-medium">직원 채용</span>
          <span className="text-[11px] text-gray-300">역할 정하고 24시간 맡기기</span>
        </button>
      </div>

      <HireStaffModal open={showHire} workspace={workspace} onClose={() => setShowHire(false)} onHired={() => load()} />
    </>
  );
}
