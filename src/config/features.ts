/**
 * @file src/config/features.ts
 * @description 개인 공간 기능 on/off 플래그 (슬림다운 · 백업용)
 *
 * 개인 공간을 핵심 4개(할일·인사이트·스터디·기록)로 축소하면서, 나머지 기능은
 * 코드를 지우지 않고 여기서 꺼둔다. 상용화 시 해당 값을 true로 바꾸면 부활한다.
 * 자세한 계획: docs/PERSONAL_SLIMDOWN_PLAN.md
 *
 * ⚠️ 오피스(회사 워크스페이스) 셸에는 영향 없음 — 개인 공간(Layout/pages) 노출만 제어.
 */
export const FEATURES = {
  schedules: false, // 일정 (/schedules)
  aiChat: false,    // 방 대화(rooms) + 모디 비서(FAB·브리핑) + 최근 대화 + ChatModal
  content: false,   // 콘텐츠 (/content)
  projects: false,  // 프로젝트 (상세 /project/:id + 사이드바 목록)
  summaries: false, // 대화 요약 (/summaries)
} as const;

export type FeatureKey = keyof typeof FEATURES;
