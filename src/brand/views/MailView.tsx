/**
 * @file src/brand/views/MailView.tsx
 * @description 10 메일 - 그 오피스 메일 계정만 (마이그 076 · 시안 sol-hq/할일/AI오피스-개편-시안.html 「10 메일 · 4판」)
 *  탭: 아침 정리 · 초안 · 템플릿 · 서명 · 구독 취소 · 메일함 정리 · 전체 메일
 *  · 메일함 정리: 본부가 보낸 곳별로 낸 정리안(077) → 행동 고르기 · 체크 → 「정리 요청」 → 본부가 몇 분 안에 실행 · 유지 메모(078)
 *  · 아침 정리: 기간 필터(시목 판매 현황 결 · 「오늘」 = 어제 10시 ~ 오늘 10시 · [저장] 을 눌러야 걸림) → 요약 카드 → 본부 정리 → 아직 남은 것 → 이 기간 중요
 *  · 초안: 본부가 쓴 답장 · 직접 쓴 것 → 고치고 「보내기 확정」 → 본부가 몇 분 안에 그 계정으로 보낸다
 *  · 서명은 늘 본문 아래 구분선 뒤 (명함 이미지 · 이름 · 연락처)
 * 주소: /w/:id/mail/:detailId?  detailId = m-<메일> · d-<초안> · d-new · t-<템플릿> · t-new · s-<서명> · s-new
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BrandViewProps } from '../BrandShell';
import { Act, Card, Empty, Err, Field, Mini, PageHead, Panel, Sec, Skeleton, Tabs, hay, matchSearch, usePaged, Pager } from '../ui';
import {
  MAIL_CATS, MailAccount, MailCategory, MailDigest, MailDraft, MailMessage, MailSignature, MailTemplate, MailUnsub, QUICK, QuickRange, Range,
  UNSUB_METHOD, addDraft, bumpTemplate, catLabel, composeHtml, confirmDraft, deleteSignature, deleteTemplate, discardDraft, fmtKst, fmtWhen,
  getMailDigest, getSignatureCard, kstDay, listDrafts, listMailAccounts, listMailMessages, listOpenMail, listSignatures, listTemplates, listUnsubs,
  quickRange, requestUnsubs, keepUnsub, unkeepUnsub, saveDraft, saveSignature, saveTemplate, setMailDone, unconfirmDraft, DraftFields,
  setUnsubMemo, listCleanup, setCleanup, requestCleanup, cleanDo, CLEAN_LABEL, MailCleanup, CleanAction,
} from '../mail.service';
import { MailEditor } from './MailEditor';

type Tab = 'sum' | 'drafts' | 'tpl' | 'sig' | 'unsub' | 'clean' | 'all';
const DRAFT_ST: Record<string, [string, string]> = {
  draft: ['확정 전', 'wait'], confirmed: ['보낼 예정', 'go'], sending: ['보내는 중', 'go'], sent: ['보냄', 'sent'], failed: ['실패', 'fail'],
};
const stripHtml = (h: string) => h.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

export function MailView({ workspace, look, detailId, go }: BrandViewProps) {
  const ws = workspace.id;
  const isHq = workspace.hqBrandKey === 'hq';
  const [tab, setTab] = useState<Tab>('sum');
  const [accounts, setAccounts] = useState<MailAccount[] | null>(null);
  const [acc, setAcc] = useState<string>('all');
  const [range, setRange] = useState<Range>(() => quickRange('today'));
  const [filterOpen, setFilterOpen] = useState(false);
  const [cat, setCat] = useState<MailCategory | 'all'>('all');
  const [q, setQ] = useState('');
  const [msgs, setMsgs] = useState<MailMessage[]>([]);
  const [openList, setOpenList] = useState<MailMessage[]>([]);
  const [digest, setDigest] = useState<MailDigest | null>(null);
  const [drafts, setDrafts] = useState<MailDraft[]>([]);
  const [templates, setTemplates] = useState<MailTemplate[]>([]);
  const [sigs, setSigs] = useState<MailSignature[]>([]);
  const [unsubs, setUnsubs] = useState<MailUnsub[]>([]);
  const [cleans, setCleans] = useState<MailCleanup[]>([]);
  const [err, setErr] = useState<unknown>(null);

  const reload = useCallback(async () => {
    try {
      const [a, o, d, t, s, u] = await Promise.all([listMailAccounts(ws), listOpenMail(ws), listDrafts(ws), listTemplates(ws), listSignatures(ws), listUnsubs(ws)]);
      setAccounts(a); setOpenList(o); setDrafts(d); setTemplates(t); setSigs(s); setUnsubs(u); setErr(null);
      setCleans(await listCleanup(ws).catch(() => []));   // 077 전에는 빈 목록
    } catch (e) { setErr(e); setAccounts([]); }
  }, [ws]);
  const reloadRange = useCallback(async () => {
    try {
      const [m, dg] = await Promise.all([listMailMessages(ws, range.from, range.to), range.day ? getMailDigest(ws, range.day) : Promise.resolve(null)]);
      setMsgs(m); setDigest(dg);
    } catch (e) { setErr(e); }
  }, [ws, range]);
  useEffect(() => { reload(); }, [reload]);
  useEffect(() => { reloadRange(); }, [reloadRange]);
  const refresh = () => { reload(); reloadRange(); };

  const byAcc = <T extends { accountId?: string }>(xs: T[]) => acc === 'all' ? xs : xs.filter(x => x.accountId === acc);
  const accOf = (id?: string) => accounts?.find(a => a.id === id);
  const mList = byAcc(msgs).filter(m => matchSearch(hay(m.fromName, m.fromAddr, m.subject, m.summary), q));
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const m of mList) c[m.category] = (c[m.category] ?? 0) + 1;
    return c;
  }, [mList]);
  const draftOf = (msgId: string) => drafts.find(d => d.messageId === msgId && d.status !== 'discarded');
  const openDrafts = byAcc(drafts).filter(d => d.status === 'draft');

  // 상세 (주소의 detailId)
  const [kind, id] = detailId ? [detailId.slice(0, 1), detailId.slice(2)] : ['', ''];
  const close = () => go('mail');
  const curMsg = kind === 'm' ? [...msgs, ...openList].find(m => m.id === id) : undefined;
  const curDraft = kind === 'd' && id !== 'new' ? drafts.find(d => d.id === id) : undefined;

  if (accounts === null) return <><PageHead title="메일" /><Skeleton /></>;
  const multi = accounts.length > 1;
  const small = accounts.length ? `${accounts.map(a => a.address).join(' · ')} · 10시 정리` : '메일 계정 연결 전';
  const tileCats: MailCategory[] = isHq ? ['billing', 'important', 'reply', 'ad', 'notice'] : ['reply', 'important', 'order', 'ad', 'notice'];

  return (
    <>
      <PageHead title="메일" small={small} action={tab === 'drafts' || tab === 'sum' ? <Act ghost onClick={() => go('mail', 'd-new')}>+ 새 메일</Act> : undefined} />
      <Tabs<Tab> value={tab} onChange={setTab} items={[
        { key: 'sum', label: '아침 정리' }, { key: 'drafts', label: '초안', count: openDrafts.length },
        { key: 'tpl', label: '템플릿', count: templates.length }, { key: 'sig', label: '서명', count: sigs.length },
        { key: 'unsub', label: '구독 취소', count: unsubs.filter(u => u.status === 'candidate').length },
        ...(cleans.length ? [{ key: 'clean' as Tab, label: '메일함 정리', count: cleans.filter(c => c.status === 'proposed' && cleanDo(c) !== 'keep').length }] : []),
        { key: 'all', label: '전체 메일', count: mList.length },
      ]} />
      {err != null && <Err e={err} />}
      {multi && (tab === 'sum' || tab === 'all' || tab === 'drafts' || tab === 'unsub' || tab === 'clean') && (
        <div className="m-acc">
          <button type="button" className={`m-chip${acc === 'all' ? ' on' : ''}`} onClick={() => setAcc('all')}>전체</button>
          {accounts.map(a => <button key={a.id} type="button" className={`m-chip${acc === a.id ? ' on' : ''}`} onClick={() => setAcc(a.id)}>{a.label || a.provider}<small>{a.address}</small></button>)}
        </div>
      )}

      {(tab === 'sum' || tab === 'all') && (accounts.length === 0 ? (
        <div className="m-empty"><b>연결된 메일 계정이 없습니다</b><p>계정을 연결하면 매일 10시에 정리하고, 중요 메일은 바로 알림을 보냅니다.</p></div>
      ) : <>
        <div className="m-fbar">
          <input className="sr" value={q} onChange={e => setQ(e.target.value)} placeholder="보낸 사람 · 제목 검색" />
          <button type="button" className={`m-fbtn${cat !== 'all' || range.key !== 'today' ? ' on' : ''}`} onClick={() => setFilterOpen(true)}>필터{cat !== 'all' || range.key !== 'today' ? ` ${(cat !== 'all' ? 1 : 0) + (range.key !== 'today' ? 1 : 0)}` : ''}</button>
        </div>
        <div className="m-quick">
          {cat !== 'all' && <button type="button" className="m-chip ap" onClick={() => setCat('all')} aria-label="분류 필터 해제">{catLabel(cat)} ✕</button>}
          {QUICK.map(x => <button key={x.key} type="button" className={`m-chip${range.key === x.key ? ' on' : ''}`} onClick={() => setRange(quickRange(x.key))}>{x.label}</button>)}
        </div>
        <div className="m-period">{fmtKst(range.from)} ~ {fmtKst(range.to)} · {cat === 'all' ? `메일 ${mList.length}통` : `${catLabel(cat)} ${mList.filter(m => m.category === cat).length}통`}</div>
      </>)}

      {tab === 'sum' && accounts.length > 0 && cat !== 'all' && (() => {
        const xs = mList.filter(m => m.category === cat);
        return <Card pad>{xs.length ? xs.map(m => <MailRow key={m.id} m={m} draft={draftOf(m.id)} acc={multi ? accOf(m.accountId) : undefined} onOpen={() => go('mail', `m-${m.id}`)} />) : <Empty>해당 메일이 없습니다</Empty>}</Card>;
      })()}
      {tab === 'sum' && accounts.length > 0 && cat === 'all' && <>
        <div className="m-sum">{tileCats.map((k, i) => (
          <button key={k} type="button" className={`m-tile${i === 0 && (counts[k] ?? 0) > 0 ? ' hot' : ''}`} onClick={() => setCat(k)}>
            <span className={`k ${k}`}>{catLabel(k)}</span><b>{counts[k] ?? 0}</b>
          </button>
        ))}</div>
        {digest && <div className="m-hq"><span className="t">10:00 본부 정리</span><span>휴지통 <b>{digest.trashed}</b></span><span>읽음 <b>{digest.readMarked}</b></span><span>답장 초안 <b>{digest.drafted}</b></span><span>구독 취소 대상 <b>{digest.unsubFound}</b></span>{digest.note && <span className="nt">{digest.note}</span>}</div>}
        <Sec title="처리 대기" count={byAcc(openList).length} link={openDrafts.length ? '초안 보기 ↗' : undefined} onLink={() => setTab('drafts')}>
          <Card pad>{byAcc(openList).length ? byAcc(openList).map(m => <MailRow key={m.id} m={m} draft={draftOf(m.id)} acc={multi ? accOf(m.accountId) : undefined} onOpen={() => go('mail', `m-${m.id}`)} />) : <Empty>처리할 메일이 없습니다</Empty>}</Card>
        </Sec>
        {(() => {
          const keys: MailCategory[] = isHq ? ['billing', 'important'] : ['important', 'order'];
          const xs = mList.filter(m => keys.includes(m.category) && !(m.category === 'important' && m.status === 'open'));
          return <Sec title={`이 기간 ${keys.map(catLabel).join(' · ')}`} count={xs.length}>
            <Card pad>{xs.length ? xs.map(m => <MailRow key={m.id} m={m} acc={multi ? accOf(m.accountId) : undefined} onOpen={() => go('mail', `m-${m.id}`)} />) : <Empty>해당 메일이 없습니다</Empty>}</Card>
          </Sec>;
        })()}
        <div className="m-note">휴지통 메일은 30일 안에 복구할 수 있습니다</div>
      </>}

      {tab === 'all' && accounts.length > 0 && <AllMail list={cat === 'all' ? mList : mList.filter(m => m.category === cat)}
        draftOf={draftOf} accOf={multi ? accOf : undefined} onOpen={(m) => go('mail', `m-${m.id}`)} />}

      {tab === 'drafts' && <DraftList drafts={byAcc(drafts)} accOf={accOf} onOpen={(d) => go('mail', `d-${d.id}`)} />}
      {tab === 'tpl' && <TemplateList items={templates} onOpen={(t) => go('mail', t ? `t-${t.id}` : 't-new')} />}
      {tab === 'sig' && <SignatureList items={sigs} accOf={accOf} onOpen={(s) => go('mail', s ? `s-${s.id}` : 's-new')} />}
      {tab === 'unsub' && <UnsubList items={byAcc(unsubs)} accOf={multi ? accOf : undefined} onDone={reload} />}
      {tab === 'clean' && <CleanupList items={byAcc(cleans)} accOf={multi ? accOf : undefined} onDone={reload} />}

      {filterOpen && <FilterSheet range={range} cat={cat} onClose={() => setFilterOpen(false)} onSave={(r, c) => { setRange(r); setCat(c); setFilterOpen(false); }} />}
      {kind === 'm' && (curMsg
        ? <MessagePanel m={curMsg} acc={accOf(curMsg.accountId)} draft={draftOf(curMsg.id)} onClose={close} onChanged={refresh}
            onDraft={async () => {
              const ex = draftOf(curMsg.id);
              if (ex) return go('mail', `d-${ex.id}`);
              const sig = sigs.find(s => s.isDefault && (!s.accountId || s.accountId === curMsg.accountId));
              const d = await addDraft(ws, { accountId: curMsg.accountId, toAddr: curMsg.fromAddr ?? '', subject: curMsg.subject ? `Re: ${curMsg.subject}` : '', html: '', signatureId: sig?.id }, curMsg.id);
              await reload(); go('mail', `d-${d.id}`);
            }} />
        : <Panel title="메일" onClose={close}><Empty>메일을 찾을 수 없습니다 · 기간을 바꿔 보세요</Empty></Panel>)}
      {kind === 'd' && (id === 'new' || curDraft) && <DraftPanel ws={ws} draft={curDraft} accounts={accounts} sigs={sigs} templates={templates}
        orig={curDraft?.messageId ? [...msgs, ...openList].find(m => m.id === curDraft.messageId) : undefined}
        point={look.point} onClose={close} onSaved={async (nid) => { await reload(); if (nid) go('mail', `d-${nid}`); }} />}
      {kind === 't' && <TemplatePanel ws={ws} t={templates.find(t => t.id === id)} onClose={close} onSaved={async () => { await reload(); close(); }} />}
      {kind === 's' && <SignaturePanel ws={ws} s={sigs.find(s => s.id === id)} accounts={accounts} onClose={close} onSaved={async () => { await reload(); close(); }} />}
    </>
  );
}

// ── 목록 줄 - 보낸 사람 · 제목 · 한 줄 요약 세 단 ──
function MailRow({ m, draft, acc, onOpen }: { m: MailMessage; draft?: MailDraft; acc?: MailAccount; onOpen: () => void }) {
  const st = draft ? DRAFT_ST[draft.status] : undefined;
  return (
    <button type="button" className={`m-row${m.isRead ? '' : ' unread'}`} onClick={onOpen}>
      <div className="who">{m.fromName || m.fromAddr || '보낸 사람 없음'}</div>
      <div className="t">{m.subject || '(제목 없음)'}</div>
      <div className="d">{m.summary}</div>
      <div className="rt">{acc && <span className="m-st">{acc.label || acc.provider}</span>}{st && <span className={`m-st ${st[1]}`}>{draft!.status === 'draft' ? '초안' : st[0]}</span>}{fmtWhen(m.receivedAt)}</div>
    </button>
  );
}

function AllMail({ list, draftOf, accOf, onOpen }: {
  list: MailMessage[];
  draftOf: (id: string) => MailDraft | undefined; accOf?: (id?: string) => MailAccount | undefined; onOpen: (m: MailMessage) => void;
}) {
  const { page, pages, setPage, shown: slice } = usePaged(list, 20);
  return <>
    <Card pad>{slice.length ? slice.map(m => <MailRow key={m.id} m={m} draft={draftOf(m.id)} acc={accOf?.(m.accountId)} onOpen={() => onOpen(m)} />) : <Empty>해당 기간 메일이 없습니다</Empty>}</Card>
    <Pager page={page} pages={pages} setPage={setPage} />
  </>;
}

// ── 기간 필터 팝업 (시목 판매 현황 FilterSheet 결 · [저장] 을 눌러야 걸림) ──
function FilterSheet({ range, cat, onClose, onSave }: { range: Range; cat: MailCategory | 'all'; onClose: () => void; onSave: (r: Range, c: MailCategory | 'all') => void }) {
  const [k, setK] = useState<QuickRange>(range.key);
  const [from, setFrom] = useState(kstDay(-1));
  const [to, setTo] = useState(kstDay());
  const [c, setC] = useState(cat);
  const n = (k !== 'today' ? 1 : 0) + (c !== 'all' ? 1 : 0);
  return (
    <Panel title={`필터${n ? ` ${n}` : ''}`} onClose={onClose}
      foot={<><Act ghost onClick={() => { setK('today'); setC('all'); }}>초기화</Act><span className="grow" /><Act onClick={() => onSave(quickRange(k, { from, to }), c)}>저장</Act></>}>
      <Field label="기간">
        <div className="m-quick" style={{ marginBottom: 0 }}>
          {QUICK.map(x => <button key={x.key} type="button" className={`m-chip${k === x.key ? ' on' : ''}`} onClick={() => setK(x.key)}>{x.label}</button>)}
          <button type="button" className={`m-chip${k === 'custom' ? ' on' : ''}`} onClick={() => setK('custom')}>직접</button>
        </div>
      </Field>
      <div className="m-dr">
        <input type="date" className="n-in d" value={from} onChange={e => { setFrom(e.target.value); setK('custom'); }} />
        <span>~</span>
        <input type="date" className="n-in d" value={to} onChange={e => { setTo(e.target.value); setK('custom'); }} />
      </div>
      <Field label="분류">
        <div className="m-quick" style={{ marginBottom: 0 }}>
          <button type="button" className={`m-chip${c === 'all' ? ' on' : ''}`} onClick={() => setC('all')}>전체</button>
          {MAIL_CATS.map(x => <button key={x.key} type="button" className={`m-chip${c === x.key ? ' on' : ''}`} onClick={() => setC(x.key)}>{x.label}</button>)}
        </div>
      </Field>
      <div className="m-small">오늘: 어제 10:00 ~ 오늘 10:00 · 저장을 눌러야 적용됩니다</div>
    </Panel>
  );
}

// ── 메일 열기 ──
function MessagePanel({ m, acc, draft, onClose, onChanged, onDraft }: { m: MailMessage; acc?: MailAccount; draft?: MailDraft; onClose: () => void; onChanged: () => void; onDraft: () => void }) {
  const [busy, setBusy] = useState(false);
  const done = m.status === 'done';
  return (
    <Panel title={m.subject || '(제목 없음)'} tag={catLabel(m.category)} onClose={onClose}
      foot={<>
        <Act ghost disabled={busy} onClick={async () => { setBusy(true); try { await setMailDone(m.id, !done); onChanged(); onClose(); } finally { setBusy(false); } }}>{done ? '다시 열기' : '처리 완료'}</Act>
        <span className="grow" />
        <Act onClick={onDraft}>{draft ? '답장 초안 열기' : '답장 초안 쓰기'}</Act>
      </>}>
      <div className="m-mail">
        <div className="mh"><b>{m.fromName || m.fromAddr}</b>{m.fromAddr && m.fromName ? `${m.fromAddr} · ` : ''}{fmtKst(m.receivedAt)}{acc ? ` · 받은 주소 ${acc.address}` : ''}</div>
        <div className="m-body"><p style={{ margin: 0 }}>{m.summary || '요약 없음'}</p></div>
      </div>
      <div className="m-small">요약입니다. 원문은 해당 계정 메일함에서 확인하세요.{done ? ' · 처리 완료' : ''}</div>
    </Panel>
  );
}

// ── 초안 ──
function DraftList({ drafts, accOf, onOpen }: { drafts: MailDraft[]; accOf: (id?: string) => MailAccount | undefined; onOpen: (d: MailDraft) => void }) {
  const groups: [string, MailDraft[]][] = [
    ['확정 전', drafts.filter(d => d.status === 'draft')],
    ['보낼 예정 · 실패', drafts.filter(d => ['confirmed', 'sending', 'failed'].includes(d.status))],
    ['보냄', drafts.filter(d => d.status === 'sent').slice(0, 30)],
  ];
  if (!drafts.length) return <Empty>초안이 없습니다 · 매일 10시에 답장 초안이 준비됩니다</Empty>;
  return <>{groups.filter(([, xs]) => xs.length).map(([g, xs]) => (
    <Sec key={g} title={g} count={xs.length}>
      <Card pad>{xs.map(d => {
        const st = DRAFT_ST[d.status];
        return <button key={d.id} type="button" className="m-row" onClick={() => onOpen(d)}>
          <div className="who">{d.toAddr || '받는 사람 없음'}</div>
          <div className="t">{d.subject || '(제목 없음)'}</div>
          <div className="d">{d.error ? `실패 · ${d.error}` : stripHtml(d.html).slice(0, 80)}</div>
          <div className="rt">{accOf(d.accountId)?.label && <span className="m-st">{accOf(d.accountId)!.label}</span>}{d.hq && <span className="n-b hq">자동</span>}<span className={`m-st ${st?.[1] ?? ''}`}>{st?.[0] ?? d.status}</span>{fmtWhen(d.sentAt ?? d.updatedAt)}</div>
        </button>;
      })}</Card>
    </Sec>
  ))}</>;
}

function SigPreview({ s }: { s?: MailSignature }) {
  const [card, setCard] = useState<string | null>(null);
  useEffect(() => { let on = true; if (s?.hasCard) getSignatureCard(s.id).then(u => { if (on) setCard(u); }); else setCard(null); return () => { on = false; }; }, [s?.id, s?.hasCard]);
  if (!s) return null;
  return <div className="m-sigbox"><hr className="m-hr" />{card && <img src={card} alt="명함" className="m-cardimg" />}<div className="m-sigtx" dangerouslySetInnerHTML={{ __html: s.html }} /></div>;
}

function DraftPanel({ ws, draft, accounts, sigs, templates, orig, onClose, onSaved }: {
  ws: string; draft?: MailDraft; accounts: MailAccount[]; sigs: MailSignature[]; templates: MailTemplate[]; orig?: MailMessage; point: string;
  onClose: () => void; onSaved: (newId?: string) => void;
}) {
  const [f, setF] = useState<DraftFields>(() => ({
    accountId: draft?.accountId ?? accounts[0]?.id, toAddr: draft?.toAddr ?? '', cc: draft?.cc, subject: draft?.subject ?? '', html: draft?.html ?? '',
    signatureId: draft?.signatureId ?? sigs.find(s => s.isDefault)?.id, templateId: draft?.templateId,
  }));
  const [view, setView] = useState<'edit' | 'mail'>('edit');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const locked = !!draft && draft.status !== 'draft' && draft.status !== 'failed';
  const sig = sigs.find(s => s.id === f.signatureId);
  const [card, setCard] = useState<string | null>(null);
  useEffect(() => { if (sig?.hasCard) getSignatureCard(sig.id).then(setCard); else setCard(null); }, [sig?.id, sig?.hasCard]);
  const st = draft ? DRAFT_ST[draft.status] : undefined;
  const set = (p: Partial<DraftFields>) => setF(x => ({ ...x, ...p }));
  const run = async (fn: () => Promise<unknown>, after?: () => void) => { setBusy(true); setMsg(''); try { await fn(); after?.(); } catch (e) { setMsg(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); } };
  const save = async () => { if (draft) { await saveDraft(draft.id, f); onSaved(); } else { const d = await addDraft(ws, f); onSaved(d.id); } };
  const ok = f.toAddr.trim() && f.subject.trim() && f.html.trim() && f.accountId;

  return (
    <Panel wide title={draft ? (draft.subject || '초안') : '새 메일'} tag={st?.[0]} onClose={onClose}
      foot={locked ? <>
        {draft!.status === 'confirmed' && <Act ghost disabled={busy} onClick={() => run(() => unconfirmDraft(draft!.id), () => onSaved())}>확정 취소</Act>}
        <span className="grow" /><span className="m-small" style={{ margin: 0 }}>{draft!.status === 'sent' ? `보냄 · ${draft!.sentAt ? fmtKst(draft!.sentAt) : ''}` : '몇 분 안에 발송됩니다'}</span>
      </> : <>
        {draft && <Act ghost disabled={busy} onClick={() => run(() => discardDraft(draft.id), () => { onSaved(); onClose(); })}>지우기</Act>}
        <span className="grow" />
        <Act ghost disabled={busy} onClick={() => run(save)}>저장</Act>
        <Act disabled={busy || !ok} onClick={() => run(async () => { if (draft) { await confirmDraft(draft.id, f); onSaved(); } else { const d = await addDraft(ws, f); await confirmDraft(d.id, f); onSaved(d.id); } })}>보내기 확정</Act>
      </>}>
      {draft?.status === 'failed' && <div className="n-err">발송 실패 · {draft.error} · 수정 후 다시 확정하세요</div>}
      {msg && <div className="n-err">{msg}</div>}
      <div className="m-fields">
        <Field label="보내는 주소">
          <select className="n-in" value={f.accountId ?? ''} disabled={locked} onChange={e => set({ accountId: e.target.value })}>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.address}</option>)}
          </select>
        </Field>
        <Field label="받는 사람"><input className="n-in" value={f.toAddr} disabled={locked} onChange={e => set({ toAddr: e.target.value })} placeholder="name@example.com" /></Field>
        <Field label="참조"><input className="n-in" value={f.cc ?? ''} disabled={locked} onChange={e => set({ cc: e.target.value })} placeholder="선택" /></Field>
        <Field label="제목"><input className="n-in" value={f.subject} disabled={locked} onChange={e => set({ subject: e.target.value })} /></Field>
      </div>
      {orig && <div className="m-orig"><b>{orig.fromName || orig.fromAddr}</b> · {orig.subject}<br />{orig.summary}</div>}
      {draft?.basis && <div className="m-small" style={{ marginTop: 0 }}>근거 · {draft.basis}</div>}
      <div className="m-vt">
        <button type="button" className={view === 'edit' ? 'on' : ''} onClick={() => setView('edit')}>편집</button>
        <button type="button" className={view === 'mail' ? 'on' : ''} onClick={() => setView('mail')}>받는 사람 화면</button>
      </div>
      {view === 'edit' && !locked ? <>
        <MailEditor html={f.html} onChange={html => set({ html })} placeholder="답장 내용"
          signatures={sigs.map(s => ({ key: s.id, label: s.name, sub: s.isDefault ? '기본' : undefined }))} onSignature={k => set({ signatureId: k })}
          templates={templates.filter(t => !t.proposed).map(t => ({ key: t.id, label: t.name, sub: t.whenToUse }))}
          onTemplate={(k, ed) => { const t = templates.find(x => x.id === k); if (!t) return; ed.chain().focus().insertContent(t.html).run(); if (!f.subject && t.subject) set({ subject: t.subject, templateId: t.id }); else set({ templateId: t.id }); bumpTemplate(t); }} />
        <div className="m-sigrow">
          <span>서명</span>
          <select className="n-in" value={f.signatureId ?? ''} onChange={e => set({ signatureId: e.target.value || undefined })}>
            <option value="">서명 없음</option>{sigs.map(s => <option key={s.id} value={s.id}>{s.name}{s.isDefault ? ' · 기본' : ''}</option>)}
          </select>
        </div>
        <SigPreview s={sig} />
      </> : (
        <div className="m-mail">
          <div className="mh"><b>{f.subject || '(제목 없음)'}</b>보낸 사람 {accounts.find(a => a.id === f.accountId)?.address} · 받는 사람 {f.toAddr}</div>
          <div className="m-body" dangerouslySetInnerHTML={{ __html: composeHtml(f.html, sig, card) }} />
        </div>
      )}
    </Panel>
  );
}

// ── 템플릿 ──
function TemplateList({ items, onOpen }: { items: MailTemplate[]; onOpen: (t?: MailTemplate) => void }) {
  const prop = items.filter(t => t.proposed), mine = items.filter(t => !t.proposed);
  return <>
    {prop.length > 0 && <div className="m-sug"><b>추천 템플릿 {prop.length}</b><span>자주 쓰는 답장을 템플릿으로 만들었습니다. 저장하면 사용됩니다.</span>
      {prop.map(t => <Mini key={t.id} onClick={() => onOpen(t)}>{t.name}</Mini>)}</div>}
    <div className="m-intro"><span>답장 초안에 먼저 쓰입니다 · 빈칸 예: {'{손님 이름}'} {'{주문 번호}'}</span><Act ghost onClick={() => onOpen()}>+ 템플릿</Act></div>
    {mine.length ? <div className="m-tpl">{mine.map(t => (
      <button key={t.id} type="button" className="m-tc" onClick={() => onOpen(t)}>
        <b>{t.name}</b><div className="w">{t.whenToUse || '사용 상황 미입력'}</div>
        <div className="pv">{stripHtml(t.html).slice(0, 120) || '본문 없음'}</div>
        <div className="ft">쓴 횟수 {t.useCount}</div>
      </button>
    ))}</div> : <Empty>등록된 템플릿이 없습니다</Empty>}
  </>;
}

function TemplatePanel({ ws, t, onClose, onSaved }: { ws: string; t?: MailTemplate; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(t?.name ?? '');
  const [when, setWhen] = useState(t?.whenToUse ?? '');
  const [subject, setSubject] = useState(t?.subject ?? '');
  const [html, setHtml] = useState(t?.html ?? '');
  const [busy, setBusy] = useState(false);
  return (
    <Panel wide title={t ? t.name : '새 템플릿'} tag={t?.proposed ? '추천' : undefined} onClose={onClose}
      foot={<>{t && <Act ghost disabled={busy} onClick={async () => { setBusy(true); try { await deleteTemplate(t.id); onSaved(); } finally { setBusy(false); } }}>지우기</Act>}<span className="grow" />
        <Act disabled={busy || !name.trim()} onClick={async () => { setBusy(true); try { await saveTemplate(ws, t?.id, { name, whenToUse: when, subject, html }); onSaved(); } finally { setBusy(false); } }}>저장</Act></>}>
      <div className="m-fields">
        <Field label="이름"><input className="n-in" value={name} onChange={e => setName(e.target.value)} placeholder="배송 문의 답장" /></Field>
        <Field label="사용 상황"><input className="n-in" value={when} onChange={e => setWhen(e.target.value)} placeholder="주문 후 배송이 언제 오냐고 물을 때" /></Field>
        <Field label="제목 (선택)"><input className="n-in" value={subject} onChange={e => setSubject(e.target.value)} /></Field>
      </div>
      <MailEditor html={html} onChange={setHtml} placeholder="{손님 이름} 님, 안녕하세요." />
      <div className="m-small">서명은 발송 시 자동으로 붙습니다</div>
    </Panel>
  );
}

// ── 서명 ──
function SignatureList({ items, accOf, onOpen }: { items: MailSignature[]; accOf: (id?: string) => MailAccount | undefined; onOpen: (s?: MailSignature) => void }) {
  return <>
    <div className="m-intro"><span>본문 아래 구분선 뒤에 붙습니다</span><Act ghost onClick={() => onOpen()}>+ 서명</Act></div>
    {items.length ? <div className="m-tpl">{items.map(s => (
      <button key={s.id} type="button" className="m-tc" onClick={() => onOpen(s)}>
        <b>{s.name}</b>{s.isDefault && <span className="n-b hq" style={{ marginLeft: 8 }}>기본</span>}
        <div className="w">{accOf(s.accountId)?.address ?? '이 오피스 모든 주소'}</div>
        <SigPreview s={s} />
      </button>
    ))}</div> : <Empty>등록된 서명이 없습니다</Empty>}
  </>;
}

function SignaturePanel({ ws, s, accounts, onClose, onSaved }: { ws: string; s?: MailSignature; accounts: MailAccount[]; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(s?.name ?? '');
  const [html, setHtml] = useState(s?.html ?? '');
  const [accountId, setAccountId] = useState(s?.accountId ?? '');
  const [isDefault, setIsDefault] = useState(s?.isDefault ?? !s);
  const [file, setFile] = useState<File | null>(null);
  const [remove, setRemove] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (file) { const u = URL.createObjectURL(file); setPreview(u); return () => URL.revokeObjectURL(u); }
    if (remove) { setPreview(null); return; }
    if (s?.hasCard) getSignatureCard(s.id).then(setPreview); else setPreview(null);
  }, [file, remove, s?.id, s?.hasCard]);
  return (
    <Panel wide title={s ? s.name : '새 서명'} onClose={onClose}
      foot={<>{s && <Act ghost disabled={busy} onClick={async () => { setBusy(true); try { await deleteSignature(s.id); onSaved(); } finally { setBusy(false); } }}>지우기</Act>}<span className="grow" />
        <Act disabled={busy || !name.trim()} onClick={async () => { setBusy(true); try { await saveSignature(ws, s?.id, { name, html, accountId: accountId || undefined, isDefault, card: file, removeCard: remove }); onSaved(); } finally { setBusy(false); } }}>저장</Act></>}>
      <div className="m-fields">
        <Field label="이름"><input className="n-in" value={name} onChange={e => setName(e.target.value)} placeholder="기본 서명" /></Field>
        <Field label="쓰는 주소">
          <select className="n-in" value={accountId} onChange={e => setAccountId(e.target.value)}>
            <option value="">이 오피스 모든 주소</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.address}</option>)}
          </select>
        </Field>
      </div>
      <label className="m-check"><input type="checkbox" checked={isDefault} onChange={e => setIsDefault(e.target.checked)} /> 기본 서명</label>
      <Field label="명함 이미지">
        <div className="m-cardup">
          {preview ? <img src={preview} alt="명함" className="m-cardimg" /> : <div className="m-cardph">명함 이미지 없음</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <label className="n-act ghost" style={{ cursor: 'pointer' }}>명함 이미지 올리기<input type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { setFile(f); setRemove(false); } }} /></label>
            {preview && <Mini onClick={() => { setFile(null); setRemove(true); }}>삭제</Mini>}
          </div>
        </div>
      </Field>
      <Field label="이름 · 연락처"><MailEditor html={html} onChange={setHtml} minHeight={140} placeholder="시목 · 대표 이름 · 010-0000-0000 · simok.co.kr" /></Field>
      <div className="m-small">미리보기</div>
      <div className="m-mail"><div className="m-body"><p style={{ color: '#8a8f84', margin: 0 }}>(본문)</p>
        <div dangerouslySetInnerHTML={{ __html: composeHtml('', { html }, preview) }} /></div></div>
    </Panel>
  );
}

// ── 구독 취소 ── 줄을 누르면 그동안 온 메일(날짜 · 제목) · 유지한 곳은 다음 날 본부 「지키기」 로 (077)
function UnsubList({ items, accOf, onDone }: { items: MailUnsub[]; accOf?: (id?: string) => MailAccount | undefined; onDone: () => void }) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);
  const [keptOpen, setKeptOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [memoFor, setMemoFor] = useState<string | null>(null);
  const memoOk = items.some(u => u.keepMemo !== undefined);   // 078 전에는 메모 숨김
  const cand = items.filter(u => u.status === 'candidate');
  const kept = items.filter(u => u.status === 'kept');
  const rest = items.filter(u => u.status !== 'candidate' && u.status !== 'kept');
  const toggle = (id: string) => setSel(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const ST: Record<string, string> = { requested: '처리 중', done: '취소 완료', failed: '실패' };
  const act = async (fn: () => Promise<unknown>) => { setBusy(true); try { await fn(); onDone(); } finally { setBusy(false); } };
  return <>
    <div className="m-intro"><span>선택한 곳의 구독을 취소합니다 · 로그인이나 개인정보를 요구하는 곳은 진행하지 않습니다</span></div>
    <Sec title="구독 취소 대상" count={cand.length}>
      <Card pad>{cand.length ? cand.map(u => (
        <div key={u.id} className="m-unw">
          <div className="m-row m-un" role="button" tabIndex={0} onClick={() => setOpen(o => o === u.id ? null : u.id)} onKeyDown={e => { if (e.key === 'Enter') setOpen(o => o === u.id ? null : u.id); }}>
            <input type="checkbox" checked={sel.has(u.id)} onClick={e => e.stopPropagation()} onChange={() => toggle(u.id)} aria-label="선택" />
            <div className="who">{u.senderName || u.senderAddr}</div>
            <div className="t">{u.senderAddr}</div>
            <div className="d">최근 30일 {u.count30d}통{u.note ? ` · ${u.note}` : ''}</div>
            <div className="rt">{accOf?.(u.accountId) && <span className="m-st">{accOf(u.accountId)!.label}</span>}<span className={`m-st ${u.method === 'caution' ? 'fail' : ''}`}>{UNSUB_METHOD[u.method]}</span>
              <Mini onClick={(e) => { e.stopPropagation(); if (memoOk) setMemoFor(u.id); else act(() => keepUnsub(u.id)); }}>유지</Mini><span className="m-car">{open === u.id ? '▴' : '▾'}</span></div>
          </div>
          {memoFor === u.id && <KeepMemo onCancel={() => setMemoFor(null)} onSave={(m) => act(async () => { await keepUnsub(u.id, m); setMemoFor(null); })} />}
          {open === u.id && <ExampleList xs={u.examples} />}
        </div>
      )) : <Empty>구독 취소 대상이 없습니다</Empty>}</Card>
    </Sec>
    {rest.length > 0 && <Sec title="처리 결과" count={rest.length}>
      <Card pad>{rest.map(u => (
        <div key={u.id} className="m-row">
          <div className="who">{u.senderName || u.senderAddr}</div><div className="t">{u.senderAddr}</div><div className="d">{u.note}</div>
          <div className="rt"><span className={`m-st ${u.status === 'done' ? 'sent' : u.status === 'failed' ? 'fail' : 'go'}`}>{ST[u.status]}</span></div>
        </div>
      ))}</Card>
    </Sec>}
    {kept.length > 0 && <div className="m-kept">
      <button type="button" className="m-kepth" onClick={() => setKeptOpen(v => !v)}>유지한 곳 {kept.length}<span className="m-car">{keptOpen ? '▴' : '▾'}</span></button>
      {keptOpen && <Card pad>{kept.map(u => (
        <div key={u.id} className="m-unw"><div className="m-row">
          <div className="who">{u.senderName || u.senderAddr}</div><div className="t">{u.senderAddr}</div>
          <div className="d">{u.keepMemo ? <>메모 · {u.keepMemo}</> : '구독 취소 · 휴지통 대상에서 제외'}</div>
          <div className="rt">{memoOk && <Mini onClick={() => setMemoFor(u.id)}>메모</Mini>}<Mini onClick={() => act(() => unkeepUnsub(u.id))}>되돌리기</Mini></div>
        </div>
          {memoFor === u.id && <KeepMemo initial={u.keepMemo ?? ''} onCancel={() => setMemoFor(null)} onSave={(m) => act(async () => { await setUnsubMemo(u.id, m); setMemoFor(null); })} />}
        </div>
      ))}</Card>}
    </div>}
    {sel.size > 0 && <div className="m-bar"><b>{sel.size}곳</b> 선택<span className="grow" style={{ flex: 1 }} />
      <Act disabled={busy} onClick={() => act(async () => { await requestUnsubs([...sel]); setSel(new Set()); })}>선택한 {sel.size}곳 구독 취소</Act></div>}
  </>;
}

/** 유지 메모 한 줄 - 본부가 읽는다 (메모에 「배움」 → 라벨 배움 · 없으면 라벨 뉴스레터) */
function KeepMemo({ initial = '', onSave, onCancel }: { initial?: string; onSave: (memo: string) => void; onCancel: () => void }) {
  const [v, setV] = useState(initial);
  return (
    <div className="m-memo" onClick={e => e.stopPropagation()}>
      <input value={v} onChange={e => setV(e.target.value)} placeholder="메모 (선택) · 예: 즐겨 보는 뉴스레터 · 배움으로 분류" maxLength={120} autoFocus
        onKeyDown={e => { if (e.key === 'Enter') onSave(v); if (e.key === 'Escape') onCancel(); }} />
      <Mini primary onClick={() => onSave(v)}>유지</Mini><Mini onClick={onCancel}>취소</Mini>
    </div>
  );
}

// ── 메일함 정리 ── 본부 정리안(077) · 행동별 묶음 (휴지통 → 구독 취소 → 라벨 → 확인 필요 → 유지) · 줄을 누르면 그동안 온 메일
const CLEAN_ORDER: CleanAction[] = ['trash', 'unsub_trash', 'label', 'ask', 'keep'];
function CleanupList({ items, accOf, onDone }: { items: MailCleanup[]; accOf?: (id?: string) => MailAccount | undefined; onDone: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const [fold, setFold] = useState<Record<string, boolean>>({ keep: true });
  const [memoFor, setMemoFor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const memoOk = items.some(c => c.keepMemo !== undefined);
  const act = async (fn: () => Promise<unknown>) => { setBusy(true); try { await fn(); onDone(); } finally { setBusy(false); } };
  const todo = items.filter(c => c.status === 'proposed' || c.status === 'failed');
  const groupKey = (c: MailCleanup) => { const d = cleanDo(c); return d === 'label' ? `label:${c.label ?? ''}` : d; };
  const groups = useMemo(() => {
    const m = new Map<string, MailCleanup[]>();
    for (const c of todo) { const k = groupKey(c); if (!m.has(k)) m.set(k, []); m.get(k)!.push(c); }
    return [...m.entries()].sort((a, b) => CLEAN_ORDER.indexOf(a[0].split(':')[0] as CleanAction) - CLEAN_ORDER.indexOf(b[0].split(':')[0] as CleanAction) || a[0].localeCompare(b[0]));
  }, [todo]);
  const gTitle = (k: string) => k.startsWith('label:') ? `라벨 · ${k.slice(6)}` : CLEAN_LABEL[k as CleanAction];
  const sum = (xs: MailCleanup[]) => xs.reduce((n, c) => n + c.count, 0);
  const runnable = todo.filter(c => c.checked && ['trash', 'unsub_trash', 'label'].includes(cleanDo(c)));
  const working = items.filter(c => c.status === 'requested');
  const done = items.filter(c => c.status === 'done');
  const choose = (c: MailCleanup, v: string) => {
    const [d, label] = v.split(':');
    if (d === 'keep') { if (memoOk) setMemoFor(c.id); act(() => setCleanup(c.id, { chosen: 'keep', checked: false })); return; }
    if (d === 'label' && label !== c.label) return;   // 다른 라벨로 옮기기는 본부 정리안에서
    act(() => setCleanup(c.id, { chosen: d === c.action ? null : d as Exclude<CleanAction, 'ask'>, checked: true }));
  };
  return <>
    <div className="m-intro"><span>보낸 곳별 정리안입니다 · 선택한 곳을 정리합니다 · 휴지통은 30일이 지난 메일만 옮기며 30일 안에 복구할 수 있습니다</span></div>
    <div className="m-sum m-csum">{groups.map(([k, xs]) => (
      <button key={k} type="button" className="m-tile" onClick={() => document.getElementById(`mc-${k}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
        <span className={`k ${k.split(':')[0]}`}>{gTitle(k)}</span><b>{sum(xs).toLocaleString()}</b><small>{xs.length}곳</small>
      </button>
    ))}</div>
    {working.length > 0 && <div className="m-hq"><span className="t">처리 중</span><span>{working.length}곳 · {sum(working).toLocaleString()}통 · 몇 분 안에 끝납니다</span></div>}
    {groups.map(([k, xs]) => (
      <section key={k} id={`mc-${k}`} className="n-sec">
        <button type="button" className="m-cg" onClick={() => setFold(f => ({ ...f, [k]: !f[k] }))}>
          <span className={`m-ck ${k.split(':')[0]}`}>{gTitle(k)}</span><b>{xs.length}곳 · {sum(xs).toLocaleString()}통</b><span className="m-car">{fold[k] ? '▾' : '▴'}</span>
        </button>
        {!fold[k] && <Card pad>{xs.map(c => {
          const d = cleanDo(c);
          const gone = (c.goneMonths ?? 0) >= 2 && (d === 'trash' || d === 'unsub_trash');
          return <div key={c.id} className="m-unw">
            <div className="m-row m-un" role="button" tabIndex={0} onClick={() => setOpen(o => o === c.id ? null : c.id)} onKeyDown={e => { if (e.key === 'Enter') setOpen(o => o === c.id ? null : c.id); }}>
              <input type="checkbox" checked={c.checked && d !== 'keep' && d !== 'ask'} disabled={d === 'keep' || d === 'ask'} onClick={e => e.stopPropagation()}
                onChange={() => act(() => setCleanup(c.id, { checked: !c.checked }))} aria-label="선택" />
              <div className="who">{c.senderName || c.senderAddr}</div>
              <div className="t">{c.senderAddr}<span className="m-kind">{c.kind}</span></div>
              <div className="d">{c.count.toLocaleString()}통 · 안 읽음 {c.unseen.toLocaleString()}{gone ? ` · 이미 오지 않음 (${c.goneMonths}개월 전) · 구독 취소 불필요` : ''}{c.status === 'failed' && c.error ? ` · 실패: ${c.error}` : ''}{d === 'keep' && c.keepMemo ? ` · 메모: ${c.keepMemo}` : ''}</div>
              <div className="rt">{accOf?.(c.accountId) && <span className="m-st">{accOf(c.accountId)!.label}</span>}
                <select className="m-sel" value={d === 'label' ? `label:${c.label ?? ''}` : d} onClick={e => e.stopPropagation()} onChange={e => choose(c, e.target.value)} aria-label="행동">
                  {c.action === 'label' && <option value={`label:${c.label ?? ''}`}>라벨 · {c.label}</option>}
                  <option value="trash">휴지통</option><option value="unsub_trash">구독 취소 + 휴지통</option><option value="keep">유지</option>
                  {c.action === 'ask' && <option value="ask" disabled>확인 필요</option>}
                </select>
                <span className="m-car">{open === c.id ? '▴' : '▾'}</span></div>
            </div>
            {memoFor === c.id && <KeepMemo initial={c.keepMemo ?? ''} onCancel={() => setMemoFor(null)} onSave={(m) => act(async () => { await setCleanup(c.id, { keepMemo: m }); setMemoFor(null); })} />}
            {open === c.id && <ExampleList xs={c.examples} />}
          </div>;
        })}</Card>}
      </section>
    ))}
    {!todo.length && !working.length && <Empty>정리할 항목이 없습니다</Empty>}
    {done.length > 0 && <div className="m-note">정리 완료 {done.length}곳 · {done.reduce((n, c) => n + c.moved, 0).toLocaleString()}통 이동</div>}
    {runnable.length > 0 && <div className="m-bar"><b>{runnable.length}곳</b><span>{sum(runnable).toLocaleString()}통</span><span className="grow" style={{ flex: 1 }} />
      <Act disabled={busy} onClick={() => act(() => requestCleanup(runnable.map(c => c.id)))}>선택한 {runnable.length}곳 정리</Act></div>}
  </>;
}

/** 그동안 온 메일 - 날짜 · 제목 (최근 것부터) */
const ymd = (iso: string) => { const t = Date.parse(iso); if (!t) return '-'; const d = new Date(t + 9 * 3600e3); return `${String(d.getUTCFullYear()).slice(2)}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${String(d.getUTCDate()).padStart(2, '0')}`; };
function ExampleList({ xs }: { xs: { date: string; subject: string }[] }) {
  if (!xs.length) return <div className="m-exs"><div className="m-exe">받은 메일 기록이 아직 없습니다 · 다음 정리 때 채워집니다</div></div>;
  const sorted = [...xs].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return <div className="m-exs">{sorted.map((x, i) => <div key={i} className="m-ex"><span className="dt">{ymd(x.date)}</span><span className="sj">{x.subject}</span></div>)}</div>;
}

/** 가계부 - 본부 오피스 11 (준비 중) */
export function BudgetSoon() {
  return <>
    <PageHead title="가계부" small="준비 중" />
    <div className="m-empty"><b>가계부 · 준비 중</b><p>1억 모으기 가계부와 연결해 수입 · 지출을 정리합니다.</p></div>
  </>;
}
