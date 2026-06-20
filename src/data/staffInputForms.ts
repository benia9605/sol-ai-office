/**
 * @file src/data/staffInputForms.ts
 * @description 직원별 "직접 시키기(수동)" 입력 폼 정의
 * - 각 직원 SOP 문서(docs/guides/ai오피스구축/직원SOP/*)의 입력 폼·시뮬레이션 기준.
 * - "어떤 상품으로 상세페이지 써줘" 같은 수동 지시를 직원 타입별 필드로 받는다.
 * - 매번 입력 = 수동 실행(runStaffManual). 이미지 업로드는 추후(Vision 연동 시).
 */
import { StaffInputField } from '../types';

export const STAFF_INPUT_FORMS: Record<string, StaffInputField[]> = {
  sourcing: [
    { name: 'productName', label: '상품명', type: 'text', required: true, placeholder: '예: 티크 원목 도마' },
    { name: 'category', label: '카테고리', type: 'text', placeholder: '예: 원목 주방소품' },
    { name: 'price', label: '예상 판매가 / 원가', type: 'text', placeholder: '예: 판매 39,000 / 원가 18,000' },
    { name: 'competitorLink', label: '경쟁사 링크/정보', type: 'text' },
    { name: 'description', label: '상품 설명', type: 'textarea', placeholder: '소재·특징·타겟 등' },
    { name: 'mode', label: '모드', type: 'select', options: ['분석(할까 말까)', '키워드 기획', '상품 기획서'] },
  ],
  detail_page: [
    { name: 'productName', label: '상품명', type: 'text', required: true },
    { name: 'features', label: '핵심 특장점 (줄바꿈으로)', type: 'textarea', placeholder: '통원목 한 장\n천연오일 마감\n국내 수작업' },
    { name: 'targetCustomer', label: '타겟 고객', type: 'text', placeholder: '예: 신혼·집들이 선물' },
    { name: 'price', label: '가격', type: 'text' },
    { name: 'tone', label: '톤 조정', type: 'select', options: ['기본', '더 감성적으로', '더 전문적으로', '짧게'] },
  ],
  cs: [
    { name: 'customerMessage', label: '고객 문의', type: 'textarea', required: true, placeholder: '고객이 보낸 문의를 붙여넣기' },
    { name: 'productName', label: '상품명', type: 'text' },
    { name: 'orderInfo', label: '주문정보(선택)', type: 'text', placeholder: '주문번호 등' },
    { name: 'mode', label: '모드', type: 'select', options: ['문의 답변', 'FAQ 생성', '부정 후기 대응'] },
  ],
  sns: [
    { name: 'topic', label: '주제', type: 'text', placeholder: '예: 신상 도마 / 원목 관리법' },
    { name: 'productName', label: '상품명', type: 'text' },
    { name: 'channel', label: '채널', type: 'select', options: ['인스타', '유튜브', '틱톡', '블로그'] },
    { name: 'objective', label: '목적', type: 'select', options: ['인지', '저장', '공감', '문의', '전환', '신뢰'] },
    // 스크립트 모드 전용
    { name: 'length', label: '길이', type: 'duration', placeholder: '예: 30초 / 5분', showFor: ['스크립트'] },
    { name: 'detail', label: '상세 기획 내용', type: 'textarea', placeholder: '구성·장면·핵심 메시지·자막 등 원하는 방향', showFor: ['스크립트'] },
    { name: 'mode', label: '모드', type: 'select', options: ['콘텐츠 캘린더', '게시글 캡션', '스크립트'] },
  ],
  ad: [
    { name: 'productName', label: '상품명', type: 'text', required: true },
    { name: 'usp', label: '핵심 USP', type: 'text', placeholder: '예: 통원목·천연오일 마감' },
    { name: 'target', label: '타겟', type: 'text', placeholder: '예: 2030 신혼·집들이 선물' },
    { name: 'budget', label: '일예산(선택)', type: 'text' },
    { name: 'channels', label: '채널', type: 'multiselect', options: ['네이버 성과형', '인스타/메타', '카카오 모먼트'] },
  ],
  monitor: [
    { name: 'competitorInput', label: '경쟁사 URL / 붙여넣은 정보', type: 'textarea', required: true, placeholder: '경쟁사 상품 링크나 가격·리뷰 텍스트' },
    { name: 'keywords', label: '비교 키워드', type: 'text', placeholder: '예: 티크도마, 원목도마' },
    { name: 'category', label: '카테고리', type: 'text' },
  ],
  analyst: [
    { name: 'metricData', label: '지표 데이터', type: 'textarea', required: true, placeholder: '매출 320만(전주 285만)\n전환율 2.1%(전주 2.5%)\n광고비 67만, ROAS 4.8 …' },
    { name: 'period', label: '기간', type: 'text', placeholder: '예: 6/8~6/14 (전주 대비)' },
  ],
  visual: [
    { name: 'productName', label: '상품명', type: 'text', required: true },
    { name: 'mood', label: '무드 키워드', type: 'text', placeholder: '예: 따뜻·미니멀·신혼 주방' },
    { name: 'usage', label: '용도', type: 'multiselect', options: ['상세페이지', '인스타 피드', '릴스 썸네일', '광고 배너'] },
    { name: 'ratio', label: '비율', type: 'select', options: ['4:5 (상세/피드)', '1:1 (썸네일)', '9:16 (릴스)', '16:9 (배너)'] },
    { name: 'description', label: '제품 설명/소재', type: 'textarea', placeholder: '소재·색감·특징' },
  ],
  ops: [
    { name: 'focus', label: '특별히 볼 것(선택)', type: 'text', placeholder: '예: 광고 승인 / 매출 / 비워두면 전체' },
  ],
};

export function getInputForm(typeKey: string): StaffInputField[] {
  return STAFF_INPUT_FORMS[typeKey] || [];
}

/**
 * 직원·모드별 "이 작업만" 강한 전용 지시문.
 * - 모드가 안 갈라져 같은 결과가 나오는 문제 해결: 모드마다 산출물을 명확히 다르게 강제.
 * - 회사 브레인(시목 맥락)은 시스템 프롬프트에 이미 주입됨 → "그 맥락을 실전으로 활용"하라고 명시.
 */
export const MODE_DIRECTIVES: Record<string, Record<string, string>> = {
  sourcing: {
    '분석(할까 말까)':
      '이번엔 "소싱 가부 판정"만 한다 (키워드/상품명/태그·기획서는 내지 마). ' +
      '① 추천/보류/비추천 + 5축 평가 + 예상 순마진. ' +
      '② 보류·비추천이면 "안 되는 이유"를 구체적으로 짚고, 그걸 극복해 추천으로 바꿀 조건/방법을 제시. ' +
      '③ 반드시 실전 근거로: 이 원목 시장의 소구점, 고객 니즈, 커뮤니티(카페·블로그·유튜브 댓글)에서 이 상품류를 어떻게 말하는지, 대상 고객이 누구인지를 회사 브레인+검색으로 구체적으로 채운다. 일반론·뜬구름 금지.',
    '키워드 기획':
      '이번엔 "키워드 기획"만 한다 (가부 판정·5축·기획서는 내지 마). ' +
      '메인 키워드 5(구매의도·검색량), 서브 10(롱테일·낮은 경쟁), 스마트스토어 상품명 3, 태그 20을 내고 각 경쟁강도를 병기. 실제 검색 트렌드 근거로.',
    '상품 기획서':
      '이번엔 "상품 기획서"만 한다 (가부 판정·키워드 세트는 내지 마). ' +
      '타겟·USP·가격 포지셔닝·마진 가이드·차별화 포인트·구매 장벽과 극복법을 구조화. 시목 원목 맥락과 고객 니즈를 구체적으로 반영.',
  },
  cs: {
    '문의 답변': '이번엔 "이 문의 1건 답변초안"만. 공감→사실확인/대안→처리시간. 유형·긴급도·감정·승인필요 여부 판단 포함. FAQ 묶음·후기 대응은 내지 마.',
    'FAQ 생성': '이번엔 "FAQ 생성"만. 반복될 문의를 질문/답변 쌍으로 묶어 지식화. 개별 답변초안은 내지 마.',
    '부정 후기 대응': '이번엔 "부정 후기 대응"만. 공개 응대문(미래 고객이 봄: 공감→유감→해결의지→개선약속→개별연락) + 비공개 처리/개선 인사이트. 일반 문의 답변은 내지 마.',
  },
  sns: {
    '콘텐츠 캘린더': '이번엔 "주간 콘텐츠 캘린더"만. 여러 게시물을 날짜·채널·포맷·콘텐츠유형(정보/공감/제품/UGC/비하인드 믹스)·목적·핵심메시지로. 단건 캡션 전문·스크립트는 내지 마.',
    '게시글 캡션': '이번엔 "게시글 캡션 1건"만. 훅(점수)·본문·해시태그·이미지 브리프 + A/B/C 변주. 캘린더·스크립트는 내지 마.',
    '스크립트': '이번엔 "릴스/영상 스크립트"만. 0~3초 후킹→문제→해결→제품→CTA 타임라인, 컷별 장면·자막·촬영가이드·소품. 캘린더·정적 캡션은 내지 마.',
  },
};
