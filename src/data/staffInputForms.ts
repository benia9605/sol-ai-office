/**
 * @file src/data/staffInputForms.ts
 * @description 직원별 "직접 시키기(수동)" 입력 폼 + 모드별 전용 지시문
 * - 각 직원 SOP(docs/guides/ai오피스구축/직원SOP/*) 기준으로 모드(기능)·입력칸·지시문을 분리.
 * - 모드 옵션 문자열 == showFor 값 == MODE_DIRECTIVES 키 (반드시 일치).
 * - showFor 없는 필드는 항상 표시. mode 선택값에 따라 전용 필드만 노출.
 */
import { StaffInputField } from '../types';

export const STAFF_INPUT_FORMS: Record<string, StaffInputField[]> = {
  // 🔍 소싱 기획자
  sourcing: [
    { name: 'productName', label: '상품명', type: 'text', required: true, placeholder: '예: 티크 원목 도마' },
    { name: 'category', label: '카테고리', type: 'text', placeholder: '예: 원목 주방소품' },
    { name: 'description', label: '상품 설명', type: 'textarea', placeholder: '소재·형태·용도·특징', showFor: ['분석(할까 말까)', '상품 기획서'] },
    { name: 'expectedPrice', label: '예상 판매가', type: 'text', placeholder: '예: 39,000', showFor: ['분석(할까 말까)', '상품 기획서'] },
    { name: 'expectedCost', label: '예상 원가', type: 'text', placeholder: '예: 18,000 (순마진 계산용)', showFor: ['분석(할까 말까)', '상품 기획서'] },
    { name: 'competitorLink', label: '경쟁사 링크/정보', type: 'textarea', placeholder: 'URL·가격·리뷰 (여러 개 줄바꿈)', showFor: ['분석(할까 말까)'] },
    { name: 'target', label: '타겟', type: 'text', placeholder: '예: 신혼·집들이 선물', showFor: ['키워드 기획', '상품 기획서'] },
    { name: 'channel', label: '채널', type: 'select', options: ['스마트스토어', '쿠팡', '인스타'], showFor: ['키워드 기획'] },
    { name: 'mode', label: '모드', type: 'select', required: true, options: ['분석(할까 말까)', '키워드 기획', '상품 기획서'] },
  ],

  // 📄 상세페이지 제작자 (12섹션 역설계본)
  detail_page: [
    { name: 'productName', label: '상품명/카테고리', type: 'text', required: true, placeholder: '예: 시목 티크 원목 도마' },
    { name: 'oneLineCore', label: '한 줄 핵심(고객이 얻는 변화)', type: 'text', placeholder: '예: 매일의 도마가 주방 인테리어가 된다', showFor: ['전체 기획'] },
    { name: 'price', label: '가격/옵션', type: 'text', placeholder: '예: 39,000원 / 소·대 2종', showFor: ['전체 기획'] },
    { name: 'priceTier', label: '가격대', type: 'select', options: ['저가', '중가', '프리미엄'], showFor: ['전체 기획'] },
    { name: 'industry', label: '업종(신뢰순위)', type: 'select', options: ['가구/원목소품', '식품/건기식', '뷰티', '생활용품'], showFor: ['전체 기획'] },
    { name: 'targetCustomer', label: '타깃(누가/언제/상황)', type: 'textarea', placeholder: '예: 신혼부부, 집들이 선물 살 때', showFor: ['전체 기획'] },
    { name: 'painScenes', label: '고객 불편 장면 3개', type: 'textarea', placeholder: '구체적 짜증 장면 3개 (줄바꿈)', showFor: ['전체 기획'] },
    { name: 'differentiators', label: '차별점(숫자·재료·공정)', type: 'textarea', placeholder: '통원목 한 장 / 천연오일 마감 / 국내 수작업', showFor: ['전체 기획'] },
    { name: 'specs', label: '핵심 스펙', type: 'textarea', placeholder: '재질·사이즈·원산지·제조', showFor: ['전체 기획'] },
    { name: 'careGuide', label: '사용법/관리법(선택)', type: 'textarea', showFor: ['전체 기획'] },
    { name: 'certifications', label: '인증/성적서(선택·있는것만)', type: 'textarea', showFor: ['전체 기획'] },
    { name: 'reviewKeywords', label: '후기 키워드(선택)', type: 'text', showFor: ['전체 기획'] },
    { name: 'policy', label: '배송/교환/반품/A/S(선택)', type: 'textarea', showFor: ['전체 기획'] },
    { name: 'bannedExpressions', label: '금지 표현/톤(선택)', type: 'text', placeholder: '예: 과장·최저가 금지, 담백한 장인 톤', showFor: ['전체 기획'] },
    { name: 'targetSection', label: '재생성할 섹션', type: 'select', options: ['후킹', '문제제기·공감', '방치 시 손실', '솔루션·메커니즘', '변화 후 모습', '디테일 스펙', '신뢰·증거', '비교·차별점', '가격·구성', '구매결정 안내', 'FAQ', '최종CTA'], showFor: ['섹션 재생성'] },
    { name: 'rewriteDirection', label: '재생성 방향', type: 'select', options: ['더 감성적으로', '더 전문적으로', '더 짧게', '덜 자극적으로', '부드러운 CTA'], showFor: ['섹션 재생성'] },
    { name: 'sourcePlan', label: '변환할 기획안 붙여넣기', type: 'textarea', placeholder: '완성된 상세페이지 기획안', showFor: ['HTML 변환'] },
    { name: 'targetPlatform', label: '대상 플랫폼', type: 'select', options: ['스마트스토어', '자사몰'], showFor: ['HTML 변환'] },
    { name: 'mode', label: '모드', type: 'select', required: true, options: ['전체 기획', '섹션 재생성', 'HTML 변환'] },
  ],

  // 💬 CS 응대
  cs: [
    { name: 'customerMessage', label: '고객 문의/후기 원문', type: 'textarea', placeholder: '고객이 보낸 문의/후기를 그대로 붙여넣기', showFor: ['문의 답변', '부정 후기 대응'] },
    { name: 'productName', label: '상품명', type: 'text', showFor: ['문의 답변', '부정 후기 대응', 'FAQ 생성'] },
    { name: 'orderInfo', label: '주문정보(선택)', type: 'text', placeholder: '주문번호/배송상태 등', showFor: ['문의 답변'] },
    { name: 'channel', label: '채널', type: 'select', options: ['스마트스토어', '쿠팡', '인스타DM', '카카오톡', '이메일'], showFor: ['문의 답변', '부정 후기 대응'] },
    { name: 'rating', label: '후기 별점', type: 'select', options: ['1점', '2점', '3점', '4점', '5점'], showFor: ['부정 후기 대응'] },
    { name: 'inquiryBatch', label: '반복 문의 모음', type: 'textarea', placeholder: '반복된 문의들을 한 줄에 하나씩', showFor: ['FAQ 생성'] },
    { name: 'policyCategory', label: '정책 항목', type: 'select', options: ['배송', '교환', '환불', '파손', '후기'], showFor: ['정책 안내문'] },
    { name: 'policyText', label: '내부 운영 기준', type: 'textarea', placeholder: '예: 수령 후 7일 내 사진 확인 시 교환', showFor: ['정책 안내문'] },
    { name: 'mode', label: '모드', type: 'select', required: true, options: ['문의 답변', 'FAQ 생성', '부정 후기 대응', '정책 안내문'] },
  ],

  // 📣 SNS 운영
  sns: [
    { name: 'topic', label: '주제', type: 'textarea', placeholder: '예: 신상 도마 / 원목 관리법', showFor: ['콘텐츠 캘린더', '게시글 캡션', '스크립트', '훅 뽑기'] },
    { name: 'platform', label: '플랫폼', type: 'select', options: ['인스타', '스레드', '블로그', '유튜브', '틱톡'], showFor: ['콘텐츠 캘린더', '게시글 캡션', '스크립트', '훅 뽑기'] },
    { name: 'objective', label: '목적', type: 'select', options: ['인지', '저장', '공감', '문의', '전환', '신뢰'], showFor: ['콘텐츠 캘린더', '게시글 캡션', '스크립트', '훅 뽑기'] },
    { name: 'campaignMode', label: '캠페인 모드', type: 'select', options: ['평상시', '초기 브랜드', '판매집중', '신뢰·브랜딩'], showFor: ['콘텐츠 캘린더', '게시글 캡션'] },
    { name: 'postCount', label: '생성 개수', type: 'select', options: ['5', '7', '10'], showFor: ['콘텐츠 캘린더'] },
    { name: 'productName', label: '상품명(선택)', type: 'text', showFor: ['게시글 캡션'] },
    { name: 'contentType', label: '콘텐츠 유형', type: 'select', options: ['정보·팁', '공감·일상', '제품', '후기·UGC', '비하인드'], showFor: ['게시글 캡션'] },
    { name: 'length', label: '길이', type: 'duration', placeholder: '예: 30초 / 5분', showFor: ['스크립트'] },
    { name: 'detail', label: '구성 방향(선택)', type: 'textarea', placeholder: '장면·핵심 메시지·자막 방향', showFor: ['스크립트'] },
    { name: 'draftText', label: '점검할 캡션', type: 'textarea', placeholder: '기존 캡션을 붙여넣기', showFor: ['톤 점검'] },
    { name: 'fixIntent', label: '조정 방향', type: 'multiselect', options: ['더 담백하게', '더 감성적으로', '판매느낌 줄이기', '짧게', '금지표현 검사'], showFor: ['톤 점검'] },
    { name: 'mode', label: '모드', type: 'select', required: true, options: ['콘텐츠 캘린더', '게시글 캡션', '스크립트', '훅 뽑기', '톤 점검'] },
  ],

  // 🎯 광고 기획
  ad: [
    { name: 'productName', label: '상품명', type: 'text', required: true, placeholder: '예: 티크 원목 도마' },
    { name: 'usp', label: '핵심 USP', type: 'text', placeholder: '예: 통원목·천연오일 마감', showFor: ['카피 3세트', '타겟·예산 세팅', '채널별 문안', 'A/B 테스트 설계'] },
    { name: 'target', label: '타겟', type: 'text', placeholder: '예: 2030 신혼·집들이 선물', showFor: ['카피 3세트', '타겟·예산 세팅', '채널별 문안'] },
    { name: 'goal', label: '광고 목적', type: 'select', options: ['구매전환', '유입', '인지', '저장'], showFor: ['카피 3세트', '타겟·예산 세팅'] },
    { name: 'channels', label: '채널', type: 'multiselect', options: ['네이버 성과형', '인스타/메타', '카카오 모먼트'], showFor: ['카피 3세트', '채널별 문안'] },
    { name: 'budget', label: '일예산(선택)', type: 'text', showFor: ['타겟·예산 세팅', 'A/B 테스트 설계'] },
    { name: 'landingUrl', label: '랜딩/상세 URL(선택)', type: 'text', placeholder: '광고=랜딩 일치 체크용', showFor: ['컴플라이언스 점검'] },
    { name: 'existingCopy', label: '점검할 기존 카피', type: 'textarea', placeholder: '헤드라인·서브·상세·혜택 문구', showFor: ['컴플라이언스 점검'] },
    { name: 'testVariable', label: '테스트 변수', type: 'select', options: ['이미지', '헤드라인', '타겟', 'CTA', '상세'], showFor: ['A/B 테스트 설계'] },
    { name: 'mode', label: '모드', type: 'select', required: true, options: ['카피 3세트', '타겟·예산 세팅', '채널별 문안', '컴플라이언스 점검', 'A/B 테스트 설계'] },
  ],

  // 📡 모니터링
  monitor: [
    { name: 'category', label: '카테고리', type: 'text', placeholder: '예: 원목 주방소품' },
    { name: 'competitorInput', label: '경쟁사 링크/정보', type: 'textarea', placeholder: '경쟁사 상품 링크·가격·리뷰 텍스트', showFor: ['경쟁사 분석'] },
    { name: 'ourProduct', label: '우리 상품·가격·구성', type: 'text', placeholder: '예: 티크도마 39,000 +관리카드', showFor: ['경쟁사 분석'] },
    { name: 'prevReport', label: '지난 확인값(선택)', type: 'textarea', placeholder: '지난 가격·리뷰 등 — 델타 비교용', showFor: ['경쟁사 분석'] },
    { name: 'trendKeywords', label: '관심 키워드', type: 'text', placeholder: '예: 통원목, 원목도마 관리, 집들이선물', showFor: ['트렌드 리포트'] },
    { name: 'trendChannel', label: '관찰 채널', type: 'multiselect', options: ['네이버 쇼핑', '인스타', '블로그/커뮤니티', '유튜브'], showFor: ['트렌드 리포트'] },
    { name: 'diagKeywords', label: '진단할 키워드', type: 'text', placeholder: '예: 티크도마, 우드도마, 신혼주방', showFor: ['키워드 경쟁강도'] },
    { name: 'mode', label: '모드', type: 'select', required: true, options: ['경쟁사 분석', '트렌드 리포트', '키워드 경쟁강도'] },
  ],

  // 📊 분석가
  analyst: [
    { name: 'metricData', label: '지표 데이터', type: 'textarea', required: true, placeholder: '매출 320만(전주 285만)\n전환율 2.1%(전주 2.5%)\n광고비 67만, ROAS 4.8 …', showFor: ['주간 성과 리포트', 'KPI 집계·해석', '이상치 진단'] },
    { name: 'period', label: '기간', type: 'text', placeholder: '예: 6/8~6/14', showFor: ['주간 성과 리포트', 'KPI 집계·해석', '이상치 진단'] },
    { name: 'compareTo', label: '비교 기준', type: 'select', options: ['전주', '전월', '전일', '목표', '전년동기'], showFor: ['주간 성과 리포트', 'KPI 집계·해석'] },
    { name: 'goalKpi', label: '목표 KPI(선택)', type: 'text', placeholder: '예: ROAS 3.0 / 월매출 1500만', showFor: ['주간 성과 리포트'] },
    { name: 'focusMetric', label: '집중 지표', type: 'text', placeholder: '예: CAC, 전환율', showFor: ['이상치 진단'] },
    { name: 'funnelData', label: '퍼널 수치', type: 'textarea', placeholder: '노출 10만\n클릭 2500\n상세 2300\n장바구니 130\n구매 48', showFor: ['퍼널 분석'] },
    { name: 'breakdownData', label: '채널/세트별 데이터', type: 'textarea', placeholder: '감성형 CTR2.8 CVR1.4 ROAS2.6\n기능형 …', showFor: ['채널 성과 비교'] },
    { name: 'dataSource', label: '데이터 출처(선택)', type: 'text', placeholder: '예: 스마트스토어·광고관리자' },
    { name: 'mode', label: '모드', type: 'select', required: true, options: ['주간 성과 리포트', 'KPI 집계·해석', '이상치 진단', '퍼널 분석', '채널 성과 비교'] },
  ],

  // 📸 비주얼 디렉터
  visual: [
    { name: 'productName', label: '상품명', type: 'text', required: true },
    { name: 'material', label: '핵심 소재', type: 'text', placeholder: '예: 티크 원목', showFor: ['촬영컷 리스트', '이미지 프롬프트', '목업 합성', '상세 슬롯 설계'] },
    { name: 'mood', label: '무드 키워드', type: 'text', placeholder: '예: 따뜻·미니멀·신혼 주방', showFor: ['촬영컷 리스트', '이미지 프롬프트', '상세 슬롯 설계'] },
    { name: 'forbidden', label: '금지 요소(선택)', type: 'text', placeholder: '예: 플라스틱 질감·과채도·깨진 한글', showFor: ['이미지 프롬프트'] },
    { name: 'usage', label: '용도', type: 'multiselect', options: ['상세페이지', '인스타 피드', '릴스 썸네일', '광고 배너'], showFor: ['촬영컷 리스트'] },
    { name: 'shotType', label: '컷 종류', type: 'multiselect', options: ['정면', '측면', '사용씬', '디테일', '사이즈감', '패키지', '무드', '히어로'], showFor: ['이미지 프롬프트'] },
    { name: 'ratio', label: '비율', type: 'select', options: ['4:5 (상세/피드)', '1:1 (썸네일)', '9:16 (릴스)', '16:9 (배너)'], showFor: ['이미지 프롬프트', '목업 합성'] },
    { name: 'refImageNote', label: '원본 사진 설명', type: 'text', placeholder: '합성할 제품 원본 컷', showFor: ['목업 합성'] },
    { name: 'targetScene', label: '합성할 배경', type: 'textarea', placeholder: '예: 자연광 홈카페 식탁', showFor: ['목업 합성'] },
    { name: 'overlayText', label: '삽입 문구', type: 'text', placeholder: '히어로/광고컷에 얹을 한글 1~2줄', showFor: ['텍스트 합성'] },
    { name: 'textPosition', label: '문구 위치', type: 'select', options: ['좌상단', '우상단', '하단', '중앙 여백'], showFor: ['텍스트 합성'] },
    { name: 'description', label: '제품 설명/색감(선택)', type: 'textarea', showFor: ['촬영컷 리스트', '상세 슬롯 설계'] },
    { name: 'mode', label: '모드', type: 'select', required: true, options: ['촬영컷 리스트', '이미지 프롬프트', '목업 합성', '텍스트 합성', '상세 슬롯 설계'] },
  ],

  // 🧭 운영 매니저
  ops: [
    { name: 'focus', label: '특별히 볼 것(선택)', type: 'text', placeholder: '예: 광고 승인 / 매출 / 비우면 전체' },
    { name: 'staffData', label: '직원 산출물·상태(선택)', type: 'textarea', placeholder: '비우면 최근 리포트 자동 참조', showFor: ['전사 브리핑', '누락·병목 감지'] },
    { name: 'approvalItems', label: '승인 대기 항목', type: 'textarea', placeholder: '유형|요청직원|내용|대기시간 (줄바꿈)', showFor: ['승인 대기 정리'] },
    { name: 'taskList', label: '할일/인사이트 목록', type: 'textarea', placeholder: '제목|담당|기한 (줄바꿈)', showFor: ['중복·만료 정리'] },
    { name: 'mode', label: '모드', type: 'select', required: true, options: ['전사 브리핑', '승인 대기 정리', '누락·병목 감지', '중복·만료 정리'] },
  ],
};

export function getInputForm(typeKey: string): StaffInputField[] {
  return STAFF_INPUT_FORMS[typeKey] || [];
}

/**
 * 직원·모드별 "이 작업만" 강한 전용 지시문 (inputToInstruction이 프롬프트 맨 앞에 주입).
 * 회사 브레인(시목 맥락)은 시스템 프롬프트에 이미 주입됨 → "그 맥락을 실전으로 구체화"하라고 명시.
 */
export const MODE_DIRECTIVES: Record<string, Record<string, string>> = {
  sourcing: {
    '분석(할까 말까)':
      '이번엔 "소싱 가부 판정"만 (키워드·상품명·태그·기획서는 내지 마). ① 5축(트렌드·진입여지·타겟·마진·차별화)을 0~2점 평가→합계/판정(7+추천·4~6보류·3↓비추천, 마진0이면 추천 불가) + 예상 순마진(수수료·배송·광고비 매출15% 포함, 순마진율·손익분기). ② 보류·비추천이면 "안 되는 이유"를 구체적으로, 그걸 추천으로 바꿀 조건/방법까지. ③ 원목 시장 소구점·고객 니즈·커뮤니티(카페·블로그·유튜브 댓글) 반응·타겟 페르소나를 회사 브레인+검색으로 구체화. 검증 신뢰도(높음/중간/낮음) 표기. 일반론·뜬구름 금지.',
    '키워드 기획':
      '이번엔 "키워드 기획"만 (가부 판정·5축·마진·기획서는 내지 마). 메인5(구매의도·검색량)·서브10(롱테일·낮은경쟁)·스마트스토어 상품명3(50자내)·태그20을 각각 경쟁강도(상/중/하)와 함께 표로. 시목 타겟의 상황 키워드(집들이·신혼·선물) 반영, 금지표현 제외.',
    '상품 기획서':
      '이번엔 "상품 기획서"만 (가부 판정·키워드 세트는 내지 마). 타겟·USP3·가격 포지셔닝·마진 가이드(원가·권장가·손익분기)·차별화·예상 구매장벽+극복법. "관리 어려움" 같은 장벽을 시목 강점(통원목·천연오일)으로 정면 돌파하는 각도로.',
  },
  detail_page: {
    '전체 기획':
      '이번엔 "전체 상세페이지 기획"만. 12섹션(①후킹 ②문제제기·공감 ③방치 시 손실 ④솔루션·메커니즘 ⑤변화 후 모습 ⑥디테일 스펙 ⑦신뢰·증거 ⑧비교·차별점 ⑨가격·구성+중간CTA ⑩구매결정 안내 ⑪FAQ ⑫최종CTA)을 산출하고, 각 섹션은 6블록(핵심 한 줄·모바일 카피·핵심 불릿 7개·추천 비주얼 3개+오버레이 카피·의심 제거 1줄·미니 CTA)으로. priceTier로 비중 가중(저가=공감40·혜택30·가격30 / 중가=공감20·차별40·증거40 / 프리미엄=공감10·스토리30·신뢰60, 프리미엄만 일일환산). industry 신뢰순위 적용(가구=소재>내구성>설치사진>공정>AS). 기능은 고객이익으로 번역. 빈칸은 되묻지 말고 안전 기본값+"※"플래그. 과장·효능단정·최저가·근거없는 1위/보증 금지.',
    '섹션 재생성':
      '이번엔 지정한 targetSection 1개만 rewriteDirection 톤으로 재생성(6블록 구조 유지). 다른 섹션·전략브리핑은 내지 마. 구매 직전 새 장점 추가 금지(불안 제거만).',
    'HTML 변환':
      '이번엔 붙여넣은 기획안을 대상 플랫폼 붙여넣기용 HTML/텍스트 구조로 "변환"만. 카피 내용·소구점 변경·새 주장 추가 금지. 끝에 "최종 게시 전 사람 확인 필요" 명시.',
  },
  cs: {
    '문의 답변': '이번엔 "이 문의 1건 답변초안"만. 유형·긴급도·감정·승인필요를 먼저 분류하고 공감(첫 문장)→사실확인/대안→처리시간(영업일 1~2일) 3~5문장. 교환·환불×즉시×(불만/이탈위험)이면 승인필요=true. 금지표현("정책상 안 됩니다/고객님 과실/환불 불가/원래 그런 제품/상세에 적혀있습니다/책임 없습니다") 금지, 단정 거절 말고 대안으로. FAQ·후기 대응은 내지 마.',
    'FAQ 생성': '이번엔 "FAQ 생성"만. 반복 문의를 Q&A 쌍으로 묶어 지식화 + 상세페이지/상품/비주얼로 넘길 개선 인사이트 분리. 개별 답변초안은 만들지 마.',
    '부정 후기 대응': '이번엔 "부정 후기 공개 대응"만(미래 고객이 봄). 공감→책임 회피 없는 유감→해결 의지→개선 약속→개별 연락 안내 + 비공개 처리/개선 인사이트. 고객 잘못 공개 지적·정책 공개 논쟁·개인정보 공개 요청·장황한 변명 금지.',
    '정책 안내문': '이번엔 "고객 대면 정책 안내문"만. 내부 운영 기준을 부드럽고 명확한 고객용 문구로 다듬기. 입력에 없는 정책 지어내기·효능 단정 금지.',
  },
  sns: {
    '콘텐츠 캘린더': '이번엔 "주간 콘텐츠 캘린더"만. campaignMode에 맞춰 정보/공감/제품/후기/비하인드 비율 조정해 날짜·채널·포맷·유형·목적·핵심메시지·해시태그 배치(제품 비중 과다면 경고). 단건 캡션 전문·릴스 스크립트는 내지 마.',
    '게시글 캡션': '이번엔 "캡션 1건"만. 첫 줄은 8유형 훅 중 하나(점수+이유)→공감→가치→자연스러운 제품→해시태그(대2·중4·소4·#시목)→목적별 CTA + A/B/C 변주 + 이미지 브리프. 효능 단정·판매 직진 금지. 캘린더·스크립트는 내지 마.',
    '스크립트': '이번엔 "릴스/영상 스크립트"만. 0~3초 후킹 최우선, length 타임라인(후킹→문제→해결→제품→CTA), 컷별 장면·자막·촬영가이드·소품·오디오 무드. 정적 캡션·캘린더는 내지 마.',
    '훅 뽑기': '이번엔 "훅 후보"만. 본문 없이 8유형 훅 6~8개 + 즉시성·타겟성·저장성·전환성·브랜드적합성 5기준 훅 점수와 이유. 시목 원목 맥락으로 구체화, 완성 캡션은 만들지 마.',
    '톤 점검': '이번엔 새로 생성하지 말고 붙여넣은 캡션을 시목 톤(따뜻·담백)으로 리라이트. fixIntent 반영, 과장·효능 단정·위험 해시태그 표시·교체. 원문 의미 유지, 판매 직진 톤만 완화.',
  },
  ad: {
    '카피 3세트': '이번엔 "카피 3세트"만(감성/기능/가격). 세트마다 헤드라인15·서브30·상세90·CTA·이미지 방향·적합 채널·기대 반응·주의점·상태·variant_id. 기능은 고객이익으로 번역. 타겟·예산·채널 문안은 내지 마.',
    '타겟·예산 세팅': '이번엔 "타겟·예산"만. 키워드20(구매의도순)·오디언스(코어/유사/관심/제외)·예산 배분(1차 균등→3일 후 승자70/보조20/신규10). 카피 본문은 내지 마.',
    '채널별 문안': '이번엔 선택 채널 "실집행 문안"만(네이버=키워드·제목·설명, 인스타=이미지+짧은 카피, 카카오=관심사·친근). 미선택 채널·3세트 변주는 내지 마.',
    '컴플라이언스 점검': '이번엔 붙여넣은 문구의 "컴플라이언스·랜딩 점검"만. 금지표현(근거없는 1위/최저가·내구성/효능 단정·허위 혜택·불안 조장)→대체 표현, 랜딩 URL 있으면 가격·배송·소재·포장·관리법 일치 체크. 새 카피 창작 금지.',
    'A/B 테스트 설계': '이번엔 testVariable 하나만 변주(나머지 고정)하는 "A/B 설계"만. 가설·기대지표(CTR/CVR/ROAS)·승자/폐기 기준. 풀 카피세트는 내지 마.',
  },
  monitor: {
    '경쟁사 분석': '이번엔 "경쟁사 vs 시목 비교 + 대응 전략"만. 가격·구성·리뷰 강약점·차별점 비교표(세트는 1인분 단가 환산) + 회사 브레인 기준 대응 2~3줄(가격/구성/메시지 중 무엇으로). prevReport 있으면 델타(지난값→이번값). 모든 수치에 출처 URL·확인시각·확실도, 핵심 가격은 "원문 확인 필요". 트렌드 전반·키워드강도표는 내지 마.',
    '트렌드 리포트': '이번엔 "카테고리 트렌드"만. 키워드별 검색량 방향·급상승어·시즌성을 의미·활용 방향(SNS/상세/광고)까지. 단정 말고 방향성(불확실하면 "추정"), 상위 출처만. 경쟁사 비교표·대응 카피는 내지 마.',
    '키워드 경쟁강도': '이번엔 "키워드 경쟁강도 진단"만. 키워드별 경쟁 정도(상/중/하)·노출 난이도·진입 여지·공략 우선순위 + 근거(상위 노출 경쟁사 수·리뷰 누적)·확실도. 경쟁사 비교표·대응 전략은 내지 마.',
  },
  analyst: {
    '주간 성과 리포트': '이번엔 "주간 성과 풀세트"만. KPI 카드(8개 이내·값·델타·시그널)+이상치+가설(신뢰도)+추천 액션(담당)+출처/신뢰도. 표본 작으면 "데이터 부족". 단순 수치 나열·단정 금지.',
    'KPI 집계·해석': '이번엔 "집계·해석"만. 지표별 변화율(%/%p/배수)·신호등·지표 조합 해석(방문↑전환↓ 등)까지만. 가설/액션 장황하게·이상치 깊은 진단은 다음 모드로 (내지 마).',
    '이상치 진단': '이번엔 focusMetric 또는 가장 급변한 1~2지표만 깊게. 원인 가설(영향지표·기간·채널)+신뢰도+검증 액션(A/B·세그먼트·데이터요청). 전체 KPI 카드 나열·상관을 인과로 단정 금지.',
    '퍼널 분석': '이번엔 funnelData 단계별(노출→클릭→상세→장바구니→구매) 전환율·최대 이탈 구간 + 그 구간 원인 가설·액션만. 퍼널 외 일반 매출/광고 해석은 내지 마.',
    '채널 성과 비교': '이번엔 breakdownData를 비교표(CTR·CPC·CVR·CAC·ROAS)로, 승자/중단 세트 판정 + 예산 재배분 제안(→광고)만. 평균 착시 금지(세트·채널 분리), 사장 승인 없이 집행 단정 금지.',
  },
  visual: {
    '촬영컷 리스트': '이번엔 "촬영컷 리스트"만. 먼저 소재·물성·용도·감성·신뢰·차별점을 추출하고 그 가치가 보이는 컷만. MUST5(정면/측면두께/사용씬/디테일/사이즈감) 필수 + NICE + 채널별 조합·용도별 비율. 단순 예쁜 컷 나열 금지.',
    '이미지 프롬프트': '이번엔 "이미지 프롬프트"만. 컷별 [무엇]+[연출]+[배경/소품]+[조명/무드]+[스타일/퀄리티]+[--ar 비율] 6덩어리 영문 + 브랜드 무드(warm natural, wood) + 물성(realistic wood grain, no CGI look) + 네거티브 + 엔진 추천. 충돌 키워드·효능 암시 금지.',
    '목업 합성': '이번엔 "목업 합성 브리프"만. 제품 형태·색·나뭇결·비율 유지하고 배경에만 자연스럽게 합성(원근·그림자·조명 일치). 떠 보임·제품 변형 금지. 추천 엔진 gpt-image-1.',
    '텍스트 합성': '이번엔 "텍스트 합성 브리프"만. 제품 안 가리는 여백에 한글 1~2줄, 폰트 톤·색(차콜/크림)·위치 지정, 가격 문구는 실제와 일치. 대표컷은 한글 깨짐 우려로 사람 후편집 권장. 제품 위 텍스트 덮기 금지.',
    '상세 슬롯 설계': '이번엔 "상세페이지 이미지 슬롯 순서"만. 히어로→정면→소재→두께→사용→사이즈→관리→선물→무드 순으로 슬롯별 컷·문구 방향. AI 이미지는 시안/보완용, 메인컷은 실촬영 기준 표기.',
  },
  ops: {
    '전사 브리핑': '이번엔 "오늘 볼 것 3개"(반드시 3개 이하)만 메인으로 — ①매출·전환 직격 ②사장 승인 대기(병목) ③재시도·기한 임박 순, 각 5요소(level🔴🟠🟢·area·title·whyNow·decision). 끝에 직원 건강(성공/실패/미실행 카운트+예시)·승인 대기 큐. 승인 status를 절대 "승인"으로 바꾸지 마(결정은 사람만).',
    '승인 대기 정리': '이번엔 "승인 대기 큐"만. 항목별 유형·요청직원·내용·대기시간·승인 안 하면 영향·추천 선택지로 정렬(매출영향·대기시간 순). top3·직원 건강은 내지 마. 어떤 항목도 대신 승인하지 마(정렬·제안만).',
    '누락·병목 감지': '이번엔 "누락 감지"만. 제안→할일 미생성 / 할일→담당 미지정 / 실패→재시도 없음 / 넘기기 미수신 / 인사이트 미연결을 출처직원·대상직원·영향·추천·등급으로. top3 형식·승인 큐는 내지 마. 새 할일 등록은 본문 제안으로(자동 등록 금지).',
    '중복·만료 정리': '이번엔 "중복·만료 정리 제안"만. 유사 할일 병합 제안(담당·기한 다르면 병합 금지 명시) + 만료/지난 기한 인사이트 정리 제안. 자동 병합·자동 삭제 금지(모두 사장 확인용 제안). top3·승인 큐는 내지 마.',
  },
};
