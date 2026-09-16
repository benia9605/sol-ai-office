/**
 * @file src/components/office/ContentHubView.tsx
 * @description 콘텐츠 허브 — 아이디어 → 채널별 발행물 + 기록시점 수치. 채널 탭 + 통계.
 * - 탭: 아이디어 / 유튜브 / 인스타 / 스레드 / 당근
 * - 아이디어 상세(본문 보기·관련 콘텐츠) → 콘텐츠 상세(수치 스냅샷·직접 추가, 유튜브 자동)
 * - 설계: docs/CONTENT_HUB_REDESIGN.md · 프리뷰 v8
 */
import { useEffect, useMemo, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Workspace, ContentItem, ContentMetric, ContentChannel, CHANNEL_METRIC_FIELDS } from '../../types';
import { fetchContentItems, addContentItem, updateContentItem, deleteContentItem } from '../../services/contentItems.service';
import { fetchMetricsByWorkspace, addMetricSnapshot } from '../../services/contentMetrics.service';
import { fetchVideos, linkVideoToContent, YoutubeVideoRow } from '../../services/youtube.service';
import { useCategories } from '../../hooks/useCategories';
import { CategorySelect } from '../CategorySelect';
import { CategoryBadge } from '../CategoryBadge';
import { ViewHead, EmptyState } from './ui';
import { ChannelIcon, CHANNELS, CHANNEL_META, channelName } from './ChannelIcon';
import { TiptapEditor } from '../tiptap/TiptapEditor';
import { TiptapReadOnly } from '../tiptap/TiptapReadOnly';
import { ContentPage } from '../../pages/ContentPage';

const fmt = (n?: number) => (n ?? 0).toLocaleString();
const PRIMARY: Record<string, string> = { youtube: 'likes', instagram: 'saves', threads: 'likes', daangn: 'chats', blog: 'likes', tiktok: 'likes', etc: 'likes' };
const mlabel = (ch: string, key: string) => (CHANNEL_METRIC_FIELDS[ch] || []).find((f) => f.key === key)?.label || key;
const nowLocal = () => { const d = new Date(); const p = (x: number) => String(x).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
const excerpt = (s: string, n = 40) => (s.length > n ? s.slice(0, n) + '…' : s);
const parseDoc = (s?: string): Record<string, unknown> | null => {
  if (!s) return null;
  try { const o = JSON.parse(s); if (o && (o as any).type) return o; } catch { /* plain */ }
  return { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: s }] }] };
};

type Modal =
  | { t: 'ideaDetail'; id: string }
  | { t: 'ideaBody'; id: string }
  | { t: 'content'; id: string; from?: string }
  | { t: 'addMetric'; id: string; from?: string }
  | { t: 'linkYt'; id: string; from?: string }
  | { t: 'ideaForm' }
  | { t: 'contentForm'; ideaId: string };

const statusMeta: Record<string, { label: string; cls: string }> = {
  idea: { label: '아이디어', cls: 'bg-surface-sunken text-foreground-muted' },
  scheduled: { label: '예약', cls: 'bg-amber-50 text-amber-600' },
  scripted: { label: '대본', cls: 'bg-surface-sunken text-foreground-muted' },
  published: { label: '발행', cls: 'bg-emerald-50 text-emerald-600' },
};
const statusBadge = (s: string) => {
  const m = statusMeta[s] || { label: s, cls: 'bg-surface-sunken text-foreground-muted' };
  return <span className={`text-[11px] font-medium px-2 py-0.5 rounded-[4px] ${m.cls}`}>{m.label}</span>;
};

export function ContentHubView({ workspace }: { workspace: Workspace; onNavigate?: (v: string, id?: string) => void }) {
  const wsId = workspace.id;
  const [items, setItems] = useState<ContentItem[]>([]);
  const [metrics, setMetrics] = useState<ContentMetric[]>([]);
  const [ytVideos, setYtVideos] = useState<YoutubeVideoRow[]>([]);
  const [tab, setTab] = useState<'idea' | ContentChannel>('idea');
  const [modal, setModal] = useState<Modal | null>(null);
  const { categories, colorOf, labelOf } = useCategories('content', wsId);

  const reload = () => {
    fetchContentItems(wsId).then(setItems).catch(() => setItems([]));
    fetchMetricsByWorkspace(wsId).then(setMetrics).catch(() => setMetrics([]));
    fetchVideos(wsId).then(setYtVideos).catch(() => setYtVideos([]));
  };
  const linkedVideoOf = (contentId: string) => ytVideos.find((v) => v.content_item_id === contentId) || null;
  const doLinkYt = async (videoRowId: string, contentId: string | null) => {
    await linkVideoToContent(videoRowId, contentId).catch(() => {});
    reload();
  };
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [wsId]);

  const ideas = useMemo(() => items.filter((i) => !i.ideaId), [items]);
  const childrenOf = (ideaId: string) => items.filter((i) => i.ideaId === ideaId);
  const itemById = (id: string) => items.find((i) => i.id === id);
  const snapsOf = (id: string) => metrics.filter((m) => m.contentItemId === id).slice().sort((a, b) => (a.measuredAt || '').localeCompare(b.measuredAt || ''));
  const latestOf = (id: string) => { const s = snapsOf(id); return s.length ? s[s.length - 1] : null; };

  // ── 액션 ──
  const saveMetric = async (id: string, measuredAt: string, vals: Record<string, number>) => {
    await addMetricSnapshot(wsId, id, measuredAt.replace('T', ' '), vals).catch(() => {});
    reload();
  };
  const createIdea = async (title: string, category: string, bodyJson: Record<string, unknown>) => {
    await addContentItem(wsId, { title, category, status: 'idea', script: JSON.stringify(bodyJson) }).catch(() => {});
    reload();
  };
  const createContent = async (ideaId: string, f: { channel: ContentChannel; title: string; body: string; link: string; status: ContentItem['status'] }) => {
    const idea = itemById(ideaId);
    await addContentItem(wsId, { title: f.title, ideaId, channel: f.channel, status: f.status, hook: f.body, url: f.link, category: idea?.category }).catch(() => {});
    reload();
  };

  const catBadge = (catId?: string) => catId ? <CategoryBadge color={colorOf(catId)} label={labelOf(catId) || '카테고리'} size="sm" /> : null;

  // ── 행 렌더 ──
  const contentRow = (id: string) => {
    const c = itemById(id); if (!c) return null;
    const l = latestOf(id); const ch = c.channel || 'etc';
    const title = c.title || (c.hook ? excerpt(c.hook, 24) : `${channelName(ch)} 게시물`);
    return (
      <button key={id} onClick={() => setModal({ t: 'content', id, from: c.ideaId || undefined })}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-muted transition-colors text-left">
        <span className="w-8 h-8 rounded-lg bg-surface-muted flex items-center justify-center shrink-0 text-foreground"><ChannelIcon channel={ch} size={17} /></span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-medium text-foreground truncate">{title}</span>
          <span className="block text-xs text-foreground-faint mt-0.5">
            {channelName(ch)}
            {l && <> · 조회 <b className="text-foreground-muted tabular-nums">{fmt(l.metrics?.views)}</b> · {mlabel(ch, PRIMARY[ch])} <b className="text-foreground-muted tabular-nums">{fmt(l.metrics?.[PRIMARY[ch]])}</b></>}
            {!l && <> · 아직 수치 없음</>}
          </span>
        </span>
        {statusBadge(c.status)}
      </button>
    );
  };

  // ── 채널 통계 ──
  const channelPanel = (ch: ContentChannel) => {
    const list = items.filter((i) => i.channel === ch && i.ideaId != null || (i.channel === ch && i.status !== 'idea'));
    const pub = list.filter((i) => i.status === 'published');
    const tv = pub.reduce((a, i) => a + (latestOf(i.id)?.metrics?.views || 0), 0);
    const tp = pub.reduce((a, i) => a + (latestOf(i.id)?.metrics?.[PRIMARY[ch]] || 0), 0);
    // 날짜별 조회 합 → 막대
    const byDate: Record<string, number> = {};
    list.forEach((i) => snapsOf(i.id).forEach((s) => { const d = (s.measuredAt || '').slice(5, 10); if (d) byDate[d] = (byDate[d] || 0) + (s.metrics?.views || 0); }));
    const bars = Object.entries(byDate).sort();
    const max = Math.max(1, ...bars.map((b) => b[1]));
    return (
      <div>
        <div className="flex items-center gap-2.5 mb-4">
          <span className="w-9 h-9 rounded-xl bg-surface-muted flex items-center justify-center text-foreground"><ChannelIcon channel={ch} size={20} /></span>
          <span className="text-base font-semibold text-foreground">{channelName(ch)}</span>
          {CHANNEL_META[ch]?.auto
            ? <span className="text-[11px] font-medium px-2 py-0.5 rounded-[4px] bg-primary-50 text-primary-500">API 자동</span>
            : <span className="text-[11px] font-medium px-2 py-0.5 rounded-[4px] bg-surface-sunken text-foreground-muted">수기 기록</span>}
        </div>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="rounded-2xl border border-line p-4"><div className="text-[11px] text-foreground-muted">발행</div><div className="text-2xl font-light mt-1 tabular-nums">{pub.length}<span className="text-sm text-foreground-faint"> 건</span></div></div>
          <div className="rounded-2xl border border-line p-4"><div className="text-[11px] text-foreground-muted">총 조회</div><div className="text-2xl font-light mt-1 tabular-nums">{fmt(tv)}</div></div>
          <div className="rounded-2xl border border-line p-4"><div className="text-[11px] text-foreground-muted">총 {mlabel(ch, PRIMARY[ch])}</div><div className="text-2xl font-light mt-1 tabular-nums">{fmt(tp)}</div></div>
        </div>
        <div className="rounded-2xl border border-line p-4 mb-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-foreground-faint">조회수 추이 (기록 시점)</div>
          {bars.length ? (
            <div className="flex items-end gap-3 h-28 mt-4">
              {bars.map(([d, v]) => (
                <div key={d} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end min-w-0">
                  <div className="text-[10px] text-foreground-muted tabular-nums">{fmt(v)}</div>
                  <div className="w-3/5 max-w-[26px] rounded-t bg-primary-500" style={{ height: `${Math.max((v / max) * 100, 3)}%` }} />
                  <div className="text-[10px] text-foreground-faint whitespace-nowrap">{d}</div>
                </div>
              ))}
            </div>
          ) : <p className="text-xs text-foreground-faint mt-3">기록된 수치가 없어요.</p>}
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground-faint mt-5 mb-1.5">{channelName(ch)} 콘텐츠</p>
        {list.length ? list.map((i) => contentRow(i.id)) : <p className="text-sm text-foreground-faint py-3">아직 이 채널 콘텐츠가 없어요.</p>}
      </div>
    );
  };

  return (
    <div>
      <ViewHead eyebrow="CONTENT" title="콘텐츠" sub={`아이디어 ${ideas.length} · 발행물 ${items.filter((i) => i.ideaId).length} · ${CHANNELS.length}개 채널`}
        action={<button onClick={() => setModal({ t: 'ideaForm' })} className="px-4 py-2 rounded-lg text-sm font-medium border border-primary-500 bg-primary-500 text-white hover:opacity-85 transition-opacity">＋ 아이디어</button>} />

      {/* 탭 */}
      <div className="flex gap-1.5 mt-6 mb-6 overflow-x-auto pb-1">
        <TabBtn on={tab === 'idea'} onClick={() => setTab('idea')} label={`💡 아이디어`} count={ideas.length} />
        {CHANNELS.map((c) => (
          <TabBtn key={c.key} on={tab === c.key} onClick={() => setTab(c.key)}
            label={<span className="inline-flex items-center gap-1.5"><ChannelIcon channel={c.key} size={15} />{c.name}</span>}
            count={items.filter((i) => i.channel === c.key).length} />
        ))}
      </div>

      {/* 아이디어 탭 */}
      {tab === 'idea' && (
        ideas.length ? ideas.map((idea) => (
          <button key={idea.id} onClick={() => setModal({ t: 'ideaDetail', id: idea.id })}
            className="w-full flex items-center gap-3 border border-line rounded-2xl bg-surface p-4 mb-3 hover:border-line-strong hover:bg-surface-muted transition-colors text-left">
            <span className="text-xl">💡</span>
            <span className="flex-1 min-w-0 text-base font-semibold text-foreground truncate">{idea.title}</span>
            {catBadge(idea.category)}
            <span className="text-xs text-foreground-faint whitespace-nowrap">발행물 {childrenOf(idea.id).length}</span>
          </button>
        )) : <EmptyState emoji="💡" title="아직 아이디어가 없어요" sub="＋ 아이디어로 시작하고, 채널별 발행물을 연결하세요" />
      )}

      {/* 채널 탭 — 유튜브는 라이브(ContentPage) 편입, 나머지는 수기 통계 패널 */}
      {tab === 'youtube' && <ContentPage embedded hideHead workspaceId={wsId} />}
      {tab !== 'idea' && tab !== 'youtube' && channelPanel(tab)}

      {modal && createPortal(
        <ModalHost
          modal={modal} setModal={setModal} onClose={() => setModal(null)}
          itemById={itemById} childrenOf={childrenOf} snapsOf={snapsOf} latestOf={latestOf}
          contentRow={contentRow} catBadge={catBadge} wsId={wsId}
          onSaveMetric={saveMetric} onCreateIdea={createIdea} onCreateContent={createContent}
          ytVideos={ytVideos} linkedVideoOf={linkedVideoOf} onLinkYt={doLinkYt}
        />, document.body)}
    </div>
  );
}

function TabBtn({ on, onClick, label, count }: { on: boolean; onClick: () => void; label: React.ReactNode; count: number }) {
  return (
    <button onClick={onClick}
      className={`flex-none inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium border transition-colors ${on ? 'bg-primary-500 border-primary-500 text-white' : 'bg-surface border-line text-foreground-muted hover:border-line-strong hover:text-foreground'}`}>
      {label}<span className="text-[11px] opacity-70">{count}</span>
    </button>
  );
}

/* ───────── 모달 호스트 (아이디어/본문/콘텐츠/수치추가/폼) ───────── */
function ModalHost({ modal, setModal, onClose, itemById, childrenOf, snapsOf, latestOf, contentRow, catBadge, wsId, onSaveMetric, onCreateIdea, onCreateContent, ytVideos, linkedVideoOf, onLinkYt }: any) {
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  const back = (m: Modal) => setModal(m);

  const Sheet = ({ children, wide }: { children: React.ReactNode; wide?: boolean }) => (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/45" onMouseDown={onClose}>
      <div className={`bg-surface rounded-2xl w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} max-h-[calc(100vh-32px)] overflow-y-auto p-5`} onMouseDown={stop}>{children}</div>
    </div>
  );
  const X = () => <button onClick={onClose} className="w-7 h-7 rounded-full bg-surface-muted text-foreground-muted hover:text-foreground text-sm shrink-0">✕</button>;

  if (modal.t === 'ideaDetail') {
    const idea = itemById(modal.id); if (!idea) return null;
    const kids = childrenOf(idea.id);
    return <Sheet>
      <div className="flex items-start gap-3 mb-4"><div className="flex-1">{catBadge(idea.category)}<h3 className="text-lg font-semibold text-foreground mt-2">💡 {idea.title}</h3></div><X /></div>
      <button onClick={() => back({ t: 'ideaBody', id: idea.id })} className="w-full flex items-center gap-2 border border-line rounded-lg px-4 py-3 text-sm font-medium text-foreground hover:border-primary-500 hover:text-primary-500 hover:bg-surface-muted transition-colors">본문 보기 <span className="ml-auto text-foreground-faint">›</span></button>
      <div className="h-px bg-line my-4" />
      <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground-faint mb-1.5">관련 콘텐츠 {kids.length}</p>
      {kids.length ? kids.map((k: ContentItem) => contentRow(k.id)) : <p className="text-sm text-foreground-faint py-1.5">아직 등록된 콘텐츠가 없어요.</p>}
      <button onClick={() => back({ t: 'contentForm', ideaId: idea.id })} className="w-full mt-2 flex items-center justify-center gap-2 border border-dashed border-line-strong rounded-lg py-3 text-sm text-foreground-muted hover:border-primary-500 hover:text-primary-500 transition-colors">＋ 관련 콘텐츠 등록</button>
    </Sheet>;
  }

  if (modal.t === 'ideaBody') {
    const idea = itemById(modal.id); if (!idea) return null;
    const doc = parseDoc(idea.script);
    return <Sheet>
      <div className="flex items-center gap-3 mb-3"><button onClick={() => back({ t: 'ideaDetail', id: idea.id })} className="text-sm text-foreground-muted hover:text-foreground">‹ {idea.title}</button><div className="flex-1" /><X /></div>
      <h3 className="text-lg font-semibold text-foreground mb-3">본문</h3>
      {doc ? <TiptapReadOnly content={doc as any} /> : <p className="text-sm text-foreground-faint">내용 없음</p>}
    </Sheet>;
  }

  if (modal.t === 'content') {
    const c = itemById(modal.id); if (!c) return null;
    const ch = c.channel || 'etc'; const snaps = snapsOf(c.id).slice().reverse();
    const auto = CHANNEL_META[ch]?.auto;
    return <Sheet>
      {modal.from && <button onClick={() => back({ t: 'ideaDetail', id: modal.from })} className="text-sm text-foreground-muted hover:text-foreground mb-3 block">‹ 아이디어</button>}
      <div className="flex items-start gap-3 mb-3"><div className="flex-1">
        <div className="flex items-center gap-1.5 mb-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-[4px] bg-surface-sunken text-foreground-muted"><ChannelIcon channel={ch} size={13} /> {channelName(ch)}</span>
          {statusBadge(c.status)}
        </div>
        <h3 className="text-lg font-semibold text-foreground">{c.title || `${channelName(ch)} 게시물`}</h3>
      </div><X /></div>
      {c.hook && <p className="text-sm text-foreground-muted leading-relaxed whitespace-pre-wrap mb-3">{c.hook}</p>}
      {c.url && <a href={c.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 border border-line rounded-lg p-3 text-xs text-foreground-muted hover:border-primary-500 mb-3"><ChannelIcon channel={ch} size={16} /><span className="truncate">{c.url}</span></a>}
      <div className="h-px bg-line my-4" />
      <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground-faint mb-1.5">수치 기록 (최신순)</p>
      {auto ? (() => {
        // 유튜브: 연결된 영상의 라이브 수치가 곧 수치 기록 (수기 없음)
        const lv = linkedVideoOf(c.id);
        if (lv) return <div>
          <div className="flex gap-4 py-3.5">
            <div className="shrink-0 min-w-[92px] text-xs text-foreground-faint pt-0.5 whitespace-nowrap">실시간</div>
            <div className="flex-1 flex flex-wrap gap-x-5 gap-y-3">
              <div className="text-[11px] text-foreground-muted">조회수<b className="block text-base text-foreground font-semibold tabular-nums mt-0.5">{fmt(lv.view_count)}</b></div>
              <div className="text-[11px] text-foreground-muted">좋아요<b className="block text-base text-foreground font-semibold tabular-nums mt-0.5">{fmt(lv.like_count)}</b></div>
              <div className="text-[11px] text-foreground-muted">댓글<b className="block text-base text-foreground font-semibold tabular-nums mt-0.5">{fmt(lv.comment_count)}</b></div>
            </div>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-foreground-faint border-t border-line pt-2.5">
            <ChannelIcon channel="youtube" size={13} />
            <span className="truncate">연결됨 · {lv.title} · 자동 반영</span>
            <button onClick={() => onLinkYt(lv.id, null)} className="ml-auto shrink-0 text-foreground-faint hover:text-rose-500">연결 해제</button>
          </div>
        </div>;
        return <>
          <p className="text-xs text-foreground-faint py-2">유튜브 영상을 연결하면 조회·좋아요·댓글이 자동으로 채워져요.</p>
          <button onClick={() => back({ t: 'linkYt', id: c.id, from: modal.from })} className="w-full mt-1 flex items-center justify-center gap-2 border border-dashed border-line-strong rounded-lg py-3 text-sm text-foreground-muted hover:border-primary-500 hover:text-primary-500 transition-colors"><ChannelIcon channel="youtube" size={15} /> 유튜브 영상 연결 (수치 자동)</button>
        </>;
      })() : (<>
        {snaps.length ? snaps.map((s: ContentMetric) => {
          const [d, t] = (s.measuredAt || '').split(' ');
          return <div key={s.id} className="flex gap-4 py-3.5 border-b border-line last:border-0">
            <div className="shrink-0 min-w-[92px] text-xs text-foreground-faint pt-0.5 tabular-nums whitespace-nowrap">{d?.slice(5)} {t || ''}</div>
            <div className="flex-1 flex flex-wrap gap-x-5 gap-y-3">
              {(CHANNEL_METRIC_FIELDS[ch] || []).filter((f) => s.metrics?.[f.key] != null).map((f) => (
                <div key={f.key} className="text-[11px] text-foreground-muted">{f.label}<b className="block text-base text-foreground font-semibold tabular-nums mt-0.5">{fmt(s.metrics?.[f.key])}</b></div>
              ))}
            </div>
          </div>;
        }) : <p className="text-xs text-foreground-faint py-2">아직 기록된 수치가 없어요.</p>}
        <button onClick={() => back({ t: 'addMetric', id: c.id, from: modal.from })} className="w-full mt-2 flex items-center justify-center gap-2 border border-dashed border-line-strong rounded-lg py-3 text-sm text-foreground-muted hover:border-primary-500 hover:text-primary-500 transition-colors">＋ 수치 추가 (기록 시점 저장)</button>
      </>)}
    </Sheet>;
  }

  if (modal.t === 'linkYt') {
    const c = itemById(modal.id); if (!c) return null;
    const avail = (ytVideos as YoutubeVideoRow[]).filter((v) => !v.content_item_id);
    return <Sheet>
      <button onClick={() => back({ t: 'content', id: modal.id, from: modal.from })} className="text-sm text-foreground-muted hover:text-foreground mb-3 block">‹ 뒤로</button>
      <div className="flex items-center gap-3 mb-1"><h3 className="text-lg font-semibold text-foreground flex-1">유튜브 영상 연결</h3><X /></div>
      <p className="text-xs text-foreground-faint mb-3">연결하면 이 콘텐츠의 조회·좋아요·댓글이 유튜브 영상 실측치로 자동 반영돼요.</p>
      {avail.length ? avail.map((v) => (
        <button key={v.id} onClick={() => { onLinkYt(v.id, c.id); back({ t: 'content', id: c.id, from: modal.from }); }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-muted text-left">
          <span className="w-8 h-8 rounded-lg bg-surface-muted flex items-center justify-center shrink-0"><ChannelIcon channel="youtube" size={16} /></span>
          <span className="flex-1 min-w-0"><span className="block text-sm font-medium text-foreground truncate">{v.title}</span><span className="block text-xs text-foreground-faint mt-0.5 tabular-nums">조회 {fmt(v.view_count)} · 좋아요 {fmt(v.like_count)}</span></span>
        </button>
      )) : <p className="text-sm text-foreground-faint py-3">연결 가능한 유튜브 영상이 없어요. (유튜브 탭에서 채널을 먼저 등록하세요)</p>}
    </Sheet>;
  }

  if (modal.t === 'addMetric') return <AddMetricForm modal={modal} itemById={itemById} onBack={() => back({ t: 'content', id: modal.id, from: modal.from })} onClose={onClose} onSave={onSaveMetric} X={X} Sheet={Sheet} />;
  if (modal.t === 'ideaForm') return <IdeaForm wsId={wsId} onClose={onClose} onCreate={onCreateIdea} X={X} Sheet={Sheet} />;
  if (modal.t === 'contentForm') return <ContentForm ideaId={modal.ideaId} itemById={itemById} onBack={() => back({ t: 'ideaDetail', id: modal.ideaId })} onClose={onClose} onCreate={onCreateContent} X={X} Sheet={Sheet} />;
  return null;
}

function AddMetricForm({ modal, itemById, onBack, onSave, X, Sheet }: any) {
  const c = itemById(modal.id); const ch = c?.channel || 'etc';
  const [dt, setDt] = useState(nowLocal());
  const [vals, setVals] = useState<Record<string, string>>({});
  return <Sheet>
    <button onClick={onBack} className="text-sm text-foreground-muted hover:text-foreground mb-3 block">‹ 뒤로</button>
    <div className="flex items-center gap-3 mb-3"><h3 className="text-lg font-semibold text-foreground flex-1">수치 추가 · {channelName(ch)}</h3><X /></div>
    <label className="block text-xs font-semibold text-foreground-muted mb-1.5">기록 시점 (날짜·시간)</label>
    <input type="datetime-local" value={dt} onChange={(e) => setDt(e.target.value)} className="w-full border border-line bg-surface rounded-lg px-3 py-2.5 text-sm text-foreground focus:border-primary-500 focus:outline-none" />
    <div className="grid grid-cols-2 gap-3 mt-3">
      {(CHANNEL_METRIC_FIELDS[ch] || []).map((f: any) => (
        <div key={f.key}><label className="block text-xs text-foreground-muted mb-1.5">{f.label}</label>
          <input type="number" min="0" value={vals[f.key] ?? ''} onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))} placeholder="0" className="w-full border border-line bg-surface rounded-lg px-3 py-2.5 text-sm text-foreground focus:border-primary-500 focus:outline-none" /></div>
      ))}
    </div>
    <div className="flex justify-end gap-2 mt-5">
      <button onClick={onBack} className="px-4 py-2 rounded-lg text-sm border border-line-strong text-foreground-muted hover:border-foreground">취소</button>
      <button onClick={() => { const num: Record<string, number> = {}; Object.entries(vals).forEach(([k, v]) => { if (v !== '') num[k] = Number(v); }); onSave(modal.id, dt, num); onBack(); }} className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary-500 text-white hover:opacity-85">저장</button>
    </div>
  </Sheet>;
}

function IdeaForm({ wsId, onClose, onCreate, X, Sheet }: any) {
  const [title, setTitle] = useState('');
  const [cat, setCat] = useState('');
  const bodyRef = useRef<Record<string, unknown>>({ type: 'doc', content: [] });
  return <Sheet wide>
    <div className="flex items-center gap-3 mb-4"><h3 className="text-lg font-semibold text-foreground flex-1">새 아이디어</h3><X /></div>
    <label className="block text-xs font-semibold text-foreground-muted mb-1.5">아이디어 제목</label>
    <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 원목 무드 홈스타일링" className="w-full border border-line bg-surface rounded-lg px-3 py-2.5 text-sm text-foreground focus:border-primary-500 focus:outline-none" />
    <label className="block text-xs font-semibold text-foreground-muted mb-1.5 mt-3.5">카테고리</label>
    <CategorySelect scope="content" workspaceId={wsId} value={cat} onChange={setCat} allowNone />
    <label className="block text-xs font-semibold text-foreground-muted mb-1.5 mt-3.5">내용</label>
    <TiptapEditor content={{ type: 'doc', content: [] }} onChange={(j) => { bodyRef.current = j; }} placeholder="훅 · 핵심 메시지 · 채널 계획 · 이미지 등 자유롭게" maxHeight="42vh" />
    <div className="flex justify-end gap-2 mt-5">
      <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border border-line-strong text-foreground-muted hover:border-foreground">취소</button>
      <button onClick={() => { const t = title.trim(); if (!t) return; onCreate(t, cat, bodyRef.current); onClose(); }} className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary-500 text-white hover:opacity-85">등록</button>
    </div>
  </Sheet>;
}

function ContentForm({ ideaId, itemById, onBack, onClose, onCreate, X, Sheet }: any) {
  const idea = itemById(ideaId);
  const [channel, setChannel] = useState<ContentChannel>('youtube');
  const [noTitle, setNoTitle] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [link, setLink] = useState('');
  const [status, setStatus] = useState<ContentItem['status']>('published');
  return <Sheet>
    <button onClick={onBack} className="text-sm text-foreground-muted hover:text-foreground mb-3 block">‹ {idea?.title}</button>
    <div className="flex items-center gap-3 mb-4"><h3 className="text-lg font-semibold text-foreground flex-1">관련 콘텐츠 등록</h3><X /></div>
    <label className="block text-xs font-semibold text-foreground-muted mb-1.5">채널</label>
    <div className="flex gap-2 flex-wrap">
      {CHANNELS.map((c) => (
        <button key={c.key} onClick={() => setChannel(c.key)} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm border ${channel === c.key ? 'border-primary-500 bg-primary-50 text-primary-500' : 'border-line text-foreground-muted'}`}><ChannelIcon channel={c.key} size={15} />{c.name}</button>
      ))}
    </div>
    <label className="flex items-center gap-2 mt-3.5 text-sm text-foreground-muted cursor-pointer"><input type="checkbox" checked={noTitle} onChange={(e) => setNoTitle(e.target.checked)} className="w-4 h-4 accent-primary-500" /> 제목 없음 (인스타·릴스처럼)</label>
    {!noTitle && <><label className="block text-xs font-semibold text-foreground-muted mb-1.5 mt-3">제목</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 도마 고르는 3가지 기준" className="w-full border border-line bg-surface rounded-lg px-3 py-2.5 text-sm text-foreground focus:border-primary-500 focus:outline-none" /></>}
    <label className="block text-xs font-semibold text-foreground-muted mb-1.5 mt-3.5">본문 / 캡션</label>
    <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="캡션·스크립트·메모" className="w-full border border-line bg-surface rounded-lg px-3 py-2.5 text-sm text-foreground min-h-[72px] focus:border-primary-500 focus:outline-none" />
    <label className="block text-xs font-semibold text-foreground-muted mb-1.5 mt-3.5">링크</label>
    <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..." className="w-full border border-line bg-surface rounded-lg px-3 py-2.5 text-sm text-foreground focus:border-primary-500 focus:outline-none" />
    <label className="block text-xs font-semibold text-foreground-muted mb-1.5 mt-3.5">상태</label>
    <select value={status} onChange={(e) => setStatus(e.target.value as ContentItem['status'])} className="w-full border border-line bg-surface rounded-lg px-3 py-2.5 text-sm text-foreground focus:border-primary-500 focus:outline-none">
      <option value="idea">아이디어</option><option value="scheduled">예약</option><option value="published">발행</option>
    </select>
    <div className="flex justify-end gap-2 mt-5">
      <button onClick={onBack} className="px-4 py-2 rounded-lg text-sm border border-line-strong text-foreground-muted hover:border-foreground">취소</button>
      <button onClick={() => { if (!noTitle && !title.trim()) return; onCreate(ideaId, { channel, title: noTitle ? '' : title.trim(), body, link, status }); onBack(); }} className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary-500 text-white hover:opacity-85">등록</button>
    </div>
  </Sheet>;
}
