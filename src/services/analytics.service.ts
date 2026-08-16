/**
 * @file src/services/analytics.service.ts
 * @description 워크스페이스 성과 집계 — 분석가(analyst)·대시보드 KPI의 실데이터 소스
 * - 매출: sales_daily(시목 ERP 연동 or 수기) 집계 (최근 7/30일·채널별·객단가)
 * - 콘텐츠: content_items + content_metrics 집계 (저장률·공유율·유형별·top)
 * - AI가 숫자를 지어내지 않게, 계산된 실수치를 분석가 프롬프트에 주입(buildAnalystContextText).
 */
import { fetchSalesDaily } from './salesDaily.service';
import { fetchContentItems } from './contentItems.service';
import { fetchMetricsByWorkspace } from './contentMetrics.service';
import { ErpSource } from '../config/dataSource';
import { ContentMetric, ContentType } from '../types';

export interface WorkspaceAnalytics {
  sales: {
    hasData: boolean;
    last7Revenue: number;
    last30Revenue: number;
    orders7: number;
    aov: number | null;                 // 객단가(원)
    byChannel: { source: string; label: string; revenue: number }[];
    dailySeries: number[];              // 최근 7일 일별 매출(원)
  };
  content: {
    hasData: boolean;
    publishedCount: number;
    avgSaveRate: number | null;         // %
    avgShareRate: number | null;        // %
    followerDelta: number;
    byType: { type: string; label: string; saveRate: number | null; n: number }[];
    top: { title: string; saveRate: number; views: number }[];
  };
}

const TYPE_LABEL: Record<string, string> = { desire: '욕망', info: '정보', worldview: '세계관', behind: '비하인드' };
const CH_LABEL: Record<string, string> = { self: '자사몰', smartstore: '스마트스토어', coupang: '쿠팡', ohouse: '오늘의집', instagram: '인스타', 매장: '매장' };
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

/** 콘텐츠 1건의 최신 스냅샷(d7>h72>h24) 고르기 */
function latestMetric(metrics: ContentMetric[]): ContentMetric | null {
  const order: Record<string, number> = { d7: 3, h72: 2, h24: 1 };
  return metrics.reduce<ContentMetric | null>((best, m) => {
    if (!best) return m;
    return (order[m.checkpoint] ?? 0) > (order[best.checkpoint] ?? 0) ? m : best;
  }, null);
}

export async function fetchWorkspaceAnalytics(workspaceId: string, erpSource: ErpSource = 'manual'): Promise<WorkspaceAnalytics> {
  const [sales, items, metrics] = await Promise.all([
    fetchSalesDaily(workspaceId, 30, erpSource).catch(() => []),
    fetchContentItems(workspaceId).catch(() => []),
    fetchMetricsByWorkspace(workspaceId).catch(() => []),
  ]);

  // ── 매출 ──
  const from7 = daysAgo(7);
  const salesRows = sales.filter(s => s.source !== 'total');
  const s7 = salesRows.filter(s => s.date >= from7);
  const last7Revenue = s7.reduce((a, s) => a + (s.revenue ?? 0), 0);
  const last30Revenue = salesRows.reduce((a, s) => a + (s.revenue ?? 0), 0);
  const orders7 = s7.filter(s => s.ordersBasis !== 'voucher').reduce((a, s) => a + (s.orders ?? 0), 0);
  const aov = orders7 > 0 ? Math.round(last7Revenue / orders7) : null;
  const chMap: Record<string, number> = {};
  s7.forEach(s => { chMap[s.source] = (chMap[s.source] ?? 0) + (s.revenue ?? 0); });
  const byChannel = Object.entries(chMap).map(([source, revenue]) => ({ source, label: CH_LABEL[source] ?? source, revenue })).sort((a, b) => b.revenue - a.revenue);
  // 최근 7일 일별 시리즈
  const dayMap: Record<string, number> = {};
  s7.forEach(s => { dayMap[s.date] = (dayMap[s.date] ?? 0) + (s.revenue ?? 0); });
  const dailySeries = Array.from({ length: 7 }, (_, i) => dayMap[daysAgo(6 - i)] ?? 0);

  // ── 콘텐츠 성과 ──
  const byItem: Record<string, ContentMetric[]> = {};
  metrics.forEach(m => { (byItem[m.contentItemId] ??= []).push(m); });
  const rows = items
    .map(it => ({ item: it, m: latestMetric(byItem[it.id] ?? []) }))
    .filter((r): r is { item: typeof r.item; m: ContentMetric } => !!r.m && (r.m.views ?? 0) > 0);
  const rate = (num?: number, den?: number) => (den && den > 0 && num != null ? (num / den) * 100 : null);
  const withSave = rows.map(r => ({ ...r, saveRate: rate(r.m.saves, r.m.views), shareRate: rate(r.m.shares, r.m.views) }));
  const avg = (arr: (number | null)[]) => { const v = arr.filter((x): x is number => x != null); return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null; };
  const avgSaveRate = avg(withSave.map(r => r.saveRate));
  const avgShareRate = avg(withSave.map(r => r.shareRate));
  const followerDelta = withSave.reduce((a, r) => a + (r.m.followerDelta ?? 0), 0);
  const types = (Object.keys(TYPE_LABEL) as ContentType[]).map(t => {
    const g = withSave.filter(r => r.item.contentType === t);
    return { type: t, label: TYPE_LABEL[t], saveRate: avg(g.map(r => r.saveRate)), n: g.length };
  }).filter(x => x.n > 0);
  const top = withSave
    .filter(r => r.saveRate != null)
    .sort((a, b) => (b.saveRate ?? 0) - (a.saveRate ?? 0))
    .slice(0, 3)
    .map(r => ({ title: r.item.title, saveRate: Math.round((r.saveRate ?? 0) * 10) / 10, views: r.m.views ?? 0 }));

  return {
    sales: { hasData: salesRows.length > 0, last7Revenue, last30Revenue, orders7, aov, byChannel, dailySeries },
    content: { hasData: withSave.length > 0, publishedCount: items.filter(i => i.status === 'published').length, avgSaveRate, avgShareRate, followerDelta, byType: types, top },
  };
}

/** 분석가 AI 프롬프트에 주입할 실데이터 텍스트 블록 (숫자 환각 방지) */
export function buildAnalystContextText(a: WorkspaceAnalytics): string {
  const won = (n: number) => `${n.toLocaleString()}원`;
  const lines: string[] = ['[실데이터 — 이 숫자만 근거로 해석해. 새 숫자를 지어내지 마.]'];
  if (a.sales.hasData) {
    lines.push(`· 매출 최근7일 ${won(a.sales.last7Revenue)} / 최근30일 ${won(a.sales.last30Revenue)}, 주문 ${a.sales.orders7}건${a.sales.aov != null ? `, 객단가 ${won(a.sales.aov)}` : ''}`);
    if (a.sales.byChannel.length) lines.push(`· 채널별(7일): ${a.sales.byChannel.map(c => `${c.label} ${won(c.revenue)}`).join(' / ')}`);
    lines.push(`· 일별 매출(최근7일): ${a.sales.dailySeries.map(won).join(', ')}`);
  } else lines.push('· 매출: 데이터 없음');
  if (a.content.hasData) {
    lines.push(`· 콘텐츠 성과: 저장률 평균 ${a.content.avgSaveRate ?? '—'}% / 공유율 평균 ${a.content.avgShareRate ?? '—'}% / 팔로워 증감 ${a.content.followerDelta}`);
    if (a.content.byType.length) lines.push(`· 유형별 저장률: ${a.content.byType.map(t => `${t.label} ${t.saveRate ?? '—'}%(n=${t.n})`).join(' / ')}`);
    if (a.content.top.length) lines.push(`· 저장률 상위: ${a.content.top.map(t => `"${t.title}" ${t.saveRate}%`).join(' / ')}`);
  } else lines.push('· 콘텐츠 성과: 입력된 데이터 없음');
  return lines.join('\n');
}
