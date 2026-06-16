/**
 * @file src/services/staffRun.service.ts
 * @description AI 직원 실행 엔진 (Phase 4)
 * - 시스템 프롬프트 3겹 결합: [타입 베이스 SOP] + [브랜드 컨텍스트] + [사용자 프롬프트]
 * - AI 호출 → 일일 리포트 생성·저장. (API 키 없거나 오류 시 데모 리포트로 폴백)
 * - 지금은 "지금 실행" 버튼으로 온디맨드. cron 자동화는 Edge Function으로 확장 예정.
 */
import { sendWithModel, calcCoins } from './chatApi';
import { deductCredits } from './credits.service';
import { createReport, fetchReportsByWorkspace } from './dailyReports.service';
import { fetchStaff, fetchRoutines } from './staff.service';
import { createSuggestedActions } from './staffOutputActions.service';
import { getStaffType } from '../data/staffCatalog';
import { fetchBrandContext, brandContextToPrompt } from './brandContexts.service';
import { Staff, Workspace, DailyReport, BrandContext, ReportTrigger, OutputKind } from '../types';

/**
 * 타입별 베이스 SOP (코드 고정 — 우리가 확보한 노하우)
 * 출처: docs/guides/ai오피스구축/_직원별_실행스펙_시목.md §1~9
 * (01~06 AGENT 문서 + 07~13 품질 노하우 + 3사 검증을 압축한 1차 골격)
 */
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
};

/** 직원 모델(StaffModel) → 실제 provider+model. research는 2단계라 별도 처리 */
const MODEL_REGISTRY: Record<string, { provider: 'anthropic' | 'openai' | 'perplexity'; model: string }> = {
  sonnet: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
  haiku: { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' },
  opus: { provider: 'anthropic', model: 'claude-opus-4-8' },
  gpt: { provider: 'openai', model: 'gpt-4o' },
};
const RESEARCH_MODEL = { provider: 'perplexity' as const, model: 'sonar-pro' };

/**
 * outputKind별 구조화 출력(JSON) 스키마 힌트.
 * AI가 마크다운 본문 + 마지막에 이 스키마로 채운 ```json``` 블록을 낸다 → content_json 저장(UI 카드용).
 * 직원 SOP 문서의 "출력 구조 + JSON 병행"과 동기화.
 */
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
};

function buildSystemPrompt(staff: Staff, workspace: Workspace, brand: BrandContext | null, peerNotes: string[], tasks: string[], manualInput?: string): string {
  const type = getStaffType(staff.typeKey);
  const base = BASE_SOP[staff.typeKey] || `너는 ${type?.label || 'AI 직원'}이다.`;
  // ① 회사 브레인 (사장이 입력한 brand_contexts) — 모든 답변의 기준
  const brandBlock = brandContextToPrompt(brand, workspace.name + (workspace.bizInfo ? ` · ${workspace.bizInfo}` : ''));
  const extra = staff.prompt ? `\n[추가 지시]\n${staff.prompt}` : '';
  // CS 직원 전용 — 정책/톤 주입 (정책 범위 내 응대 + 브랜드 톤)
  const csBlock = (staff.typeKey === 'cs' && brand && (brand.csPolicies || brand.csTone))
    ? `\n\n[CS 정책 — 반드시 이 범위 안에서만 안내]\n${brand.csPolicies || '(정책 미설정 — 단정 금지, 확인 안내)'}\n[CS 응대 톤]\n${brand.csTone || ''}`
    : '';
  // ★ 수동(직접 시키기) 입력이 있으면 그것을 우선 수행, 없으면 설정된 일과
  const task = manualInput
    ? `\n\n[작업 지시 — 사장이 직접 시킨 일. 이것을 수행해라]\n${manualInput}`
    : (tasks.length ? `\n\n[오늘 수행할 일과 — 이 내용을 실제로 해줘]\n${tasks.map(t => '- ' + t).join('\n')}` : '');
  // ★ 동료 직원들의 최근 산출물 주입 → 서로의 결과를 참고해 협업
  const peer = peerNotes.length
    ? `\n\n[동료 직원들이 최근 알아낸 것 — 관련 있으면 반영해서 작업]\n${peerNotes.join('\n')}`
    : '';
  const schemaHint = OUTPUT_SCHEMA[type?.outputKind || ''] || '{}';
  return `${base}\n\n${brandBlock}${extra}${csBlock}${task}${peer}\n\n결과는 한국어 마크다운으로. 첫 줄은 "# 한 줄 제목", 둘째 줄은 한 줄 요약, 이어서 본문(오늘 한 일·핵심·내일 제안).
그리고 맨 마지막에 반드시 아래 형식의 JSON 코드블록을 덧붙여라(UI 표시·자동 등록용):
\`\`\`json
{ "output": ${schemaHint},
  "actions": [ {"type":"task","title":"제목","priority":"high|medium|low"}, {"type":"schedule","title":"제목","date":"YYYY-MM-DD","time":"HH:MM"}, {"type":"insight","title":"한 줄","body":"내용"} ] }
\`\`\`
- output: 위 스키마를 너의 실제 작업 결과로 채워라(빈 값·예시값 금지).
- actions: 실제 등록할 일정/할일/인사이트만(없으면 []). 외부 영향(발송·집행·발행)은 actions에 넣지 말고 본문에 "승인 필요"로만 적어라.`;
}

/** AI 출력의 [액션] 블록 파싱 → 일정/할일/인사이트 후보 */
function parseActions(out: string): {
  schedules: { date: string; time: string; title: string }[];
  tasks: { title: string; priority: string }[];
  insights: string[];
} {
  const schedules: { date: string; time: string; title: string }[] = [];
  const tasks: { title: string; priority: string }[] = [];
  const insights: string[] = [];
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

type ParsedActs = { schedules: { date: string; time: string; title: string }[]; tasks: { title: string; priority: string }[]; insights: string[] };

/** AI 출력 끝의 ```json``` 블록 파싱 → { output(구조화), actions } */
function parseJsonBlock(out: string): { output: Record<string, unknown> | null; actions: any[] } | null {
  const m = out.match(/```json\s*([\s\S]*?)```/i);
  if (!m) return null;
  try {
    const obj = JSON.parse(m[1].trim());
    return {
      output: obj && typeof obj.output === 'object' && obj.output ? obj.output : null,
      actions: Array.isArray(obj?.actions) ? obj.actions : [],
    };
  } catch { return null; }
}

/** JSON actions 배열 → 기존 {schedules,tasks,insights} 형태로 변환 */
function jsonActionsToActs(jsonActions: any[]): ParsedActs {
  const schedules: ParsedActs['schedules'] = [], tasks: ParsedActs['tasks'] = [], insights: string[] = [];
  for (const a of jsonActions) {
    if (!a || typeof a !== 'object') continue;
    if (a.type === 'schedule' && a.title) schedules.push({ date: String(a.date || ''), time: String(a.time || ''), title: String(a.title) });
    else if (a.type === 'task' && a.title) tasks.push({ title: String(a.title), priority: ['high', 'medium', 'low'].includes(a.priority) ? a.priority : 'medium' });
    else if (a.type === 'insight' && (a.title || a.body)) insights.push(String(a.title || a.body));
  }
  return { schedules, tasks, insights };
}

/** AI 액션을 승인 큐(staff_output_actions)에 'suggested'로 쌓는다 (HITL — 바로 등록 X) */
async function queueActions(staff: Staff, workspace: Workspace, reportId: string, acts: ParsedActs): Promise<number> {
  const actions = [
    ...acts.schedules.map(s => ({ type: 'schedule' as const, payload: { title: s.title, date: s.date, time: s.time, staffName: staff.name } })),
    ...acts.tasks.map(t => ({ type: 'task' as const, payload: { title: t.title, priority: t.priority, staffName: staff.name } })),
    ...acts.insights.map(c => ({ type: 'insight' as const, payload: { title: c, content: c, staffName: staff.name } })),
  ];
  if (!actions.length) return 0;
  try {
    await createSuggestedActions({ workspaceId: workspace.id, staffId: staff.id, reportId, actions });
    return actions.length;
  } catch (e) { console.warn('[staffRun] 액션 큐 저장 실패:', e); return 0; }
}

/** 같은 워크스페이스 동료 직원들의 최근 리포트 요약(본인 제외, 최신 6건) */
async function collectPeerNotes(staff: Staff, workspace: Workspace): Promise<string[]> {
  try {
    const [peers, reports] = await Promise.all([
      fetchStaff(workspace.id),
      fetchReportsByWorkspace(workspace.id, 12),
    ]);
    const byId = new Map(peers.map(s => [s.id, s]));
    return reports
      .filter(r => r.staffId !== staff.id)
      .slice(0, 6)
      .map(r => {
        const s = byId.get(r.staffId);
        const label = s?.name || '직원';
        return `- [${label}] ${r.title}${r.summary ? ' — ' + r.summary : ''}`;
      });
  } catch {
    return [];
  }
}

function parseReport(out: string): { title: string; summary: string; body: string } {
  const text = out.trim();
  const rawLines = text.split('\n');
  const meaningful = rawLines.map((l, i) => ({ l, i })).filter(x => x.l.trim());
  const strip = (s: string) => s.replace(/^#+\s*/, '').replace(/\*\*/g, '').trim();
  const title = strip(meaningful[0]?.l || '일일 리포트').slice(0, 80);
  const summary = strip(meaningful[1]?.l || '').slice(0, 120);
  // 본문 = 요약 줄 다음부터 → 제목/요약이 본문에 또 나오는 중복 제거
  const startIdx = meaningful[1] ? meaningful[1].i + 1 : (meaningful[0] ? meaningful[0].i + 1 : 0);
  let body = rawLines.slice(startIdx).join('\n').trim();
  body = body.replace(/^[-*_]{3,}\s*\n?/, '').trim();  // 본문 맨 앞 구분선(---) 제거 → 카드 구분선과 중복 방지
  return { title, summary, body };
}

/** 입력 객체(직접 시키기) → 지시문 */
function inputToInstruction(input: Record<string, string>): string {
  return Object.entries(input)
    .filter(([, v]) => v != null && String(v).trim())
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n');
}

/** 데모 폴백용 outputKind별 샘플 구조 데이터 — API 키 없이도 전용 뷰를 미리 확인 */
const DEMO_SAMPLE: Record<string, Record<string, unknown>> = {
  sourcing_brief: {
    verdict: '추천', score: 8, confidence: '높음',
    summary: '상품성이 있고 마진도 확보 가능하지만, 초기 리뷰 확보가 필요합니다.',
    reasons: ['원목 주방용품 검색 수요가 안정적', '판매가 대비 예상 순마진율 양호', '시목 브랜드 톤과 잘 맞음'],
    scores: {
      trend: { score: 2, reason: '원목 주방용품 검색 수요가 유지되고 있습니다.' },
      entry: { score: 1, reason: '경쟁사는 많지만 차별화 여지가 있습니다.' },
      target: { score: 2, reason: '신혼·집들이 타겟과 잘 맞습니다.' },
      margin: { score: 2, reason: '예상 순마진율 35% 이상입니다.' },
      diff: { score: 1, reason: '관리카드 구성으로 차별화 가능합니다.' },
    },
    margin: { price: 39000, cost: 12000, platformFee: 3500, packagingShipping: 4000, expectedAdCost: 5850, netProfit: 13650, netRate: '35%', breakEvenMonthlyQty: 40 },
    persona: '신혼집 주방을 예쁘게 꾸미고 싶은 30대 여성',
    channels: ['스마트스토어', '인스타', '오프라인 매장'],
    risks: ['관리 부담', '원목도마 경쟁 과다'],
    nextActions: [{ type: 'task', title: '샘플 두께·마감 검증', priority: 'high', owner: 'sourcing' }],
    handoff: {
      detailPage: ['관리카드 포함을 상세페이지 첫 화면에 강조'],
      ads: ['관리 쉬운 원목 도마 소구 테스트'],
      sns: ['원목도마 관리법 콘텐츠 제작'],
      visual: ['두께와 나뭇결 디테일컷 필요'],
      monitor: ['A몰·B몰 가격 지속 추적'],
    },
    sources: [{ title: '네이버 쇼핑 검색', url: 'https://example.com', type: 'shopping', confidence: 'medium' }],
  },
  ticket_list: {
    summary: { total: 6, urgent: 2, needsHumanApproval: 1, faqCandidates: 2, negativeReviews: 1 },
    tickets: [
      { id: 'CS-001', type: '환불', urgency: '즉시', sentiment: '격앙', riskLevel: 'high', customerMessage: '배송이 너무 늦어서 환불하고 싶어요.', draft: '불편을 드려 정말 죄송합니다. 주문번호 확인 후 오늘 중으로 처리 도와드리겠습니다.', needsConfirm: ['주문번호', '배송 상태'], needsHumanApproval: true, approvalReason: '환불·보상 관련 응대', status: 'approval_waiting', faqCandidate: { shouldCreate: true, question: '배송이 지연되면 환불할 수 있나요?', answer: '배송 상태에 따라 환불 가능 여부를 확인해드립니다.' }, nextActions: [{ target: 'detail_page', title: '배송 안내 문구 보강' }] },
      { id: 'CS-002', type: '교환', urgency: '일반', sentiment: '중립', riskLevel: 'low', customerMessage: '사이즈가 생각보다 작아요.', draft: '교환 도와드리겠습니다. 제품 사진 한 장만 보내주시면 바로 처리해드릴게요.', needsConfirm: ['제품 사진'], needsHumanApproval: false, status: '답변초안' },
    ],
  },
  sns_queue: {
    summary: { total: 7, needsApproval: 2, scheduled: 3, needsVisual: 2, mix: { info: 30, empathy: 25, product: 20, ugc: 15, behind: 10 }, warnings: ['이번 주 판매글 비중이 높습니다.'] },
    posts: [
      { id: 'SNS-001', date: '2026-06-17', time: '18:00', channel: '인스타', format: '피드', objective: '저장', contentType: '정보',
        hook: { type: '공감', text: '원목도마, 관리가 어렵다고 느꼈다면', score: 8 },
        body: '처음 쓰는 분들도 쉽게 관리할 수 있는 오일 관리법을 알려드려요.',
        cta: { type: 'soft', text: '관리법 저장해두기' },
        hashtags: { large: ['#원목도마'], medium: ['#주방살림'], small: ['#티크도마'], brand: ['#시목'] },
        imageBrief: '도마·오일·천·관리카드가 놓인 4:5 이미지',
        variants: [{ label: 'A', angle: '정보형', hook: '원목도마 관리 어렵지 않아요', body: '' }, { label: 'B', angle: '공감형', hook: '', body: '' }],
        status: 'approval_waiting', nextActions: [{ target: 'visual', title: '관리법 카드뉴스 이미지 요청' }] },
    ],
  },
  copy_variants: {
    product: { name: '티크 원목 도마', price: 39000, channels: ['instagram', 'naver'], goal: '구매전환', angle: '신혼·집들이 선물' },
    sets: [
      { variantId: 'AD-001', type: '감성', headline: '주방이 카페가 된다', sub: '통원목 한 장이 바꾸는 아침', detail: '따뜻한 티크 나뭇결로 신혼집 주방에 분위기를 더해보세요.', cta: '지금 선물 보러가기', imageDirection: '밝은 주방, 커피잔, 빵, 도마 플레이팅', recommendedChannels: ['instagram', 'kakao'], expectedMetric: ['CTR', '저장률'], caution: '감성만 강조하면 기능 설득이 약할 수 있음', status: 'test' },
      { variantId: 'AD-002', type: '기능', headline: '칼자국 덜 나는 통원목 3cm', sub: '천연오일 마감', detail: '갈라짐 적고 오래 쓰는 두께, 매일 쓰기 좋아요.', cta: '스펙 자세히 보기', imageDirection: '도마 두께·나뭇결 디테일 클로즈업', recommendedChannels: ['naver'], expectedMetric: ['전환율'], caution: '스펙 나열이 과하면 지루할 수 있음', status: 'test' },
      { variantId: 'AD-003', type: '가격', headline: '오늘 39,000원 · 첫 구매 10%', sub: '무료배송 + 선물포장', detail: '집들이 선물로 딱.', cta: '할인가로 담기', imageDirection: '선물 포장된 도마, 가격 강조 그래픽', recommendedChannels: ['naver', 'kakao'], expectedMetric: ['전환율', 'ROAS'], caution: '최저가·과장 표현 주의', status: 'test' },
    ],
    targeting: { keywords: ['티크도마', '원목도마', '우드도마', '신혼주방', '집들이선물'], audience: { core: ['2030 신혼'], lookalike: ['기존 구매자 유사'], interest: ['홈카페', '주방살림'], exclude: ['도매·b2b'] }, budgetSplit: { test: { emotional: 33, functional: 33, price: 33 }, scale: { winner: 70, support: 20, newTest: 10 } } },
    channelGuide: { instagram: '이미지 중심. 감성형·가격형 우선 테스트.', naver: '구매의도 키워드 중심. 기능형·가격형 우선.', kakao: '선물·신혼·집들이 맥락.' },
    complianceCheck: { exaggeration: true, unverifiedNo1: true, lowestPrice: true, healthClaim: true, landingConsistencyRequired: true },
    handoff: { sns: ['반응 좋은 카피를 유기 콘텐츠로 변환'], analyst: ['variantId 기준 성과 추적'], landing: ['광고 문구와 상세페이지 첫 화면 일치 확인'], ownerApproval: ['광고비', '일예산', '혜택 문구'] },
  },
  detail_builder: {
    brief: {
      productName: '티크 원목 도마', target: '신혼·집들이 선물 고객',
      usp: ['티크 원목', '관리카드 포함', '따뜻한 주방 무드'],
      customerPain: ['원목도마 관리가 어려울까 걱정', '선물로 고급스러워 보일지 고민'],
      banned: ['최저가', '10년 보장', '절대 안 휨'],
    },
    sections: [
      { key: 'hero', title: '히어로', objective: '3초 안에 상품 가치 전달', coreLine: '주방이 카페가 되는 순간', subLine: '티크 원목 한 장으로 따뜻한 식탁을 완성하세요.', bullets: ['신혼집 주방에 어울리는 원목 무드', '집들이 선물로 좋은 구성'], visual: '빵·커피·세라믹 접시와 함께 놓인 도마 사용씬', cta: '지금 선물 준비하기', status: 'draft' },
      { key: 'problem', title: '문제 제기', objective: '구매 불안 자극', coreLine: '원목 도마, 관리가 어렵진 않을까요?', bullets: ['갈라짐·휨 걱정', '세척 후 관리 번거로움'], visual: '관리 안 된 도마 vs 관리된 도마 비교컷', cta: '', status: 'draft' },
      { key: 'solution', title: '솔루션', objective: '기능을 이익으로 번역', coreLine: '관리카드 한 장이면 충분해요', bullets: ['통원목 3cm → 칼자국 덜 나고 오래 사용', '천연오일 마감 → 오일 한 번이면 새것처럼'], visual: '오일 바르는 손 클로즈업', cta: '', status: 'draft' },
    ],
    visualSlots: [{ sectionKey: 'hero', imageType: 'lifestyle', brief: '따뜻한 자연광의 홈카페 사용씬' }],
    complianceCheck: { pass: true, flags: [], bannedExpressionsFound: [] },
    handoff: { visual: ['히어로 사용씬 이미지 필요'], ads: ['광고 카피와 히어로 문구 일치 확인'], analyst: ['A/B 테스트 후 CVR 확인'] },
  },
  monitor_digest: {
    summary: ['A몰이 티크도마 가격을 37,000원으로 인하했습니다.', 'D몰 신규 진입이 확인되었습니다.', '원목도마 관리 키워드가 상승했습니다.'],
    alerts: [{ level: 'red', title: 'A몰 가격 인하', change: '42,000원 → 37,000원', impact: '우리 39,000원과 가격 차이 축소', recommendation: '가격 추격보다 관리카드 메시지 강화', source: { url: 'https://example.com', title: 'A몰 상품페이지', sourceType: 'shopping_mall', checkedAt: '2026-06-16 08:00', confidence: 'high' }, status: 'action_required' }],
    compareTable: [
      { name: '우리', price: 39000, composition: '도마+관리카드', difference: '기준', recommendedResponse: '관리 쉬움 강조' },
      { name: 'A몰', price: 37000, composition: '도마 단품', difference: '-2,000원', recommendedResponse: '가격 비교 노출' },
      { name: 'B몰', price: 41000, composition: '도마+오일', difference: '+2,000원', recommendedResponse: '구성 차별화' },
    ],
    changeLog: [{ item: 'A몰 가격', before: '42,000원', after: '37,000원', delta: '-5,000원', level: 'red' }],
    trends: [{ keyword: '원목도마 관리', delta: '상승', meaning: '관리 부담 해소 콘텐츠 필요', citations: [{ url: 'https://example.com', sourceType: 'search_trend', checkedAt: '2026-06-16 08:00' }] }],
    strategy: { summary: '가격 추격보다 관리 쉬움 메시지로 대응', actions: [{ target: 'ads', title: '관리 쉬운 통원목 도마 카피 테스트' }] },
    limitations: ['가격은 확인 시각 기준이며 변동될 수 있습니다.'],
    handoff: { ads: ['관리 쉬움 카피 테스트'], sns: ['관리법 콘텐츠'], detailPage: ['관리카드 강조'] },
  },
  metric_digest: {
    summary: ['매출은 전주 대비 12% 증가했습니다.', '방문수는 늘었지만 전환율은 하락했습니다.', 'CAC가 2배 상승해 광고 세트별 점검이 필요합니다.'],
    kpis: [
      { group: 'sales', name: 'revenue', label: '매출', value: 3200000, displayValue: '320만 원', compareValue: 2850000, delta: '+12%', signal: 'green', interpretation: '매출 증가' },
      { group: 'traffic', name: 'visitors', label: '방문수', displayValue: '8,200', delta: '+18%', signal: 'green' },
      { group: 'sales', name: 'cvr', label: '전환율', displayValue: '2.1%', delta: '-0.4%p', signal: 'orange' },
      { group: 'ad', name: 'roas', label: 'ROAS', displayValue: '4.8', delta: '+0.3', signal: 'green' },
      { group: 'ad', name: 'cac', label: 'CAC', displayValue: '18,000원', delta: '+100%', signal: 'red' },
    ],
    anomalies: [{ level: 'red', metric: 'CAC', title: 'CAC 2배 급등', current: '18,000원', previous: '9,000원', delta: '+100%', meaning: '고객 1명을 데려오는 비용이 크게 증가했습니다.', hypothesis: '신규 광고 세트 효율이 낮을 가능성이 있습니다.', evidence: ['방문수 +18%', '전환율 -0.4%p'], confidence: 'medium', nextAction: '광고 세트별 CAC/CVR/ROAS 분리 확인', owner: ['ad_planner', 'analyst'] }],
    actions: [{ priority: 1, title: '광고 세트별 효율 분리', owner: 'ad_planner', reason: 'CAC 2배 상승', metricsToCheck: ['CAC', 'CVR', 'ROAS'], approvalRequired: true }],
    dataSource: [{ source: '스마트스토어 통계', metrics: ['매출', '주문수', '전환율'], period: '2026-06-08~06-14', confidence: 'high' }],
    confidence: 'high', limitations: [],
  },
  image_brief: {
    visualDirection: { mood: ['자연광', '원목', '따뜻함', '미니멀'], colors: ['아이보리', '우드 브라운', '차콜'], props: ['린넨', '커피잔', '빵'], avoid: ['플라스틱 질감', '과채도', '깨진 한글'] },
    shotList: [
      { id: 'SHOT-001', grade: 'must', type: 'front', label: '정면컷', purpose: '제품 전체 형태', useCases: ['대표 이미지', '썸네일'], ratio: '1:1', status: 'planned' },
      { id: 'SHOT-002', grade: 'must', type: 'lifestyle', label: '사용씬', purpose: '홈카페 분위기', useCases: ['상세', '피드'], ratio: '4:5', status: 'planned' },
      { id: 'SHOT-003', grade: 'nice', type: 'detail', label: '디테일 클로즈업', purpose: '나뭇결·두께', useCases: ['상세'], ratio: '4:5', status: 'planned' },
    ],
    prompts: [{ id: 'PROMPT-001', shotId: 'SHOT-001', text: 'teak wood cutting board, natural light, minimal kitchen, ivory background, product photography, high detail', ratio: '1:1', engine: 'imagen', useCase: ['대표 이미지'], status: 'candidate' }],
    negativePrompt: ['distorted hands', 'broken Korean text', 'plastic texture'],
    candidates: [{ id: 'IMG-001', promptId: 'PROMPT-001', thumbnailUrl: '', status: 'selected', notes: '대표 이미지로 적합' }, { id: 'IMG-002', promptId: 'PROMPT-001', thumbnailUrl: '', status: 'candidate', notes: '' }],
    handoff: { detailPage: ['히어로 사용씬 배치'], ads: ['감성형 광고 이미지'], sns: ['피드 라이프스타일 컷'] },
  },
  ops_digest: {
    top3: [
      { rank: 1, level: 'red', area: '매출', title: 'A몰 가격 인하 대응 없음', whyNow: '전환율 하락과 경쟁사 가격 인하가 겹쳤습니다.', decisionNeeded: '가격 유지 + 관리카드 메시지 강화로 대응할까요?', recommendation: '가격 인하는 보류하고 메시지 대응을 추천합니다.', owners: ['monitor', 'ad', 'detail_page'], status: 'action_required', sourceStaff: 'monitor', sourceOutputKind: 'monitor_digest' },
      { rank: 2, level: 'orange', area: '승인', title: 'CS 환불 답변 승인 대기', whyNow: '격앙 고객 응대가 지연되면 이탈 위험.', decisionNeeded: '환불 답변을 발송할까요?', owners: ['cs'], status: 'action_required' },
      { rank: 3, level: 'orange', area: '운영', title: '분석가 실행 실패 재시도 필요', whyNow: '어제 KPI 집계가 실패했습니다.', owners: ['analyst'], status: 'action_required' },
    ],
    staffHealth: [
      { staff: 'sourcing', status: 'ok', completed: 2, waiting: 0, failed: 0, issues: [] },
      { staff: 'cs', status: 'ok', completed: 5, waiting: 2, failed: 0, issues: [] },
      { staff: 'analyst', status: 'warning', completed: 1, waiting: 0, failed: 1, issues: ['어제 실행 실패 1건'] },
    ],
    approvalQueue: { adSpend: ['AD-003 예산 승인'], snsPublish: ['SNS-001'], csSend: ['CS-001', 'CS-004'], detailPage: [], visual: [], sourcing: [] },
    missed: [{ level: 'orange', sourceStaff: 'analyst', targetStaff: 'detail_page', issue: '상세 A/B 테스트 제안이 할일로 생성되지 않음', recommendation: '상세페이지 담당자에게 할일 생성' }],
    suggestedTasks: [{ title: '상세 첫 섹션 A/B 테스트', owner: 'detail_page', source: 'metric_digest', priority: 'orange' }],
    duplicates: [], staleInsights: [], limitations: [],
  },
};

/** 실행 결과 (저장 전 미리보기용) */
export interface StaffRunResult {
  title: string;
  summary: string;
  body: string;
  contentJson: Record<string, unknown> | null;
  outputKind?: OutputKind;
  actions: ParsedActs;
  input?: Record<string, unknown>;
  coins?: number;  // 이번 실행 소모 코인 (토큰 비용 환산)
}

/** AI 실행 + 파싱만 (저장 X) — 미리보기 결과 반환 */
async function runAndParse(staff: Staff, workspace: Workspace, opts: { tasks: string[]; manualInput?: string }): Promise<StaffRunResult> {
  const type = getStaffType(staff.typeKey);
  const [peerNotes, brand] = await Promise.all([
    collectPeerNotes(staff, workspace),
    fetchBrandContext(workspace.id).catch(() => null),
  ]);
  const system = buildSystemPrompt(staff, workspace, brand, peerNotes, opts.tasks, opts.manualInput);
  const today = new Date().toISOString().split('T')[0];
  const userMsg = opts.manualInput
    ? '사장이 직접 시킨 작업을 수행하고 결과를 정리해줘.'
    : '오늘 너의 일과를 수행하고 결과를 일일 리포트로 정리해줘.';

  let title = '', summary = '', body = '';
  let actions: ParsedActs = { schedules: [], tasks: [], insights: [] };
  let contentJson: Record<string, unknown> | null = null;
  const modelKey = staff.model || type?.defaultModel || 'sonnet';
  let coins = 0;
  try {
    let out = '';
    if (modelKey === 'research') {
      // 1단계: Perplexity로 실시간 검색·시장조사
      const r1 = await sendWithModel(
        RESEARCH_MODEL,
        `${system}\n\n[검색 단계] 위 작업에 필요한 최신 시장·경쟁사·가격·트렌드 정보를 검색해 핵심 사실과 수치를 출처와 함께 정리해줘.`,
        [{ role: 'user', content: userMsg }], 1200,
      );
      // 2단계: Claude Sonnet으로 검색 결과를 전용 뷰용 JSON으로 구조화
      const r2 = await sendWithModel(
        MODEL_REGISTRY.sonnet, system,
        [{ role: 'user', content: `${userMsg}\n\n[검색 결과 — 아래 사실을 근거로 정리해라]\n${r1.text}` }], 1500,
      );
      out = r2.text;
      coins = calcCoins(RESEARCH_MODEL.model, r1.usage) + calcCoins(MODEL_REGISTRY.sonnet.model, r2.usage);
    } else {
      const cfg = MODEL_REGISTRY[modelKey] || MODEL_REGISTRY.sonnet;
      const r = await sendWithModel(cfg, system, [{ role: 'user', content: userMsg }], 1500);
      out = r.text;
      coins = calcCoins(cfg.model, r.usage);
    }
    if (!out.trim()) throw new Error('empty');
    ({ title, summary, body } = parseReport(out));
    const parsed = parseJsonBlock(out);
    if (parsed) {
      contentJson = parsed.output;
      actions = jsonActionsToActs(parsed.actions);
      body = body.replace(/```json[\s\S]*?```/i, '').trim();  // 본문에서 json 블록 제거(깔끔하게)
    } else {
      actions = parseActions(out);  // 폴백: 구 마크다운 [액션] 형식
    }
  } catch {
    // 폴백: API 키 미설정/오류 → 데모 리포트 (흐름 + 전용 뷰 미리보기용)
    const sample = type?.outputKind ? DEMO_SAMPLE[type.outputKind] : undefined;
    contentJson = { _demo: true, ...(sample || { note: '실제 AI 실행 시 구조화 결과(content_json)가 채워져요' }) };
    title = `${staff.name} · 데모 리포트`;
    summary = opts.manualInput ? '직접 시키기 (API 키 설정 시 실제 작성)' : 'API 키 설정 시 실제 AI가 작성합니다';
    actions = {
      schedules: [{ date: today, time: '14:00', title: `${type?.label || '직원'} 제안 일정 (데모)` }],
      tasks: [{ title: `${staff.name} 후속 작업 (데모)`, priority: 'medium' }],
      insights: [`${type?.label || '직원'} 데모 인사이트 — 실제 AI 실행 시 채워져요`],
    };
    const nameTitle = type && type.label !== staff.name ? `${staff.name} (${type.label})` : staff.name;
    body = `## ${nameTitle}\n\n${opts.manualInput ? '**직접 시키기 입력**\n' + opts.manualInput + '\n\n' : ''}- 동료 직원 산출물 ${peerNotes.length}건 참고${peerNotes.length ? '\n' + peerNotes.join('\n') : ''}\n\n> 실제 AI 실행은 \`VITE_ANTHROPIC_API_KEY\` 설정 후 동작해요. (지금은 데모)`;
  }
  return { title, summary, body, contentJson, outputKind: type?.outputKind, actions, coins };
}

/** 결과 저장 (리포트 + 액션 큐). 미리보기 결과를 실제 저장. */
async function persistResult(staff: Staff, workspace: Workspace, result: StaffRunResult, trigger: ReportTrigger, inputObj?: Record<string, unknown>): Promise<DailyReport> {
  const today = new Date().toISOString().split('T')[0];
  const report = await createReport({
    workspaceId: workspace.id, staffId: staff.id, date: today,
    title: result.title, summary: result.summary, body: result.body, model: staff.model,
    trigger, outputKind: result.outputKind, contentJson: result.contentJson, input: inputObj,
  });
  const queued = await queueActions(staff, workspace, report.id, result.actions);
  if (queued > 0) report.body += `\n\n— 📌 제안 액션 ${queued}건이 승인 대기 중이에요`;
  // 코인 차감 (이번 실행 토큰 비용)
  if (result.coins) {
    await deductCredits({ workspaceId: workspace.id, staffId: staff.id, reportId: report.id, model: staff.model, coins: result.coins }).catch(() => {});
  }
  return report;
}

/** 자동 실행 (지금 한 번 = 활성 일과를 "각각" 실행 → 일과별 리포트. cron과 동일) */
export async function runStaffNow(staff: Staff, workspace: Workspace): Promise<DailyReport[]> {
  const routines = await fetchRoutines(staff.id).catch(() => []);
  const enabled = routines.filter(r => r.enabled);
  // 일과가 없으면 일반 실행 1개
  if (enabled.length === 0) {
    const result = await runAndParse(staff, workspace, { tasks: [] });
    return [await persistResult(staff, workspace, result, 'auto')];
  }
  // 일과별로 각각 실행 → 일과마다 리포트 1개 (순차)
  const reports: DailyReport[] = [];
  for (const r of enabled) {
    const result = await runAndParse(staff, workspace, { tasks: [r.label] });
    reports.push(await persistResult(staff, workspace, result, 'auto'));
  }
  return reports;
}

/** 단일 일과만 "지금 한 번" 실행 → 리포트 1개 (여러 번 반복 가능) */
export async function runRoutineNow(staff: Staff, workspace: Workspace, label: string): Promise<DailyReport> {
  const result = await runAndParse(staff, workspace, { tasks: [label] });
  return persistResult(staff, workspace, result, 'auto');
}

/** 수동 미리보기 (직접 시키기 — 실행만, 저장 X) */
export async function previewStaffManual(staff: Staff, workspace: Workspace, input: Record<string, string>): Promise<StaffRunResult> {
  const manualInput = inputToInstruction(input);
  const result = await runAndParse(staff, workspace, { tasks: [], manualInput });
  return { ...result, input };
}

/** 수동 결과 저장 (미리보기 결과를 일일 리포트로 — '저장' 버튼) */
export async function saveStaffResult(staff: Staff, workspace: Workspace, result: StaffRunResult): Promise<DailyReport> {
  return persistResult(staff, workspace, result, 'manual', result.input);
}
