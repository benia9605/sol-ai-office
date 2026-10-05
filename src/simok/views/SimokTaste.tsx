/**
 * @file src/simok/views/SimokTaste.tsx
 * @description 취향 지도 — 읽기 중심 (BUILD_PACK §4: "초기 읽기 중심")
 *
 * 저장소 사실: `campaigns` / `experiments` 테이블이 **아직 없다**.
 * 가장 가까운 기존 기록은 `company_memory`(kind='experiment'|'insight')와 `brand_contexts` 다.
 * 그래서 시즌·가설을 **있는 기록에서** 읽어 보여주고, 없는 구조는 없다고 적는다.
 */
import { useEffect, useState } from 'react';
import { SimokViewProps } from '../SimokShell';
import { Empty, ErrorBox, Loading, Note, SectionHead } from '../ui';
import { fetchMemories } from '../../services/companyMemory.service';
import { CompanyMemory } from '../../types';

export function SimokTaste({ workspace }: SimokViewProps) {
  const [memos, setMemos] = useState<CompanyMemory[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setErr(null); setMemos(null);
    fetchMemories(workspace.id)
      .then(r => { if (alive) setMemos(r.filter(m => m.kind === 'experiment' || m.kind === 'insight')); })
      .catch(e => { if (alive) setErr(e instanceof Error ? e.message : String(e)); });
    return () => { alive = false; };
  }, [workspace.id, tick]);

  return (
    <>
      <p className="simok-page-intro">계절의 큰 방향은 미리, 이번 주의 이야기는 사람들의 반응을 보며.</p>

      <div className="simok-hero" style={{ minHeight: 220 }}>
        <div className="simok-hero-copy">
          <div className="simok-eyebrow">2026.10 · PLANT &amp; SPACE</div>
          <h2 style={{ fontSize: 26 }}>A room for green.</h2>
          <p>식물과 함께 사는 공간. 질문 → 제안 → 실제 시도 → 선택 정보 → 경험으로 이어지는 시리즈.</p>
        </div>
        <div className="simok-hero-image" style={{ minHeight: 220 }}>
          <img src="/simok/atelier.png" alt="나무와 식물이 놓인 시목 작업실 연출 이미지" />
          <div className="simok-hero-credit">연출 참고 이미지 · 실제 제품/고객 사진 아님</div>
        </div>
      </div>

      <div className="simok-banner info">
        <strong>시즌 계획은 아직 데이터가 아니에요</strong>
        <span>
          위 시즌 문구는 코드에 적힌 값이에요. <code>campaigns</code> · <code>experiments</code> 테이블이 없어서
          취향별 시즌·가설·대표 제품을 저장할 자리가 아직 없습니다. 다음 작업의 마이그레이션 대상이에요.
        </span>
      </div>

      <SectionHead title="기록된 가설·배운 것" sub="회사 기억에서" />
      {err && <ErrorBox message={err} retryable onRetry={() => setTick(t => t + 1)} />}
      {!err && !memos && <Loading rows={3} label="회사 기억 불러오는 중" />}
      {!err && memos && memos.length === 0 && (
        <Empty title="기록된 실험·인사이트가 없어요">
          회사 기억에 실험·깨달음을 남기면 여기서 취향 가설로 이어 볼 수 있어요.
        </Empty>
      )}
      {!err && memos && memos.length > 0 && (
        <div className="simok-board">
          {memos.slice(0, 9).map(m => (
            <article key={m.id} className="simok-work-card">
              <span className="simok-pill paper">{m.kind === 'experiment' ? '실험' : '깨달음'}</span>
              <h3>{m.title}</h3>
              {(m.summary || m.body) && <p>{(m.summary || m.body || '').slice(0, 160)}</p>}
              {m.tags && m.tags.length > 0 && (
                <div className="simok-work-meta">
                  {m.tags.slice(0, 4).map(t => <span key={t} className="simok-pill">{t}</span>)}
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      <Note>
        <strong>지금은 읽기 전용입니다.</strong><br />
        시즌 편집·취향별 대표 제품 연결은 <code>campaigns</code>/<code>experiments</code> 구조가 생긴 뒤에 붙입니다.
        동작하지 않는 편집 버튼을 먼저 두지 않아요.
      </Note>
    </>
  );
}
