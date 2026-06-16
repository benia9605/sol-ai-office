/**
 * @file src/data/staffCatalog.ts
 * @description AI 직원 타입 카탈로그 (코드 상수)
 * - 아키텍처 §5.2 기반. 채용 시 타입을 골라 인스턴스(staff)를 만든다.
 * - outputKind가 직원 상세 UI를 결정.
 * - defaultPrompt: 채용 시 미리 채워지는 기본 프롬프트(사용자가 편집).
 *   ※ 실제 실행 시스템프롬프트 = [타입 베이스 SOP(코드)] + [브랜드 컨텍스트(자동)] + [이 프롬프트]
 */
import { StaffTypeDef } from '../types';

export const STAFF_TYPES: StaffTypeDef[] = [
  {
    key: 'sourcing',
    label: '소싱 기획자',
    emoji: '🔍',
    roleLine: '팔릴 근거부터 정리',
    features: ['소싱 가능성 분석', '키워드 기획안', '상품 기획서 초안'],
    outputKind: 'sourcing_brief',
    defaultRoutines: ['매일 09:00 카테고리 트렌드 점검', '주간 경쟁강도 리포트'],
    defaultPrompt: '느낌이 아니라 트렌드 방향·경쟁강도·타겟 명확성의 근거로 소싱 추천 여부를 판단해줘. 결과는 바로 실행 가능한 형태로 정리.',
    promptPlaceholder: '예: 2030 여성 타겟, 감성 소품 위주로 추천 여부를 근거와 함께.',
  },
  {
    key: 'detail_page',
    label: '상세페이지 제작자',
    emoji: '📄',
    roleLine: '상품정보 → 바로 쓰는 상세페이지',
    features: ['6섹션 기획안 생성', '섹션별 카피 재생성', '스마트스토어 HTML 변환'],
    outputKind: 'detail_builder',
    defaultRoutines: ['주문 시 상세페이지 초안 생성'],
    defaultPrompt: '스크롤을 멈추는 후킹으로 시작하고, 기능을 "고객 이익"으로 번역해줘. 신뢰/증거 섹션을 중간에 배치하고, 과장·효능 단정은 피해줘. 톤은 우리 브랜드에 맞게.',
    promptPlaceholder: '예: 따뜻하고 담백한 장인 톤. 과장 금지.',
  },
  {
    key: 'cs',
    label: 'CS 응대',
    emoji: '💬',
    roleLine: '문의 답변 + 후기 관리',
    features: ['문의 분류+답변', 'FAQ 생성', '후기 관리(긍정 유도·부정 대응)'],
    outputKind: 'ticket_list',
    defaultRoutines: ['실시간 문의 1차 응답', '매일 18:00 미해결·신규 후기 요약'],
    defaultPrompt: '항상 먼저 불편에 공감하고 3~5문장으로 답해줘. 환불·교환은 정책 내 최대한 수용적으로. 후기는 긍정 유도, 부정 후기는 공감+해결로 브랜드 이미지를 지켜줘. 의학적 효능 단정 금지.',
    promptPlaceholder: '예: 친근한 존댓말, 이모지 적당히.',
  },
  {
    key: 'sns',
    label: 'SNS 운영',
    emoji: '📣',
    roleLine: '캘린더 + 캡션 + 릴스 스크립트',
    features: ['월간 콘텐츠 캘린더', '캡션 A/B/C', '릴스/스토리 스크립트'],
    outputKind: 'sns_queue',
    defaultRoutines: ['매일 09:00 게시물 초안 1건', '주간 콘텐츠 캘린더 정리'],
    defaultPrompt: '첫 줄 훅이 강한 캡션을 써줘. 브랜드 톤을 유지하고, 자동 발행이 어려우면 복붙용 완성 카피 + 이미지 브리프로 제공.',
    promptPlaceholder: '예: 인스타 감성 톤, 해시태그 #인생네컷 계열.',
  },
  {
    key: 'ad',
    label: '광고 기획',
    emoji: '🎯',
    roleLine: '광고 카피·타겟 세팅 가이드',
    features: ['카피세트(헤드라인/서브/CTA)', '타겟 세팅 가이드', 'A/B 3세트'],
    outputKind: 'copy_variants',
    defaultRoutines: ['주간 광고 소재 세트 생성'],
    defaultPrompt: '핵심 USP를 짧고 강하게. 헤드라인 15자 이내. 감성형·기능형·가격형 3세트로 변주해줘.',
    promptPlaceholder: '예: 네이버·인스타 기준, 일예산 배분도.',
  },
  {
    key: 'monitor',
    label: '모니터링',
    emoji: '📡',
    roleLine: '경쟁사·트렌드 주간 리포트',
    features: ['경쟁사 분석', '트렌드 리포트', '키워드 경쟁강도 예측'],
    outputKind: 'monitor_digest',
    defaultRoutines: ['매일 08:00 키워드 검색량 수집', '주간 경쟁사 스캔'],
    defaultPrompt: '붙여넣은 경쟁사 정보를 분석해 가격·리뷰키워드·구성을 비교하고, 우리 차별화 포인트와 대응 전략을 뽑아줘.',
    promptPlaceholder: '예: 경쟁사 URL/텍스트 붙여넣으면 비교표로.',
  },
  {
    key: 'analyst',
    label: '분석가',
    emoji: '📊',
    roleLine: 'KPI 집계·해석·이상치',
    features: ['KPI 집계·추이', '이상치 감지', '주간 성과 해석'],
    outputKind: 'metric_digest',
    defaultRoutines: ['매일 09:00 KPI 집계', '주간 성과 리포트'],
    defaultPrompt: '핵심 지표 추이를 집계하고, 전주 대비 급변한 지표는 원인 가설과 함께 짚어줘. 숫자는 쉽게 해석해서.',
    promptPlaceholder: '예: 매출·전환율·방문자 중심으로.',
  },
  {
    key: 'visual',
    label: '비주얼 디렉터',
    emoji: '📸',
    roleLine: '촬영·이미지 프롬프트 · 목업',
    features: ['제품/라이프스타일 이미지 프롬프트', '목업 합성 브리프', '필수 촬영컷 리스트'],
    outputKind: 'image_brief',
    defaultRoutines: ['상품 등록 시 촬영컷 리스트 + 이미지 프롬프트 생성'],
    defaultPrompt: '제품 사진을 바로 만들 수 있는 이미지 프롬프트를 [무엇]+[연출]+[배경/소품]+[조명/무드]+[스타일/퀄리티]+[비율] 구조로 써줘. 브랜드 무드를 유지하고, 상세페이지에 필요한 필수 촬영컷 리스트도 제안. 충돌 키워드는 피하고 비율은 상세용 4:5 기본.',
    promptPlaceholder: '예: 원목 무드, 자연광, 미니멀. 미드저니/나노바나나용.',
  },
  {
    key: 'ops',
    label: '운영 매니저',
    emoji: '🧭',
    roleLine: '전 직원 취합 · 오늘 볼 것 3개',
    features: ['전사 일일 브리핑', '미완료·실행실패 점검', '중복 할일 병합·인사이트 정리'],
    outputKind: 'ops_digest',
    defaultRoutines: ['매일 08:30 전사 브리핑'],
    defaultPrompt: '전 직원의 어제 산출물과 미완료 할일·실행 실패를 취합해서, 사장이 "오늘 꼭 볼 것 3개"만 우선순위로 압축해줘. 승인 대기 액션·미배정 할일·재시도 필요 건을 짚고, 말은 줄이고 결정을 돕는 톤으로.',
    promptPlaceholder: '예: 매출/승인대기 우선, 너무 길게 쓰지 말 것.',
  },
];

export function getStaffType(key: string): StaffTypeDef | undefined {
  return STAFF_TYPES.find(t => t.key === key);
}
