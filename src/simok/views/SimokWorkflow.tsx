/**
 * @file src/simok/views/SimokWorkflow.tsx
 * @description 역할 · 업무 지도 — 8단계와 담당·시작조건·산출물·다음담당
 *
 * 기준: 08_ROLES_AND_HANDOFFS.md, 11_SIMOK_OFFICE_BUILD_PACK.md §4
 *
 * ★ 중요: 이건 **운영 설계 지도**다. 실시간 job 진행률이 아니다(08 문서가 명시).
 *   그래서 단계마다 "설계" 와 "지금 상태" 를 따로 적는다.
 */
import { useState } from 'react';
import { SimokViewProps } from '../SimokShell';
import { Note, RoleBadge, SectionHead, Actor } from '../ui';

interface Step {
  n: string; title: string; actor: Actor; how: string;
  start: string; output: string; next: string;
  /** 지금 실제로 가동되는가 — 관측 가능한 사실만 */
  live: 'yes' | 'no' | 'partial';
  liveNote: string;
}

const STEPS: Step[] = [
  {
    n: '01', title: '하루 데이터 집계·수신', actor: 'system', how: '앱 자동 처리',
    start: '시목 앱이 하루 원장을 마감', output: '버전 있는 snapshot(원문 + revision)',
    next: 'GPT 가 분석',
    live: 'partial',
    liveNote: 'Office 수신·저장 코드와 DB 는 준비됨. 시목 daily-snapshot 조회가 연결되지 않아 실제 수신 0건.',
  },
  {
    n: '02', title: '분석 · 주제 제안', actor: 'gpt', how: '자동 준비',
    start: '수신된 집계와 품질', output: '브리핑 초안 · 주제·실험 제안',
    next: '시목이 범위 결정',
    live: 'no',
    liveNote: '구독 GPT/Codex 예약이 등록되지 않았고 Office 조회 API 도 아직 없음.',
  },
  {
    n: '03', title: '이번 작업 범위 결정', actor: 'human', how: '사람이 판단',
    start: 'GPT 제안이 도착', output: '집중 상품·예산·실험 목적',
    next: 'GPT 가 원고·촬영안',
    live: 'partial',
    liveNote: '보고서 상세에서 제안을 과제로 승인하는 경로는 동작함.',
  },
  {
    n: '04', title: '원고 · 촬영안 · 시안', actor: 'gpt', how: '자동 준비',
    start: '결정된 범위', output: '원고 · 컷 리스트 · 이미지 시안',
    next: '시목이 실물 촬영·검토',
    live: 'no',
    liveNote: '외부 GPT 초안 저장 경로 미구현.',
  },
  {
    n: '05', title: '실물 촬영 · 사실 확인', actor: 'human', how: '사람이 수행',
    start: '원고와 촬영안', output: '실제 사진 · 확인된 사실',
    next: '최종본 검토',
    live: 'partial',
    liveNote: '제작실에서 상태를 옮길 수 있음. 버전·검토 기록 필드는 아직 없음.',
  },
  {
    n: '06', title: '최종본 검토', actor: 'human', how: '사람이 검토',
    start: '촬영물·수정 원고', output: '확인한 버전',
    next: '게시 실행',
    live: 'no',
    liveNote: 'review_status · reviewed_version 필드가 없어 "확인한 버전" 을 고정할 수 없음.',
  },
  {
    n: '07', title: '게시 · 현장 응대', actor: 'human', how: '사람이 실행',
    start: '검토된 최종본', output: '실제 게시 URL',
    next: '앱이 성과 기록',
    live: 'partial',
    liveNote: '게시 URL 을 저장할 수 있음. 자동 게시는 구현하지 않음(권한·규칙 별도).',
  },
  {
    n: '08', title: '결과물 · 성과 기록', actor: 'system', how: '앱 자동 처리',
    start: '게시 확인', output: '성과 스냅샷 · 아카이브',
    next: 'GPT 가 리뷰 → 03 으로',
    live: 'partial',
    liveNote: '콘텐츠 성과 입력은 가능. 방문·유입 수집은 연결 전.',
  },
];

export function SimokWorkflow({ workspace: _ws, go }: SimokViewProps) {
  const [open, setOpen] = useState<string | null>('01');
  return (
    <>
      <p className="simok-page-intro">GPT가 준비하고, 시목이 판단하고, 앱이 기록합니다. 다음 차례까지 분명하게.</p>

      <div className="simok-card" style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <RoleBadge actor="gpt" />
          <RoleBadge actor="human" />
          <RoleBadge actor="system" />
        </div>
        <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 12, lineHeight: 1.85 }}>
          ‘시목’은 사람(대표·남편)을, ‘앱’은 시스템을 뜻해요. 색만으로 구별하지 않고 역할을 글로 함께 씁니다.
        </p>
      </div>

      <div className="simok-banner info">
        <strong>운영 설계 지도</strong>
        <span>실시간 작업 진행률이 아니에요. 각 단계의 ‘지금 상태’ 는 관측 가능한 사실만 적었습니다.</span>
      </div>

      <SectionHead title="한 편의 콘텐츠가 만들어지는 순서" />
      <div style={{ display: 'grid', gap: 2 }}>
        {STEPS.map((s, i) => {
          const isOpen = open === s.n;
          return (
            <div key={s.n} className="simok-card" style={{ padding: 0, borderRadius: 9, borderTop: i ? undefined : undefined }}>
              <button
                onClick={() => setOpen(isOpen ? null : s.n)}
                aria-expanded={isOpen}
                style={{ width: '100%', textAlign: 'left', padding: '15px 18px', display: 'grid', gridTemplateColumns: '34px 1fr auto auto', gap: 14, alignItems: 'center' }}
              >
                <span style={{ fontFamily: 'Georgia, serif', opacity: .45 }}>{s.n}</span>
                <span style={{ fontSize: 13 }}>{s.title}</span>
                <RoleBadge actor={s.actor} how={s.how} />
                <span className={`simok-pill ${s.live === 'yes' ? '' : s.live === 'partial' ? 'amber' : 'paper'}`}>
                  {s.live === 'yes' ? '가동' : s.live === 'partial' ? '일부' : '미가동'}
                </span>
              </button>
              {isOpen && (
                <div style={{ padding: '0 18px 18px', borderTop: '1px solid var(--line)', marginTop: -1, paddingTop: 14 }}>
                  <dl className="simok-dl">
                    <dt>시작 조건</dt><dd>{s.start}</dd>
                    <dt>산출물</dt><dd>{s.output}</dd>
                    <dt>다음 담당</dt><dd>{s.next}</dd>
                    <dt>지금 상태</dt><dd>{s.liveNote}</dd>
                  </dl>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Note>
        <strong>검토를 기다리는 동안에도 준비할 수 있는 일은 계속합니다.</strong><br />
        GPT 는 자료 조사·다른 초안을 준비할 수 있어요. 실제 게시와 운영 변경은 해당 버전의 사람 검토·실행 단계에서 처리합니다.
        <br />
        <button className="simok-btn text" style={{ marginTop: 10, textDecoration: 'underline' }} onClick={() => go('connections')}>
          연결 단계 자세히 보기 ↗
        </button>
      </Note>
    </>
  );
}
