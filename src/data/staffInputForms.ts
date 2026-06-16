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
