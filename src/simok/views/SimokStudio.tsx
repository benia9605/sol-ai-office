/**
 * @file src/simok/views/SimokStudio.tsx
 * @description 콘텐츠 제작실 — 전체 / 시목 차례 / GPT 담당 필터 + 현재·다음 담당 표시
 *
 * 기준: 11_SIMOK_OFFICE_BUILD_PACK.md §4·§6, 08_ROLES_AND_HANDOFFS.md §"제작실",
 *       preview/index.html #view-studio
 *
 * ★ 08 문서의 핵심 요구
 *   "작성자가 GPT여도 검토 대기 단계의 현재 담당은 시목이다.
 *    누가 만들었는지와 지금 누가 움직여야 하는지를 구별한다."
 *
 * ⚠️ 지금의 한계를 숨기지 않는다
 *   `content_items` 에는 아직 `current_actor` / `next_actor` / `review_status` / 버전 테이블이 없다.
 *   그래서 **담당은 기존 status 에서 유도**하고, 그 사실을 화면에 적는다.
 *   필터는 그 유도 규칙 위에서 동작한다. 저장되는 업무 상태 필드는 다음 마이그레이션 대상이다.
 *
 * provider(모델 API)를 호출하지 않는다.
 */
import { useEffect, useState } from 'react';
import { SimokViewProps } from '../SimokShell';
import { Empty, ErrorBox, Loading, Note, RoleBadge, SectionHead, Actor } from '../ui';
import { fetchContentItems } from '../../services/contentItems.service';
import { ContentItem, ContentStatus } from '../../types';

type Who = 'all' | 'human' | 'gpt';

const WHO_FILTERS: { key: Who; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'human', label: '시목 차례' },
  { key: 'gpt', label: 'GPT 담당' },
];

const STATUS_LABEL: Record<string, string> = {
  idea: '아이디어', approved: '승인됨', scripted: '원고 완료', shooting: '촬영',
  editing: '편집', scheduled: '발행 예정', published: '발행됨', archived: '보관',
};

/**
 * 현재 담당 유도 규칙 (저장된 필드가 없으므로 status 에서 추론).
 * 08 문서: "역할은 모델의 문장으로 추론하지 말고 업무 상태 데이터로 저장한다."
 * → 지금은 **업무 상태(status)** 에서 유도하므로 그 조건은 지키지만, 전용 필드가 생기면 그걸 쓴다.
 */
function derive(status: ContentStatus | undefined): { current: Actor; currentHow: string; next: string } {
  switch (status) {
    case 'idea':
      return { current: 'human', currentHow: '할지 말지 판단', next: '정하면 GPT 가 원고 초안' };
    case 'approved':
      return { current: 'gpt', currentHow: '원고·촬영안 준비', next: '초안이 오면 시목이 검토' };
    case 'scripted':
      return { current: 'human', currentHow: '원고 검토·사실 확인', next: '확인되면 촬영' };
    case 'shooting':
      return { current: 'human', currentHow: '실제 촬영', next: '촬영물이 생기면 편집' };
    case 'editing':
      return { current: 'human', currentHow: '편집·최종 확인', next: '완성되면 발행 예약' };
    case 'scheduled':
      return { current: 'human', currentHow: '게시 실행', next: '게시 후 앱이 성과 기록' };
    case 'published':
      return { current: 'system', currentHow: '성과 수집·보관', next: 'GPT 가 리뷰' };
    case 'archived':
      return { current: 'system', currentHow: '보관됨', next: '수정하면 새 검토 대상' };
    default:
      return { current: 'human', currentHow: '상태 확인 필요', next: '—' };
  }
}

export function SimokStudio({ workspace, go }: SimokViewProps) {
  const [items, setItems] = useState<ContentItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [who, setWho] = useState<Who>('all');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setErr(null); setItems(null);
    fetchContentItems(workspace.id)
      .then(r => { if (alive) setItems(r); })
      .catch(e => { if (alive) setErr(e instanceof Error ? e.message : String(e)); });
    return () => { alive = false; };
  }, [workspace.id, tick]);

  const shown = (items ?? []).filter(it => {
    if (who === 'all') return true;
    const d = derive(it.status);
    return who === 'human' ? d.current === 'human' : d.current === 'gpt';
  });

  const humanCount = (items ?? []).filter(it => derive(it.status).current === 'human').length;

  return (
    <>
      <p className="simok-page-intro">하나의 질문이 한 편의 콘텐츠가 되고, 다음 실험의 출발점이 됩니다.</p>

      <SectionHead
        title="이번 주 제작 흐름"
        sub={items ? `${items.length}건 · 시목 차례 ${humanCount}건` : undefined}
      />

      <div className="simok-filters" role="group" aria-label="담당 필터">
        {WHO_FILTERS.map(f => (
          <button key={f.key} className="simok-filter" aria-pressed={who === f.key} onClick={() => setWho(f.key)}>
            {f.label}
          </button>
        ))}
      </div>

      {err && <ErrorBox message={`제작물을 불러오지 못했어요: ${err}`} retryable onRetry={() => setTick(t => t + 1)} />}
      {!err && !items && <Loading rows={4} label="제작물 불러오는 중" />}

      {!err && items && shown.length === 0 && (
        <Empty title={items.length === 0 ? '등록된 제작물이 없어요' : '이 필터에 맞는 제작물이 없어요'}>
          {items.length === 0
            ? '콘텐츠를 등록하면 원고·촬영·검토·발행 단계가 여기서 이어져요.'
            : '다른 필터를 눌러보세요.'}
        </Empty>
      )}

      {!err && shown.length > 0 && (
        <div className="simok-board">
          {shown.map(it => {
            const d = derive(it.status);
            return (
              <article key={it.id} className="simok-work-card">
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className="simok-pill paper">{STATUS_LABEL[it.status ?? ''] ?? it.status}</span>
                  {it.channel && <span className="simok-pill blue">{it.channel}</span>}
                </div>
                <h3>{it.title}</h3>
                {it.hook && <p>{it.hook}</p>}

                <div className="simok-work-meta">
                  {/* 지금 누가 움직여야 하는가 */}
                  <RoleBadge actor={d.current} how={d.currentHow} />
                </div>
                <p style={{ marginTop: 8, fontSize: 10 }}>
                  <span style={{ color: 'var(--muted)' }}>다음 — </span>{d.next}
                </p>

                {/* 만든 사람과 지금 담당자를 구별 (08 검수기준 3) */}
                {it.owner && (
                  <p style={{ marginTop: 6, fontSize: 10, color: 'var(--muted)' }}>
                    등록·작성 {it.owner}
                  </p>
                )}

                {it.status === 'published' && it.url && (
                  <a className="simok-btn text" style={{ marginTop: 10, textDecoration: 'underline' }}
                    href={it.url} target="_blank" rel="noreferrer">
                    실제 게시물 보기 ↗
                  </a>
                )}
                {it.status === 'scheduled' && (
                  <p style={{ marginTop: 10, fontSize: 10, color: 'var(--muted)' }}>
                    예약은 게시 완료가 아니에요. 게시 후 실제 URL 을 저장해야 보관으로 넘어가요.
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}

      <Note>
        <strong>지금 화면의 담당은 업무 상태에서 유도한 값입니다.</strong><br />
        <code>current_actor</code> · <code>next_actor</code> · <code>review_status</code> ·
        <code>reviewed_version</code> 같은 필드가 아직 <code>content_items</code> 에 없어요(08 문서 제안 필드).
        그래서 원고 버전 보존·승인본 immutable·보관본 수정 시 재검토 같은 동작은 아직 구현되지 않았습니다.
        다음 작업에서 전용 마이그레이션으로 추가하고 이 유도 규칙을 대체할 예정이에요.
        <br />
        <button className="simok-btn text" style={{ marginTop: 10, textDecoration: 'underline' }} onClick={() => go('workflow')}>
          역할·업무 지도에서 8단계 보기 ↗
        </button>
      </Note>
    </>
  );
}
