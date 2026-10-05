/**
 * @file src/simok/views/SimokConnections.tsx
 * @description 연결 상태 — 코드준비 / 배포 / 연결 / 수신을 **구별**해서 보여준다
 *
 * 기준: 11_SIMOK_OFFICE_BUILD_PACK.md §4, 06_UI_SPEC.md "연결 상태",
 *       GPT_INTEGRATION_round2 §2 ("코드준비/배포/연결/수신을 구별")
 *
 * ★ 이 화면의 목적은 "되는 척" 을 못 하게 만드는 것이다.
 *   실제 수신된 snapshot 과 실패 기록을 DB 에서 읽고, 아직 아닌 단계는 아니라고 적는다.
 */
import { useEffect, useState } from 'react';
import { SimokViewProps } from '../SimokShell';
import { Empty, ErrorBox, Loading, Note, SectionHead } from '../ui';
import { ConnectionHealth, fetchConnectionHealth, fetchSnapshotProjections } from '../../services/sourceSnapshots.service';
import { SnapshotProjection } from '../../contracts/projection';

/** 단계 — 관측 가능한 근거가 있을 때만 '완료' 로 표시한다 */
type Stage = { label: string; state: 'done' | 'pending' | 'unknown'; detail: string };

export function SimokConnections({ workspace }: SimokViewProps) {
  const [health, setHealth] = useState<ConnectionHealth | null>(null);
  const [recent, setRecent] = useState<SnapshotProjection[]>([]);
  const [validation, setValidation] = useState<SnapshotProjection[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setErr(null); setHealth(null);
    const to = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
    const from = new Date(Date.now() + 9 * 3600 * 1000 - 30 * 86400 * 1000).toISOString().slice(0, 10);
    (async () => {
      try {
        const [h, ops, val] = await Promise.all([
          fetchConnectionHealth(workspace.id),
          fetchSnapshotProjections(workspace.id, from, to).catch(() => []),
          // 검증용 자료는 운영 집계와 **분리해서** 따로 센다 (계약 §2)
          fetchSnapshotProjections(workspace.id, from, to, { usage: 'validation' }).catch(() => []),
        ]);
        if (!alive) return;
        setHealth(h); setRecent(ops); setValidation(val);
      } catch (e) {
        if (alive) setErr(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { alive = false; };
  }, [workspace.id, tick]);

  const received = recent.length + validation.length;

  const stages: Stage[] = [
    {
      label: '코드 준비',
      state: 'done',
      detail: '계약 0.2.0 검증기·canonical digest·수신 저장소가 구현돼 있어요.',
    },
    {
      label: 'DB 구조 적용',
      state: 'done',
      detail: 'source_snapshots · latest pointer · 실패 원장 테이블이 운영 DB 에 있어요.',
    },
    {
      label: '원천 연결',
      state: workspace.erpSource === 'simok_api' ? 'done' : 'pending',
      detail: workspace.erpSource === 'simok_api'
        ? '이 워크스페이스는 시목 ERP 조회로 설정돼 있어요.'
        : '아직 수기 입력(Compatibility) 모드예요.',
    },
    {
      label: '하루 snapshot 수신',
      state: received > 0 ? 'done' : 'pending',
      detail: received > 0
        ? `최근 30일에 ${received}건 수신 (운영 ${recent.length} · 검증용 ${validation.length})`
        : '아직 한 건도 수신되지 않았어요. 시목 앱의 daily-snapshot 조회가 연결되면 쌓여요.',
    },
    {
      label: 'GPT 조회·초안 저장',
      state: 'pending',
      detail: 'context 조회와 초안 저장 경로는 아직 만들지 않았어요.',
    },
    {
      label: '예약 실행',
      state: 'pending',
      detail: '구독 GPT/Codex 예약은 등록되지 않았어요. 자동으로 돌고 있는 작업이 없습니다.',
    },
  ];

  return (
    <>
      <p className="simok-page-intro">세 역할이 같은 기록을 보도록. 연결은 작게 시작해 한 번의 왕복부터 확인합니다.</p>

      <SectionHead title="어디까지 됐나" sub="코드 준비 ≠ 배포 ≠ 연결 ≠ 실제 수신" />
      <div className="simok-card">
        <ol style={{ display: 'grid', gap: 2 }}>
          {stages.map((s, i) => (
            <li key={s.label} style={{ display: 'grid', gridTemplateColumns: '34px 1fr auto', gap: 14, alignItems: 'start', padding: '13px 0', borderTop: i ? '1px solid var(--line)' : undefined }}>
              <span style={{ fontFamily: 'Georgia, serif', opacity: .45, fontSize: 13 }}>{String(i + 1).padStart(2, '0')}</span>
              <div>
                <div style={{ fontSize: 13 }}>{s.label}</div>
                <p style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4, lineHeight: 1.8 }}>{s.detail}</p>
              </div>
              <span className={`simok-pill ${s.state === 'done' ? '' : 'amber'}`}>
                {s.state === 'done' ? '확인됨' : '대기'}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <SectionHead title="수신 기록" />
      {err && <ErrorBox message={err} retryable onRetry={() => setTick(t => t + 1)} />}
      {!err && !health && <Loading rows={3} label="수신 기록 불러오는 중" />}
      {!err && health && (
        health.lastReceivedAt ? (
          <div className="simok-card">
            <dl className="simok-dl">
              <dt>마지막 수신</dt><dd>{health.lastReceivedAt.slice(0, 16).replace('T', ' ')}</dd>
              <dt>업무 날짜</dt><dd>{health.lastBusinessDate}</dd>
              <dt>revision</dt><dd>r{health.lastRevision}</dd>
            </dl>
          </div>
        ) : (
          <Empty title="수신된 snapshot 이 없어요">
            이 상태에서는 매출·순수납을 <strong>0으로 표시하지 않습니다.</strong> 모른다고 표시해요.
          </Empty>
        )
      )}

      <SectionHead title="실패·불완전 기록" sub="에러를 0이나 빈 목록으로 바꾸지 않아요" />
      {health && (health.recentErrors.length === 0 ? (
        <Empty title="기록된 실패가 없어요">수신 시도 자체가 없으면 실패도 없어요. 위 단계를 함께 보세요.</Empty>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {health.recentErrors.map((e, i) => (
            <div key={i} className="simok-work-card">
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="simok-pill rose">{e.code}</span>
                <span className="simok-pill paper">{e.retryable ? '재시도 가능' : '설정 확인 필요'}</span>
                <span style={{ fontSize: 10, color: 'var(--muted)' }}>{e.createdAt?.slice(0, 16).replace('T', ' ')}</span>
              </div>
              <p style={{ marginTop: 8 }}>{e.message}</p>
            </div>
          ))}
        </div>
      ))}

      <Note>
        <strong>재처리 버튼은 아직 없습니다.</strong><br />
        계약 §7.8 의 멱등성·권한 검증을 갖춘 재시도 경로를 만든 뒤에 붙일 거예요.
        지금 버튼을 두면 "눌렀는데 아무 일도 안 일어나는" 상태가 되니까요.
      </Note>
    </>
  );
}
