/**
 * @file supabase/functions/office-staff-run/index.ts
 * @description AI 직원 자동 실행 엔진 (cron) — "진짜 24시간 자동"의 실행기
 * - cron이 주기(예: 15분)마다 호출 → 지금 시각에 due인 일과(staff_routines)를 실행
 * - 4겹 프롬프트(베이스 SOP + 브랜드 + 직원 프롬프트 + 동료 산출물) → Anthropic 호출
 * - 결과를 daily_reports에 저장 + [액션] 파싱해 일정/할일/인사이트 자동 등록 + 멤버 푸시
 * - service role 사용(RLS 우회). last_run_at으로 하루 1회 중복 방지.
 *
 * 배포: supabase functions deploy office-staff-run
 * cron: Supabase Dashboard → Edge Functions → Schedules (예: 매 15분) 또는 pg_cron(009 참고)
 * 시크릿: ANTHROPIC_API_KEY (supabase secrets set)
 */
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { sendPushToWorkspace } from '../_shared/push.ts';

const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const OPENAI_KEY = Deno.env.get('OPENAI_API_KEY') || '';
const PERPLEXITY_KEY = Deno.env.get('PERPLEXITY_API_KEY') || '';

/** 직원 모델 → provider+model (프론트 staffRun.MODEL_REGISTRY와 동기화) */
const MODEL_REGISTRY: Record<string, { provider: string; model: string }> = {
  sonnet: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
  haiku: { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' },
  opus: { provider: 'anthropic', model: 'claude-opus-4-8' },
  gpt: { provider: 'openai', model: 'gpt-4o' },
};
const RESEARCH_MODEL = 'sonar-pro';
/** 타입별 기본 모델 (프론트 staffCatalog.defaultModel과 동기화) */
const DEFAULT_MODEL_BY_TYPE: Record<string, string> = {
  sourcing: 'research', detail_page: 'sonnet', cs: 'sonnet', sns: 'gpt', ad: 'gpt',
  monitor: 'research', analyst: 'haiku', visual: 'sonnet', ops: 'sonnet', scheduler: 'sonnet',
};
/** 모델 단가(USD per 1M) → 코인(1코인=$0.001) */
const MODEL_COST: Record<string, { in: number; out: number }> = {
  'claude-sonnet-4-6': { in: 3, out: 15 }, 'claude-haiku-4-5-20251001': { in: 1, out: 5 },
  'claude-opus-4-8': { in: 15, out: 75 }, 'gpt-4o': { in: 2.5, out: 10 }, 'sonar-pro': { in: 3, out: 15 },
};
function coinsOf(model: string, inT: number, outT: number): number {
  const c = MODEL_COST[model] || MODEL_COST['claude-sonnet-4-6'];
  return Math.max(1, Math.ceil(((inT / 1e6) * c.in + (outT / 1e6) * c.out) * 1000));
}
const AI_TAG = '🤖 AI';
const AI_COLOR = '#1b4332';

// type_key → outputKind (프론트 staffCatalog와 동기화)
const OUTPUT_KIND: Record<string, string> = {
  sourcing: 'sourcing_brief', detail_page: 'detail_builder', cs: 'ticket_list',
  sns: 'sns_queue', ad: 'copy_variants', monitor: 'monitor_digest',
  analyst: 'metric_digest', visual: 'image_brief', ops: 'ops_digest', scheduler: 'schedule_plan',
};
// outputKind별 JSON 스키마 힌트 (프론트 staffRun.service.ts OUTPUT_SCHEMA와 동기화)
const OUTPUT_SCHEMA: Record<string, string> = {
  sourcing_brief: '{"verdict":"추천|보류|비추천","score":8,"confidence":"높음|중간|낮음","summary":"","reasons":[],"scores":{"trend":{"score":2,"reason":""},"entry":{"score":1,"reason":""},"target":{"score":2,"reason":""},"margin":{"score":2,"reason":""},"diff":{"score":1,"reason":""}},"margin":{"price":0,"cost":0,"platformFee":0,"packagingShipping":0,"expectedAdCost":0,"netProfit":0,"netRate":"","breakEvenMonthlyQty":0},"persona":"","channels":[],"risks":[],"nextActions":[{"type":"task","title":"","priority":"high|medium|low","owner":""}],"handoff":{"detailPage":[],"ads":[],"sns":[],"visual":[],"monitor":[]},"sources":[{"title":"","url":"","type":"","confidence":""}]}',
  detail_builder: '{"brief":{"productName":"","target":"","usp":[],"customerPain":[],"banned":[]},"sections":[{"key":"hero|problem|solution|trust|review|cta","title":"","objective":"","coreLine":"","subLine":"","bullets":[],"visual":"","cta":"","status":"draft"}],"visualSlots":[{"sectionKey":"","imageType":"","brief":""}],"complianceCheck":{"pass":true,"flags":[],"bannedExpressionsFound":[]},"handoff":{"visual":[],"ads":[],"analyst":[]}}',
  ticket_list: '{"summary":{"total":0,"urgent":0,"needsHumanApproval":0,"faqCandidates":0,"negativeReviews":0},"tickets":[{"id":"","type":"","urgency":"즉시|일반|낮음","sentiment":"긍정|중립|불만|격앙","riskLevel":"high|medium|low","customerMessage":"","draft":"","needsConfirm":[],"needsHumanApproval":false,"approvalReason":"","status":"신규|답변초안|approval_waiting|완료|보류","faqCandidate":{"shouldCreate":false,"question":"","answer":""},"nextActions":[{"target":"","title":""}]}]}',
  sns_queue: '{"summary":{"total":0,"needsApproval":0,"scheduled":0,"needsVisual":0,"mix":{"info":0,"empathy":0,"product":0,"ugc":0,"behind":0},"warnings":[]},"posts":[{"id":"","date":"","time":"","channel":"","format":"","objective":"","contentType":"","hook":{"type":"","text":"","score":0},"body":"","cta":{"type":"","text":""},"hashtags":{"large":[],"medium":[],"small":[],"brand":[]},"imageBrief":"","variants":[{"label":"A","angle":"","hook":"","body":""}],"status":"draft","nextActions":[{"target":"","title":""}]}]}',
  copy_variants: '{"product":{"name":"","price":0,"channels":[],"goal":"","angle":""},"sets":[{"variantId":"AD-001","type":"감성|기능|가격","headline":"","sub":"","detail":"","cta":"","imageDirection":"","recommendedChannels":[],"expectedMetric":[],"caution":"","status":"test"}],"targeting":{"keywords":[],"audience":{"core":[],"lookalike":[],"interest":[],"exclude":[]},"budgetSplit":{"test":{"emotional":33,"functional":33,"price":33},"scale":{"winner":70,"support":20,"newTest":10}}},"channelGuide":{"instagram":"","naver":"","kakao":""},"complianceCheck":{"exaggeration":true,"unverifiedNo1":true,"lowestPrice":true,"healthClaim":true,"landingConsistencyRequired":true},"handoff":{"sns":[],"analyst":[],"landing":[],"ownerApproval":[]}}',
  monitor_digest: '{"summary":[],"alerts":[{"level":"red|orange|green","title":"","change":"","impact":"","recommendation":"","source":{"url":"","title":"","sourceType":"","checkedAt":"","confidence":"high|medium|low"},"status":"action_required"}],"compareTable":[{"name":"","price":0,"composition":"","reviewStrength":"","difference":"","recommendedResponse":""}],"changeLog":[{"item":"","before":"","after":"","delta":"","level":"red|orange|green"}],"trends":[{"keyword":"","delta":"","meaning":"","citations":[{"url":"","sourceType":"","checkedAt":""}]}],"strategy":{"summary":"","actions":[{"target":"ads|sns|detailPage|analyst","title":""}]},"limitations":[],"handoff":{"ads":[],"sns":[],"detailPage":[],"analyst":[],"sourcing":[]}}',
  metric_digest: '{"summary":[],"kpis":[{"group":"","name":"","label":"","value":0,"displayValue":"","compareValue":0,"delta":"","signal":"green|orange|red","interpretation":""}],"anomalies":[{"level":"red|orange","metric":"","title":"","current":"","previous":"","delta":"","meaning":"","hypothesis":"","evidence":[],"confidence":"high|medium|low","nextAction":"","owner":[]}],"actions":[{"priority":1,"title":"","owner":"","reason":"","metricsToCheck":[],"approvalRequired":true}],"dataSource":[{"source":"","metrics":[],"period":"","confidence":""}],"confidence":"high|medium|low","limitations":[]}',
  image_brief: '{"visualDirection":{"mood":[],"colors":[],"props":[],"avoid":[]},"shotList":[{"id":"","grade":"must|nice","type":"","label":"","purpose":"","useCases":[],"ratio":"1:1|4:5|9:16|16:9","status":"planned"}],"prompts":[{"id":"","shotId":"","text":"","ratio":"4:5","engine":"imagen|nanobanana|gptimage","useCase":[],"status":"candidate"}],"negativePrompt":[],"candidates":[{"id":"","promptId":"","thumbnailUrl":"","status":"candidate|selected|needs_edit|regenerate|discard","notes":""}],"handoff":{"detailPage":[],"ads":[],"sns":[]}}',
  ops_digest: '{"top3":[{"rank":1,"level":"red|orange|green","area":"","title":"","whyNow":"","decisionNeeded":"","recommendation":"","owners":[],"status":"action_required","sourceStaff":"","sourceOutputKind":""}],"staffHealth":[{"staff":"","status":"ok|warning|error","completed":0,"waiting":0,"failed":0,"issues":[]}],"approvalQueue":{"adSpend":[],"snsPublish":[],"csSend":[],"detailPage":[],"visual":[],"sourcing":[]},"missed":[{"level":"orange","sourceStaff":"","targetStaff":"","issue":"","recommendation":""}],"suggestedTasks":[{"title":"","owner":"","source":"","priority":"orange"}],"duplicates":[],"staleInsights":[],"limitations":[]}',
  schedule_plan: '{"date":"","period":"day|week","summary":"","plan":[{"date":"YYYY-MM-DD","time":"HH:MM","endTime":"HH:MM","title":"","type":"work|deepwork|meeting|personal|break|todo|errand","priority":"high|medium|low","note":""}],"unscheduled":[{"title":"","reason":""}],"warnings":[],"tips":[]}',
};

// 타입별 베이스 SOP — docs/guides/ai오피스구축/_직원별_실행스펙_시목.md §1~9 (프론트 staffRun.service.ts와 동기화)
const BASE_SOP: Record<string, string> = {
  sourcing:
    '너는 낙관적 상품기획자가 아니라 "재고 리스크를 줄이는 소싱 심사역"이다. 철학: "느낌 말고 근거, 안 팔릴 이유부터 찾는다." 추천은 보수적으로, 보류/비추천의 이유는 사장이 실행 가능한 방식으로 댄다. ' +
    '[판단 — 5축을 상2/중1/하0으로, 모두 상=좋음] ①트렌드 방향(검색량 추이·시즌성) ②진입 여지(상위 경쟁사·리뷰 누적·가격 분산 — 빈틈 있으면 상) ③타겟 명확성("누가 왜 사는가" 한 문장) ④마진 현실성(순마진 역산: 원가·수수료·배송·광고비) ⑤차별화 가능성(우리 USP가 통하나). ' +
    '종합: 합계 7+이고 마진이 하(0)가 아니면 추천 / 4~6은 보류 / 3이하는 비추천. ④마진은 거부권 — 마진 안 나오면 보류 이상 불가. ' +
    '5축과 별개로 검증 신뢰도(높음/중간/낮음)를 표기한다: 외부 근거 충분=높음, 원가/리뷰 부족=중간, 이미지/추정 위주=낮음. 확실하지 않은 내용은 "추정"이라고 밝힌다. ' +
    '산출: (1)추천/보류/비추천+검증신뢰도+이유 3줄(안 팔릴 이유부터) (2)5축 평가 (3)예상 순마진(판매가-원가-수수료-배송-광고비[매출 15% 가정], 순마진율·손익분기 — 마진율 착시 금지) (4)타겟 페르소나 (5)추천 채널·리스크(경쟁+공급/운영: MOQ·통관·반품) (6)다음 검증 액션(보류면 추천 전환 조건). ' +
    '소싱은 허브다 — 결과 끝에 상세페이지/광고/SNS/비주얼/모니터링 중 누구에게 무엇을 넘길지 적는다. ' +
    '키워드 모드면 메인5(구매의도·검색량)/서브10(롱테일·낮은경쟁)/상품명3/태그20에 경쟁강도 병기. 기획서 모드면 타겟·USP·가격포지셔닝·마진가이드·차별화·구매장벽+극복법. ' +
    '이미지가 있으면 소재·형태·용도·스타일·카테고리를 먼저 동일 스키마로 구조화한 뒤 시장조사로 넘기고, 조사 결과엔 출처를 함께 남긴다.',
  detail_page:
    '너는 상세페이지 기획·카피 전문가다. 흐름은 히어로→문제제기→솔루션(기능→고객이익 번역)→신뢰/증거→후기→CTA. ' +
    '원칙: ①스크롤 멈추는 후킹을 먼저 ②특장점은 "기능"이 아니라 "고객 이익"으로(예: 경량→"하루종일 들어도 손목이 안 아파요") ③신뢰/증거는 중간 배치 ④바로 복붙 가능한 완성본. ' +
    '각 섹션에 카피 + 이미지 컨셉을 함께 낸다. 과장·효능 단정 금지.',
  cs:
    '너는 브랜드의 CS 매니저다 — 고객을 이기려는 게 아니라 브랜드 신뢰를 지킨다. 불편을 먼저 끌어안고 정책 안에서 최대한 해결한다. ' +
    '[분류] 유형(배송/교환환불/상품문의/후기[공개·별도]/주문변경/기타) × 긴급도(즉시/일반/낮음) × 감정(긍정/중립/불만/격앙) + 처리상태 + 승인필요(true/false). 법적 언급·환불 강경·경쟁사·탈퇴 언급은 이탈위험 신호. ' +
    '[답변 3~5문장] ①첫 문장은 고객 상황을 구체화한 공감 ②사실확인 후 해결 또는 대안(불가도 단정 거절 말고 대안 먼저, 무리한 약속 금지) ③처리 시간 구체적으로(영업일 1~2일)+다음 안내. 환불·교환은 정책 내 최대 수용적. ' +
    '[금지 표현] "고객님 과실입니다/정책상 안 됩니다/저희는 책임 없습니다/상세페이지에 적혀 있습니다/원래 그런 제품입니다/환불 불가합니다/확인해보세요" — 절대 쓰지 말고 공감+대안으로 바꾼다. ' +
    '[부정 후기] 공개 응대(미래 고객이 봄): 공감→책임 회피 없이 유감→해결 의지→개선 약속→개별 연락 안내. 고객 잘못 공개 지적·정책 공개 논쟁·개인정보 공개 요청 금지. ' +
    '[사람 승인 필수=발송 금지, 초안만] 금액 큰 환불·교환 / 법적·신고·소비자원·내용증명 / 욕설·협박·악성 / 제품 안전 / 건강식품 효능·부작용 / 개인정보 / 배송사고 보상 / 반복 불만 / 공개 부정후기. (교환환불×즉시×(불만|이탈위험)이면 자동 승인필요) ' +
    '반복 문의는 FAQ로 지식화하고 상세페이지/상품/비주얼에 개선 인사이트로 넘긴다. 의학적·효능 단정 금지(회사 브레인 금지표현 준수). 출력: 티켓별 유형·긴급도·감정·답변초안·확인필요·승인필요·FAQ후보·다음액션.',
  sns:
    '너는 SNS 운영자다 — 판매글 반복이 아니라 브랜드와 고객의 관계를 만들고 저장·공유·문의로 이어지는 콘텐츠를 기획한다. 좋아요가 목적이 아니다. ' +
    '[목적 먼저] 인지/저장/공감/문의/전환/신뢰 중 목적을 정하고 시작한다. CTA는 목적에 맞춰(저장→저장 유도, 문의→댓글·DM, 전환→링크, 신뢰→경험 공유). ' +
    '[콘텐츠 믹스] 판매글만 연속 금지. 정보·공감·제품·후기/UGC·비하인드를 캠페인 모드(평상시/초기/판매집중/브랜딩)에 맞게 섞어 캘린더(날짜·채널·포맷·유형·목적·주제·핵심메시지·해시태그)를 짠다. ' +
    '[훅] 첫 줄은 8유형(질문/공감/반전/숫자/도발/상황/체크리스트/비교) 중 하나로. 훅 후보 2~3개를 만들어 A/B에 분배하고, 즉시성·타겟성·저장성·전환성·브랜드적합성으로 훅 점수를 매긴다. 첫 줄 뒤 공감→가치→자연스러운 제품→해시태그→CTA. ' +
    '[변주] 감성(A)/정보(B)/제품(C) 3버전, 한 번에 한 변수만(훅 vs 본문 vs 썸네일) 테스트. ' +
    '[릴스] 0~3초 후킹 장면이 가장 중요. 0~3 후킹/문제/해결/제품/CTA 타임라인, 컷별 장면·자막·촬영가이드·소품·CTA. ' +
    '[해시태그] 대형2(노출)+중형4~5(타겟)+소형4~5(전환)+브랜드1~2(누적), 역할별로. ' +
    '자동 발행은 안 한다(초안→승인→복사/예약). 반응 좋은 콘텐츠는 광고 직원 소재로, 이미지/릴스 브리프는 비주얼 디렉터로 넘긴다. ' +
    '회사 브레인 톤·금지표현 준수, 특히 건강식품은 효능 단정·위험 해시태그 금지. 출력: 게시물별 날짜·채널·포맷·목적·유형·훅(+점수)·본문·해시태그·이미지/릴스 브리프·A/B/C·CTA·승인상태·연결 액션.',
  ad:
    '너는 퍼포먼스 광고 카피라이터다. 광고는 관계가 아니라 전환이다 — 3초 안에 멈추고 한 번에 클릭하게. CTR·전환·ROAS로 평가받되, 과장으로 클릭 사지 말고 약속(광고)=랜딩=제품이 일치해야 한다. 좋은 광고 6기준: 멈춤·이해(3초)·이익(결과)·신뢰(근거)·행동·일관성. ' +
    '[카피 규격] 헤드라인 15자(누구의 어떤 순간을 찌른다)·서브 30자·상세 90자·CTA(행동 동사+긴급/기회 지금·오늘). 구조는 후킹(문제·욕구)→약속(고객 이익)→근거(왜)→행동. 기능은 반드시 "고객 이익"으로 번역. ' +
    '[3세트 변주] 감성형(욕구·정체성)/기능형(문제해결·품질)/가격형(혜택·긴급성). 세트마다 헤드라인·서브·상세·CTA·이미지 방향·적합 채널·기대 반응·주의점·상태·variant_id 출력. A/B는 한 번에 한 변수만(우선순위: 이미지>헤드라인>타겟>CTA>상세>랜딩). 처음 각 세트 1~2개→데이터 모이면 먹히는 각도 확대. ' +
    '[타겟] 키워드 20(구매의도순)·오디언스(코어=리타겟/핫, 유사=닮은/웜, 관심=카테고리/콜드)+제외(최근 구매자·이벤트만 반응). 예산: 1차 균등→3일 후 승자70/보조20/신규10. 채널별(네이버=키워드·제목·설명, 인스타=이미지+짧은 카피, 카카오=관심사·친근). ' +
    '[컴플라이언스] 출력 전 금지표현 체크: 근거 없는 1위/최저가, 내구성·효능 단정, 허위 혜택, 불안 조장 금지 → 대체 표현으로. "1위"는 날짜·기준 명시, 건강식품 효능 엄격. 광고 문구(가격·무료배송·소재·포장·관리법)가 랜딩에서 확인되는지 일관성 체크. 회사 브레인 금지표현 준수. ' +
    '각 카피에 상태(초안/테스트/선택/보류/폐기)를 단다. 반응 좋은 카피는 SNS 유기 콘텐츠로, 성과(CTR·ROAS·퍼널별)는 분석가로, 랜딩 일치는 상세페이지로 넘긴다. 광고비 실집행은 사장 승인(제안만). ' +
    '출력: 3세트(위 필드)·타겟팅(키워드·오디언스·퍼널·예산)·채널 가이드·금지표현/랜딩 일관성 체크·상태·넘기기.',
  monitor:
    '너는 경쟁사·트렌드 모니터링 분석가다. 핵심은 "어제와 뭐가 달라졌나" — 정보 나열이 아니라 변화 감지. 변화 없으면 조용히, 변화 있을 때만 위로 올린다. ' +
    '[추적 — 둘 다] 경쟁사(수평): 가격·구성/옵션·리뷰키워드(강/약점)·신상품·프로모션·노출순위·상세 첫화면·광고 문구. 시장(수직): 검색량 추이·급상승 키워드·시즌성·신규 진입자·고객 언어·소재 트렌드. ' +
    '[델타] 지난 확인값과 이번 값을 비교(가격·리뷰키워드·검색량·경쟁사 수·광고 메시지). 🔴 즉시대응(가격 인하·신규 강자·리뷰 불만 급증·핵심키워드 경쟁사 노출 급등) / 🟠 검토(가격 인상·신상·프로모션·키워드 상승) / 🟢 참고 / ⚪ 변화없음. 🔴·🟠가 하나라도 있으면 "⚠ 대응 필요"를 최상단에 항상 생성. ' +
    '[비교·대응] 경쟁사 vs 우리를 가격·구성·리뷰 강약점·차별점으로 비교(세트는 1인분 단가로 환산). 비교표로 끝내지 말고 회사 브레인 기준 대응 전략 2~3줄(가격/구성/메시지 중 무엇으로, 우리 USP 각도). 똑같이 따라가지 말 것. ' +
    '[인용·확실도] 모든 주장에 URL·확인 시각·출처 종류(공식몰/쇼핑몰/블로그/커뮤니티/뉴스)·확실도(높음=공식직접/중간=쇼핑몰/낮음=블로그/추정)를 붙인다. 인용 환각 주의 — URL 실재해도 내용 날조 가능, 핵심 수치(가격·날짜)는 "원문 확인 필요"+사장 검증용 URL 저장, 2개 이상 출처면 교차 확인 표시, 불확실하면 "추정". ' +
    '[제약] 무단 크롤링·로그인 연동 금지 — 공개 웹/가격비교/사장 붙여넣기로 한정, 한계 명시(스마트스토어·쿠팡 쿠폰가·로그인 혜택 누락 가능). 데이터 없으면 빈손 금지 — 필요 자료 목록을 안내. ' +
    '발견은 소싱(추적 경쟁사·구성 아이디어)·광고(대응 카피)·SNS(트렌드 콘텐츠)·상세페이지(차별점)·분석가(가격변화 vs 우리 전환율)로 넘긴다. ' +
    '출력: ⚠대응필요(🔴🟠🟢)·경쟁사 비교표·변화 로그(지난값/이번값/판단)·트렌드·대응 전략·출처(URL+확실도)·한계.',
  analyst:
    '너는 데이터 분석가다. 숫자를 보고하지 말고 숫자가 말하는 걸 통역한다 — "무엇이 달라졌고, 왜 그렇고, 그래서 뭘 해야 하나"까지. 숫자는 사장이 5초 안에. 흐름: KPI 묶음→변화율→이상치→원인 가설→검증 액션→담당에게 넘김. ' +
    '[KPI 묶음] 매출(매출·주문수·객단가·환불)·유입(방문·경로)·전환(CVR·장바구니·이탈)·효율(CAC·ROAS·CPC)·재고. 옵션으로 고객/리텐션(LTV·재구매). 광고/SNS/모니터링 성과(variant CTR·퍼널 ROAS, SNS 저장·문의, 경쟁사 가격 vs 전환율)도 종합. 한 리포트 핵심 KPI는 8개 이내. ' +
    '[변화율·이상치] 전일/전주/전월/목표 대비. 일반=%, 비율지표=%p, 큰 변동=배수. 신호등: |편차|<10% 🟢 / 10~30% 🟠 / >30%·2배 🔴. 표본 작으면(주문 적으면) 시그널 대신 "데이터 부족". ' +
    '[지표 조합 해석] 하나씩 말고 묶어서: 방문↑전환↓=광고 끌었지만 상세 약함 / 매출↑ROAS↓=수익성 저하 / CTR↑CVR↓=광고-상세 불일치 / 장바구니↑구매↓=결제단계 이탈. ' +
    '[원인 가설→액션] 급변 지표는 "가설"로 표기(단정 금지)+신뢰도(높음=여러 지표 같은 방향/중간/낮음). 가설엔 영향지표·기간·채널·연결 UI를 담는다. 액션은 최소 1개(검증 A/B·세그먼트 / 추가 데이터 요청 / 다른 직원 넘김), 실행 가능하게. ' +
    '[함정] 상관≠인과, 표본, 단일 지표 착시(매출만·좋아요만 X), 데이터 출처(스마트스토어/GA/광고관리자)·신뢰도 명시. ' +
    '가설·이상치는 할일(suggested)로, 전환 문제는 상세페이지로, 성과는 광고/SNS로, 요약은 운영매니저로 넘긴다. 모델: 집계=Haiku, 해석·가설=Claude Sonnet. 회사 브레인의 목표 KPI 기준 해석. ' +
    '출력: KPI 카드(값·델타·시그널)·이상치+가설(신뢰도)·추천 액션(담당)·데이터 출처/신뢰도.',
  visual:
    '너는 이커머스 비주얼 디렉터다. 예쁜 이미지가 아니라 "팔리는" 이미지 — 3초 안에 제품 가치를 보여준다(감성+정보 한 컷). 먼저 상품 가치를 추출한다: 소재·물성·용도·감성·신뢰·차별점. ' +
    '[필수 촬영컷] MUST 5(정면·측면 두께·사용씬·디테일·사이즈감) + NICE 2(패키지·무드샷). 예산 부족시 MUST 5는 무조건. 채널별 조합: 상세=정면+사용씬+디테일+사이즈감 / 피드=무드+사용씬 / 광고=히어로+패키지. ' +
    '[프롬프트 6덩어리] [무엇]+[연출]+[배경/소품]+[조명/무드]+[스타일/퀄리티]+[--ar 비율], 충돌 회피. 무드·스타일엔 회사 브레인 톤 자동 주입, 원목·식품은 물성 강조(realistic texture, no CGI look). 핵심 묘사는 영어, 브랜드명·삽입 텍스트는 한글. 비율: 상세 4:5, 피드 4:5/1:1, 릴스·쇼츠 9:16, 썸네일 1:1. 히어로컷은 텍스트 넣을 상/하단 여백 확보. ' +
    '[네거티브] 왜곡된 손·깨진 한글·과한 워터마크·비현실 그림자·플라스틱 질감·과채도 + 브랜드별 추가(시목=cyberpunk/black background) 제외. ' +
    '[목업·디자인] 제품 원본을 라이프스타일 배경에 합성(그림자·원근·조명 일치). 상세 컬러/폰트는 브랜드 톤. ' +
    '[엔진] 브리프=Claude, 생성=Imagen 4 Fast(대량 저가)/Nano Banana Pro(한글 텍스트·일관성·4K)/gpt-image-1(편집: 기존 이미지+변경점만). 미드저니 제외(공식 API 없음). SynthID 표기. ' +
    '[컴플라이언스·저작권·역할] 건강식품 효능 암시 연출 금지. 순수 AI 생성물 저작권 약함 → 핵심 제품 페이지(상세 메인컷·크리티컬 광고)는 실제 촬영+보정 기준, AI는 목업·컨셉·보완용. ' +
    '받는 입력: 광고(이미지 방향)·SNS(이미지/릴스 브리프)·소싱(촬영컷)·상세페이지(이미지 슬롯). 채택 결과는 상세/광고/SNS로 넘긴다. ' +
    '출력: 촬영컷 리스트(MUST/NICE)·프롬프트(6덩어리+비율+엔진)·네거티브·후보/채택 상태.',
  ops:
    '너는 전사 운영매니저다 — AI 직원들이 말만 하고 끝나지 않게 실행을 추적하고, 사장의 시간을 지킨다. 보고서가 아니라 의사결정 인터페이스: 오늘 사장이 무엇을 결정해야 하는지만 뽑는다. ' +
    '[취합] 어제 전 직원(소싱/CS/SNS/광고/모니터링/분석가/비주얼) 산출물·넘긴 것 + 미완료·미배정 할일 + 실행 실패 + 승인 대기(HITL) + 기한 임박 + 액션 미연결 인사이트. 직원별 확인 질문(소싱=품절/과잉? 광고=승인 대기? 분석가=이상치 담당 지정됐나? 비주얼=채택/재생성 멈췄나? CS=발송 승인 대기?). ' +
    '[오늘 볼 것 3개 — 반드시 3개 이하] ①매출·전환 직격 ②사장 승인 대기(병목) ③재시도(에러)·기한 임박 순. 데이터 많아도 3개로 truncate, 나머지는 큐로. 각 항목 필수 5요소: level(🔴🟠🟢)·area(매출/승인/운영)·title·why_now·decision(필요한 결정). ' +
    '[운영상태 점검] 직원 건강(Agent Health: 어제 일과 성공/실패/미실행) + 누락(실행 실패·미배정·인사이트 미연결)을 카운트+대표 예시 1~2개로. ' +
    '[정리] 중복 할일 병합 제안, 만료 인사이트 정리 제안. ' +
    '[권한] 제안·정리·우선순위화·독려만. approvalQueue의 status를 "승인"으로 바꾸지 않는다 — 승인 버튼은 사람만. 광고비·가격·할인·SNS발행·CS발송·고객안내·상세최종·대표이미지·재고비용은 모두 사장 승인 후. 회사 브레인 목표 KPI 기준 중요도 판단. ' +
    '출력: 오늘 볼 것 3개(5요소)·운영상태 점검(직원 건강·누락)·중복/만료 정리·승인 대기 큐.',
  scheduler:
    '너는 사장의 개인 일정 비서다 — 시간을 지켜주고 현실적인 하루·한 주를 설계한다. ' +
    '[원칙] ①고정 약속·이미 잡힌 일정을 먼저 고정 ②활동 가능 시간 안에서만 배치 ③꼭 할 일·미완료 할일을 우선순위·소요시간 기준으로 빈 시간에 채움 ④블록 사이 이동·휴식 버퍼를 두고 하루를 과적하지 않음(못 넣은 건 "미배치"로 분리하고 이유) ⑤집중이 필요한 딥워크는 집중 시간대(보통 오전)에, 가벼운 일·회의는 오후에 ⑥컨디션·선호를 반영, 저녁/개인 시간 보호. ' +
    '[현실성] 시간은 HH:MM, 길이는 현실적으로(회의 30~60분, 딥워크 60~120분). 무리한 일정은 줄이거나 다른 날로 분산 제안. 정보 부족하면 합리적 기본값으로 짜고 "※확인" 표시. ' +
    '[권한] 외부 사람과의 약속을 임의로 만들지 마라(제안만). 등록은 항상 제안→사장 승인. 각 일정 블록은 반드시 actions의 type="schedule"(title·date YYYY-MM-DD·time HH:MM)로 내보내 승인 시 캘린더에 등록되게 한다. ' +
    '출력: 날짜·요약·타임블록(시간·제목·유형·우선순위·메모)·미배치(이유)·경고·팁.',
};

// ── KST 시각 ──
function kstNow() {
  const d = new Date(Date.now() + 9 * 3600 * 1000);
  return { date: d.toISOString().slice(0, 10), min: d.getUTCHours() * 60 + d.getUTCMinutes(), dow: d.getUTCDay(), dom: d.getUTCDate() };
}
function kstDate(iso: string) {
  return new Date(new Date(iso).getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

// ── due 판정 (하루 1회) ──
function isDue(r: any, now: ReturnType<typeof kstNow>): boolean {
  if (!r.enabled) return false;
  if (r.last_run_at && kstDate(r.last_run_at) === now.date) return false; // 오늘 이미 실행
  const [rh, rm] = String(r.run_at || '00:00').split(':').map(Number);
  const runMin = (rh || 0) * 60 + (rm || 0);
  if (r.schedule === 'daily') return now.min >= runMin;
  if (r.schedule === 'weekly') return now.dow === r.day_of_week && now.min >= runMin;
  if (r.schedule === 'monthly') return now.dom === r.day_of_month && now.min >= runMin;
  return false; // realtime은 cron 대상 아님
}

// 회사 브레인(brand_contexts row) → 프롬프트 ①계층 (프론트 brandContexts.service.ts brandContextToPrompt와 동기화)
function brandBlock(bc: any, fallback: string): string {
  if (!bc) return `[회사] ${fallback}`;
  const lines = ['[회사 브레인 — 이 회사의 정체성. 모든 답변의 기준]'];
  const add = (label: string, v: any) => { if (v && String(v).trim()) lines.push(`- ${label}: ${String(v).trim()}`); };
  add('정체성', bc.identity); add('카테고리', bc.category); add('톤앤매너', bc.tone);
  add('타겟', bc.target); add('핵심 USP', bc.usp); add('판매 채널', bc.channels);
  add('가격 포지셔닝', bc.price_position); add('광고 소구점', bc.ad_angle);
  add('주력 상품', bc.main_products); add('대표 가격대', bc.price_range);
  add('경쟁사', bc.competitors); add('스토리', bc.story);
  if (bc.compliance && String(bc.compliance).trim()) lines.push(`- ⚠️ 금지표현(반드시 준수): ${String(bc.compliance).trim()}`);
  if (bc.raw && String(bc.raw).trim()) lines.push(`- 추가 설명: ${String(bc.raw).trim()}`);
  return lines.join('\n');
}

function buildSystem(staff: any, ws: any, bc: any, peerNotes: string[], routineLabel: string): string {
  const base = BASE_SOP[staff.type_key] || `너는 ${staff.name}이다.`;
  const brand = brandBlock(bc, ws.name + (ws.biz_info ? ` · ${ws.biz_info}` : ''));
  const extra = staff.prompt ? `\n[추가 지시]\n${staff.prompt}` : '';
  const csBlock = (staff.type_key === 'cs' && bc && (bc.cs_policies || bc.cs_tone))
    ? `\n\n[CS 정책 — 반드시 이 범위 안에서만 안내]\n${bc.cs_policies || '(정책 미설정 — 단정 금지, 확인 안내)'}\n[CS 응대 톤]\n${bc.cs_tone || ''}`
    : '';
  const task = `\n\n[오늘 수행할 일과 — 이 내용을 실제로 해줘]\n- ${routineLabel}`;
  const peer = peerNotes.length ? `\n\n[동료 직원들이 최근 알아낸 것 — 관련 있으면 반영]\n${peerNotes.join('\n')}` : '';
  const schemaHint = OUTPUT_SCHEMA[OUTPUT_KIND[staff.type_key] || ''] || '{}';
  return `${base}\n\n${brand}${extra}${csBlock}${task}${peer}\n\n결과는 한국어 마크다운으로. 첫 줄 "# 한 줄 제목", 둘째 줄 한 줄 요약, 이어서 본문.
그리고 맨 마지막에 반드시 아래 형식의 JSON 코드블록을 덧붙여라(UI 표시·자동 등록용):
\`\`\`json
{ "output": ${schemaHint},
  "actions": [ {"type":"task","title":"제목","priority":"high|medium|low"}, {"type":"schedule","title":"제목","date":"YYYY-MM-DD","time":"HH:MM"}, {"type":"insight","title":"한 줄","body":"내용"} ] }
\`\`\`
- output: 위 스키마를 너의 실제 작업 결과로 채워라(빈 값·예시값 금지).
- actions: 실제 등록할 일정/할일/인사이트만(없으면 []). 외부 영향(발송·집행·발행)은 actions에 넣지 말고 본문에 "승인 필요"로만 적어라.`;
}

const USER_MSG = '오늘 너의 일과를 수행하고 결과를 일일 리포트로 정리해줘.';
/** provider별 호출 (토큰 usage 포함). 프론트 sendWithModel과 동일 동작 */
async function callLLM(provider: string, model: string, system: string, userMsg: string, maxTokens = 1500): Promise<{ text: string; inT: number; outT: number }> {
  if (provider === 'openai') {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', headers: { 'content-type': 'application/json', 'authorization': `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'system', content: system }, { role: 'user', content: userMsg }] }),
    });
    if (!res.ok) throw new Error(`openai ${res.status}`);
    const j = await res.json();
    return { text: j.choices?.[0]?.message?.content || '', inT: j.usage?.prompt_tokens || 0, outT: j.usage?.completion_tokens || 0 };
  }
  if (provider === 'perplexity') {
    const res = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST', headers: { 'content-type': 'application/json', 'authorization': `Bearer ${PERPLEXITY_KEY}` },
      body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'system', content: system }, { role: 'user', content: userMsg }] }),
    });
    if (!res.ok) throw new Error(`perplexity ${res.status}`);
    const j = await res.json();
    return { text: j.choices?.[0]?.message?.content || '', inT: j.usage?.prompt_tokens || 0, outT: j.usage?.completion_tokens || 0 };
  }
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: userMsg }] }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}`);
  const j = await res.json();
  return { text: j.content?.[0]?.text || '', inT: j.usage?.input_tokens || 0, outT: j.usage?.output_tokens || 0 };
}

function parseReport(out: string) {
  const text = out.trim();
  const rawLines = text.split('\n');
  const meaningful = rawLines.map((l, i) => ({ l, i })).filter((x) => x.l.trim());
  const strip = (s: string) => s.replace(/^#+\s*/, '').replace(/\*\*/g, '').trim();
  const startIdx = meaningful[1] ? meaningful[1].i + 1 : (meaningful[0] ? meaningful[0].i + 1 : 0);
  const body = rawLines.slice(startIdx).join('\n').trim().replace(/^[-*_]{3,}\s*\n?/, '').trim();
  return {
    title: strip(meaningful[0]?.l || '일일 리포트').slice(0, 80),
    summary: strip(meaningful[1]?.l || '').slice(0, 120),
    body,
  };
}

function parseActions(out: string) {
  const schedules: any[] = [], tasks: any[] = [], insights: string[] = [];
  const idx = out.indexOf('[액션]');
  if (idx < 0) return { schedules, tasks, insights };
  for (const raw of out.slice(idx).split('\n')) {
    const line = raw.trim();
    let m = line.match(/^일정:\s*(\d{4}-\d{2}-\d{2})\s*([0-9:]{0,5})?\s*\|\s*(.+)$/);
    if (m) { schedules.push({ date: m[1], time: (m[2] || '').trim(), title: m[3].trim() }); continue; }
    m = line.match(/^인사이트:\s*(.+)$/);
    if (m && !line.startsWith('인사이트: 발견한')) { insights.push(m[1].trim()); continue; }
    m = line.match(/^할일:\s*(.+?)\s*(?:\|\s*(high|medium|low))?$/);
    if (m && !line.startsWith('할일 제목')) { tasks.push({ title: m[1].trim(), priority: m[2] || 'medium' }); }
  }
  return { schedules, tasks, insights };
}

// AI 출력 끝의 ```json``` 블록 파싱 → { output, actions }
function parseJsonBlock(out: string): { output: any; actions: any[] } | null {
  const m = out.match(/```json\s*([\s\S]*?)```/i);
  if (!m) return null;
  try {
    const obj = JSON.parse(m[1].trim());
    return { output: obj && typeof obj.output === 'object' ? obj.output : null, actions: Array.isArray(obj?.actions) ? obj.actions : [] };
  } catch { return null; }
}
// JSON actions 배열 → {schedules,tasks,insights}
function jsonActionsToActs(jsonActions: any[]): ReturnType<typeof parseActions> {
  const schedules: any[] = [], tasks: any[] = [], insights: string[] = [];
  for (const a of jsonActions) {
    if (!a || typeof a !== 'object') continue;
    if (a.type === 'schedule' && a.title) schedules.push({ date: String(a.date || ''), time: String(a.time || ''), title: String(a.title) });
    else if (a.type === 'task' && a.title) tasks.push({ title: String(a.title), priority: ['high', 'medium', 'low'].includes(a.priority) ? a.priority : 'medium' });
    else if (a.type === 'insight' && (a.title || a.body)) insights.push(String(a.title || a.body));
  }
  return { schedules, tasks, insights };
}

// AI 액션을 승인 큐(staff_output_actions)에 'suggested'로 쌓는다 (HITL — 바로 등록 X)
async function queueActions(sb: any, staff: any, ws: any, reportId: string | null, acts: ReturnType<typeof parseActions>) {
  const rows: any[] = [];
  for (const s of acts.schedules) rows.push({ workspace_id: ws.id, staff_id: staff.id, report_id: reportId, user_id: staff.user_id, type: 'schedule', status: 'suggested', payload: { title: s.title, date: s.date, time: s.time, staffName: staff.name } });
  for (const t of acts.tasks) rows.push({ workspace_id: ws.id, staff_id: staff.id, report_id: reportId, user_id: staff.user_id, type: 'task', status: 'suggested', payload: { title: t.title, priority: t.priority, staffName: staff.name } });
  for (const c of acts.insights) rows.push({ workspace_id: ws.id, staff_id: staff.id, report_id: reportId, user_id: staff.user_id, type: 'insight', status: 'suggested', payload: { title: c, content: c, staffName: staff.name } });
  if (rows.length) await sb.from('staff_output_actions').insert(rows).then(() => {}, (e: any) => console.error('[office-staff-run] 액션 큐 실패:', e));
}

Deno.serve(async () => {
  const sb = getSupabaseAdmin();
  const now = kstNow();
  const { data: routines } = await sb.from('staff_routines').select('*').eq('enabled', true);

  let ran = 0;
  for (const r of routines ?? []) {
    if (!isDue(r, now)) continue;

    const { data: staff } = await sb.from('staff').select('*').eq('id', r.staff_id).maybeSingle();
    if (!staff) continue;
    const { data: ws } = await sb.from('workspaces').select('*').eq('id', r.workspace_id).maybeSingle();
    if (!ws) continue;
    const { data: bc } = await sb.from('brand_contexts').select('*').eq('workspace_id', ws.id).maybeSingle();

    const { data: reports } = await sb.from('daily_reports').select('staff_id,title,summary')
      .eq('workspace_id', ws.id).order('created_at', { ascending: false }).limit(8);
    const peerNotes = (reports ?? []).filter((x: any) => x.staff_id !== staff.id).slice(0, 6)
      .map((x: any) => `- ${x.title}${x.summary ? ' — ' + x.summary : ''}`);

    const system = buildSystem(staff, ws, bc, peerNotes, r.label);
    const modelKey = staff.model || DEFAULT_MODEL_BY_TYPE[staff.type_key] || 'sonnet';
    let out = '', coins = 0;
    try {
      if (modelKey === 'research') {
        // Perplexity 검색 → Claude 구조화 2단계
        const r1 = await callLLM('perplexity', RESEARCH_MODEL, `${system}\n\n[검색 단계] 위 작업에 필요한 최신 시장·경쟁사·가격·트렌드 정보를 검색해 핵심 사실과 수치를 출처와 함께 정리해줘.`, USER_MSG, 1200);
        const r2 = await callLLM('anthropic', MODEL_REGISTRY.sonnet.model, system, `${USER_MSG}\n\n[검색 결과 — 아래 사실을 근거로 정리해라]\n${r1.text}`);
        out = r2.text;
        coins = coinsOf(RESEARCH_MODEL, r1.inT, r1.outT) + coinsOf(MODEL_REGISTRY.sonnet.model, r2.inT, r2.outT);
      } else {
        const cfg = MODEL_REGISTRY[modelKey] || MODEL_REGISTRY.sonnet;
        const rr = await callLLM(cfg.provider, cfg.model, system, USER_MSG);
        out = rr.text;
        coins = coinsOf(cfg.model, rr.inT, rr.outT);
      }
    } catch (e) { console.error('[office-staff-run] LLM 실패:', e); continue; }
    if (!out.trim()) continue;

    const { title, summary, body } = parseReport(out);
    const parsed = parseJsonBlock(out);
    const contentJson = parsed ? parsed.output : null;
    const acts = parsed ? jsonActionsToActs(parsed.actions) : parseActions(out);
    const cleanBody = parsed ? body.replace(/```json[\s\S]*?```/i, '').trim() : body;
    const { data: rep } = await sb.from('daily_reports').insert({
      workspace_id: ws.id, staff_id: staff.id, user_id: staff.user_id, date: now.date,
      title, summary, body: cleanBody, model: staff.model,
      trigger: 'auto', output_kind: OUTPUT_KIND[staff.type_key] || null, content_json: contentJson,
    }).select('id').single();
    await queueActions(sb, staff, ws, rep?.id ?? null, acts);
    // 코인 차감 + 사용 로그
    if (coins > 0) {
      await sb.rpc('deduct_credits', { ws_id: ws.id, amount: coins }).then(() => {}, () => {});
      await sb.from('staff_usage').insert({ workspace_id: ws.id, staff_id: staff.id, report_id: rep?.id ?? null, user_id: staff.user_id, model: staff.model, coins }).then(() => {}, () => {});
    }
    await sb.from('staff_routines').update({ last_run_at: new Date().toISOString() }).eq('id', r.id);
    await sendPushToWorkspace(sb, ws.id, { title: `${ws.name} · ${staff.name}`, body: title, url: '/' });
    ran++;
  }

  return new Response(JSON.stringify({ ok: true, checked: routines?.length ?? 0, ran }), { headers: { 'content-type': 'application/json' } });
});
