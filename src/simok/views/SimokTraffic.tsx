/**
 * @file src/simok/views/SimokTraffic.tsx
 * @description 방문 · 유입 — WEB-O2
 *
 * 기준: 10_WEB_ANALYTICS_PLAN.md §5·§6, 11_SIMOK_OFFICE_BUILD_PACK.md §4
 *
 * ★ 이 화면이 지켜야 하는 것 (10 문서)
 *   - GA 관측 지표와 **원장 주문 집계를 섞지 않는다.** 별도 블록으로 둔다.
 *   - "실제 전체 주문 ÷ GA 관측 방문자" 를 구매 전환율로 표시하지 않는다.
 *   - 연결률은 **‘주문 유입 연결률’** 로만 표시한다(구매 전환율 아님). 분모 0 이면 null.
 *   - 수집 시작 전 기간을 0 으로 채우지 않는다. collection_started_at 이전은 '수집 전' 이다.
 *   - GA4 는 처리 중 값이 바뀐다 → freshness(잠정/재조회) 를 표시한다.
 *   - 직접/미상은 '직접 또는 경로 미상' 으로 쓴다.
 */
import { useEffect, useState } from 'react';
import { SimokViewProps } from '../SimokShell';
import { Empty, ErrorBox, Loading, MetricCard, Note, ProvisionalBanner, SectionHead, ValidationBanner } from '../ui';
import { WebAnalyticsRecord, fetchWebAnalytics } from '../../services/webAnalytics.service';

const RANGES = [
  { key: '7', label: '최근 7일' },
  { key: '28', label: '최근 28일' },
] as const;

function kst(offsetDays = 0): string {
  return new Date(Date.now() + 9 * 3600 * 1000 + offsetDays * 86400 * 1000).toISOString().slice(0, 10);
}

export function SimokTraffic({ workspace, go }: SimokViewProps) {
  const [days, setDays] = useState<'7' | '28'>('7');
  const [rec, setRec] = useState<WebAnalyticsRecord[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setErr(null); setRec(null);
    fetchWebAnalytics(workspace.id, kst(-Number(days) + 1), kst(0))
      .then(r => { if (alive) setRec(r); })
      .catch(e => { if (alive) setErr(e instanceof Error ? e.message : String(e)); });
    return () => { alive = false; };
  }, [workspace.id, days, tick]);

  const latest = rec?.[0] ?? null;

  return (
    <>
      <p className="simok-page-intro">
        누가 어디서 왔고, 어떤 게시물이 상품으로 이어졌는지. 관측된 범위만 보여줍니다.
      </p>

      <div className="simok-filters" role="group" aria-label="기간">
        {RANGES.map(r => (
          <button key={r.key} className="simok-filter" aria-pressed={days === r.key} onClick={() => setDays(r.key)}>
            {r.label}
          </button>
        ))}
      </div>

      {err && <ErrorBox message={`방문 기록을 불러오지 못했어요: ${err}`} retryable onRetry={() => setTick(t => t + 1)} />}
      {!err && !rec && <Loading rows={3} label="방문 기록 불러오는 중" />}

      {!err && rec && rec.length === 0 && (
        <>
          <Empty title="아직 수집된 방문 기록이 없어요">
            웹 계측이 연결되면 관측 방문자·세션·페이지 조회와 유입 경로가 여기 쌓여요.
            <br />
            <strong>수집 시작 전 기간을 0 으로 채우지 않습니다.</strong> 과거 유입은 만들어 낼 수 없어요.
          </Empty>
          <SectionHead title="연결에 필요한 것" />
          <div className="simok-card">
            <p style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.9 }}>
              Office 쪽 보관·화면은 준비됐고(WEB-O1·O2), 수집은 시목 앱 담당이에요(WEB-S1~S3).
            </p>
            <ul style={{ marginTop: 12, display: 'grid', gap: 8, fontSize: 11 }}>
              <li>· 시목 앱에 GA4 단일 태그·상품/장바구니/결제 이벤트 (WEB-S1)</li>
              <li>· UTM 등록부 + 서버가 고정하는 attribution_ref (WEB-S2)</li>
              <li>· <code>GET /api/erp/v1/web-analytics</code> 집계 어댑터 (WEB-S3)</li>
              <li>· GA4 property ID·읽기 credential — 서버 secret 에만 둡니다</li>
            </ul>
            <p style={{ fontSize: 10, color: 'var(--muted)', marginTop: 14, lineHeight: 1.8 }}>
              GA4 Measurement ID 와 Data API property ID 는 다른 값이에요. 둘 다 이 문서에 적지 않고
              서버 secret 으로 관리합니다.
            </p>
          </div>
        </>
      )}

      {!err && latest && (
        <>
          {latest.usage === 'validation' && <ValidationBanner note="검증용 집계예요. 운영 보고에 쓰지 않습니다." />}
          {latest.freshness === 'provisional' && (
            <ProvisionalBanner note={`GA4 는 처리 중 값이 바뀔 수 있어요. 이 수치는 잠정이고 D+2·D+7 에 재조회해 정정합니다. (원천 데이터 기준 ${latest.sourceDataThrough ?? '미상'})`} />
          )}

          <SectionHead title="관측된 방문" sub={`${latest.periodStart} ~ ${latest.periodEnd} · KST`} />
          {latest.gaStatus !== 'complete' && (
            <div className="simok-banner info" style={{ marginBottom: 14 }}>
              <strong>{latest.gaStatus === 'missing' ? 'GA 미연결' : 'GA 일부만'}</strong>
              <span>{latest.gaReason ?? '방문 지표를 수집하지 못했어요.'} — 숫자를 0으로 채우지 않습니다.</span>
            </div>
          )}
          <div className="simok-metrics">
            <MetricCard label="관측 방문자" value={latest.totalUsers} unit="명"
              note="웹 stream 한정 · 일별을 더해 주간 고유 방문자로 만들지 않아요" />
            <MetricCard label="방문 횟수" value={latest.sessions} unit="회" />
            <MetricCard label="페이지 조회" value={latest.pageViews} unit="회" />
          </div>

          <SectionHead title="어디서 왔나" sub="GA 세션 차원" />
          {latest.sources.length === 0 ? (
            <Empty title="유입 경로가 집계되지 않았어요">
              {latest.gaStatus !== 'complete'
                ? 'GA 방문 수집이 연결되지 않아 경로 분해가 없어요. 아래 주문 유입 연결은 우리 원장만으로 계산한 값이라 그대로 볼 수 있어요.'
                : '같은 기간에 관측된 세션이 없거나 수집 범위 밖이에요.'}
            </Empty>
          ) : (
            <div className="simok-card">
              <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--muted)' }}>
                    <th style={{ padding: '6px 0', fontWeight: 400 }}>경로</th>
                    <th style={{ padding: '6px 0', fontWeight: 400, textAlign: 'right' }}>세션</th>
                  </tr>
                </thead>
                <tbody>
                  {latest.sources.map(s => (
                    <tr key={s.sourceMedium} style={{ borderTop: '1px solid var(--line)' }}>
                      <td style={{ padding: '9px 0' }}>
                        {s.sourceMedium === '(direct) / (none)' ? '직접 또는 경로 미상' : s.sourceMedium}
                      </td>
                      <td style={{ padding: '9px 0', textAlign: 'right' }}>{s.sessions.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ★ 원장 주문은 **별도 블록** — GA 구매 합으로 원장 매출을 대체하지 않는다 */}
          <SectionHead title="주문 유입 연결" sub="금액·주문 수는 시목 원장 기준" />
          <div className="simok-metrics">
            <MetricCard label="웹 결제 주문" value={latest.webPaidOrders} unit="건" note="최초 성공 결제일 기준 · 자사몰만" />
            <MetricCard label="유입 확인됨" value={latest.attributedOrders} unit="건"
              note={latest.attributionModel ? `규칙 ${latest.attributionModel}` : undefined} />
            <MetricCard
              label="주문 유입 연결률"
              value={latest.attributionRate}
              unit="%"
              note="구매 전환율이 아니에요. 유입 참조가 남은 주문의 비율입니다"
            />
          </div>

          {latest.byAttribution.length > 0 && (
            <div className="simok-card" style={{ marginTop: 14 }}>
              <div className="simok-eyebrow">콘텐츠·경로별 (우리 원장)</div>
              <table style={{ width: '100%', marginTop: 12, fontSize: 11, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--muted)' }}>
                    <th style={{ padding: '6px 0', fontWeight: 400 }}>경로</th>
                    <th style={{ padding: '6px 0', fontWeight: 400 }}>콘텐츠</th>
                    <th style={{ padding: '6px 0', fontWeight: 400, textAlign: 'right' }}>주문</th>
                    <th style={{ padding: '6px 0', fontWeight: 400, textAlign: 'right' }}>상품 수납</th>
                  </tr>
                </thead>
                <tbody>
                  {latest.byAttribution.map((a, i) => (
                    <tr key={i} style={{ borderTop: '1px solid var(--line)' }}>
                      <td style={{ padding: '9px 0' }}>{a.source} / {a.medium}</td>
                      <td style={{ padding: '9px 0', color: 'var(--muted)' }}>{a.content ?? '—'}</td>
                      <td style={{ padding: '9px 0', textAlign: 'right' }}>{a.orders.toLocaleString()}</td>
                      <td style={{ padding: '9px 0', textAlign: 'right' }}>
                        {a.merchandise_captured_krw != null ? a.merchandise_captured_krw.toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {latest.unattributedByReason.length > 0 && (
            <div className="simok-card" style={{ marginTop: 14 }}>
              <div className="simok-eyebrow">유입을 모르는 주문</div>
              <ul style={{ marginTop: 10, display: 'grid', gap: 8, fontSize: 11 }}>
                {latest.unattributedByReason.map((u, i) => (
                  <li key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <span>
                      {u.reason === 'direct_or_unknown' ? '직접 또는 경로 미상'
                        : u.reason === 'consent_denied' ? '동의하지 않음'
                        : u.reason === 'no_ref' ? '유입 참조 없음'
                        : u.reason}
                    </span>
                    <strong>{u.orders.toLocaleString()}건</strong>
                  </li>
                ))}
              </ul>
              <p style={{ fontSize: 10, color: 'var(--muted)', marginTop: 12, lineHeight: 1.8 }}>
                「직접 또는 경로 미상」에는 링크 복사·앱 내 이동 등이 섞여 있어요. 직접 방문이라고 단정하지 않습니다.
              </p>
            </div>
          )}

          {latest.limitations.length > 0 && (
            <>
              <SectionHead title="이 수치의 한계" />
              <div className="simok-card">
                <ul style={{ display: 'grid', gap: 8, fontSize: 11, color: 'var(--muted)' }}>
                  {latest.limitations.map((l, i) => <li key={i}>· {l}</li>)}
                </ul>
              </div>
            </>
          )}
        </>
      )}

      <Note>
        <strong>방문 계측은 사람 수의 증명이 아니에요.</strong><br />
        브라우저·동의·차단·기기 변경으로 관측 범위가 달라집니다. 그래서 GA 관측값과 원장 수납을 따로 두고,
        특정 게시물이 구매를 "만들었다"고 단정하지 않아요. 콘텐츠별 연결은{' '}
        <button className="simok-btn text" style={{ textDecoration: 'underline' }} onClick={() => go('studio')}>제작실 ↗</button>
        에서 이어집니다.
      </Note>
    </>
  );
}
