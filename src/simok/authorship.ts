/**
 * @file src/simok/authorship.ts
 * @description 보고서의 **실행 계기**와 **실제 생성자**를 분리한다 — GPT-R3-O3
 *
 * GPT 통합 round3 §4:
 *   "캡처03에 `GPT 예약 실행`과 `sonnet`이 함께 나온다. SimokReports.tsx 가 trigger!==manual 이면
 *    actor=gpt 로 고정한 결과다. **실행 계기(예약/수동)와 실제 생성자/모델을 분리**한다.
 *    기존 Claude/Office 기록이나 출처 미상 기록을 GPT 가 작성했다고 표시하지 않는다.
 *    현재 예약 미등록인데 과거 기록 배지가 가동 상태처럼 보이지 않아야 한다."
 *
 * 사실관계:
 *   · `daily_reports.trigger` 는 **어떻게 시작됐나**(auto=일과/cron, manual=지금 시키기)일 뿐
 *     **누가 썼나**가 아니다.
 *   · 과거 기록은 Office 의 AI 직원 엔진(Anthropic/OpenAI/Perplexity)이 만든 것이다.
 *     구독 GPT/Codex 가 쓴 것이 아니다. 둘을 같은 'GPT' 배지로 묶으면 거짓이 된다.
 *   · `office-staff-run`(cron)은 **배포돼 있지 않다.** 그래서 trigger='auto' 라도
 *     "지금 예약이 돌고 있다"는 뜻이 아니다. 과거 기록일 뿐이다.
 */

/** 실제로 누가 만들었나 */
export type Author =
  | { kind: 'office_engine'; model: string }   // Office 의 AI 직원 엔진이 모델 API 로 생성
  | { kind: 'external_gpt' }                   // 구독 GPT/Codex 가 만들어 Office 에 저장
  | { kind: 'human' }                          // 사람이 직접 작성
  | { kind: 'unknown' };                       // 출처가 기록되지 않음

/** 어떻게 시작됐나 */
export type Trigger =
  | { kind: 'scheduled'; live: boolean }       // 일과/cron. live=false 면 과거 기록
  | { kind: 'manual' }                         // 사람이 "지금 시키기"
  | { kind: 'imported' }                       // 외부에서 저장(bridge push 등)
  | { kind: 'unknown' };

export interface Attribution { author: Author; trigger: Trigger }

/** Office 엔진이 쓰는 모델 이름들 — 이 값이 있으면 **구독 GPT 가 아니다** */
const OFFICE_ENGINE_MODELS = new Set([
  'sonnet', 'haiku', 'opus', 'gpt', 'research',
  'claude-sonnet-4-6', 'claude-haiku-4-5-20251001', 'claude-opus-4-8',
  'gpt-4o', 'sonar-pro', 'gpt-image-1',
]);

/**
 * 저장된 레코드에서 작성자와 실행 계기를 **각각** 판정한다.
 *
 * @param scheduledRunnerLive 지금 예약 실행기가 실제로 가동 중인가.
 *   `office-staff-run` 이 배포·등록되지 않았으므로 기본 false 다.
 *   false 면 trigger='auto' 기록을 "가동 중" 으로 보이게 하지 않는다.
 */
export function attributionOf(
  r: { trigger?: string; model?: string | null; source?: string | null },
  scheduledRunnerLive = false,
): Attribution {
  const model = (r.model ?? '').trim();

  // ── 작성자 ──
  let author: Author;
  if (r.source === 'bridge' || r.source === 'external_gpt') {
    author = { kind: 'external_gpt' };
  } else if (model && OFFICE_ENGINE_MODELS.has(model)) {
    // 모델 이름이 있으면 Office 엔진이 만든 것이다. 구독 GPT 가 아니다.
    author = { kind: 'office_engine', model };
  } else if (model) {
    author = { kind: 'office_engine', model };
  } else if (r.trigger === 'manual') {
    // 모델 기록이 없는 수동 기록 — 사람이 쓴 것으로 본다
    author = { kind: 'human' };
  } else {
    author = { kind: 'unknown' };
  }

  // ── 실행 계기 ──
  let trigger: Trigger;
  if (r.trigger === 'manual') trigger = { kind: 'manual' };
  else if (r.trigger === 'auto') trigger = { kind: 'scheduled', live: scheduledRunnerLive };
  else if (r.source === 'bridge') trigger = { kind: 'imported' };
  else trigger = { kind: 'unknown' };

  return { author, trigger };
}

/** 화면에 띄울 작성자 라벨 */
export function authorLabel(a: Author): { text: string; sub: string } {
  switch (a.kind) {
    case 'office_engine': return { text: 'Office AI 직원', sub: `모델 ${a.model}` };
    case 'external_gpt': return { text: 'GPT', sub: '구독 실행 · 저장됨' };
    case 'human': return { text: '사람', sub: '직접 작성' };
    default: return { text: '작성자 미상', sub: '기록 없음' };
  }
}

/** 화면에 띄울 실행 계기 라벨. 가동 중이 아니면 그렇게 쓴다. */
export function triggerLabel(t: Trigger): string {
  switch (t.kind) {
    case 'scheduled': return t.live ? '예약 실행' : '예약 실행(과거 기록 · 현재 미가동)';
    case 'manual': return '사람이 실행';
    case 'imported': return '외부에서 저장';
    default: return '실행 경로 미상';
  }
}
