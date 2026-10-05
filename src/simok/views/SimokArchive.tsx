/**
 * @file src/simok/views/SimokArchive.tsx
 * @description 우리의 아카이브 — 보관된 제작물·첨부 파일 검색
 *
 * BUILD_PACK §4: "파일 없는 결과물은 보관완료로 표시하지 않음", "미게시와 게시 구분"
 * 저장소 사실: `content_versions` / `publications` 테이블이 아직 없다.
 *   그래서 **버전 이력·승인본 immutable 은 아직 보여줄 수 없고**, 그 사실을 적는다.
 *   파일은 기존 `attachments`(비공개 버킷 + 1시간 서명 URL)를 쓴다.
 */
import { useEffect, useState } from 'react';
import { SimokViewProps } from '../SimokShell';
import { Empty, ErrorBox, Loading, Note } from '../ui';
import { fetchContentItems } from '../../services/contentItems.service';
import { ContentItem } from '../../types';

export function SimokArchive({ workspace, go }: SimokViewProps) {
  const [items, setItems] = useState<ContentItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setErr(null); setItems(null);
    fetchContentItems(workspace.id)
      .then(r => { if (alive) setItems(r.filter(i => i.status === 'archived' || i.status === 'published')); })
      .catch(e => { if (alive) setErr(e instanceof Error ? e.message : String(e)); });
    return () => { alive = false; };
  }, [workspace.id, tick]);

  const term = q.trim().toLowerCase();
  const shown = (items ?? []).filter(i =>
    !term || i.title.toLowerCase().includes(term) || (i.hook ?? '').toLowerCase().includes(term));

  return (
    <>
      <p className="simok-page-intro">시목이 만든 장면, 써 내려간 문장, 다시 꺼내 쓸 수 있는 생각들.</p>

      <label className="simok-card" style={{ display: 'block', padding: '12px 16px', marginBottom: 18 }}>
        <span style={{ position: 'absolute', left: -9999 }}>아카이브 검색</span>
        <input
          type="search" value={q} onChange={e => setQ(e.target.value)}
          placeholder="제목 또는 훅으로 찾기"
          style={{ width: '100%', border: 0, outline: 'none', background: 'none', font: 'inherit', color: 'inherit' }}
        />
      </label>

      {err && <ErrorBox message={err} retryable onRetry={() => setTick(t => t + 1)} />}
      {!err && !items && <Loading rows={3} label="아카이브 불러오는 중" />}
      {!err && items && shown.length === 0 && (
        <Empty title={items.length === 0 ? '보관된 제작물이 없어요' : '검색 결과가 없어요'}>
          {items.length === 0
            ? '발행하거나 보관한 콘텐츠가 여기 모여요.'
            : '다른 검색어를 넣어보세요.'}
        </Empty>
      )}
      {!err && shown.length > 0 && (
        <div className="simok-board">
          {shown.map(i => (
            <article key={i.id} className="simok-work-card">
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {/* 보관 ≠ 게시 완료 (08 검수기준 4) */}
                <span className={`simok-pill ${i.status === 'published' ? 'blue' : 'paper'}`}>
                  {i.status === 'published' ? '게시됨' : '보관'}
                </span>
                {i.status === 'published' && !i.url && <span className="simok-pill amber">게시 URL 없음</span>}
              </div>
              <h3>{i.title}</h3>
              {i.publishedAt && <p>게시 {i.publishedAt.slice(0, 10)}</p>}
              {i.url
                ? <a className="simok-btn text" style={{ marginTop: 10, textDecoration: 'underline' }} href={i.url} target="_blank" rel="noreferrer">원본 보기 ↗</a>
                : <p style={{ marginTop: 8, fontSize: 10, color: 'var(--muted)' }}>실제 파일·게시 URL 이 연결되지 않아 보관 완료로 표시하지 않아요.</p>}
            </article>
          ))}
        </div>
      )}

      <Note>
        <strong>버전 이력은 아직 없습니다.</strong><br />
        <code>content_versions</code> · <code>publications</code> 테이블이 없어서 "검토한 버전·검토자·시각" 과
        "보관본 수정 시 이전 승인본 immutable 유지" 를 보여줄 수 없어요(08 검수기준 4·5).
        파일은 기존 비공개 버킷(1시간 서명 URL)을 쓰고, finalize→asset_id 연결은 다음 작업입니다.
        <br />
        <button className="simok-btn text" style={{ marginTop: 10, textDecoration: 'underline' }} onClick={() => go('studio')}>제작실로 ↗</button>
      </Note>
    </>
  );
}
