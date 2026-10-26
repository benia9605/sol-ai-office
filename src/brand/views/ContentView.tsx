/**
 * @file src/brand/views/ContentView.tsx
 * @description 04 콘텐츠 - 기획 · 원고 · 촬영 · 편집 · 게시 완료
 *  - PC: 카드를 끌어서 다른 단계 칸에 놓는다 (HTML5 drag)
 *  - 폰: 위 단계 탭으로 칸을 고르고, 카드를 눌러 「단계」 버튼으로 옮긴다
 *  - 원고 단계 카드는 본부가 매일 초안을 쓴다 (draft_status auto). 사람이 고치거나 확정하면 본부가 덮어쓰지 않는다
 *  - 게시일을 정하면 게시 일정 · 다음 날 브리핑 「예약 콘텐츠」 에 뜬다 (본부가 hq_pull 로 읽음)
 * 주소: /w/:id/content/(new | <content id>)
 */
import { useCallback, useEffect, useState } from 'react';
import { BrandViewProps } from '../BrandShell';
import { Content, Prompt, STAGES, Stage, addContent, deleteContent, fmtDay, listContents, listPrompts, todayKst, updateContent } from '../hq.service';
import { Act, Badge, Card, DueSeg, Empty, Err, Field, Kind, List, Mini, PageHead, Panel, Row, Sec, Seg, Skeleton } from '../ui';

const CHANNELS = ['피드', '릴스', '스레드', '유튜브', '블로그'];

export function ContentView({ workspace, detailId, go }: BrandViewProps) {
  const ws = workspace.id;
  const [items, setItems] = useState<Content[] | null>(null);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [err, setErr] = useState<unknown>(null);
  const [stageTab, setStageTab] = useState<Stage>('plan');
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<Stage | null>(null);

  const load = useCallback(async () => {
    try { const [c, p] = await Promise.all([listContents(ws), listPrompts(ws)]); setItems(c); setPrompts(p); setErr(null); } catch (e) { setErr(e); }
  }, [ws]);
  useEffect(() => { load(); }, [load]);

  const list = items ?? [];
  const replace = (c: Content) => setItems(xs => (xs ?? []).map(x => (x.id === c.id ? c : x)));
  const move = async (id: string, stage: Stage) => {
    const c = list.find(x => x.id === id);
    if (!c || c.stage === stage) return;
    replace({ ...c, stage });                         // 바로 옮겨 보이고
    try { replace(await updateContent(id, { stage })); } catch (e) { setErr(e); replace(c); }
  };
  const sel = list.find(c => c.id === detailId);
  const scheduled = list.filter(c => c.dueDate && c.stage !== 'done').sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1));

  const card = (c: Content) => (
    <div key={c.id} className={`n-kc click${dragId === c.id ? ' n-dragging' : ''}`} draggable
      onDragStart={e => { setDragId(c.id); e.dataTransfer.setData('text/plain', c.id); e.dataTransfer.effectAllowed = 'move'; }}
      onDragEnd={() => { setDragId(null); setOver(null); }}
      onClick={() => go('content', c.id)}>
      <div className="n-gm">{c.channel && <span className="n-b">{c.channel}</span>}<Badge source={c.source} />{c.dueDate && <span style={{ marginLeft: 'auto' }}>{fmtDay(c.dueDate, false)}</span>}</div>
      <h3>{c.title}</h3>
      {c.stage === 'draft' && c.draftStatus && <div className="n-gm" style={{ marginTop: 6 }}><span className="n-b hq">{c.draftStatus === 'auto' ? `초안 v${c.draftVersion}` : c.draftStatus === 'edited' ? '원고 수정 중' : '원고 확정'}</span></div>}
    </div>
  );

  return (
    <>
      <PageHead title="콘텐츠" action={<Act onClick={() => go('content', 'new')}>+ 콘텐츠</Act>} />
      {!!err && <Err e={err} />}
      {!items ? <Skeleton /> : (
        <>
          <div className="n-stages">{STAGES.map(s => (
            <button key={s.key} type="button" className={stageTab === s.key ? 'on' : ''} onClick={() => setStageTab(s.key)}>{s.label}<span>{list.filter(c => c.stage === s.key).length}</span></button>
          ))}</div>
          <div className="n-board">{STAGES.map(s => {
            const cs = list.filter(c => c.stage === s.key);
            return (
              <div key={s.key} className={`n-col${stageTab === s.key ? ' first' : ''}${over === s.key ? ' over' : ''}`}
                onDragOver={e => { e.preventDefault(); setOver(s.key); }} onDragLeave={() => setOver(o => (o === s.key ? null : o))}
                onDrop={e => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); setOver(null); if (id) move(id, s.key); }}>
                <h4>{s.label}<span>{cs.length}</span></h4>
                {cs.length ? cs.map(card) : <div className="none">없음</div>}
              </div>
            );
          })}</div>
          <div style={{ marginTop: 28 }}>
            <Sec title="게시 일정" count={scheduled.length}>
              <Card>{scheduled.length ? <List>{scheduled.map(c => (
                <Row key={c.id} left={<Kind>{fmtDay(c.dueDate!, false)}</Kind>} title={c.title} desc={[c.channel, STAGES.find(s => s.key === c.stage)?.label].filter(Boolean).join(' · ')} onClick={() => go('content', c.id)} />
              ))}</List> : <Empty>예정된 게시물 없음</Empty>}</Card>
            </Sec>
          </div>
        </>
      )}

      {detailId === 'new' && <ContentPanel title="콘텐츠 추가" onClose={() => go('content')}
        onSave={async f => { const c = await addContent(ws, { title: f.title, channel: f.channel, stage: f.stage, dueDate: f.dueDate, memo: f.memo }); setItems(xs => [...(xs ?? []), c]); go('content'); }} />}
      {sel && <ContentPanel title="콘텐츠" c={sel} prompt={prompts.find(p => p.id === sel.promptId)} onClose={() => go('content')}
        onSave={async f => { replace(await updateContent(sel.id, f)); go('content'); }}
        onDelete={async () => { await deleteContent(sel.id); setItems(xs => (xs ?? []).filter(x => x.id !== sel.id)); go('content'); }}
        onOpenPrompt={() => go('library', sel.promptId)} />}
    </>
  );
}

interface CForm { title: string; channel?: string; stage: Stage; dueDate?: string; memo?: string; draft?: string; draftStatus?: Content['draftStatus'] }
function ContentPanel({ title, c, prompt, onClose, onSave, onDelete, onOpenPrompt }: {
  title: string; c?: Content; prompt?: Prompt; onClose: () => void; onSave: (f: CForm) => Promise<void>; onDelete?: () => Promise<void>; onOpenPrompt?: () => void;
}) {
  const [f, setF] = useState<CForm>(() => ({ title: c?.title ?? '', channel: c?.channel, stage: c?.stage ?? 'plan', dueDate: c?.dueDate, memo: c?.memo ?? '', draft: c?.draft, draftStatus: c?.draftStatus }));
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const today = todayKst();
  const save = async (patch: Partial<CForm> = {}) => { setBusy(true); try { await onSave({ ...f, ...patch }); } finally { setBusy(false); } };
  const hasDraft = !!c?.draft || f.stage === 'draft';
  return (
    <Panel title={title} tag={c?.source === 'hq' ? '자동' : undefined} onClose={onClose}
      foot={<>{onDelete && <Act ghost onClick={onDelete} disabled={busy}>삭제</Act>}<span className="grow" /><Act onClick={() => save()} disabled={busy || !f.title.trim()}>{c ? '저장' : '추가'}</Act></>}>
      <Field label="단계"><Seg items={STAGES.map(s => ({ key: s.key, label: s.label }))} value={f.stage} onChange={k => setF({ ...f, stage: k })} /></Field>
      <Field label="제목"><input className="n-in" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} placeholder="제목 입력" autoFocus={!c} /></Field>
      <Field label="채널"><Seg items={CHANNELS.map(x => ({ key: x, label: x }))} value={f.channel} onChange={k => setF({ ...f, channel: k })} /></Field>
      <Field label="게시일"><DueSeg value={f.dueDate} onChange={d => setF({ ...f, dueDate: d })} today={today} tomorrow={todayKst(1)} /></Field>
      {c && hasDraft && (
        <Field label="원고">
          <div className="n-draft">
            <div className="dh">{c.draft ? (f.draftStatus === 'auto' ? `초안 v${c.draftVersion}` : f.draftStatus === 'confirmed' ? '확정 원고' : '수정 중') : '초안 대기'}{f.draftStatus === 'auto' && <span className="n-b hq">자동</span>}</div>
            {editing
              ? <textarea className="n-in area" style={{ border: 0, borderRadius: 0, minHeight: 160 }} value={f.draft ?? ''} onChange={e => setF({ ...f, draft: e.target.value })} />
              : <div className="db">{c.draft || '원고 단계에 두면 다음 아침 본부가 초안을 씁니다'}</div>}
            <div className="df">
              {editing
                ? <Mini primary onClick={() => { setEditing(false); setF({ ...f, draftStatus: 'edited' }); }}>수정 끝</Mini>
                : <Mini onClick={() => setEditing(true)}>직접 수정</Mini>}
              {f.draftStatus !== 'auto' && c.draft && <Mini onClick={() => save({ draftStatus: 'auto' })}>다시 쓰기 요청</Mini>}
              {c.draft && f.draftStatus !== 'confirmed' && <Mini primary onClick={() => save({ draftStatus: 'confirmed', stage: f.stage === 'draft' ? 'shoot' : f.stage })}>원고 확정</Mini>}
            </div>
          </div>
        </Field>
      )}
      {prompt && <Field label="사용한 프롬프트"><Card><List><Row left={<Kind>v{prompt.version}</Kind>} title={prompt.title} desc="07 자료실" right={<Mini onClick={onOpenPrompt}>열기</Mini>} /></List></Card></Field>}
      <Field label="메모"><textarea className="n-in area" rows={3} value={f.memo} onChange={e => setF({ ...f, memo: e.target.value })} placeholder="선택 입력" /></Field>
    </Panel>
  );
}
