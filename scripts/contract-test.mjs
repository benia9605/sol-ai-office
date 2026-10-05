/**
 * @file scripts/contract-test.mjs
 * @description 계약 0.2.0 TS 포팅 회귀 검사 — 공유 폴더 fixture 를 Office 코드로 돌린다.
 *
 * 왜: 공유 `contracts/test_contract.py` 는 Python validator 를 검사한다.
 *     Office 는 수신 시점에 **TS 코드로** 같은 규칙을 적용하므로, 같은 fixture 로 TS 쪽을 따로 검사해야 한다.
 *     "두 검증기가 같은 결론을 낸다"를 증거로 남기는 것이 목적이다.
 *
 * 실행: node scripts/contract-test.mjs
 *   공유 루트는 SHARED_ROOT 환경변수로 덮어쓸 수 있다.
 */
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const SHARED = process.env.SHARED_ROOT
  || '/Users/solmac/.codex/.chatgpt-projects/g-p-6a5f60f490f08191a6af058b45a467c3/deliverables/simok-ai-office-v1';
const CONTRACTS = join(SHARED, 'contracts');

// ── TS 를 즉석 트랜스파일해 불러온다 (esbuild 는 vite 의존성으로 이미 있다) ──
const { build } = await import('esbuild');
const outdir = mkdtempSync(join(tmpdir(), 'contract-ts-'));
await build({
  entryPoints: ['src/contracts/dailySnapshot.ts', 'src/contracts/projection.ts', 'src/contracts/webAnalyticsV1.ts'],
  outdir, bundle: true, format: 'esm', platform: 'node', target: 'node18', logLevel: 'silent',
});
const C = await import(join(outdir, 'dailySnapshot.js'));
const P = await import(join(outdir, 'projection.js'));
const W = await import(join(outdir, 'webAnalyticsV1.js'));

let pass = 0, fail = 0;
const failures = [];

/** 두 문자열의 첫 불일치 위치를 사람이 읽게 */
function firstDiff(a, b) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return `idx ${i}: ts=${JSON.stringify(a.slice(i, i + 40))} py=${JSON.stringify(b.slice(i, i + 40))}`;
  return `길이만 다름 (${a.length} vs ${b.length})`;
}

function ok(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; failures.push(name + (detail ? ` — ${detail}` : '')); console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`); }
}

/** fixture 를 읽어 JSON 객체로 */
function fx(name) { return JSON.parse(readFileSync(join(CONTRACTS, name), 'utf8')); }
function fxText(name) { return readFileSync(join(CONTRACTS, name), 'utf8'); }

/** 검증이 실패해야 하는 경우 — 실패 메시지를 돌려준다 */
function expectReject(name, mutate) {
  const s = fx('demo-daily-snapshot.json');
  mutate(s);
  try { C.validateSnapshot(s); ok(name, false, '거절되어야 하는데 통과했다'); return null; }
  catch (e) { ok(name, true); return e.message; }
}

console.log('\n── 1. 공유 fixture 3종이 TS 검증기를 통과한다 ──');
for (const f of ['demo-daily-snapshot.json', 'demo-mixed-snapshot.json', 'demo-missing-snapshot.json']) {
  try { C.validateSnapshot(fx(f)); ok(f, true); }
  catch (e) { ok(f, false, e.message); }
}

console.log('\n── 2. Python 검증기와 결론이 같은지 대조 ──');
for (const f of ['demo-daily-snapshot.json', 'demo-mixed-snapshot.json', 'demo-missing-snapshot.json']) {
  let py = true;
  try { execFileSync('python3', ['validate_fixture.py', join(CONTRACTS, f)], { cwd: CONTRACTS, stdio: 'pipe' }); }
  catch { py = false; }
  let ts = true;
  try { C.validateSnapshot(fx(f)); } catch { ts = false; }
  ok(`${f}: python=${py} ts=${ts} 일치`, py === ts);
}

console.log('\n── 3. 품질·정직성 규칙 (계약 §5) ──');
expectReject('partial 인데 값이 숫자면 거절', s => {
  s.commerce.totals.quality.fields.refunded_krw = { status: 'partial', reason: '일부만' };
  // 값은 그대로 50000 → non-null 인데 complete 아님
});
expectReject('complete 인데 reason 이 있으면 거절', s => {
  s.commerce.totals.quality.fields.captured_krw.reason = '이유';
});
expectReject('rollup 불일치 거절', s => {
  s.commerce.totals.quality.status = 'partial'; // 전 필드 complete 인데 partial 주장
});
expectReject('채널 합계 1원 불일치 거절', s => {
  s.commerce.totals.captured_krw = 250001;
  s.commerce.totals.net_collected_krw = 200001;
  s.commerce.totals.merchandise_captured_krw = 245001;
});
expectReject('상품 합계 1원 불일치 거절', s => {
  s.products.items[0].merchandise_captured_krw = 198001;
});
expectReject('미수집 traffic 을 0으로 쓰면 거절', s => {
  s.traffic.sessions = 0; // quality 는 missing 인데 값이 0
});
expectReject('순수납만 알 수는 없다(수납·환불 미확인)', s => {
  s.commerce.by_channel[0].quality.fields.refunded_krw = { status: 'missing', reason: '모름' };
  s.commerce.by_channel[0].refunded_krw = null;
  // net 은 그대로 숫자 → 거절되어야 함
});

console.log('\n── 4. workspace 주입 차단 (계약 §2) ──');
for (const k of ['tenant_id', 'workspace_id', 'workspaceId']) {
  const msg = expectReject(`본문의 ${k} 거절`, s => { s[k] = 'x'; });
  if (msg) ok(`  ${k}: workspace_injection 코드`, /workspace/.test(msg), msg);
}

console.log('\n── 5. environment/usage 조합 (계약 §2) ──');
expectReject('demo + operational 거절', s => { s.environment = 'demo'; s.usage = 'operational'; });
{
  const s = fx('demo-daily-snapshot.json');
  s.environment = 'production'; s.usage = 'validation';
  try { C.validateSnapshot(s); ok('production + validation 허용', true); }
  catch (e) { ok('production + validation 허용', false, e.message); }
}

console.log('\n── 6. 시각 프로파일 — Python fromisoformat 함정을 넘는다 (시목 M-7) ──');
for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
  const s = fx('demo-daily-snapshot.json');
  s.generated_at = `2026-10-03T08:00:00.${'9'.repeat(n)}+09:00`;
  try { C.validateSnapshot(s); ok(`소수부 ${n}자리 통과`, true); }
  catch (e) { ok(`소수부 ${n}자리 통과`, false, e.message); }
}
expectReject('소수부 10자리 거절', s => { s.generated_at = '2026-10-03T08:00:00.0123456789+09:00'; });
expectReject('-00:00 거절', s => { s.generated_at = '2026-10-03T08:00:00-00:00'; });
expectReject('offset 없음 거절', s => { s.generated_at = '2026-10-03T08:00:00'; });
expectReject('소문자 t 거절', s => { s.generated_at = '2026-10-03t08:00:00+09:00'; });
expectReject('달력에 없는 날짜 거절(2026-02-30)', s => { s.business_date = '2026-02-30'; });
expectReject('13월 거절', s => { s.business_date = '2026-13-01'; });
{
  const s = fx('demo-daily-snapshot.json');
  s.business_date = '2024-02-29'; // 윤년
  try { C.validateSnapshot(s); ok('윤년 2024-02-29 통과', true); }
  catch (e) { ok('윤년 2024-02-29 통과', false, e.message); }
}

console.log('\n── 7. catalog / custom (계약 §5) ──');
expectReject('catalog 인데 product_id 없음 거절', s => { s.products.items[0].product_id = null; });
{
  const s = fx('demo-daily-snapshot.json');
  ok('catalog 의 sku=null 허용(fixture 에 이미 있음)', s.products.items[1].sku === null);
}
{
  const s = fx('demo-mixed-snapshot.json');
  const customs = s.products.items.filter(p => p.product_ref_type === 'custom');
  ok('custom 2줄이 각기 고유 item_key 로 통과', customs.length === 2 && customs.every(p => p.product_id === null));
}
expectReject('custom 에 sku 가 있으면 거절', s => {
  s.products.items[0].product_ref_type = 'custom';
  s.products.items[0].product_id = null;
  // sku 는 'DEMO-A' 로 남아 있음
});
expectReject('중복 item_key 거절', s => { s.products.items[1].item_key = s.products.items[0].item_key; });
expectReject('commerce 에 없는 channel_id 거절', s => { s.products.items[0].channel_id = 'nope'; });

console.log('\n── 8. 1 MiB 상한·중복 멤버 (계약 §8) ──');
{
  const big = JSON.stringify(fx('demo-daily-snapshot.json')).replace(
    '"source_system"', '"' + 'x'.repeat(1024 * 1024) + '":1,"source_system"');
  try { C.parseSnapshotText(big); ok('1 MiB 초과 거절', false, '통과해버림'); }
  catch (e) { ok('1 MiB 초과 거절', /1 MiB|payload_too_large/.test(e.message), e.message); }
}
{
  const dup = fxText('demo-daily-snapshot.json').replace('"revision": 1', '"revision": 1, "revision": 2');
  try { C.parseSnapshotText(dup); ok('중복 JSON 멤버 거절', false, '통과해버림'); }
  catch (e) { ok('중복 JSON 멤버 거절', /중복 멤버/.test(e.message), e.message); }
}
{
  // 정상 본문은 통과하고 원문을 바꾸지 않는다
  const text = fxText('demo-daily-snapshot.json');
  const { snapshot } = C.parseSnapshotText(text);
  ok('정상 본문 파싱', snapshot.snapshot_id === 'demo_2026-10-02_r1');
}

console.log('\n── 9. canonical digest (계약 §7.3) ──');
{
  const a = fx('demo-daily-snapshot.json');
  const b = fx('demo-daily-snapshot.json');
  // 관찰 시각·snapshot_id·revision·generated_at 만 바꿔도 digest 는 같아야 한다
  b.snapshot_id = 'demo_2026-10-02_r9';
  b.revision = 9;
  b.generated_at = '2026-10-04T23:59:59+09:00';
  b.source_updated_at = '2026-10-04T23:00:00+09:00';
  b.commerce.totals.quality.as_of = '2026-10-04T23:59:59+09:00';
  b.commerce.by_channel[0].quality.as_of = '2026-10-04T23:59:59+09:00';
  const da = await C.contentDigest(a), db = await C.contentDigest(b);
  ok('관찰 시각만 달라지면 digest 동일 → 새 revision 사유 아님', da === db, `${da.slice(0, 12)} vs ${db.slice(0, 12)}`);

  const c = fx('demo-daily-snapshot.json');
  c.commerce.totals.captured_krw = 250000 + 1;
  c.commerce.totals.merchandise_captured_krw = 245001;
  c.commerce.totals.net_collected_krw = 200001;
  c.commerce.by_channel[0].captured_krw = 250001;
  c.commerce.by_channel[0].merchandise_captured_krw = 245001;
  c.commerce.by_channel[0].net_collected_krw = 200001;
  c.products.items[0].merchandise_captured_krw = 198001;
  const dc = await C.contentDigest(c);
  ok('금액이 바뀌면 digest 변경 → 새 revision 사유', da !== dc);

  // 배열 순서만 달라도 digest 동일 (정렬 규칙)
  const d = fx('demo-mixed-snapshot.json');
  const e = fx('demo-mixed-snapshot.json');
  e.commerce.by_channel.reverse();
  e.products.items.reverse();
  e.inventory.items.reverse();
  ok('배열 순서가 달라도 digest 동일', await C.contentDigest(d) === await C.contentDigest(e));

  // 재고 값 변화도 새 revision 사유 (계약 §7.2)
  const f = fx('demo-daily-snapshot.json');
  f.inventory.items[0].available_units = 999;
  ok('재고 값 변화는 digest 변경', da !== await C.contentDigest(f));
}

console.log('\n── 10. projection: 모르는 값이 0이 되지 않는다 ──');
{
  const mixed = P.projectSnapshot(C.validateSnapshot(fx('demo-mixed-snapshot.json')));
  ok('mixed: 전체 수납은 알려짐(35만)', mixed.totals.captured.known && mixed.totals.captured.value === 350000);
  ok('mixed: 전체 환불은 unknown', !mixed.totals.refunded.known);
  ok('mixed: 전체 순수납은 unknown', !mixed.totals.netCollected.known);
  ok('mixed: unknown 은 "—" 로 표시', P.formatMeasure(mixed.totals.netCollected) === '—');
  const web = mixed.channels.find(c => c.channelId === 'demo-web');
  ok('mixed: 웹 채널 순수납은 그 채널에 남아 있다(20만)', web.netCollected.known && web.netCollected.value === 200000);
  const store = mixed.channels.find(c => c.channelId === 'demo-store');
  ok('mixed: 전표 채널 환불은 unknown + 이유 있음', !store.refunded.known && !!store.refunded.reason);

  const missing = P.projectSnapshot(C.validateSnapshot(fx('demo-missing-snapshot.json')));
  ok('missing: 수납이 0이 아니라 unknown', !missing.totals.captured.known);
  ok('missing: 판매 0과 구별되는 이유 문자열', !!missing.channelCoverageReason);
  ok('missing: 채널 목록 비어 있음', missing.channels.length === 0);

  const demo = P.projectSnapshot(C.validateSnapshot(fx('demo-daily-snapshot.json')));
  ok('demo: traffic 미수집은 unknown', !demo.traffic.visitors.known);
  ok('demo: usage=validation 이면 검증 배지', demo.showValidationBadge === true);
  ok('demo: isOperational=false (운영 집계 제외)', demo.isOperational === false);
}

console.log('\n── 11. 주문당 수납액: 분자·분모 같은 범위 (계약 §3 · GPT 지적) ──');
{
  const demo = P.projectSnapshot(C.validateSnapshot(fx('demo-daily-snapshot.json')));
  ok('order 채널만 있으면 계산됨 (250000/3 = 83333)',
    demo.perOrderCaptured.known && demo.perOrderCaptured.value === Math.round(250000 / 3),
    JSON.stringify(demo.perOrderCaptured));

  const mixed = P.projectSnapshot(C.validateSnapshot(fx('demo-mixed-snapshot.json')));
  // 전표(voucher) 10만은 분자에서 빠지고, 웹 25만/3건만 쓴다 → 83333. 350000/3=116666 이면 틀린 것.
  ok('voucher 채널 수납이 분자에 섞이지 않는다',
    mixed.perOrderCaptured.known && mixed.perOrderCaptured.value === Math.round(250000 / 3),
    JSON.stringify(mixed.perOrderCaptured));
  ok('GPT 가 지적한 잘못된 값(전체/웹주문)이 아니다',
    !(mixed.perOrderCaptured.known && mixed.perOrderCaptured.value === Math.round(350000 / 3)));
  ok('계산에 쓴 채널을 밝힌다', mixed.perOrderCaptured.known && mixed.perOrderCaptured.channelIds.join() === 'demo-web');

  // order 채널의 주문 수가 unknown 이면 계산하지 않는다
  const s = fx('demo-daily-snapshot.json');
  s.commerce.by_channel[0].quality.fields.paid_orders = { status: 'missing', reason: '주문 수 미상' };
  s.commerce.by_channel[0].paid_orders = null;
  s.commerce.by_channel[0].quality.status = 'partial';
  const p = P.projectSnapshot(C.validateSnapshot(s));
  ok('주문 수 unknown 이면 계산 안 함 + 이유', !p.perOrderCaptured.known && !!p.perOrderCaptured.reason);

  // voucher 채널만 있으면 아예 계산 불가
  const v = fx('demo-mixed-snapshot.json');
  v.commerce.by_channel = v.commerce.by_channel.filter(c => c.orders_basis === 'voucher');
  v.products.items = v.products.items.filter(p2 => p2.channel_id === 'demo-store');
  // totals 재계산: 전표만 남으므로 전체는 전표 값
  const only = v.commerce.by_channel[0];
  for (const k of C.FINANCIAL) {
    v.commerce.totals[k] = only[k];
    v.commerce.totals.quality.fields[k] = { ...only.quality.fields[k] };
  }
  v.commerce.totals.quality.status = C.rollup(C.FINANCIAL.map(k => v.commerce.totals.quality.fields[k].status));
  const vp = P.projectSnapshot(C.validateSnapshot(v));
  ok('voucher 채널만 있으면 주문당 수납액 계산 불가',
    !vp.perOrderCaptured.known && /order 기준 채널이 없습니다/.test(vp.perOrderCaptured.reason));
}

console.log('\n── 12. 기간 합계: 하루라도 unknown 이면 기간도 unknown (계약 §5) ──');
{
  const good = P.projectSnapshot(C.validateSnapshot(fx('demo-daily-snapshot.json')));
  const mixed = P.projectSnapshot(C.validateSnapshot(fx('demo-mixed-snapshot.json')));
  const sum2 = P.sumOverDays([good, good], p => p.totals.captured);
  ok('아는 날끼리는 합산 (25만+25만)', sum2.known && sum2.value === 500000);
  const sumBad = P.sumOverDays([good, mixed], p => p.totals.netCollected);
  ok('한 날이 unknown 이면 기간 합계 unknown', !sumBad.known && !!sumBad.reason);
  const sumNone = P.sumOverDays([], p => p.totals.captured);
  ok('수신 없는 기간은 0이 아니라 unknown', !sumNone.known);
}

console.log('\n── 13. latest revision 선택 (계약 §7.5) ──');
{
  const rows = [
    { businessDate: '2026-10-02', revision: 1 },
    { businessDate: '2026-10-02', revision: 2 },
    { businessDate: '2026-10-01', revision: 1 },
  ];
  const latest = P.latestPerDate(rows);
  ok('날짜별 최신 revision 만 남는다', latest.length === 2 && latest.find(r => r.businessDate === '2026-10-02').revision === 2);
  // 낮은 revision 이 나중에 들어와도 결과는 같다
  const reordered = P.latestPerDate([rows[1], rows[0], rows[2]]);
  ok('낮은 revision 이 늦게 와도 latest 는 내려가지 않는다',
    reordered.find(r => r.businessDate === '2026-10-02').revision === 2);
}

console.log('\n── 14. canonical 7벡터 대조 (계약 §11 · GPT-R2-O5) ──');
{
  // 레퍼런스: contracts/canonical_digest.py. TS 가 **같은 문자열·같은 SHA** 를 만들어야 한다.
  const vec = JSON.parse(readFileSync(join(CONTRACTS, 'canonical-vectors.json'), 'utf8'));
  // 파이썬 레퍼런스로 입력문자열+digest 를 뽑아 온다
  const refOut = execFileSync('python3', ['-c', `
import json,sys
sys.path.insert(0,'.')
from canonical_digest import canonical_input, digest
d=json.load(open('canonical-vectors.json'))
print(json.dumps([{'name':v['name'],'input':canonical_input(v['snapshot']),'digest':digest(v['snapshot'])} for v in d['vectors']], ensure_ascii=False))
`], { cwd: CONTRACTS, encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
  const ref = JSON.parse(refOut);
  let baseDigest = null;
  for (let i = 0; i < vec.vectors.length; i++) {
    const v = vec.vectors[i], r = ref[i];
    const tsInput = C.canonicalDigestInput(v.snapshot);
    const tsDigest = await C.contentDigest(v.snapshot);
    if (v.name === 'base') baseDigest = tsDigest;

    ok(`[${v.name}] 입력 문자열이 Python 레퍼런스와 바이트 동일`, tsInput === r.input,
      tsInput === r.input ? '' : `len ts=${tsInput.length} py=${r.input.length} · 첫 차이 ${firstDiff(tsInput, r.input)}`);
    ok(`[${v.name}] digest 일치 ${r.digest.slice(0, 16)}…`, tsDigest === r.digest, `ts=${tsDigest.slice(0,16)}`);
    // 벡터가 선언한 same_as_base 기대와 맞는지
    const expectSame = v.same_as_base === true;
    ok(`[${v.name}] same_as_base=${expectSame} 기대 충족`, (tsDigest === baseDigest) === expectSame);
  }
  // 제외/포함 규칙이 실제로 그렇게 동작하는지 한 번 더 명시
  const base = vec.vectors.find(v => v.name === 'base').snapshot;
  ok('channel_name 은 digest 입력에 없다 (§11 B-3)', !C.canonicalDigestInput(base).includes('"channel_name"'));
  ok('quality.as_of 는 digest 입력에 없다', !C.canonicalDigestInput(base).includes('"as_of"'));
  for (const k of ['snapshot_id', 'revision', 'generated_at', 'source_updated_at']) {
    ok(`루트 ${k} 는 digest 입력에 없다`, !C.canonicalDigestInput(base).includes(`"${k}"`));
  }
  for (const k of ['source_system', 'environment', 'usage', 'business_date', 'schema_version']) {
    ok(`${k} 는 digest 입력에 포함된다 (§11 B-3)`, C.canonicalDigestInput(base).includes(`"${k}"`));
  }
  ok('상품 name 은 digest 입력에 포함된다 (변경 시 새 revision)', C.canonicalDigestInput(base).includes('"name"'));
}

console.log('\n── 15. web-analytics.v1 — 시목 round5 실제 fixture 대조 (WEB-O1) ──');
{
  const WA = join(SHARED, 'coordination', 'evidence', 'simok-app', 'round5');
  const files = ['fixture-web-analytics-v1.ga-not-connected.json', 'fixture-web-analytics-v1.empty-day.json'];
  const loaded = {};
  for (const f of files) {
    const text = readFileSync(join(WA, f), 'utf8');
    try {
      const rec = W.validateWebAnalyticsV1(JSON.parse(text));
      loaded[f] = rec;
      ok(`${f} 통과`, true);
    } catch (e) { ok(`${f} 통과`, false, e.message); }
  }

  const ga = loaded[files[0]], empty = loaded[files[1]];
  if (ga) {
    ok('GA 미연결인데 방문 지표가 전부 null', ga.ga.visitors_observed === null && ga.ga.sessions === null && ga.ga.page_views === null);
    ok('GA 미연결 사유가 남아 있다', typeof ga.ga.reason === 'string' && ga.ga.reason.length > 0);
    ok('연결률은 0~1 ratio (0.5)', ga.orders.attribution_link_rate === 0.5);
    ok('attributed + unattributed = total', ga.orders.attributed_orders + ga.orders.unattributed_orders === ga.orders.total_paid_orders);
    const row = W.toStorageRow(ga);
    ok('매핑: period → period_start/end', row.period_start === '2026-10-01' && row.period_end === '2026-10-05');
    ok('매핑: ga 블록이 ga_metrics 로', row.ga_metrics.status === 'missing' && row.ga_metrics.visitors_observed === null);
    ok('매핑: 주문 블록이 order_metrics 로', row.order_metrics.total_paid_orders === 10);
    ok('매핑: 귀속 규칙이 attribution 으로', row.attribution.model === 'last_eligible_touch_30d_v1');
    ok('매핑: GA 블록과 주문 블록이 분리됨', !('total_paid_orders' in row.ga_metrics) && !('visitors_observed' in row.order_metrics));
  }
  if (empty) {
    ok('주문 0건이면 연결률은 null (0% 아님)', empty.orders.attribution_link_rate === null);
    ok('주문 0건도 total=0 으로 기록된다', empty.orders.total_paid_orders === 0);
  }

  // 거절되어야 하는 변형
  const mutate = (base, fn) => { const c = JSON.parse(JSON.stringify(base)); fn(c); return c; };
  const expectBad = (name, obj, re) => {
    try { W.validateWebAnalyticsV1(obj); ok(name, false, '거절되어야 하는데 통과'); }
    catch (e) { ok(name, re ? re.test(e.message) : true, e.message); }
  };
  if (ga) {
    expectBad('GA missing 인데 방문자 0 이면 거절', mutate(ga, c => { c.ga.visitors_observed = 0; }), /미수집을 0/);
    expectBad('연결률이 재계산과 다르면 거절', mutate(ga, c => { c.orders.attribution_link_rate = 0.9; }), /불일치/);
    expectBad('연결률이 %(50)로 오면 거절', mutate(ga, c => { c.orders.attribution_link_rate = 50; }), /0~1 ratio/);
    expectBad('by_attribution 합이 안 맞으면 거절', mutate(ga, c => { c.orders.by_attribution[0].orders = 99; }), /by_attribution 합/);
    expectBad('attributed+unattributed ≠ total 거절', mutate(ga, c => { c.orders.total_paid_orders = 11; }), /total/);
    expectBad('전환율 칸이 오면 거절', mutate(ga, c => { c.ga.conversion_rate = 0.03; }), /전환율/);
    expectBad('본문에 workspace_id 주입 거절', mutate(ga, c => { c.workspace_id = 'x'; }), /workspace/);
    expectBad('demo + operational 거절', mutate(ga, c => { c.environment = 'demo'; c.usage = 'operational'; }), /validation/);
    expectBad('31일 초과 거절', mutate(ga, c => { c.period.from = '2026-09-01'; c.period.to = '2026-10-05'; }), /31일/);
    expectBad('구버전 schema_version 거절', mutate(ga, c => { c.schema_version = 'web-analytics.v0'; }), /schema_version/);
  }
  if (empty) {
    expectBad('주문 0인데 연결률 0 이면 거절', mutate(empty, c => { c.orders.attribution_link_rate = 0; }), /null 이어야/);
  }
}

console.log('\n── 16. 구버전 거절 ──');
{
  const old = fx(join('versions', '0.1.0', 'demo-daily-snapshot.json').replace(/\\/g, '/'));
  try { C.validateSnapshot(old); ok('0.1.0 fixture 는 0.2.0 검증기에서 거절', false, '통과해버림'); }
  catch (e) { ok('0.1.0 fixture 는 0.2.0 검증기에서 거절', /schema_version/.test(e.message), e.message); }
}

console.log(`\n${'='.repeat(60)}`);
console.log(`PASS ${pass} / FAIL ${fail}`);
if (fail) { console.log('\n실패 목록:'); failures.forEach(f => console.log('  - ' + f)); }
writeFileSync(join(outdir, 'done'), '');
process.exit(fail ? 1 : 0);
