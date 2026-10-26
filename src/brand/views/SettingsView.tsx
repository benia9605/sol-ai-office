/**
 * @file src/brand/views/SettingsView.tsx
 * @description ⚙ 설정 - 브랜드 값 · 멤버 · 연동 · 워크스페이스 · 백업
 *  같은 템플릿을 쓰는 워크스페이스마다 다른 것: 이름 · 로고 · 한 줄 소개 · 배경 컬러 · 포인트 컬러 · 대표 이미지(사진/글자)
 *  기존 Teamie 화면(OfficeShell)은 백업으로만 연다.
 * 주소: /w/:id/settings/(brand | new | invite)
 */
import { useEffect, useState } from 'react';
import { BrandViewProps, brandLook } from '../BrandShell';
import { Workspace } from '../../types';
import { createWorkspace, updateWorkspace } from '../../services/workspaces.service';
import { uploadImage } from '../../services/storage.service';
import { supabase } from '../../services/supabase';
import { useWorkspaceContext } from '../../contexts/WorkspaceContext';
import { Act, Badge, Card, Empty, Field, G2, List, Mini, PageHead, Panel, Row, Sec, Seg, memberName } from '../ui';

const PAPERS = ['#f4f2eb', '#f6f5f0', '#FAF9F6', '#f3f0ea'];
const POINTS = ['#1f4035', '#00594D', '#5B3A6B', '#7A5A42', '#2F4A6B'];
const HEX = /^#[0-9a-fA-F]{6}$/;

interface BrandForm { name: string; logo: string; sub: string; motto: string; paper: string; point: string; heroImage?: string; heroWord: string }
const formOf = (w?: Workspace): BrandForm => {
  const l = w ? brandLook(w) : null;
  return { name: w?.name ?? '', logo: w?.brandLogo ?? '', sub: w?.brandSub ?? '', motto: w?.brandMotto ?? '', paper: l?.paper ?? '#f4f2eb', point: l?.point ?? '#1f4035', heroImage: w?.brandHeroImage, heroWord: w?.brandHeroWord ?? '' };
};

export function SettingsView({ workspace, members, myId, detailId, go, onBackupShell, onOpenLauncher }: BrandViewProps & { onOpenLauncher: () => void }) {
  const { offices, reload, setActiveWorkspace } = useWorkspaceContext();
  const look = brandLook(workspace);
  const isOwner = members.find(m => m.userId === myId)?.role === 'owner';
  const [hq, setHq] = useState<{ last?: string; ok: boolean } | null>(null);
  useEffect(() => {
    supabase.from('ingest_credentials').select('last_used_at,scopes,is_active').eq('workspace_id', workspace.id)
      .then(({ data }: { data: any[] | null }) => {
        const c = (data ?? []).find((r: any) => (r.scopes ?? []).includes('hq:ingest') && r.is_active);
        setHq(c ? { ok: true, last: c.last_used_at ?? undefined } : { ok: false });
      });
  }, [workspace.id]);

  return (
    <>
      <PageHead title="설정" />
      <Sec title="브랜드" count="배경 · 포인트 컬러 · 이름 · 로고 · 소개 · 대표 이미지">
        <Card><List>
          <Row title={workspace.name} desc={[`로고 ${look.logo}`, look.motto && `「${look.motto}」`, look.heroImage ? '대표 이미지' : `대표 글자 「${look.heroWord}」`].filter(Boolean).join(' · ')}
            right={<><span className="n-sw"><i style={{ background: look.paper }} /><i style={{ background: look.point }} /></span>{isOwner && <Mini onClick={() => go('settings', 'brand')}>편집</Mini>}</>} />
        </List></Card>
      </Sec>
      <G2>
        <Sec title="멤버" count={members.length} link={workspace.inviteCode ? '초대 코드 ↗' : undefined} onLink={() => go('settings', 'invite')}>
          <Card><List>{members.map(m => (
            <Row key={m.userId} left={<span className="l"><span className="simok-avatar" style={{ width: 24, height: 24, fontSize: 11 }}>{(m.nickname || '?')[0]}</span></span>}
              title={memberName(members, m.userId) || '이름 없음'} desc={m.userId === myId ? '나' : undefined} right={<Badge>{m.role === 'owner' ? '오너' : '멤버'}</Badge>} />
          ))}</List></Card>
        </Sec>
        <Sec title="연동" count={hq?.last ? `최근 수신 ${hq.last.slice(5, 16).replace('T', ' ')}` : ''}>
          <Card><List>
            <Row title="본부 아침 브리핑" desc="매일 09:00 · 브리핑 · 실적 · 할 일 제안 · 리서치 · 원고 초안" right={<span className={`n-b${hq?.ok ? ' hq' : ''}`}>{hq == null ? '확인 중' : hq.ok ? '정상' : '미연결'}</span>} />
            <Row title="슬랙 알림" desc="오피스 반영이 끝나면 본부 채널로" right={<span className="n-b">본부</span>} />
          </List></Card>
        </Sec>
      </G2>
      <G2>
        <Sec title="워크스페이스" count={offices.length} link="+ 새 워크스페이스" onLink={() => go('settings', 'new')}>
          <Card><List>{offices.map(w => {
            const l = brandLook(w);
            return <Row key={w.id} title={w.name} desc={w.id === workspace.id ? '현재' : undefined}
              right={<><span className="n-sw"><i style={{ background: l.point }} /></span>{w.id !== workspace.id && <Mini onClick={() => { setActiveWorkspace(w.id); go('today'); window.location.assign(`/w/${w.id}/today`); }}>전환</Mini>}</>} />;
          })}</List></Card>
        </Sec>
        <Sec title="백업">
          <Card><List>
            <Row title="Teamie 기존 화면" desc="이전 오피스 화면 · 할일 · 회의 · AI 직원" right={<Mini onClick={onBackupShell}>열기</Mini>} />
            <Row title="개인 화면 · 다른 워크스페이스" right={<Mini onClick={onOpenLauncher}>전환</Mini>} />
          </List></Card>
        </Sec>
      </G2>

      {detailId === 'brand' && <BrandPanel title="브랜드 편집" initial={formOf(workspace)} onClose={() => go('settings')}
        onSave={async f => {
          await updateWorkspace(workspace.id, { name: f.name, brandLogo: f.logo, brandSub: f.sub, brandMotto: f.motto, brandPaper: f.paper, brandPoint: f.point, brandHeroImage: f.heroImage ?? null, brandHeroWord: f.heroWord });
          reload(); go('settings');
        }} />}
      {detailId === 'new' && <BrandPanel title="새 워크스페이스" initial={{ ...formOf(), name: '', paper: '#FAF9F6', point: '#2F4A6B' }} isNew onClose={() => go('settings')}
        onSave={async f => {
          const w = await createWorkspace('office', f.name, { bizInfo: f.motto });
          await updateWorkspace(w.id, { brandLogo: f.logo, brandSub: f.sub, brandMotto: f.motto, brandPaper: f.paper, brandPoint: f.point, brandHeroImage: f.heroImage ?? null, brandHeroWord: f.heroWord });
          reload(); window.location.assign(`/w/${w.id}/today`);
        }} />}
      {detailId === 'invite' && <InvitePanel code={workspace.inviteCode} onClose={() => go('settings')} />}
    </>
  );
}

function MiniOffice({ f }: { f: BrandForm }) {
  return (
    <div className="n-mini-office" style={{ color: f.point }}>
      <div className="s" style={{ background: `color-mix(in srgb, ${f.point} 6%, ${f.paper})` }}>{(f.logo || f.name || '오피스').slice(0, 8)}<i className="on" /><i /><i /><i /></div>
      <div className="c" style={{ background: f.paper }}><i /><i style={{ height: 34 }} /><i /></div>
    </div>
  );
}

function ColorPick({ value, presets, onChange }: { value: string; presets: string[]; onChange: (c: string) => void }) {
  const [hex, setHex] = useState(value);
  useEffect(() => setHex(value), [value]);
  return (
    <div className="n-sw" style={{ flexWrap: 'wrap' }}>
      {presets.map(c => <button key={c} type="button" aria-label={c} className={c.toLowerCase() === value.toLowerCase() ? 'on' : ''} onClick={() => onChange(c)}
        style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(0,0,0,.08)', background: c, outline: c.toLowerCase() === value.toLowerCase() ? '2px solid var(--ink)' : undefined, outlineOffset: 2 }} />)}
      <input type="color" value={HEX.test(value) ? value : '#000000'} onChange={e => onChange(e.target.value)} aria-label="직접 고르기" style={{ width: 34, height: 30, border: 0, background: 'none' }} />
      <input className="n-in" style={{ width: 96, padding: '6px 8px' }} value={hex} onChange={e => { setHex(e.target.value); if (HEX.test(e.target.value)) onChange(e.target.value); }} />
    </div>
  );
}

function BrandPanel({ title, initial, isNew, onClose, onSave }: { title: string; initial: BrandForm; isNew?: boolean; onClose: () => void; onSave: (f: BrandForm) => Promise<void> }) {
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [heroMode, setHeroMode] = useState<'image' | 'word'>(initial.heroImage ? 'image' : 'word');
  const [err, setErr] = useState('');
  const set = (p: Partial<BrandForm>) => setF(x => ({ ...x, ...p }));
  return (
    <Panel title={title} onClose={onClose}
      foot={<><Act ghost onClick={onClose}>취소</Act><span className="grow" /><Act disabled={busy || !f.name.trim() || !HEX.test(f.paper) || !HEX.test(f.point)}
        onClick={async () => { setBusy(true); setErr(''); try { await onSave({ ...f, heroImage: heroMode === 'image' ? f.heroImage : undefined }); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); } }}>{isNew ? '만들기' : '저장'}</Act></>}>
      {err && <div className="n-err">{err}</div>}
      <Field label="미리보기"><MiniOffice f={f} /></Field>
      <Field label="워크스페이스 이름"><input className="n-in" value={f.name} onChange={e => set({ name: e.target.value })} autoFocus={isNew} /></Field>
      <Field label="로고 글자"><input className="n-in" value={f.logo} onChange={e => set({ logo: e.target.value })} placeholder="비우면 이름" /></Field>
      <Field label="로고 아래 글"><input className="n-in" value={f.sub} onChange={e => set({ sub: e.target.value })} placeholder="THE PRIVATE OFFICE" /></Field>
      <Field label="한 줄 소개"><input className="n-in" value={f.motto} onChange={e => set({ motto: e.target.value })} /></Field>
      <Field label="배경 컬러"><ColorPick value={f.paper} presets={PAPERS} onChange={c => set({ paper: c })} /></Field>
      <Field label="포인트 컬러"><ColorPick value={f.point} presets={POINTS} onChange={c => set({ point: c })} /></Field>
      <Field label="대표 이미지">
        <Seg items={[{ key: 'image', label: '사진' }, { key: 'word', label: '글자' }]} value={heroMode} onChange={setHeroMode} />
        {heroMode === 'image'
          ? <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {f.heroImage && <img src={f.heroImage} alt="" style={{ width: 72, height: 48, objectFit: 'cover', borderRadius: 8 }} />}
              <label className="n-mini" style={{ cursor: 'pointer' }}>사진 올리기<input type="file" accept="image/*" hidden onChange={async e => {
                const file = e.target.files?.[0]; if (!file) return;
                try { set({ heroImage: await uploadImage(file, 'workspaces') }); } catch (x) { setErr(x instanceof Error ? x.message : String(x)); }
              }} /></label>
            </div>
          : <input className="n-in" value={f.heroWord} onChange={e => set({ heroWord: e.target.value })} placeholder="예: OZ · 입동" />}
      </Field>
      {isNew && <div className="n-sub" style={{ marginTop: 0 }}>같은 오피스 템플릿으로 생성 · 본부 연결은 생성 후 본부에 요청</div>}
    </Panel>
  );
}

function InvitePanel({ code, onClose }: { code?: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <Panel title="초대 코드" onClose={onClose} foot={<><span className="grow" /><Act onClick={onClose}>확인</Act></>}>
      {code ? <>
        <div className="n-code" style={{ textAlign: 'center' }}>{code}</div>
        <div className="n-sub" style={{ marginTop: 0, textAlign: 'center' }}>로그인 후 「워크스페이스 참여」 에 입력</div>
        <div style={{ textAlign: 'center' }}><Mini primary onClick={async () => { await navigator.clipboard.writeText(code); setCopied(true); }}>{copied ? '복사됨' : '복사'}</Mini></div>
      </> : <Empty>초대 코드 없음</Empty>}
    </Panel>
  );
}
