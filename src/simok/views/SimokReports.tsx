/**
 * @file src/simok/views/SimokReports.tsx
 * @description 브리핑 · 보고서 — 목록 + 상세 (직접 URL 진입 지원)
 *
 * 기준: 11_SIMOK_OFFICE_BUILD_PACK.md §4·§6, preview/index.html #view-reports
 *
 * - 기존 `daily_reports` 를 그대로 읽는다. 새 플랫폼을 만들지 않는다.
 * - **옛 모델 생성 보고서에는 실제 작성 주체/실행일을 남긴다.** GPT 가 새로 쓴 것처럼 표시하지 않고,
 *   표시를 바꾸려고 예전 기록을 덮어쓰지도 않는다(BUILD_PACK §4).
 * - 본문은 `script` 로 실행하지 않고 안전하게 렌더한다(BUILD_PACK §8) — 기존 MarkdownView 재사용.
 * - 추천 → 과제 전환의 중복 방지는 기존 `staff_output_actions` 의 (report_id, action) 큐를 쓴다.
 * - provider(모델 API)를 호출하지 않는다.
 */
import { useEffect, useState } from 'react';
import { SimokViewProps } from '../SimokShell';
import { Empty, ErrorBox, Loading, Note, RoleBadge, SectionHead } from '../ui';
import { MarkdownView } from '../../components/office/MarkdownView';
import { fetchReportsByWorkspace, fetchReportById } from '../../services/dailyReports.service';
import { fetchActions, approveAction } from '../../services/staffOutputActions.service';
import { DailyReport, StaffOutputAction } from '../../types';
import { attributionOf, authorLabel, triggerLabel } from '../authorship';

type Filter = 'all' | 'manual' | 'auto' | 'failed';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'auto', label: '예약 실행' },
  { key: 'manual', label: '사람이 실행' },
  { key: 'failed', label: '실패 기록' },
];

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export function SimokReports({ workspace, detailId, go }: SimokViewProps) {
  if (detailId) return <ReportDetail workspace={workspace} reportId={detailId} go={go} />;
  return <ReportList workspace={workspace} go={go} />;
}

function ReportList({ workspace, go }: Omit<SimokViewProps, 'detailId'>) {
  const [reports, setReports] = useState<DailyReport[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setErr(null); setReports(null);
    fetchReportsByWorkspace(workspace.id, 40)
      .then(r => { if (alive) setReports(r); })
      .catch(e => { if (alive) setErr(e instanceof Error ? e.message : String(e)); });
    return () => { alive = false; };
  }, [workspace.id, tick]);

  const shown = (reports ?? []).filter(r =>
    filter === 'all' ? true
      : filter === 'failed' ? r.status === 'failed'
      : filter === 'manual' ? r.trigger === 'manual' && r.status !== 'failed'
      : r.trigger !== 'manual' && r.status !== 'failed');

  return (
    <>
      <p className="simok-page-intro">우리가 무엇을 보았고, 왜 그렇게 결정했는지. 판단의 근거를 남깁니다.</p>

      <div className="simok-filters" role="group" aria-label="보고서 필터">
        {FILTERS.map(f => (
          <button key={f.key} className="simok-filter" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
            {f.label}
          </button>
        ))}
      </div>

      {err && <ErrorBox message={`보고서를 불러오지 못했어요: ${err}`} retryable onRetry={() => setTick(t => t + 1)} />}
      {!err && !reports && <Loading rows={4} label="보고서 목록 불러오는 중" />}

      {!err && reports && shown.length === 0 && (
        <Empty title={reports.length === 0 ? '저장된 보고서가 없어요' : '이 필터에 맞는 보고서가 없어요'}>
          {reports.length === 0
            ? <>구독 GPT/Codex 가 보고서 초안을 저장하면 여기에 쌓여요. Office 는 초안을 <strong>만들지 않고</strong> 보관·검토만 해요.</>
            : '다른 필터를 눌러보세요.'}
        </Empty>
      )}

      {!err && shown.length > 0 && (
        <div className="simok-report-list">
          {shown.map(r => {
            const d = r.date?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            return (
              <button key={r.id} className="simok-report-row" onClick={() => go('reports', r.id)}>
                <div className="simok-report-date">
                  <div className="day">{d ? d[3] : '–'}</div>
                  <div className="month">{d ? MONTHS[Number(d[2]) - 1] : r.date}</div>
                </div>
                <div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* ★ 작성자와 실행 계기를 **분리**해서 표시 (GPT-R3-O3).
                        trigger 는 "어떻게 시작됐나" 일 뿐 "누가 썼나" 가 아니다. */}
                    {(() => {
                      const a = attributionOf(r);
                      const al = authorLabel(a.author);
                      return (
                        <>
                          <RoleBadge
                            actor={a.author.kind === 'human' ? 'human' : a.author.kind === 'external_gpt' ? 'gpt' : 'system'}
                            how={al.text === 'GPT' ? al.sub : `${al.text} · ${al.sub}`}
                          />
                          <span className="simok-pill paper">{triggerLabel(a.trigger)}</span>
                        </>
                      );
                    })()}
                    {r.status === 'failed' && <span className="simok-pill rose">실행 실패</span>}
                  </div>
                  <h3>{r.title}</h3>
                  {r.summary && <p>{r.summary}</p>}
                </div>
                <span className="simok-btn text" aria-hidden>읽기 ↗</span>
              </button>
            );
          })}
        </div>
      )}

      <Note>
        <strong>보고서의 끝은 다음 행동입니다.</strong><br />
        판단에서 과제로, 과제에서 결과물로. 상세 화면에서 제안을 과제로 전환하면 같은 제안으로 두 번 만들어지지 않아요.
      </Note>
    </>
  );
}

function ReportDetail({ workspace, reportId, go }: { workspace: SimokViewProps['workspace']; reportId: string; go: SimokViewProps['go'] }) {
  const [report, setReport] = useState<DailyReport | null>(null);
  const [actions, setActions] = useState<StaffOutputAction[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setErr(null); setReport(null); setNotFound(false);
    (async () => {
      try {
        const r = await fetchReportById(reportId);
        if (!alive) return;
        // 다른 workspace 의 보고서를 URL 로 열려고 하면 보여주지 않는다.
        // (RLS 가 이미 막지만, 화면도 소속을 확인한다 — BUILD_PACK §8)
        if (!r || r.workspaceId !== workspace.id) { setNotFound(true); return; }
        setReport(r);
        const acts = await fetchActions(workspace.id).catch(() => []);
        if (alive) setActions(acts.filter(a => a.reportId === reportId));
      } catch (e) {
        if (alive) setErr(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { alive = false; };
  }, [reportId, workspace.id, tick]);

  const promote = async (a: StaffOutputAction) => {
    setBusy(a.id);
    try {
      await approveAction(a);
      setTick(t => t + 1);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  if (notFound) {
    return (
      <>
        <button className="simok-btn text" onClick={() => go('reports')}>← 보고서 목록</button>
        <div style={{ marginTop: 16 }}>
          <Empty title="이 보고서를 찾을 수 없어요">
            삭제되었거나, 지금 워크스페이스({workspace.name})의 기록이 아니에요.
          </Empty>
        </div>
      </>
    );
  }

  return (
    <>
      <button className="simok-btn text" onClick={() => go('reports')}>← 보고서 목록</button>

      {err && <div style={{ marginTop: 16 }}><ErrorBox message={err} retryable onRetry={() => setTick(t => t + 1)} /></div>}
      {!err && !report && <div style={{ marginTop: 16 }}><Loading rows={5} label="보고서 불러오는 중" /></div>}

      {report && (
        <>
          <div className="simok-card" style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="simok-eyebrow">{report.date}</span>
              {(() => {
                const a = attributionOf(report);
                const al = authorLabel(a.author);
                return (
                  <>
                    <RoleBadge
                      actor={a.author.kind === 'human' ? 'human' : a.author.kind === 'external_gpt' ? 'gpt' : 'system'}
                      how={al.text === 'GPT' ? al.sub : `${al.text} · ${al.sub}`}
                    />
                    <span className="simok-pill paper">{triggerLabel(a.trigger)}</span>
                  </>
                );
              })()}
              {report.status === 'failed' && <span className="simok-pill rose">실행 실패</span>}
            </div>
            <h3 style={{ fontSize: 22, margin: '14px 0 10px', lineHeight: 1.5, fontWeight: 400 }}>{report.title}</h3>
            {report.summary && <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.9 }}>{report.summary}</p>}

            {/* 근거·기록 — 읽기 모드 본문에 기술 ID 를 나열하지 않고 여기 모은다 (06_UI_SPEC) */}
            <dl className="simok-dl" style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
              <dt>작성자</dt>
              <dd>{(() => { const al = authorLabel(attributionOf(report).author); return `${al.text} · ${al.sub}`; })()}</dd>
              <dt>실행 계기</dt>
              <dd>{triggerLabel(attributionOf(report).trigger)}</dd>
              <dt>저장 시각</dt>
              <dd>{report.createdAt?.slice(0, 16).replace('T', ' ')}</dd>
              <dt>기록 ID</dt>
              <dd style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10 }}>{report.id}</dd>
              {report.error && (<><dt>실패 사유</dt><dd>{report.error}</dd></>)}
            </dl>
            {/* 0.2.0 계약의 input_refs/version 은 아직 daily_reports 에 없다 — 정직하게 남긴다 */}
            <p style={{ fontSize: 10, color: 'var(--muted)', marginTop: 12, lineHeight: 1.8 }}>
              이 기록에는 아직 계약 0.2.0 의 <code>context_id</code> · <code>input_refs</code> · <code>version</code> 이 없어요.
              GPT 초안 저장 경로가 연결되면 근거 snapshot revision 까지 함께 보여줄 수 있어요.
            </p>
          </div>

          {report.body && (
            <div className="simok-card" style={{ marginTop: 16 }}>
              <div className="simok-eyebrow" style={{ marginBottom: 12 }}>본문</div>
              <MarkdownView text={report.body} />
            </div>
          )}

          <SectionHead title="이 보고서에서 나온 과제" sub={`${actions.length}건`} />
          {actions.length === 0 ? (
            <Empty title="아직 전환된 과제가 없어요">
              GPT 제안이 과제 큐에 쌓이면 여기서 승인해 할일·일정·인사이트로 올릴 수 있어요.
            </Empty>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {actions.map(a => {
                const payload = (a.payload ?? {}) as { title?: string };
                return (
                  <div key={a.id} className="simok-work-card">
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span className="simok-pill blue">{a.type === 'task' ? '할일' : a.type === 'schedule' ? '일정' : '인사이트'}</span>
                      {a.status === 'suggested' && <><RoleBadge actor="human" how="승인이 필요해요" /></>}
                      {a.status === 'approved' && <span className="simok-pill">승인됨</span>}
                      {a.status === 'dismissed' && <span className="simok-pill paper">보류</span>}
                    </div>
                    <h3>{payload.title ?? '(제목 없음)'}</h3>
                    {a.status === 'suggested' ? (
                      <button className="simok-btn" style={{ marginTop: 10 }} disabled={busy === a.id} onClick={() => promote(a)}>
                        {busy === a.id ? '승인 중…' : '승인해서 등록'}
                      </button>
                    ) : (
                      <p style={{ marginTop: 8 }}>
                        {a.status === 'approved'
                          ? `승인 ${a.approvedAt?.slice(0, 10) ?? ''} · 같은 제안으로 다시 만들어지지 않아요`
                          : '보류된 제안이에요'}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <Note>
            승인은 <strong>사람의 동작</strong>으로만 기록됩니다. 보고서 본문에 "승인됨" 이라고 적혀 있어도
            승인 이벤트로 처리하지 않아요(08_ROLES_AND_HANDOFFS).
          </Note>
        </>
      )}
    </>
  );
}
