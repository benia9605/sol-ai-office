/**
 * @file src/brand/views/LibraryView.tsx
 * @description 07 자료실 - 프롬프트(용도별 · 버전) · 문서 · 이미지 · 영상 · 브리핑 보관
 *  - 프롬프트는 고치면 새 버전. 이전 본문은 hq_prompt_versions 에 남는다 (덮어쓰지 않음)
 *  - 용도는 직접 관리 (추가 · 이름 변경 · 삭제 → 미분류 · 순서)
 *  - 파일은 기존 첨부 저장소(비공개 버킷 attachments · ref_type 'library') · 30MB 까지
 * 주소: /w/:id/library/(prompt-new | categories | upload | <prompt id>)
 */
import { DragEvent, useCallback, useEffect, useRef, useState } from 'react';
import { BrandViewProps } from '../BrandShell';
import {
  Briefing, Prompt, PromptCategory, PromptVersion, addPrompt, addPromptCategory, deletePromptCategory, fmtDay, listBriefings,
  listPromptCategories, listPromptVersions, listPrompts, markPromptUsed, renamePromptCategory, reorderPromptCategories, revisePrompt,
} from '../hq.service';
import { Attachment, deleteAttachment, listAttachments, signedUrl, uploadAttachment } from '../../services/attachments.service';
import { Act, Badge, Card, Empty, Err, Field, Kind, List, Mini, PageHead, Panel, Row, Sec, Seg, Skeleton, Tabs, memberName } from '../ui';
import { BriefingModal } from './BriefingView';

type Tab = 'prompts' | 'docs' | 'media' | 'briefings';
const TOOLS = ['Claude', 'GPT', 'GPT 이미지', '힉스필드', '미드저니'];
const isMedia = (a: Attachment) => /^(image|video)\//.test(a.mime ?? '');
const kb = (n?: number) => (n == null ? '' : n > 1048576 ? `${(n / 1048576).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`);

export function LibraryView({ workspace, members, myId, detailId, go }: BrandViewProps) {
  const ws = workspace.id;
  const me = memberName(members, myId) || '나';
  const [tab, setTab] = useState<Tab>('prompts');
  const [cats, setCats] = useState<PromptCategory[]>([]);
  const [prompts, setPrompts] = useState<Prompt[] | null>(null);
  const [files, setFiles] = useState<Attachment[]>([]);
  const [briefs, setBriefs] = useState<Briefing[]>([]);
  const [catFilter, setCatFilter] = useState<string>('all');
  const [err, setErr] = useState<unknown>(null);
  const [openBrief, setOpenBrief] = useState<Briefing | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const [c, p, f, b] = await Promise.all([listPromptCategories(ws), listPrompts(ws), listAttachments('library', ws), listBriefings(ws, 90)]);
      setCats(c); setPrompts(p); setFiles(f); setBriefs(b); setErr(null);
    } catch (e) { setErr(e); }
  }, [ws]);
  useEffect(() => { load(); }, [load]);

  const upload = async (list: FileList | null) => {
    if (!list?.length) return;
    setUploading(true);
    try { for (const file of Array.from(list)) await uploadAttachment(file, ws, 'library', ws); setFiles(await listAttachments('library', ws)); }
    catch (e) { setErr(e); } finally { setUploading(false); }
  };
  const onDrop = (e: DragEvent) => { e.preventDefault(); upload(e.dataTransfer.files); };
  const openFile = async (a: Attachment) => { const u = await signedUrl(a); if (u) window.open(u, '_blank', 'noopener'); };

  const ps = (prompts ?? []).filter(p => catFilter === 'all' || (catFilter === 'none' ? !p.categoryId : p.categoryId === catFilter));
  const sel = (prompts ?? []).find(p => p.id === detailId);
  const docs = files.filter(a => !isMedia(a)), media = files.filter(isMedia);

  return (
    <>
      <PageHead title="자료실" action={<Act onClick={() => go('library', 'upload')}>+ 업로드</Act>} />
      <Tabs<Tab> value={tab} onChange={setTab} items={[
        { key: 'prompts', label: '프롬프트', count: prompts?.length }, { key: 'docs', label: '문서', count: docs.length },
        { key: 'media', label: '이미지 · 영상', count: media.length }, { key: 'briefings', label: '브리핑 보관', count: briefs.length },
      ]} />
      {!!err && <Err e={err} />}
      {tab !== 'prompts' && tab !== 'briefings' && (
        <div className="n-dz" onDragOver={e => e.preventDefault()} onDrop={onDrop} onClick={() => fileRef.current?.click()} role="button" style={{ cursor: 'pointer', marginBottom: 28 }}>
          <b>{uploading ? '올리는 중…' : '파일을 끌어 놓기'}</b> · 최대 30MB
        </div>
      )}
      <input ref={fileRef} type="file" multiple hidden onChange={e => { upload(e.target.files); e.target.value = ''; }} />

      {!prompts ? <Skeleton /> : tab === 'prompts' ? (
        <Sec title="프롬프트" count={ps.length}>
          <div className="n-chips">
            <button type="button" className={catFilter === 'all' ? 'on' : ''} onClick={() => setCatFilter('all')}>전체 {prompts.length}</button>
            {cats.map(c => <button key={c.id} type="button" className={catFilter === c.id ? 'on' : ''} onClick={() => setCatFilter(c.id)}>{c.name} {prompts.filter(p => p.categoryId === c.id).length}</button>)}
            {prompts.some(p => !p.categoryId) && <button type="button" className={catFilter === 'none' ? 'on' : ''} onClick={() => setCatFilter('none')}>미분류 {prompts.filter(p => !p.categoryId).length}</button>}
            <button type="button" className="mg" onClick={() => go('library', 'categories')}>⚙ 용도 관리</button>
          </div>
          {ps.length ? <div className="n-gal">{ps.map(p => (
            <div key={p.id} className="n-gc click" onClick={() => go('library', p.id)}>
              <div className="n-gm"><span className="n-kind">{cats.find(c => c.id === p.categoryId)?.name ?? '미분류'}</span><span>{[p.tool, `v${p.version}`].filter(Boolean).join(' · ')}</span><Badge source={p.source} /></div>
              <h3>{p.title}</h3><pre>{p.body.split('\n').slice(0, 2).join('\n')}{p.body.split('\n').length > 2 ? ' …' : ''}</pre><div className="grow" />
              <div className="n-gf"><span>{p.lastUsedAt ? `최근 사용 ${fmtDay(p.lastUsedAt.slice(0, 10), false)}` : '사용 기록 없음'}</span><span className="h">버전 {p.version}</span></div>
            </div>
          ))}</div> : <Card><Empty>프롬프트 없음 · + 업로드 → 프롬프트</Empty></Card>}
        </Sec>
      ) : tab === 'briefings' ? (
        <Sec title="브리핑 보관" count={briefs.length}>
          <Card>{briefs.length ? <List>{briefs.map(b => <Row key={b.id} left={<Kind>{fmtDay(b.date, false)}</Kind>} title={b.summary || b.title} onClick={() => setOpenBrief(b)} />)}</List> : <Empty>없음</Empty>}</Card>
        </Sec>
      ) : (
        <Sec title={tab === 'docs' ? '문서' : '이미지 · 영상'} count={(tab === 'docs' ? docs : media).length}>
          <Card>{(tab === 'docs' ? docs : media).length ? <List>{(tab === 'docs' ? docs : media).map(a => (
            <Row key={a.id} left={<Kind>{(a.filename.split('.').pop() ?? '').toUpperCase().slice(0, 4)}</Kind>} title={a.filename}
              desc={[memberName(members, a.uploadedBy), fmtDay(a.createdAt.slice(0, 10), false), kb(a.sizeBytes)].filter(Boolean).join(' · ')} onClick={() => openFile(a)}
              right={<Mini onClick={async () => { if (confirm(`「${a.filename}」 삭제할까요?`)) { await deleteAttachment(a); setFiles(fs => fs.filter(x => x.id !== a.id)); } }}>삭제</Mini>} />
          ))}</List> : <Empty>파일 없음</Empty>}</Card>
        </Sec>
      )}

      {detailId === 'upload' && <UploadPanel cats={cats} onClose={() => go('library')} onFiles={() => { go('library'); setTab('docs'); setTimeout(() => fileRef.current?.click(), 0); }}
        onSavePrompt={async f => { const p = await addPrompt(ws, f, me); setPrompts(xs => [p, ...(xs ?? [])]); setTab('prompts'); go('library'); }} />}
      {detailId === 'categories' && <CategoriesPanel cats={cats} prompts={prompts ?? []} onClose={() => go('library')} reload={async () => setCats(await listPromptCategories(ws))}
        onAdd={async name => { await addPromptCategory(ws, name, cats.length); setCats(await listPromptCategories(ws)); }} />}
      {sel && <PromptPanel p={sel} cats={cats} onClose={() => go('library')}
        onRevise={async f => { const p = await revisePrompt(sel, f, me); setPrompts(xs => (xs ?? []).map(x => (x.id === p.id ? p : x))); }} />}
      {openBrief && <BriefingModal briefing={openBrief} onClose={() => setOpenBrief(null)} />}
    </>
  );
}

function UploadPanel({ cats, onClose, onFiles, onSavePrompt }: {
  cats: PromptCategory[]; onClose: () => void; onFiles: () => void; onSavePrompt: (f: { title: string; categoryId?: string; tool?: string; body: string }) => Promise<void>;
}) {
  const [mode, setMode] = useState<'file' | 'prompt'>('prompt');
  const [title, setTitle] = useState('');
  const [cat, setCat] = useState<string | undefined>(cats[0]?.id);
  const [tool, setTool] = useState<string | undefined>('Claude');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Panel title="업로드" onClose={onClose}
      foot={mode === 'prompt' ? <><Act ghost onClick={onClose}>취소</Act><span className="grow" /><Act disabled={busy || !title.trim() || !body.trim()} onClick={async () => { setBusy(true); try { await onSavePrompt({ title, categoryId: cat, tool, body }); } finally { setBusy(false); } }}>저장</Act></> : undefined}>
      <Seg items={[{ key: 'file', label: '파일' }, { key: 'prompt', label: '프롬프트' }]} value={mode} onChange={setMode} />
      {mode === 'file' ? <div className="n-dz" role="button" style={{ cursor: 'pointer' }} onClick={onFiles}><b>파일 고르기</b> · 문서 · 이미지 · 영상 · 최대 30MB</div> : (
        <>
          <Field label="제목"><input className="n-in" value={title} onChange={e => setTitle(e.target.value)} placeholder="예: 연출컷 지시서 · 겨울 창가 톤" autoFocus /></Field>
          <Field label="용도">{cats.length ? <Seg items={cats.map(c => ({ key: c.id, label: c.name }))} value={cat} onChange={setCat} /> : <div className="n-sub" style={{ margin: 0 }}>용도 없음 · ⚙ 용도 관리에서 추가</div>}</Field>
          <Field label="도구"><Seg items={TOOLS.map(t => ({ key: t, label: t }))} value={tool} onChange={setTool} /></Field>
          <Field label="프롬프트 · {바꿀 칸}"><textarea className="n-in area" rows={8} value={body} onChange={e => setBody(e.target.value)} placeholder="{제품명} 처럼 바꿔 넣을 칸은 중괄호로" /></Field>
        </>
      )}
    </Panel>
  );
}

function CategoriesPanel({ cats, prompts, onClose, reload, onAdd }: {
  cats: PromptCategory[]; prompts: Prompt[]; onClose: () => void; reload: () => Promise<void>; onAdd: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);
  const drop = async (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const ids = cats.map(c => c.id).filter(id => id !== dragId);
    ids.splice(ids.indexOf(targetId), 0, dragId);
    await reorderPromptCategories(ids); await reload(); setDragId(null);
  };
  return (
    <Panel title="용도 관리" onClose={onClose} foot={<><span className="grow" /><Act onClick={onClose}>닫기</Act></>}>
      <Field label="용도"><Card><List>{cats.map(c => (
        <li key={c.id} draggable onDragStart={() => setDragId(c.id)} onDragOver={e => e.preventDefault()} onDrop={() => drop(c.id)} className={dragId === c.id ? 'n-dragging' : ''}>
          <span className="l k" style={{ width: 18, cursor: 'grab' }}>≡</span>
          <div className="m">{editing === c.id
            ? <input className="n-in" value={draft} onChange={e => setDraft(e.target.value)} autoFocus />
            : <><div className="t">{c.name}</div><div className="d">프롬프트 {prompts.filter(p => p.categoryId === c.id).length}</div></>}</div>
          <div className="r">{editing === c.id
            ? <Mini primary onClick={async () => { if (draft.trim()) { await renamePromptCategory(c.id, draft); await reload(); } setEditing(null); }}>저장</Mini>
            : <><Mini onClick={() => { setEditing(c.id); setDraft(c.name); }}>이름 변경</Mini>
                <Mini onClick={async () => { if (confirm(`「${c.name}」 용도를 삭제할까요? 프롬프트는 미분류로 이동합니다.`)) { await deletePromptCategory(c.id); await reload(); } }}>삭제</Mini></>}</div>
        </li>
      ))}</List></Card></Field>
      <Field label="새 용도"><div style={{ display: 'flex', gap: 8 }}><input className="n-in" style={{ flex: 1 }} value={name} onChange={e => setName(e.target.value)} placeholder="예: 썸네일" />
        <Act disabled={!name.trim()} onClick={async () => { await onAdd(name); setName(''); }}>추가</Act></div></Field>
      <div className="n-sub" style={{ marginTop: 0 }}>≡ 를 끌어 순서 변경 · 삭제한 용도의 프롬프트는 「미분류」 로 이동</div>
    </Panel>
  );
}

function PromptPanel({ p, cats, onClose, onRevise }: {
  p: Prompt; cats: PromptCategory[]; onClose: () => void; onRevise: (f: { title?: string; categoryId?: string | null; tool?: string; body: string; note?: string }) => Promise<void>;
}) {
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(p.body);
  const [title, setTitle] = useState(p.title);
  const [cat, setCat] = useState<string | undefined>(p.categoryId);
  const [note, setNote] = useState('');
  const [copied, setCopied] = useState(false);
  useEffect(() => { listPromptVersions(p.id).then(setVersions).catch(() => setVersions([])); }, [p.id, p.version]);
  const copy = async () => { await navigator.clipboard.writeText(p.body); setCopied(true); markPromptUsed(p.id); setTimeout(() => setCopied(false), 1500); };
  return (
    <Panel title={p.title} tag={`v${p.version}`} onClose={onClose}
      foot={editing
        ? <><Act ghost onClick={() => { setEditing(false); setBody(p.body); }}>취소</Act><span className="grow" /><Act disabled={!body.trim()} onClick={async () => { await onRevise({ title, categoryId: cat ?? null, body, note: note.trim() || undefined }); setEditing(false); setNote(''); }}>새 버전 저장 · v{p.version + 1}</Act></>
        : <><Act ghost onClick={copy}>{copied ? '복사됨' : '복사'}</Act><span className="grow" /><Act onClick={() => setEditing(true)}>수정 · v{p.version + 1}</Act></>}>
      <div className="n-gm"><span className="n-kind">{cats.find(c => c.id === p.categoryId)?.name ?? '미분류'}</span><span>{[p.tool, p.lastUsedAt ? `최근 사용 ${fmtDay(p.lastUsedAt.slice(0, 10), false)}` : ''].filter(Boolean).join(' · ')}</span><Badge source={p.source} /></div>
      {editing ? (
        <>
          <Field label="제목"><input className="n-in" value={title} onChange={e => setTitle(e.target.value)} /></Field>
          <Field label="용도"><Seg items={cats.map(c => ({ key: c.id, label: c.name }))} value={cat} onChange={setCat} /></Field>
          <Field label="프롬프트"><textarea className="n-in area" rows={10} value={body} onChange={e => setBody(e.target.value)} /></Field>
          <Field label="바꾼 이유"><input className="n-in" value={note} onChange={e => setNote(e.target.value)} placeholder="선택 입력" /></Field>
        </>
      ) : <Field label="프롬프트"><div className="n-box" style={{ whiteSpace: 'pre-wrap' }}>{p.body}</div></Field>}
      <Field label="버전"><Card><List>{versions.length ? versions.map(v => (
        <Row key={v.id} left={<Kind>v{v.version}</Kind>} title={`${fmtDay(v.createdAt.slice(0, 10), false)} · ${v.authorLabel ?? ''}`} desc={v.note} />
      )) : <Row title="이력 없음" />}</List></Card></Field>
    </Panel>
  );
}
