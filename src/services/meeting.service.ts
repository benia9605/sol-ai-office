/**
 * @file src/services/meeting.service.ts
 * @description 회의실 멀티 AI 토론 서비스
 * - 회의 참가자 설정 (플래니→마키→데비→서치)
 * - 각 AI별 회의 프롬프트 빌드
 * - 모디 시작 멘트 / 정리 프롬프트
 */
import { buildSystemPrompt } from './context';

/** 회의 참가자 정보 */
export interface MeetingParticipant {
  roomId: string;
  name: string;
  emoji: string;
  image: string;
  focus: string;
}

/** 회의 참가자 순서 (모디 제외, 순차 발언용) */
export const MEETING_PARTICIPANTS: MeetingParticipant[] = [
  { roomId: 'strategy',  name: '플래니', emoji: '💜', image: '/images/plani.png',   focus: '전략적 방향성, 우선순위, 리스크' },
  { roomId: 'marketing', name: '마키',   emoji: '💗', image: '/images/maki.png',    focus: '마케팅 관점, 콘텐츠 아이디어, 타겟 분석' },
  { roomId: 'dev',       name: '데비',   emoji: '🤎', image: '/images/devi.png',    focus: '기술적 실현 가능성, 일정, 의존성' },
  { roomId: 'research',  name: '서치',   emoji: '💚', image: '/images/searchi.png',  focus: '시장 데이터, 경쟁사 사례, 팩트 체크' },
];

/** 모디 정보 */
export const MODI_INFO = {
  roomId: 'meeting',
  name: '모디',
  emoji: '💛',
  image: '/images/modi.png',
};

/** 이전 발언 내용을 포맷 */
function formatPreviousResponses(responses: { name: string; content: string }[]): string {
  if (responses.length === 0) return '';
  return responses.map(r => `[${r.name}]\n${r.content}`).join('\n\n');
}

/** 모디 시작 멘트 프롬프트 */
export async function buildModiOpeningPrompt(topic: string): Promise<string> {
  const baseContext = await buildSystemPrompt('meeting');

  return `${baseContext}

---

## 지금 역할: 회의 시작

Sol님이 회의 주제를 던졌습니다. 당신은 회의 진행자 모디입니다.

**주제:** ${topic}

아래 형식으로 1-2문장 짧게 시작 멘트를 해주세요:
- 인사말 없이 바로 주제 정리
- "각 팀원에게 의견을 물어볼게요!" 식으로 마무리
- 3문장 이내로 짧게

예시: "운명랩 와디즈 가격 전략에 대해 회의를 시작할게요! 플래니부터 순서대로 의견 들어볼게요 💛"`;
}

/** 회의 참가자별 프롬프트 */
export async function buildParticipantPrompt(
  participant: MeetingParticipant,
  topic: string,
  previousResponses: { name: string; content: string }[],
): Promise<string> {
  const baseContext = await buildSystemPrompt(participant.roomId);
  const prevText = formatPreviousResponses(previousResponses);

  return `${baseContext}

---

## 지금 역할: 회의 참가자

지금 Sol님의 AI 오피스 회의실에서 토론 중입니다.
당신은 **${participant.name}** (${participant.focus}) 입니다.

**회의 주제:** ${topic}

${prevText ? `**이전 발언:**\n${prevText}\n` : ''}

아래 가이드에 따라 의견을 주세요:
- 인사말/자기소개 없이 바로 본론부터
- **당신의 전문 영역(${participant.focus})** 관점에서만 답변
- 이전 AI들의 발언에 동의/반박/보완하며 대화를 이어가기
- 핵심만 간결하게 (3-5개 포인트)
- 구체적인 숫자, 기간, 방법을 포함
- 마크다운 형식 사용`;
}

/** 모디 정리 프롬프트 */
export async function buildModiClosingPrompt(
  topic: string,
  allResponses: { name: string; content: string }[],
): Promise<string> {
  const baseContext = await buildSystemPrompt('meeting');
  const allText = formatPreviousResponses(allResponses);

  return `${baseContext}

---

## 지금 역할: 회의 정리

Sol님의 AI 오피스 회의실에서 토론이 끝났습니다.
당신은 진행자 모디입니다. 전체 의견을 종합해서 정리해주세요.

**회의 주제:** ${topic}

**전체 발언:**
${allText}

아래 형식으로 정리해주세요:

## 💛 회의 정리

### 핵심 결정사항
- (전체 의견에서 합의된 방향 2-3개)

### 액션 아이템
- [ ] 담당: (AI이름) — (구체적 할일) — 기한: (제안 기한)
- [ ] 담당: (AI이름) — (구체적 할일) — 기한: (제안 기한)

### 추가 논의 필요
- (의견이 갈린 부분이나 더 검토할 사항)

### 한줄 요약
(이번 회의의 핵심을 한 문장으로)`;
}

/** 모디 라우터 프롬프트 (후속 질문 시 어떤 AI가 답할지 판단) */
export async function buildModiRouterPrompt(
  followUp: string,
  conversationHistory: string,
): Promise<string> {
  const baseContext = await buildSystemPrompt('meeting');

  return `${baseContext}

---

## 지금 역할: 후속 질문 라우팅

Sol님이 회의 중 후속 질문을 했습니다.
이전 대화 내용을 보고, 어떤 팀원이 답변하면 좋을지 판단해주세요.

**이전 대화:**
${conversationHistory}

**Sol님의 후속 질문:** ${followUp}

아래 규칙을 지켜주세요:
- 인사말 없이 1문장으로 자연스럽게 라우팅
- 반드시 답변할 팀원 이름을 포함 (플래니, 마키, 데비, 서치 중 1-4명)
- 예시: "이 부분은 마키에게 물어볼게요!" / "플래니와 데비가 답변하면 좋겠어요!"
- 라우팅 멘트만 짧게, 직접 답변하지 말 것`;
}

/** 후속 질문에 답변하는 참가자 프롬프트 */
export async function buildFollowUpParticipantPrompt(
  participant: MeetingParticipant,
  followUp: string,
  conversationHistory: string,
): Promise<string> {
  const baseContext = await buildSystemPrompt(participant.roomId);

  return `${baseContext}

---

## 지금 역할: 회의 후속 답변

Sol님의 AI 오피스 회의실에서 후속 질문에 답변합니다.
당신은 **${participant.name}** (${participant.focus}) 입니다.

**이전 대화:**
${conversationHistory}

**Sol님의 후속 질문:** ${followUp}

가이드:
- 인사말/자기소개 없이 바로 답변
- 이전 대화 맥락을 반영하여 답변
- 간결하게 핵심만 (2-3개 포인트)
- 마크다운 형식 사용`;
}

/** 모디 응답에서 라우팅된 AI 이름 파싱 */
export function parseRoutedParticipants(modiResponse: string): MeetingParticipant[] {
  const routed = MEETING_PARTICIPANTS.filter(p => modiResponse.includes(p.name));
  // 아무 이름도 없으면 전원 반환 (안전장치)
  return routed.length > 0 ? routed : MEETING_PARTICIPANTS;
}
