/**
 * @file src/simok/views/SimokToday.tsx
 * @description 오늘의 시목 — 시즌 히어로 · 역할 요약 · 어제의 기록 · GPT 초안 · 시목 차례
 *
 * 기준: 11_SIMOK_OFFICE_BUILD_PACK.md §4·§5, preview/index.html #view-today
 *
 * ★ 읽히는 순서 (BUILD_PACK §5)
 *   브랜드 장면·시즌 → 어제의 **확인된** 기록 → GPT 가 남긴 판단 → 오늘 사람이 이어갈 일 → 제작물
 *
 * ★ 정직성 규칙
 *   - 'GPT가 준비한 내용' 에는 **실제 저장된** 초안만 표시한다. 빈칸을 모델 호출로 채우지 않는다(D-007).
 *   - '앱 자동 처리' 는 관측된 상태만. 실행기 미연결에 '자동 운영중' 배지를 쓰지 않는다.
 *   - 돈 카드는 블록이 partial 이어도 **해당 필드가 complete 면 숫자를 보여주고** 미확인 항목을 부가설명한다.
 *   - 이 파일은 provider(모델 API)를 호출하지 않는다.
 */
import { useEffect, useState } from 'react';
import { SimokViewProps } from '../SimokShell';
import { Empty, ErrorBox, Loading, MetricCard, Note, RoleBadge, SectionHead, ValidationBanner } from '../ui';
import { SnapshotProjection } from '../../contracts/projection';
import { fetchSnapshotProjections } from '../../services/sourceSnapshots.service';
import { fetchReportsByWorkspace } from '../../services/dailyReports.service';
import { fetchWorkspaceTasks } from '../../services/tasks.service';
import { fetchActions } from '../../services/staffOutputActions.service';
import { DailyReport, TaskItem } from '../../types';
import { rowToTask } from '../mapRow';

/** KST 날짜 문자열 (브라우저 타임존과 무관하게) */
function kstDate(offsetDays = 0): string {
  const now = new Date(Date.now() + 9 * 3600 * 1000 + offsetDays * 86400 * 1000);
  return now.toISOString().slice(0, 10);
}

interface Loaded {
  snapshots: SnapshotProjection[];
  reports: DailyReport[];
  tasks: TaskItem[];
  pendingActions: number;
}

export function SimokToday({ workspace, go }: SimokViewProps) {
  const [data, setData] = useState<Loaded | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setErr(null); setData(null);
    (async () => {
      try {
        // 어제~오늘 범위의 최신 revision snapshot. 운영 조합(production+operational)이 기본.
        const [snapshots, reports, tasks, actions] = await Promise.all([
          fetchSnapshotProjections(workspace.id, kstDate(-2), kstDate(0)).catch(() => []),
          fetchReportsByWorkspace(workspace.id, 4).catch(() => []),
          fetchWorkspaceTasks(workspace.id).catch(() => []),
          fetchActions(workspace.id, 'suggested').catch(() => []),
        ]);
        if (!alive) return;
        setData({ snapshots, reports, tasks: tasks.map(rowToTask), pendingActions: actions.length });
      } catch (e) {
        if (alive) setErr(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { alive = false; };
  }, [workspace.id, tick]);

  // 가장 최근 업무일 snapshot (어제가 보통)
  const latest = data?.snapshots[0] ?? null;
  // 사람이 이어갈 일 = 미완료 할일 + 승인 대기 액션
  const humanTurn = (data?.tasks ?? []).filter(t => t.status !== 'completed');

  return (
    <>
      {/* ───── 시즌 히어로 ───── */}
      <div className="simok-hero">
        <div className="simok-hero-copy">
          <div className="simok-eyebrow">OCTOBER JOURNAL — PLANT &amp; SPACE</div>
          <h2>취향을 모으고,<br />다음 장면을 만들다.</h2>
          <p>
            식물이 놓인 작은 자리에서 시작하는 10월.<br />
            사람들의 제안이 시목의 다음 이야기가 됩니다.
          </p>
          <button className="simok-btn" onClick={() => go('tastes')}>
            이번 시즌 살펴보기 <span aria-hidden>↗</span>
          </button>
        </div>
        <div className="simok-hero-image">
          <img src="/simok/tea.png" alt="자연광 속 고재 테이블과 화병을 담은 시목 연출 이미지" />
          <div className="simok-hero-caption">GOOD THINGS TAKE TIME.</div>
          {/* PROVENANCE.md — 실물 SKU·고객 사진이 아니라 연출 참고 이미지다 */}
          <div className="simok-hero-credit">연출 참고 이미지 · 실제 제품/고객 사진 아님</div>
        </div>
      </div>

      {/* ───── 함께 일하는 방식 ───── */}
      <section className="simok-responsibility" aria-label="시목과 GPT의 역할">
        <div className="simok-responsibility-head">
          <h2>함께 일하는 방식</h2>
          <button className="simok-btn text" onClick={() => go('workflow')}>역할 지도 전체 ↗</button>
        </div>
        <div className="simok-responsibility-grid">
          <article>
            <RoleBadge actor="gpt" />
            <p>자료 분석 · 주제 제안 · 원고 초안<br />근거와 함께 다음 행동을 준비해요.</p>
          </article>
          <article>
            <RoleBadge actor="human" />
            <p>대표·남편의 판단 · 실제 촬영 · 최종 확인<br />지금 사람이 이어갈 일을 모아봐요.</p>
          </article>
          <article>
            <RoleBadge actor="system" />
            <p>시목 앱의 집계 → Office의 기록·연결<br />수집·보관 상태를 확인해요.</p>
          </article>
        </div>
        {/* 실행기 미연결 상태를 '자동 운영중' 으로 꾸미지 않는다 (BUILD_PACK §5) */}
        <p className="simok-automation-note">
          GPT 예약 실행은 아직 등록되지 않았어요. 지금 보이는 기록은 저장된 결과이고, 자동으로 돌고 있는 작업은 없어요.
        </p>
      </section>

      {/* ───── 어제의 기록 ───── */}
      <SectionHead
        title="어제의 기록"
        sub={latest ? `${latest.businessDate} · KST · 순수납 기준` : 'KST · 순수납 기준'}
        right={<button className="simok-btn text" onClick={() => go('connections')}>데이터 상태 <span aria-hidden>↗</span></button>}
      />

      {err && <ErrorBox message={`기록을 불러오지 못했어요: ${err}`} retryable onRetry={() => setTick(t => t + 1)} />}
      {!err && !data && <Loading rows={3} label="어제의 기록 불러오는 중" />}

      {!err && data && !latest && (
        <Empty title="아직 수신된 하루 집계가 없어요">
          시목 앱이 하루 snapshot 을 보내면 여기에 순수납·주문·상품이 나타나요.
          <br />숫자를 지어내지 않기 위해 비워 둡니다. 수신 상태는 ‘연결 상태’에서 볼 수 있어요.
        </Empty>
      )}

      {!err && latest && (
        <>
          {latest.showValidationBadge && <ValidationBanner />}
          <div className="simok-metrics">
            <MetricCard
              label="순수납"
              badge={latest.isOperational ? undefined : '검증용'}
              value={latest.totals.netCollected}
              note={
                latest.totals.captured.known && latest.totals.refunded.known
                  ? `결제 ${latest.totals.captured.value.toLocaleString()} − 환불 ${latest.totals.refunded.value.toLocaleString()} · 배송 포함`
                  : undefined
              }
            />
            <MetricCard
              label="수납"
              badge={latest.isOperational ? undefined : '검증용'}
              value={latest.totals.captured}
              note="배송비 포함 · 세금 포함 고객 결제 기준"
            />
            <MetricCard
              label="주문당 금액"
              value={
                latest.perOrderCaptured.known
                  ? { known: true, value: latest.perOrderCaptured.value }
                  : { known: false, status: 'partial', reason: latest.perOrderCaptured.reason }
              }
              note={
                latest.perOrderCaptured.known
                  ? `order 기준 채널만: ${latest.perOrderCaptured.channelIds.join(', ')}`
                  : undefined
              }
            />
          </div>

          {/* 채널별 — 전체가 unknown 이어도 아는 채널 값은 그 채널에 남긴다 (계약 §5) */}
          {latest.channels.length > 0 && (
            <div className="simok-card" style={{ marginBottom: 25 }}>
              <div className="simok-eyebrow">채널별 확인된 값</div>
              <table style={{ width: '100%', marginTop: 12, fontSize: 11, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--muted)' }}>
                    <th style={{ padding: '6px 0', fontWeight: 400 }}>채널</th>
                    <th style={{ padding: '6px 0', fontWeight: 400 }}>기준</th>
                    <th style={{ padding: '6px 0', fontWeight: 400, textAlign: 'right' }}>수납</th>
                    <th style={{ padding: '6px 0', fontWeight: 400, textAlign: 'right' }}>환불</th>
                    <th style={{ padding: '6px 0', fontWeight: 400, textAlign: 'right' }}>순수납</th>
                  </tr>
                </thead>
                <tbody>
                  {latest.channels.map(c => (
                    <tr key={c.channelId} style={{ borderTop: '1px solid var(--line)' }}>
                      <td style={{ padding: '9px 0' }}>{c.channelName}</td>
                      <td style={{ padding: '9px 0', color: 'var(--muted)' }}>
                        {c.ordersBasis === 'voucher' ? '전표' : '주문'}
                      </td>
                      <td style={{ padding: '9px 0', textAlign: 'right' }}>{c.captured.known ? c.captured.value.toLocaleString() : '—'}</td>
                      <td style={{ padding: '9px 0', textAlign: 'right' }}>{c.refunded.known ? c.refunded.value.toLocaleString() : '—'}</td>
                      <td style={{ padding: '9px 0', textAlign: 'right' }}>{c.netCollected.known ? c.netCollected.value.toLocaleString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {latest.channels.some(c => !c.refunded.known) && (
                <p style={{ fontSize: 10, color: 'var(--muted)', marginTop: 12, lineHeight: 1.8 }}>
                  일부 채널의 환불을 확인할 수 없어 <strong>전체 환불·순수납은 비워 둡니다.</strong>{' '}
                  확인된 채널의 값은 그 줄에 그대로 남아 있어요.
                </p>
              )}
            </div>
          )}
        </>
      )}

      {/* ───── GPT 가 남긴 판단 ───── */}
      <SectionHead
        title="GPT가 남긴 판단"
        right={<button className="simok-btn text" onClick={() => go('reports')}>보고서 전체 ↗</button>}
      />
      {!data && !err && <Loading rows={2} label="보고서 불러오는 중" />}
      {data && data.reports.length === 0 && (
        <Empty title="저장된 GPT 초안이 없어요">
          구독 GPT/Codex 가 보고서 초안을 저장하면 여기에 나타나요.
          <br />Office 는 초안을 <strong>만들지 않고</strong> 보관·검토만 해요.
        </Empty>
      )}
      {data && data.reports.length > 0 && (
        <div className="simok-grid-2">
          {data.reports.slice(0, 2).map(r => (
            <article key={r.id} className="simok-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="simok-eyebrow">{r.date}</span>
                {/* 실제 작성 주체를 남긴다 — GPT 가 새로 쓴 것처럼 표시하지 않는다 (BUILD_PACK §4) */}
                <span className="simok-pill paper">
                  {r.trigger === 'manual' ? '사람이 실행' : '예약 실행'}{r.model ? ` · ${r.model}` : ''}
                </span>
              </div>
              <h3 style={{ fontSize: 15, margin: '12px 0', lineHeight: 1.6 }}>{r.title}</h3>
              {r.summary && <p style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.85 }}>{r.summary}</p>}
              <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 10, color: 'var(--muted)' }}>
                  {r.status === 'failed' ? '실행 실패로 기록됨' : '저장된 산출물'}
                </span>
                <button className="simok-btn text" onClick={() => go('reports', r.id)}>읽기 <span aria-hidden>↗</span></button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* ───── 시목이 이어갈 차례 ───── */}
      <SectionHead
        title="시목이 이어갈 차례"
        sub="사람이 직접 하거나 판단할 일"
        right={<button className="simok-btn text" onClick={() => go('studio')}>제작실 ↗</button>}
      />
      {data && (
        <div className="simok-card">
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <RoleBadge actor="human" />
            <span style={{ fontSize: 12 }}>
              진행 중 할일 <strong>{humanTurn.length}건</strong>
              {data.pendingActions > 0 && <> · 승인 대기 <strong>{data.pendingActions}건</strong></>}
            </span>
          </div>
          {humanTurn.length === 0 && data.pendingActions === 0 ? (
            <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 14 }}>
              지금 사람이 이어갈 일로 등록된 게 없어요.
            </p>
          ) : (
            <ul style={{ marginTop: 14, display: 'grid', gap: 9 }}>
              {humanTurn.slice(0, 5).map(t => (
                <li key={t.id} style={{ display: 'flex', gap: 12, alignItems: 'baseline', fontSize: 12, borderTop: '1px solid var(--line)', paddingTop: 9 }}>
                  <span style={{ fontSize: 10, color: 'var(--muted)', minWidth: 54 }}>
                    {t.date || '기한 없음'}
                  </span>
                  <span style={{ flex: 1 }}>{t.title}</span>
                  {t.source === 'ai' && <span className="simok-pill paper">GPT 제안</span>}
                </li>
              ))}
            </ul>
          )}
          <button className="simok-btn" style={{ marginTop: 18 }} onClick={() => go('studio')}>
            제작실에서 이어가기 <span aria-hidden>↗</span>
          </button>
        </div>
      )}

      <Note>
        <strong>이 화면은 저장된 기록만 보여줍니다.</strong><br />
        Office 는 시목 workspace 에서 모델 API 를 호출하지 않아요(D-007). 조사·제작은 구독 GPT/Codex 가 하고,
        여기서는 그 결과를 보관·검토합니다.
      </Note>
    </>
  );
}
