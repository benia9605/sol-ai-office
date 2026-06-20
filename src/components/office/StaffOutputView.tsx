/**
 * @file src/components/office/StaffOutputView.tsx
 * @description 직원별 전용 결과 뷰 (outputKind별 · content_json 기반)
 * - 소싱=5축/판정/마진, 광고=3세트, 비주얼=후보 … 직원마다 다른 화면.
 * - 각 SOP 문서의 검증 답변 레이아웃 기준. 미구현 outputKind는 null(마크다운 본문만).
 * - 직원 순서대로 채워나감: ✅소싱 / ⬜CS·SNS·광고·모니터링·분석가·비주얼·운영매니저
 */
import { useState } from 'react';
import { Card } from './ui';
import { generateImage, ratioToSize } from '../../services/imageGen.service';

/* ═══════════ 공통 컴포넌트 (GPT 검증: 직원별 다른 UI, 내부 컴포넌트는 재사용) ═══════════ */
const STAFF_META: Record<string, { emoji: string; label: string }> = {
  sourcing: { emoji: '🔍', label: '소싱' }, detailPage: { emoji: '📄', label: '상세페이지' }, detail_page: { emoji: '📄', label: '상세페이지' },
  cs: { emoji: '💬', label: 'CS' }, sns: { emoji: '📣', label: 'SNS' }, ads: { emoji: '🎯', label: '광고' }, ad: { emoji: '🎯', label: '광고' }, ad_planner: { emoji: '🎯', label: '광고' },
  monitor: { emoji: '📡', label: '모니터링' }, analyst: { emoji: '📊', label: '분석가' }, visual: { emoji: '📸', label: '비주얼' },
  ops: { emoji: '🧭', label: '운영' }, landing: { emoji: '📄', label: '랜딩' }, ownerApproval: { emoji: '👤', label: '사장 승인' },
};
function SectionLabel({ children }: { children: any }) {
  return <div className="text-[11px] font-semibold text-gray-400 tracking-wide">{children}</div>;
}
/** 모든 섹션을 동일한 칸(카드)으로 — 통일된 패딩·간격·제목 */
function Section({ label, children, className = '' }: { label?: string; children: any; className?: string }) {
  return (
    <Card className={`p-3 space-y-2 ${className}`}>
      {label && <SectionLabel>{label}</SectionLabel>}
      {children}
    </Card>
  );
}
function Chips({ items, color }: { items: any[]; color: string }) {
  return <div className="flex flex-wrap gap-1">{items.map((x, i) => <span key={i} className={`text-[11px] px-2 py-0.5 rounded-full ${color}`}>{String(x)}</span>)}</div>;
}
/** 다른 직원에게 넘기기 — handoff 객체(키=직원, 값=내용 배열) */
function HandoffPanel({ handoff }: { handoff: any }) {
  if (!handoff || typeof handoff !== 'object') return null;
  const entries = Object.entries(handoff).filter(([, v]) => (Array.isArray(v) ? v.length : v));
  if (!entries.length) return null;
  return (
    <Section label="다른 직원에게 넘기기">
      <div className="space-y-1">
        {entries.map(([k, v]) => {
          const meta = STAFF_META[k] || { emoji: '→', label: k };
          const items = Array.isArray(v) ? v : [v];
          return (
            <div key={k} className="flex gap-1.5 text-xs leading-relaxed">
              <span className="flex-shrink-0 text-gray-500 font-medium">{meta.emoji} {meta.label}</span>
              <span className="text-gray-400">{items.join(' · ')}</span>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
/** 출처 — sources 배열({title,url,type,confidence} 또는 문자열) */
function SourceList({ sources }: { sources: any[] }) {
  if (!Array.isArray(sources) || !sources.length) return null;
  const txt = sources.map((x: any) => {
    if (typeof x === 'string') return x;
    const t = x?.title || x?.url || '';
    return t ? `${t}${x?.confidence ? ` (${x.confidence})` : ''}` : '';
  }).filter(Boolean).join(' · ');
  if (!txt) return null;
  return <div className="text-[11px] text-gray-400 break-all">출처: {txt}</div>;
}
/** 다음 액션 큐 — actions 배열({type,title,priority,owner} 또는 문자열) */
function ActionQueue({ actions, label = '다음 액션', bare = false }: { actions: any[]; label?: string; bare?: boolean }) {
  if (!Array.isArray(actions) || !actions.length) return null;
  const pColor = (p: string) => p === 'high' ? 'bg-rose-50 text-rose-500' : p === 'low' ? 'bg-gray-100 text-gray-400' : 'bg-amber-50 text-amber-600';
  const rows = actions.map((a: any) => (typeof a === 'string' ? { title: a } : a)).filter((a: any) => a?.title);
  if (!rows.length) return null;
  const inner = (
    <>
      {label && <SectionLabel>{label}</SectionLabel>}
      <ul className="space-y-1">
        {rows.map((a: any, i: number) => (
          <li key={i} className="flex items-center gap-1.5 text-sm text-gray-600">
            <span>□ {a.title}</span>
            {a.owner && STAFF_META[a.owner] && <span className="text-[10px] text-gray-400">{STAFF_META[a.owner].emoji}</span>}
            {a.priority && <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${pColor(a.priority)}`}>{a.priority}</span>}
          </li>
        ))}
      </ul>
    </>
  );
  return bare ? <div className="space-y-2">{inner}</div> : <Section>{inner}</Section>;
}

/** 컴플라이언스 한 줄 — complianceCheck({pass,flags,bannedExpressionsFound}) */
function ComplianceLine({ cc }: { cc: any }) {
  if (!cc) return null;
  const flags = [...(cc.flags || []), ...(cc.bannedExpressionsFound || [])].filter(Boolean);
  const pass = cc.pass !== false && !flags.length;
  return <Section label="컴플라이언스"><div className={`text-xs ${pass ? 'text-emerald-500' : 'text-rose-500'}`}>{pass ? '✅ 금지표현 체크 통과' : `⚠️ 점검 필요: ${flags.join(', ') || '금지표현'}`}</div></Section>;
}

/* ───────── ① 소싱: sourcing_brief · "의사결정 브리프" ───────── */
const SOURCING_AXES: [string, string][] = [['trend', '트렌드'], ['entry', '진입장벽'], ['target', '타겟적합'], ['margin', '마진'], ['diff', '차별화']];
function AxisRow({ label, v, reason }: { label: string; v: number; reason?: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-[11px] text-gray-500 w-14 flex-shrink-0 pt-0.5">{label}</span>
      <div className="flex gap-0.5 flex-shrink-0 pt-1">{[0, 1].map(i => <span key={i} className={`w-5 h-1.5 rounded-full ${(v ?? 0) > i ? 'bg-primary-500' : 'bg-gray-200'}`} />)}</div>
      {reason && <span className="text-[11px] text-gray-400 leading-relaxed">{reason}</span>}
    </div>
  );
}
/** 마진 — 모바일 우선 스택(판매가 − 비용… = 순마진). GPT 권장: 모바일 표/스택 */
function MarginStack({ m }: { m: any }) {
  const fmt = (n: any) => (typeof n === 'number' ? n.toLocaleString() : n);
  const rows: [string, any, boolean][] = [
    ['판매가', m.price, false], ['원가', m.cost, true], ['수수료', m.platformFee, true],
    ['포장·배송', m.packagingShipping, true], ['광고비', m.expectedAdCost, true],
  ];
  const shown = rows.filter(r => r[1] != null);
  return (
    <Card className="p-3">
      <div className="text-[11px] font-semibold text-gray-400 tracking-wide mb-1.5">예상 순마진</div>
      <div className="space-y-0.5 text-sm">
        {shown.map(([label, val, minus], i) => (
          <div key={i} className="flex justify-between text-gray-600"><span>{minus ? '− ' : ''}{label}</span><span>{fmt(val)}</span></div>
        ))}
        {m.netProfit != null && (
          <div className="flex justify-between font-semibold text-gray-800 border-t border-gray-100 pt-1 mt-1"><span>= 순마진</span><span>{fmt(m.netProfit)}{m.netRate ? ` (${m.netRate})` : ''}</span></div>
        )}
      </div>
      {m.breakEvenMonthlyQty != null && <div className="text-[11px] text-gray-400 mt-1">손익분기 월 {m.breakEvenMonthlyQty}개</div>}
    </Card>
  );
}
function SourcingView({ d, onSave }: { d: any; onSave?: (itemType: string, payload: any) => void }) {
  const v: string = d.verdict || '';
  const vColor = v.includes('비추천') ? 'bg-rose-50 text-rose-600' : v.includes('추천') ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700';
  const s = d.scores || {};
  const aScore = (x: any) => (typeof x === 'object' && x ? x.score : x);
  const aReason = (x: any) => (typeof x === 'object' && x ? x.reason : '');
  return (
    <div className="space-y-3">
      {/* 판정 히어로 */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          {v && <span className={`text-sm font-bold px-3 py-1 rounded-full ${vColor}`}>{v}</span>}
          {d.score != null && <span className="text-sm text-gray-600 font-semibold">{d.score}/10</span>}
          {d.confidence && <span className="text-[11px] text-gray-400">· 신뢰도 {d.confidence}</span>}
          {onSave && <button onClick={() => onSave('product', { ...d, title: d.persona || d.verdict })} title="상품 후보 보관" className="ml-auto text-xs text-gray-300 hover:text-amber-400 active:scale-90 transition-all">⭐</button>}
        </div>
        {d.summary && <p className="text-sm text-gray-600">{d.summary}</p>}
      </div>
      {Array.isArray(d.reasons) && d.reasons.length > 0 && (
        <ul className="space-y-0.5">{d.reasons.map((r: any, i: number) => <li key={i} className="text-sm text-gray-600">· {String(r)}</li>)}</ul>
      )}
      {d.scores && (
        <Card className="p-3 bg-gray-50/60 space-y-2">
          <div className="text-[11px] font-semibold text-gray-400 tracking-wide mb-1">5축 평가</div>
          {SOURCING_AXES.map(([k, label]) => <AxisRow key={k} label={label} v={aScore(s[k])} reason={aReason(s[k])} />)}
        </Card>
      )}
      {d.margin && (d.margin.price || d.margin.cost) && <MarginStack m={d.margin} />}
      {(d.persona || (Array.isArray(d.channels) && d.channels.length) || (Array.isArray(d.risks) && d.risks.length)) && (
        <Section>
          <div className="space-y-2.5">
            {d.persona && <div><SectionLabel>타겟 페르소나</SectionLabel><p className="text-sm text-gray-600 mt-0.5">{d.persona}</p></div>}
            {Array.isArray(d.channels) && d.channels.length > 0 && <div className="space-y-1"><SectionLabel>추천 채널</SectionLabel><Chips items={d.channels} color="bg-primary-50 text-primary-600" /></div>}
            {Array.isArray(d.risks) && d.risks.length > 0 && <div className="space-y-1"><SectionLabel>리스크</SectionLabel><Chips items={d.risks} color="bg-rose-50 text-rose-500" /></div>}
          </div>
        </Section>
      )}
      <ActionQueue actions={d.nextActions} label="다음 검증 액션" />
      <HandoffPanel handoff={d.handoff} />
      <SourceList sources={d.sources} />
    </div>
  );
}

/* ───────── ② 상세페이지: detail_builder · "페이지 빌더" ───────── */
/** 6섹션 → 스마트스토어 붙여넣기용 HTML */
function buildSmartstoreHtml(d: any): string {
  const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const sections = Array.isArray(d.sections) ? d.sections : [];
  return sections.map((s: any) => {
    const bullets = Array.isArray(s.bullets) && s.bullets.length
      ? `\n  <ul>${s.bullets.map((b: any) => `<li>${esc(b)}</li>`).join('')}</ul>` : '';
    return [
      `<section>`,
      `  <h2>${esc(s.title || s.key)}</h2>`,
      s.coreLine ? `  <p><strong>${esc(s.coreLine)}</strong></p>` : '',
      s.subLine ? `  <p>${esc(s.subLine)}</p>` : '',
      bullets,
      s.cta ? `  <p>${esc(s.cta)}</p>` : '',
      `</section>`,
    ].filter(Boolean).join('\n');
  }).join('\n\n');
}

function DetailBuilderView({ d, onSave }: { d: any; onSave?: (itemType: string, payload: any) => void }) {
  const brief = d.brief || {};
  const sections = Array.isArray(d.sections) ? d.sections : [];
  const [htmlCopied, setHtmlCopied] = useState(false);
  const copySection = (s: any) => [s.coreLine, s.subLine, ...(Array.isArray(s.bullets) ? s.bullets : []), s.cta].filter(Boolean).join('\n');
  const copyHtml = async () => {
    try { await navigator.clipboard.writeText(buildSmartstoreHtml(d)); setHtmlCopied(true); setTimeout(() => setHtmlCopied(false), 1800); } catch { /* ignore */ }
  };
  return (
    <div className="space-y-3">
      {(sections.length > 0 || onSave) && (
        <div className="flex justify-end items-center gap-2">
          {sections.length > 0 && (
            <button onClick={copyHtml} title="스마트스토어에 붙여넣을 HTML 복사"
              className="text-[11px] px-2 py-1 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 active:scale-95 transition-all">
              {htmlCopied ? '복사됨 ✓' : '⧉ HTML 복사'}
            </button>
          )}
          {onSave && (
            <button onClick={() => onSave('page', { ...d, title: brief.productName || '상세페이지' })} title="완성 페이지 보관"
              className="text-[11px] text-gray-300 hover:text-amber-400 active:scale-95 transition-all">⭐ 페이지 보관</button>
          )}
        </div>
      )}
      {/* 브리프 */}
      {(brief.productName || brief.target || brief.usp?.length || brief.banned?.length) && (
        <Card className="p-3 space-y-2">
          {brief.productName && <div className="text-sm font-bold text-gray-800">{brief.productName}</div>}
          {brief.target && <div className="text-xs text-gray-500">타겟: {brief.target}</div>}
          {Array.isArray(brief.usp) && brief.usp.length > 0 && <Chips items={brief.usp} color="bg-primary-50 text-primary-600" />}
          {Array.isArray(brief.customerPain) && brief.customerPain.length > 0 && <div className="text-[11px] text-gray-400">고객 불안: {brief.customerPain.join(' · ')}</div>}
          {Array.isArray(brief.banned) && brief.banned.length > 0 && <div className="text-[11px] text-rose-400">금지표현: {brief.banned.join(', ')}</div>}
        </Card>
      )}
      {/* 6섹션 스테퍼 */}
      <div className="space-y-2.5">
        {sections.map((s: any, i: number) => (
          <Card key={i} className="p-3 space-y-2.5">
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-primary-100 text-primary-600 text-[11px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
              <span className="text-sm font-semibold text-gray-800">{s.title || s.key}</span>
              {s.status && <span className="ml-auto text-[10px] text-gray-400">{s.status}</span>}
            </div>
            {s.objective && <div className="text-[11px] text-gray-400">🎯 {s.objective}</div>}
            {(s.coreLine || s.subLine || s.bullets?.length || s.cta) && (
              <div className="relative bg-gray-50 rounded-xl p-3 pr-9 space-y-2">
                <CopyIconButton text={copySection(s)} title="섹션 카피 복사" />
                {s.coreLine && <div className="text-sm font-bold text-gray-800 leading-relaxed">{s.coreLine}</div>}
                {s.subLine && <div className="text-xs text-gray-500 leading-relaxed">{s.subLine}</div>}
                {Array.isArray(s.bullets) && s.bullets.length > 0 && <ul className="space-y-1">{s.bullets.map((b: any, j: number) => <li key={j} className="text-xs text-gray-600 leading-relaxed">· {String(b)}</li>)}</ul>}
                {s.cta && <div className="text-xs text-primary-600 font-medium">→ {s.cta}</div>}
              </div>
            )}
            {s.visual && <div className="text-[11px] text-gray-400">🖼 {s.visual}</div>}
          </Card>
        ))}
      </div>
      <ComplianceLine cc={d.complianceCheck} />
      <HandoffPanel handoff={d.handoff} />
    </div>
  );
}

/* ───────── ③ CS: ticket_list · "티켓 인박스" ───────── */
function urgencyDot(u: string): string {
  return (u || '').includes('즉시') ? '🔴' : (u || '').includes('낮') ? '🟢' : '🟡';
}
/** 이탈 위험 칩 — riskLevel(high|medium|low 또는 높음/중간/낮음) */
function RiskChip({ level }: { level: string }) {
  const l = String(level || '');
  if (!l) return null;
  const [cls, txt] = l === 'high' || l.includes('높') ? ['bg-rose-50 text-rose-500', '이탈위험 높음']
    : l === 'low' || l.includes('낮') ? ['bg-gray-100 text-gray-400', '위험 낮음']
    : ['bg-amber-50 text-amber-600', '위험 중간'];
  return <span className={`text-[11px] px-2 py-0.5 rounded-full ${cls}`}>{txt}</span>;
}
/** 인박스 요약바 */
function TicketSummaryBar({ s }: { s: any }) {
  if (!s) return null;
  const items: [string, any][] = [['총', s.total], ['긴급', s.urgent], ['승인대기', s.needsHumanApproval], ['FAQ후보', s.faqCandidates], ['부정후기', s.negativeReviews]];
  const shown = items.filter(([, v]) => v != null);
  if (!shown.length) return null;
  return (
    <Card className="p-2.5 flex flex-wrap gap-x-3 gap-y-1">
      {shown.map(([label, v], i) => <span key={i} className="text-[11px] text-gray-500">{label} <b className="text-gray-700">{v}</b></span>)}
    </Card>
  );
}
function TicketListView({ d, onSave }: { d: any; onSave?: (itemType: string, payload: any) => void }) {
  const tickets = Array.isArray(d.tickets) ? d.tickets : [];
  if (!tickets.length && !d.summary) return null;
  return (
    <div className="space-y-2.5">
      <TicketSummaryBar s={d.summary} />
      {tickets.map((t: any, i: number) => {
        const senti = String(t.sentiment || '');
        const hot = senti.includes('불만') || senti.includes('격앙');
        const confirm = Array.isArray(t.needsConfirm) ? t.needsConfirm.join(', ') : t.needsConfirm;
        return (
          <Card key={i} className="p-3 space-y-2.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm">{urgencyDot(t.urgency)}</span>
              {t.type && <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{t.type}</span>}
              {senti && <span className={`text-[11px] px-2 py-0.5 rounded-full ${hot ? 'bg-rose-50 text-rose-500' : 'bg-gray-100 text-gray-500'}`}>{senti}</span>}
              <RiskChip level={t.riskLevel} />
              {t.needsHumanApproval && <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 ml-auto">⚠️ 승인 후 발송</span>}
              {onSave && <button onClick={() => onSave('faq', { title: `${t.type || '답변'} 응대`, body: t.draft, question: t.customerMessage, answer: t.faqCandidate?.answer })} title="답변·FAQ 보관" className={`text-xs text-gray-300 hover:text-amber-400 active:scale-90 transition-all ${t.needsHumanApproval ? '' : 'ml-auto'}`}>⭐</button>}
            </div>
            {t.customerMessage && <div className="text-xs text-gray-400 italic leading-relaxed">"{t.customerMessage}"</div>}
            {t.draft && (
              <div className="relative bg-gray-50 rounded-xl p-2.5 pr-9">
                <CopyIconButton text={t.draft} title="답변 복사" />
                <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{t.draft}</div>
              </div>
            )}
            {confirm && <div className="text-[11px] text-gray-400">확인 필요: {confirm}</div>}
            {t.needsHumanApproval && t.approvalReason && <div className="text-[11px] text-amber-500">승인 사유: {t.approvalReason}</div>}
            {t.faqCandidate?.shouldCreate && <div className="text-[11px] text-primary-500">⭐ FAQ 후보: {t.faqCandidate.question}</div>}
            {Array.isArray(t.nextActions) && t.nextActions.length > 0 && (
              <span className="text-[11px] text-gray-400">→ {t.nextActions.map((a: any) => `${STAFF_META[a.target]?.label || a.target}: ${a.title}`).join(' · ')}</span>
            )}
          </Card>
        );
      })}
    </div>
  );
}

/* ───────── ③ SNS: sns_queue ───────── */
function SnsTags({ h }: { h: any }) {
  const all = [...(h?.large || []), ...(h?.medium || []), ...(h?.small || []), ...(h?.brand || [])];
  if (!all.length) return null;
  return <div className="flex flex-wrap gap-x-2 gap-y-0.5">{all.map((t: any, i: number) => <span key={i} className="text-[11px] text-primary-500">{String(t)}</span>)}</div>;
}
/** 콘텐츠 믹스 스택바 + 경고 (GPT 권장: 도넛보다 스택바) */
const MIX_LABELS: Record<string, string> = { info: '정보', empathy: '공감', product: '상품', ugc: '후기', behind: '비하인드' };
function ContentMixBar({ summary }: { summary: any }) {
  if (!summary) return null;
  const mix = summary.mix;
  const warnings = Array.isArray(summary.warnings) ? summary.warnings : [];
  const counts: [string, any][] = [['전체', summary.total], ['승인대기', summary.needsApproval], ['예약', summary.scheduled], ['이미지필요', summary.needsVisual]];
  const shownCounts = counts.filter(([, v]) => v != null);
  if (!mix && !shownCounts.length && !warnings.length) return null;
  return (
    <Card className="p-3 space-y-2.5">
      {shownCounts.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1">{shownCounts.map(([l, v], i) => <span key={i} className="text-[11px] text-gray-500">{l} <b className="text-gray-700">{v}</b></span>)}</div>
      )}
      {mix && typeof mix === 'object' && (
        <div className="space-y-1">
          <div className="text-[11px] font-semibold text-gray-400 tracking-wide">콘텐츠 믹스</div>
          {Object.entries(mix).map(([k, v]) => (
            <div key={k} className="flex items-center gap-2">
              <span className="text-[11px] text-gray-500 w-12 flex-shrink-0">{MIX_LABELS[k] || k}</span>
              <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden"><div className="h-full bg-primary-400 rounded-full" style={{ width: `${Math.min(100, Number(v) || 0)}%` }} /></div>
              <span className="text-[10px] text-gray-400 w-8 text-right">{String(v)}%</span>
            </div>
          ))}
        </div>
      )}
      {warnings.map((w: any, i: number) => <div key={i} className="text-[11px] text-amber-600">⚠️ {String(w)}</div>)}
    </Card>
  );
}
const hashtagText = (h: any) => h ? [...(h.large || []), ...(h.medium || []), ...(h.small || []), ...(h.brand || [])].join(' ') : '';
/** 우상단 복사 아이콘 (연회색 박스 안 게시물 전체 복사) */
function CopyIconButton({ text, title = '전체 복사' }: { text: string; title?: string }) {
  return (
    <button onClick={() => navigator.clipboard?.writeText(text)} title={title}
      className="absolute top-2 right-2 w-6 h-6 rounded-lg bg-white text-gray-400 hover:text-primary-500 flex items-center justify-center shadow-sm active:scale-90 transition-all">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
    </button>
  );
}
function SnsQueueView({ d, onSave }: { d: any; onSave?: (itemType: string, payload: any) => void }) {
  const posts = Array.isArray(d.posts) ? d.posts : [];
  if (!posts.length && !d.summary) return null;
  return (
    <div className="space-y-2.5">
      <ContentMixBar summary={d.summary} />
      {posts.map((p: any, i: number) => {
        const hookText = typeof p.hook === 'string' ? p.hook : p.hook?.text;
        const hookScore = typeof p.hook === 'object' ? p.hook?.score : undefined;
        const ctaText = typeof p.cta === 'string' ? p.cta : p.cta?.text;
        const fullText = [hookText, p.body, ctaText, hashtagText(p.hashtags)].filter(Boolean).join('\n\n');
        return (
          <Card key={i} className="p-3 space-y-2.5">
            <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
              {p.date && <span className="font-semibold text-gray-700">{p.date}{p.time ? ` ${p.time}` : ''}</span>}
              {p.channel && <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{p.channel}</span>}
              {p.format && <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{p.format}</span>}
              {p.objective && <span className="px-2 py-0.5 rounded-full bg-primary-50 text-primary-600">{p.objective}</span>}
              {p.status && <span className="ml-auto text-gray-400">{p.status}</span>}
              {onSave && <button onClick={() => onSave('post', { ...p, title: hookText || (p.body ? String(p.body).slice(0, 30) : '게시물') })} title="콘텐츠 보관" className={`text-xs text-gray-300 hover:text-amber-400 active:scale-90 transition-all ${p.status ? '' : 'ml-auto'}`}>⭐</button>}
            </div>
            {/* 게시물 콘텐츠 — 연회색 박스 + 우상단 전체 복사 */}
            <div className="relative bg-gray-50 rounded-xl p-3 pr-9 space-y-2.5">
              <CopyIconButton text={fullText} title="제목·내용·해시태그 전체 복사" />
              {hookText && (
                <div className="text-sm font-bold text-gray-800 pr-1">
                  {hookText}{hookScore != null && <span className="ml-1.5 text-[11px] font-normal text-gray-400">훅 {hookScore}/10</span>}
                </div>
              )}
              {p.body && <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{p.body}</p>}
              {ctaText && <div className="text-xs text-primary-600 font-medium">→ {ctaText}</div>}
              {p.hashtags && <SnsTags h={p.hashtags} />}
            </div>
            {p.imageBrief && <div className="text-[11px] text-gray-400">🖼 {typeof p.imageBrief === 'string' ? p.imageBrief : JSON.stringify(p.imageBrief)}</div>}
            {Array.isArray(p.variants) && p.variants.length > 0 && (
              <div className="flex gap-1 flex-wrap">{p.variants.map((v: any, j: number) => <span key={j} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-400">{typeof v === 'string' ? v : (v?.label || v?.angle || 'A/B')}</span>)}</div>
            )}
            {Array.isArray(p.nextActions) && p.nextActions.length > 0 && (
              <span className="text-[11px] text-gray-400">→ {p.nextActions.map((a: any) => `${STAFF_META[a.target]?.label || a.target}: ${a.title}`).join(' · ')}</span>
            )}
          </Card>
        );
      })}
    </div>
  );
}

/* ───────── ⑤ 광고: copy_variants · "A/B 3세트 비교" ───────── */
const AD_COMPLIANCE_LABELS: Record<string, string> = { exaggeration: '과장', unverifiedNo1: '1위 표현', lowestPrice: '최저가', healthClaim: '효능 단정', landingConsistencyRequired: '랜딩 일관성' };
/** 광고 항목별 컴플라이언스 — true=점검완료/통과, landingConsistencyRequired만 true=확인필요 */
function AdCompliance({ cc }: { cc: any }) {
  if (!cc || typeof cc !== 'object') return null;
  const entries = Object.entries(cc).filter(([k]) => AD_COMPLIANCE_LABELS[k]);
  if (!entries.length) return null;
  return (
    <Section label="컴플라이언스 체크">
      <div className="flex flex-wrap gap-1.5">
        {entries.map(([k, v]) => {
          const isLanding = k === 'landingConsistencyRequired';
          const ok = isLanding ? v !== true : v === true;
          return <span key={k} className={`text-[11px] px-2 py-0.5 rounded-full ${ok ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>{ok ? '☑' : '⚠'} {AD_COMPLIANCE_LABELS[k]}</span>;
        })}
      </div>
    </Section>
  );
}
function CopyVariantsView({ d, onSave }: { d: any; onSave?: (itemType: string, payload: any) => void }) {
  const sets = Array.isArray(d.sets) ? d.sets : [];
  const tg = d.targeting || {};
  const aud = tg.audience || {};
  const pr = d.product || {};
  const cg = d.channelGuide || {};
  const copyText = (s: any) => [s.headline, s.sub, s.detail, s.cta].filter(Boolean).join('\n');
  const audLine: [string, any][] = [['코어', aud.core], ['유사', aud.lookalike], ['관심', aud.interest], ['제외', aud.exclude]];
  return (
    <div className="space-y-3">
      {/* 상품/목표 바 */}
      {(pr.name || pr.goal || pr.angle) && (
        <Card className="p-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
          {pr.name && <span className="font-semibold text-gray-700">{pr.name}</span>}
          {pr.price != null && <span className="text-gray-400">{typeof pr.price === 'number' ? pr.price.toLocaleString() : pr.price}원</span>}
          {pr.goal && <span className="px-2 py-0.5 rounded-full bg-primary-50 text-primary-600">{pr.goal}</span>}
          {pr.angle && <span className="text-gray-500">· {pr.angle}</span>}
          {Array.isArray(pr.channels) && pr.channels.length > 0 && <span className="text-gray-400">· {pr.channels.join('/')}</span>}
        </Card>
      )}
      {/* 3세트 비교 (데스크톱 나란히 / 모바일 세로 누적) */}
      {sets.length > 0 && (
        <div className="grid sm:grid-cols-3 gap-2">
          {sets.map((s: any, i: number) => (
            <Card key={i} className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary-50 text-primary-600">{s.type || '카피'}</span>
                <div className="flex items-center gap-1.5">
                  {s.status && <span className="text-[10px] text-gray-400">{s.status}</span>}
                  {onSave && <button onClick={() => onSave('copy', s)} title="보관함에 저장" className="text-xs text-gray-300 hover:text-amber-400 active:scale-90 transition-all">⭐</button>}
                </div>
              </div>
              {(s.headline || s.sub || s.detail || s.cta) && (
                <div className="relative bg-gray-50 rounded-xl p-2.5 pr-9 space-y-1">
                  <CopyIconButton text={copyText(s)} title="카피 복사" />
                  {s.headline && <div className="text-sm font-bold text-gray-800 leading-relaxed">{s.headline}</div>}
                  {s.sub && <div className="text-xs text-gray-500 leading-relaxed">{s.sub}</div>}
                  {s.detail && <div className="text-xs text-gray-400 leading-relaxed">{s.detail}</div>}
                  {s.cta && <div className="text-xs text-primary-600 font-medium">→ {s.cta}</div>}
                </div>
              )}
              {s.imageDirection && <div className="text-[11px] text-gray-400">🖼 {s.imageDirection}</div>}
              {Array.isArray(s.recommendedChannels) && s.recommendedChannels.length > 0 && <div className="text-[11px] text-gray-400">📍 {s.recommendedChannels.join(', ')}</div>}
              {Array.isArray(s.expectedMetric) && s.expectedMetric.length > 0 && <div className="text-[11px] text-gray-400">📊 {s.expectedMetric.join(', ')}</div>}
              {s.caution && <div className="text-[11px] text-amber-500">⚠ {s.caution}</div>}
              {s.variantId && <div className="text-[10px] text-gray-300 text-right">{s.variantId}</div>}
            </Card>
          ))}
        </div>
      )}
      {/* 타겟팅 */}
      {(tg.keywords?.length || aud.core?.length || tg.budgetSplit) && (
        <Card className="p-3 space-y-2">
          <div className="text-[11px] font-semibold text-gray-400 tracking-wide">타겟팅</div>
          {Array.isArray(tg.keywords) && tg.keywords.length > 0 && <div className="text-xs text-gray-600">키워드 {tg.keywords.length}개: {tg.keywords.slice(0, 8).join(', ')}{tg.keywords.length > 8 ? '…' : ''}</div>}
          {audLine.filter(([, v]) => Array.isArray(v) && v.length).map(([l, v]) => <div key={l} className="text-xs text-gray-500">{l}: {v.join(', ')}</div>)}
          {tg.budgetSplit && <div className="text-xs text-gray-500">예산: 테스트 균등 → 승자 집중(70/20/10)</div>}
        </Card>
      )}
      {/* 채널 가이드 */}
      {Object.keys(cg).length > 0 && (
        <Card className="p-3 space-y-1">
          <div className="text-[11px] font-semibold text-gray-400 tracking-wide mb-0.5">채널 가이드</div>
          {Object.entries(cg).map(([k, v]) => <div key={k} className="text-xs text-gray-500"><b className="text-gray-600">{k}</b> {String(v)}</div>)}
        </Card>
      )}
      <AdCompliance cc={d.complianceCheck} />
      <HandoffPanel handoff={d.handoff} />
    </div>
  );
}

/* ───────── ⑥ 모니터링: monitor_digest · "경쟁사 대시보드" ───────── */
function levelDot(lv: any): string {
  const l = String(lv || '');
  return l.includes('red') || l.includes('🔴') ? '🔴' : l.includes('orange') || l.includes('🟠') ? '🟠' : l.includes('green') || l.includes('🟢') ? '🟢' : '⚪';
}
function CompareTable({ rows }: { rows: any[] }) {
  const show = rows.slice(0, 4); // 우리 + 주요 경쟁사 3
  return (
    <Card className="p-3 overflow-x-auto">
      <div className="text-[11px] font-semibold text-gray-400 tracking-wide mb-1.5">경쟁사 비교</div>
      <table className="w-full text-xs">
        <tbody>
          {show.map((r: any, i: number) => (
            <tr key={i} className="border-b border-gray-50 last:border-0">
              <td className="py-1 pr-2 font-medium text-gray-700 whitespace-nowrap">{r.name}</td>
              <td className="py-1 pr-2 text-gray-500 whitespace-nowrap">{typeof r.price === 'number' ? r.price.toLocaleString() : r.price}</td>
              {r.composition && <td className="py-1 pr-2 text-gray-500">{r.composition}</td>}
              <td className="py-1 text-gray-400">{r.recommendedResponse || r.difference || ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 4 && <div className="text-[11px] text-gray-400 mt-1">+ {rows.length - 4}개 더</div>}
    </Card>
  );
}
function MonitorDigestView({ d }: { d: any }) {
  const alerts = Array.isArray(d.alerts) ? d.alerts : [];
  const table = Array.isArray(d.compareTable) ? d.compareTable : [];
  const changeLog = Array.isArray(d.changeLog) ? d.changeLog : [];
  const trends = Array.isArray(d.trends) ? d.trends : [];
  const strategy = d.strategy;
  const limits = Array.isArray(d.limitations) ? d.limitations : (d.limits ? [d.limits] : []);
  return (
    <div className="space-y-3">
      {Array.isArray(d.summary) && d.summary.length > 0 && (
        <ul className="space-y-0.5">{d.summary.map((s: any, i: number) => <li key={i} className="text-sm text-gray-600">· {String(s)}</li>)}</ul>
      )}
      {/* 대응 필요 알림 (상단) */}
      {alerts.map((a: any, i: number) => (
        <Card key={i} className="p-3 space-y-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span>{levelDot(a.level)}</span>
            {a.title && <span className="text-sm font-semibold text-gray-800">{a.title}</span>}
            {a.status && <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-500">{a.status === 'action_required' ? '대응 필요' : a.status}</span>}
          </div>
          {a.change && <div className="text-xs text-gray-600">변화: {a.change}</div>}
          {a.impact && <div className="text-xs text-gray-500">영향: {a.impact}</div>}
          {a.recommendation && <div className="text-xs text-primary-600">→ {a.recommendation}</div>}
          {a.source && <SourceList sources={[a.source]} />}
        </Card>
      ))}
      {table.length > 0 && <CompareTable rows={table} />}
      {changeLog.length > 0 && (
        <Card className="p-3 space-y-1">
          <div className="text-[11px] font-semibold text-gray-400 tracking-wide mb-0.5">변화 로그</div>
          {changeLog.map((c: any, i: number) => (
            <div key={i} className="flex items-center gap-1.5 text-xs text-gray-600 flex-wrap">
              <span>{levelDot(c.level)}</span><span className="font-medium">{c.item}</span>
              <span className="text-gray-400">{c.before} → {c.after}</span>
              {c.delta && <span className="text-rose-400">{c.delta}</span>}
            </div>
          ))}
        </Card>
      )}
      {trends.length > 0 && (
        <div className="space-y-2">
          {trends.map((t: any, i: number) => (
            <Card key={i} className="p-2.5">
              <div className="text-xs"><b className="text-gray-700">{t.keyword}</b> <span className="text-gray-400">{t.delta}</span></div>
              {t.meaning && <div className="text-[11px] text-gray-500 mt-0.5">{t.meaning}</div>}
            </Card>
          ))}
        </div>
      )}
      {strategy && (typeof strategy === 'string'
        ? <Section label="대응 전략"><div className="text-sm text-gray-600">{strategy}</div></Section>
        : (
          <Section label="대응 전략">
            {strategy.summary && <div className="text-sm text-gray-600">{strategy.summary}</div>}
            <ActionQueue actions={strategy.actions} label="" bare />
          </Section>
        ))}
      {limits.length > 0 && <div className="text-[11px] text-gray-400">ⓘ {limits.join(' · ')}</div>}
      <HandoffPanel handoff={d.handoff} />
    </div>
  );
}

/* ───────── ⑦ 분석가: metric_digest · "KPI 대시보드" ───────── */
function KpiCard({ k }: { k: any }) {
  return (
    <Card className="p-2.5 space-y-0.5">
      <div className="text-[11px] text-gray-400 truncate">{k.label || k.name}</div>
      <div className="text-base font-bold text-gray-800">{k.displayValue || (typeof k.value === 'number' ? k.value.toLocaleString() : k.value)}</div>
      <div className="flex items-center gap-1 text-[11px]"><span>{levelDot(k.signal)}</span>{k.delta && <span className="text-gray-500">{k.delta}</span>}</div>
    </Card>
  );
}
function MetricDigestView({ d }: { d: any }) {
  const kpis = Array.isArray(d.kpis) ? d.kpis : [];
  const anomalies = Array.isArray(d.anomalies) ? d.anomalies : [];
  const actions = Array.isArray(d.actions) ? d.actions : [];
  const dataSource = Array.isArray(d.dataSource) ? d.dataSource : (d.dataSource ? [{ source: d.dataSource }] : []);
  const limits = Array.isArray(d.limitations) ? d.limitations : [];
  return (
    <div className="space-y-3">
      {/* 5초 요약 */}
      {Array.isArray(d.summary) && d.summary.length > 0 && (
        <ul className="space-y-0.5">{d.summary.map((s: any, i: number) => <li key={i} className="text-sm text-gray-600">· {String(s)}</li>)}</ul>
      )}
      {/* KPI 카드 그리드 */}
      {kpis.length > 0 && <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{kpis.map((k: any, i: number) => <KpiCard key={i} k={k} />)}</div>}
      {/* 이상치 */}
      {anomalies.length > 0 && (
        <div className="space-y-2.5">
          <div className="text-[11px] font-semibold text-gray-400 tracking-wide">이상치</div>
          {anomalies.map((a: any, i: number) => (
            <Card key={i} className="p-3 space-y-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span>{levelDot(a.level)}</span>
                <span className="text-sm font-semibold text-gray-800">{a.title || a.metric}</span>
                {a.confidence && <span className="ml-auto text-[10px] text-gray-400">신뢰도 {a.confidence}</span>}
              </div>
              {(a.previous || a.current || a.delta) && <div className="text-xs text-gray-500">{a.previous}{a.previous && a.current ? ' → ' : ''}{a.current}{a.delta ? ` (${a.delta})` : ''}</div>}
              {a.meaning && <div className="text-xs text-gray-600">{a.meaning}</div>}
              {a.hypothesis && <div className="text-xs text-gray-500">가설: {a.hypothesis}</div>}
              {Array.isArray(a.evidence) && a.evidence.length > 0 && <div className="text-[11px] text-gray-400">근거: {a.evidence.join(' · ')}</div>}
              {a.nextAction && <div className="text-xs text-primary-600">→ {a.nextAction}</div>}
            </Card>
          ))}
        </div>
      )}
      {/* 추천 액션 큐 */}
      {actions.length > 0 && (
        <div>
          <span className="text-[11px] font-semibold text-gray-400 tracking-wide block mb-1">추천 액션</span>
          <div className="space-y-2">
            {actions.map((a: any, i: number) => (
              <Card key={i} className="p-2.5 space-y-0.5">
                <div className="flex items-center gap-1.5 text-sm text-gray-700 flex-wrap">
                  {a.priority != null && <span className="w-4 h-4 rounded-full bg-primary-100 text-primary-600 text-[10px] font-bold flex items-center justify-center flex-shrink-0">{a.priority}</span>}
                  <span className="font-medium">{a.title}</span>
                  {a.owner && STAFF_META[a.owner] && <span className="text-[11px] text-gray-400">{STAFF_META[a.owner].emoji}</span>}
                  {a.approvalRequired && <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600">승인 필요</span>}
                </div>
                {(a.reason || a.metricsToCheck?.length) && <div className="text-[11px] text-gray-400">{a.reason}{Array.isArray(a.metricsToCheck) && a.metricsToCheck.length ? ` · ${a.metricsToCheck.join('/')}` : ''}</div>}
              </Card>
            ))}
          </div>
        </div>
      )}
      {/* 데이터 출처 · 신뢰도 */}
      {dataSource.length > 0 && (
        <div className="text-[11px] text-gray-400">데이터: {dataSource.map((s: any) => `${s.source}${s.period ? ` (${s.period})` : ''}`).join(' · ')}{d.confidence ? ` · 신뢰도 ${d.confidence}` : ''}</div>
      )}
      {limits.length > 0 && <div className="text-[11px] text-gray-400">ⓘ {limits.join(' · ')}</div>}
    </div>
  );
}

/* ───────── ⑧ 비주얼: image_brief · "촬영/프롬프트 보드" ───────── */
const RATIO_LABELS: Record<string, string> = { '4:5': '상세/피드', '1:1': '썸네일', '9:16': '릴스/스토리', '16:9': '배너' };
function RatioBadge({ ratio }: { ratio: string }) {
  if (!ratio) return null;
  const desc = RATIO_LABELS[ratio];
  return <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{ratio}{desc ? ` ${desc}` : ''}</span>;
}
function ShotRow({ s, grade }: { s: any; grade: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs flex-wrap">
      <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${grade === 'MUST' ? 'bg-primary-50 text-primary-600' : 'bg-gray-100 text-gray-400'}`}>{grade}</span>
      <span className="text-gray-700">{s.label || s.type}</span>
      {s.purpose && <span className="text-gray-400">· {s.purpose}</span>}
      <RatioBadge ratio={s.ratio} />
    </div>
  );
}
function ImageBriefView({ d, onSave }: { d: any; onSave?: (itemType: string, payload: any) => void }) {
  const [busy, setBusy] = useState<number | null>(null);
  const [imgs, setImgs] = useState<Record<number, string>>({});
  const gen = async (p: any, i: number) => {
    setBusy(i);
    try { const { url } = await generateImage(p.text, ratioToSize(p.ratio)); if (url) setImgs(prev => ({ ...prev, [i]: url })); }
    catch (e: any) { alert(e?.message || '이미지 생성 실패 — gpt-image-1 권한/비용을 확인해주세요'); }
    finally { setBusy(null); }
  };
  const vd = d.visualDirection || {};
  const shots = Array.isArray(d.shotList) ? d.shotList : [];
  const prompts = Array.isArray(d.prompts) ? d.prompts : [];
  const negatives = Array.isArray(d.negativePrompt) ? d.negativePrompt : (d.negatives ? [d.negatives] : []);
  const candidates = Array.isArray(d.candidates) ? d.candidates : [];
  const isMust = (s: any) => String(s.grade || '').toLowerCase().includes('must');
  const must = shots.filter(isMust);
  const nice = shots.filter((s: any) => !isMust(s));
  return (
    <div className="space-y-3">
      {/* 비주얼 방향 */}
      {(vd.mood?.length || vd.colors?.length || vd.props?.length || vd.avoid?.length) && (
        <Card className="p-3 space-y-2">
          <div className="text-[11px] font-semibold text-gray-400 tracking-wide">비주얼 방향</div>
          {Array.isArray(vd.mood) && vd.mood.length > 0 && <div className="text-xs text-gray-600">무드: {vd.mood.join(' · ')}</div>}
          {Array.isArray(vd.colors) && vd.colors.length > 0 && <div className="text-xs text-gray-500">컬러: {vd.colors.join(' · ')}</div>}
          {Array.isArray(vd.props) && vd.props.length > 0 && <div className="text-xs text-gray-500">소품: {vd.props.join(' · ')}</div>}
          {Array.isArray(vd.avoid) && vd.avoid.length > 0 && <div className="text-[11px] text-rose-400">금지: {vd.avoid.join(' · ')}</div>}
        </Card>
      )}
      {/* 촬영컷 리스트 (MUST/NICE) */}
      {shots.length > 0 && (
        <Card className="p-3 space-y-2">
          <div className="text-[11px] font-semibold text-gray-400 tracking-wide">필수 촬영컷</div>
          {must.map((s: any, i: number) => <ShotRow key={`m${i}`} s={s} grade="MUST" />)}
          {nice.map((s: any, i: number) => <ShotRow key={`n${i}`} s={s} grade="NICE" />)}
        </Card>
      )}
      {/* 프롬프트 카드 */}
      {prompts.map((p: any, i: number) => (
        <Card key={i} className="p-3 space-y-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <RatioBadge ratio={p.ratio} />
            {p.engine && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary-50 text-primary-500">{p.engine}</span>}
            {Array.isArray(p.useCase) && p.useCase.length > 0 && <span className="text-[10px] text-gray-400">{p.useCase.join(', ')}</span>}
            {p.status && <span className="ml-auto text-[10px] text-gray-400">{p.status}</span>}
            {onSave && <button onClick={() => onSave('prompt', { ...p, title: (p.text ? String(p.text).slice(0, 30) : '프롬프트') })} title="프롬프트 보관" className={`text-xs text-gray-300 hover:text-amber-400 active:scale-90 transition-all ${p.status ? '' : 'ml-auto'}`}>⭐</button>}
          </div>
          {p.text && <div className="text-xs text-gray-600 leading-relaxed bg-gray-50 rounded-lg p-2 break-all">{p.text}</div>}
          <div className="flex items-center gap-1.5">
            <button onClick={() => navigator.clipboard?.writeText(String(p.text || ''))}
              className="text-[11px] px-2 py-0.5 rounded-lg bg-gray-50 text-gray-500 hover:bg-gray-100 active:scale-95 transition-all">복사</button>
            <button onClick={() => gen(p, i)} disabled={busy === i}
              className="text-[11px] px-2 py-0.5 rounded-lg bg-primary-50 text-primary-600 hover:bg-primary-100 disabled:opacity-50 active:scale-95 transition-all">{busy === i ? '생성 중…' : '🎨 이미지 생성'}</button>
          </div>
          {imgs[i] && (
            <div className="space-y-1">
              <img src={imgs[i]} alt="생성 이미지" className="w-full rounded-xl border border-gray-100" />
              {onSave && <button onClick={() => onSave('image', { title: '생성 이미지', thumbnailUrl: imgs[i], prompt: p.text })}
                className="text-[11px] text-gray-300 hover:text-amber-400 active:scale-90 transition-all">⭐ 이미지 보관</button>}
            </div>
          )}
        </Card>
      ))}
      {/* 네거티브 */}
      {negatives.length > 0 && <Section label="네거티브 프롬프트"><div className="text-[11px] text-gray-400 break-all">{negatives.join(', ')}</div></Section>}
      {/* 후보 갤러리 (이미지 생성 API 연동 시 썸네일·채택) */}
      {candidates.length > 0 && (
        <Section label="후보 갤러리">
          <div className="grid grid-cols-3 gap-2">
            {candidates.map((c: any, i: number) => (
              <div key={i} className="space-y-1">
                <div className="aspect-square rounded-xl bg-gray-100 overflow-hidden flex items-center justify-center">
                  {c.thumbnailUrl ? <img src={c.thumbnailUrl} alt="" className="w-full h-full object-cover" /> : <span className="text-2xl text-gray-300">🖼</span>}
                </div>
                {c.status === 'selected'
                  ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600">채택</span>
                  : <span className="text-[10px] text-gray-400">{c.status || '후보'}</span>}
              </div>
            ))}
          </div>
        </Section>
      )}
      <HandoffPanel handoff={d.handoff} />
    </div>
  );
}

/* ───────── ⑨ 운영매니저: ops_digest · "일일 지휘 콘솔" ───────── */
const AQ_LABELS: Record<string, string> = { adSpend: '광고비', snsPublish: 'SNS', csSend: 'CS', detailPage: '상세', visual: '비주얼', sourcing: '소싱' };
function healthDot(status: any): string {
  const s = String(status || '').toLowerCase();
  return s.includes('error') || s.includes('fail') ? '🔴' : s.includes('warn') ? '🟠' : '🟢';
}
function OpsDigestView({ d }: { d: any }) {
  const top3 = Array.isArray(d.top3) ? d.top3 : [];
  const health = Array.isArray(d.staffHealth) ? d.staffHealth : [];
  const aq = d.approvalQueue || {};
  const missed = Array.isArray(d.missed) ? d.missed : [];
  const suggested = Array.isArray(d.suggestedTasks) ? d.suggestedTasks : [];
  const aqCounts = Object.entries(aq).map(([k, v]) => [k, Array.isArray(v) ? v.length : v] as [string, any]).filter(([, n]) => n);
  return (
    <div className="space-y-3">
      {/* Top3 (펼침) */}
      {top3.length > 0 && (
        <div className="space-y-2.5">
          <div className="text-[11px] font-semibold text-gray-400 tracking-wide">오늘 꼭 볼 것 Top 3</div>
          {top3.map((t: any, i: number) => (
            <Card key={i} className="p-3 space-y-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span>{levelDot(t.level)}</span>
                {t.area && <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{t.area}</span>}
                <span className="text-sm font-semibold text-gray-800">{t.title}</span>
                {t.status && <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-500">{t.status === 'action_required' ? '대응 필요' : t.status}</span>}
              </div>
              {t.whyNow && <div className="text-xs text-gray-500">왜 지금: {t.whyNow}</div>}
              {(t.decisionNeeded || t.decision) && <div className="text-xs text-gray-700">{t.decisionNeeded || t.decision}</div>}
              {t.recommendation && <div className="text-xs text-primary-600">→ {t.recommendation}</div>}
              <div className="flex items-center gap-1.5 flex-wrap">
                {Array.isArray(t.owners) && t.owners.map((o: string, j: number) => STAFF_META[o] && <span key={j} className="text-[11px] text-gray-400">{STAFF_META[o].emoji} {STAFF_META[o].label}</span>)}
                {t.sourceStaff && <span className="text-[10px] text-gray-300 ml-auto">출처: {STAFF_META[t.sourceStaff]?.label || t.sourceStaff}</span>}
              </div>
            </Card>
          ))}
        </div>
      )}
      {/* 승인 대기 큐 요약 */}
      {aqCounts.length > 0 && (
        <Card className="p-2.5 flex flex-wrap gap-x-3 gap-y-1 items-center">
          <span className="text-[11px] text-gray-400">승인 대기</span>
          {aqCounts.map(([k, n], i) => <span key={i} className="text-[11px] text-gray-600">{AQ_LABELS[k] || k} <b className="text-gray-700">{n}</b></span>)}
        </Card>
      )}
      {/* 누락·병목 */}
      {missed.length > 0 && (
        <Card className="p-3 space-y-1">
          <div className="text-[11px] font-semibold text-gray-400 tracking-wide mb-0.5">누락·병목</div>
          {missed.map((m: any, i: number) => (
            <div key={i} className="text-xs text-gray-600 flex items-start gap-1.5"><span>{levelDot(m.level)}</span><span>{m.issue}{m.recommendation ? ` → ${m.recommendation}` : ''}</span></div>
          ))}
        </Card>
      )}
      {/* 직원 Health */}
      {health.length > 0 && (
        <Card className="p-3 space-y-1">
          <div className="text-[11px] font-semibold text-gray-400 tracking-wide mb-0.5">직원 Health</div>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {health.map((h: any, i: number) => <span key={i} className="text-[11px] text-gray-600">{healthDot(h.status)} {STAFF_META[h.staff]?.label || h.staff}{h.failed ? `(실패 ${h.failed})` : ''}</span>)}
          </div>
        </Card>
      )}
      {/* 추천 할일 */}
      {suggested.length > 0 && <ActionQueue actions={suggested} label="오늘 생성 추천 할일" />}
      {Array.isArray(d.limitations) && d.limitations.length > 0 && <div className="text-[11px] text-gray-400">ⓘ {d.limitations.join(' · ')}</div>}
    </div>
  );
}

/* ───────── 분기 ───────── */
export function StaffOutputView({ outputKind, data, onSave }: { outputKind?: string; data: any; onSave?: (itemType: string, payload: any) => void }) {
  if (!data || typeof data !== 'object') return null;
  switch (outputKind) {
    case 'sourcing_brief': return <SourcingView d={data} onSave={onSave} />;
    case 'detail_builder': return <DetailBuilderView d={data} onSave={onSave} />;
    case 'ticket_list': return <TicketListView d={data} onSave={onSave} />;
    case 'sns_queue': return <SnsQueueView d={data} onSave={onSave} />;
    case 'copy_variants': return <CopyVariantsView d={data} onSave={onSave} />;
    case 'monitor_digest': return <MonitorDigestView d={data} />;
    case 'metric_digest': return <MetricDigestView d={data} />;
    case 'image_brief': return <ImageBriefView d={data} onSave={onSave} />;
    case 'ops_digest': return <OpsDigestView d={data} />;
    default: return null; // 미구현 outputKind는 마크다운 본문만 표시
  }
}
