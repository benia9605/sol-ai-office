/**
 * @file src/services/chatApi.ts
 * @description AI 채팅 API 클라이언트
 * - roomId별 모델/API 자동 분기
 * - 플래니(Claude Sonnet 4), 데비(Claude Opus 4), 모디(Claude Sonnet 4)
 * - 마키(GPT-4o), 서치(Sonar Pro)
 */

// AI 키는 서버(server.js)가 주입한다. 브라우저는 로그인 토큰(x-sb-auth)과
// 어느 워크스페이스로 요청하는지(x-ws-id)만 보낸다.
// ★ x-ws-id 는 권한이 아니라 "요청 범위"다. 서버가 그 워크스페이스의 멤버십(RLS)과
//   ai_provider_enabled 정책을 확인한 뒤에만 provider 를 호출한다(D-007 · 계약 0.2.0 §9).
import { sbAccessToken } from './supabase';

/** provider 요청 공통 헤더 */
async function providerHeaders(workspaceId?: string): Promise<Record<string, string>> {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-sb-auth': await sbAccessToken(),
  };
  if (workspaceId) h['x-ws-id'] = workspaceId;
  return h;
}

/** 서버가 D-007 정책으로 막았을 때 사용자에게 보여줄 메시지를 꺼낸다 */
function providerErrorMessage(body: unknown, status: number, fallback: string): string {
  const e = (body as { error?: { code?: string; message?: string } } | null)?.error;
  if (e?.code === 'provider_disabled') return e.message || 'AI 모델 실행이 꺼진 워크스페이스예요.';
  if (e?.message) return e.message;
  return `${fallback} (${status})`;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ModelConfig {
  provider: 'anthropic' | 'openai' | 'perplexity';
  model: string;
}

/** roomId → 모델 설정 */
const MODEL_MAP: Record<string, ModelConfig> = {
  strategy:  { provider: 'anthropic',  model: 'claude-sonnet-4-6' },   // 플래니
  dev:       { provider: 'anthropic',  model: 'claude-opus-4-8' },     // 데비
  meeting:   { provider: 'anthropic',  model: 'claude-sonnet-4-6' },   // 모디 (회의실)
  secretary: { provider: 'anthropic',  model: 'claude-sonnet-4-6' },   // 모디 (비서)
  marketing: { provider: 'openai',     model: 'gpt-4o' },                     // 마키
  research:  { provider: 'perplexity', model: 'sonar-pro' },                  // 서치
};

const DEFAULT_CONFIG: ModelConfig = { provider: 'anthropic', model: 'claude-sonnet-4-6' };

/** LLM 응답 + 토큰 사용량 (코인 차감용) */
export interface LLMUsage { inputTokens: number; outputTokens: number }
export interface LLMResult { text: string; usage: LLMUsage }

/** 모델별 단가 (USD per 1M tokens) — 코인 환산 기준 */
const MODEL_COST: Record<string, { in: number; out: number }> = {
  'claude-sonnet-4-6': { in: 3, out: 15 },
  'claude-haiku-4-5-20251001': { in: 1, out: 5 },
  'claude-opus-4-8': { in: 15, out: 75 },
  'gpt-4o': { in: 2.5, out: 10 },
  'sonar-pro': { in: 3, out: 15 },
};
/** 토큰 사용량 → 코인 (1코인 = $0.001, 최소 1코인) */
export function calcCoins(model: string, usage: LLMUsage): number {
  const c = MODEL_COST[model] || MODEL_COST['claude-sonnet-4-6'];
  const usd = (usage.inputTokens / 1e6) * c.in + (usage.outputTokens / 1e6) * c.out;
  return Math.max(1, Math.ceil(usd * 1000));
}

/** Anthropic Claude API */
async function callAnthropic(
  config: ModelConfig, systemPrompt: string, messages: ChatMessage[], maxTokens: number,
  signal?: AbortSignal, workspaceId?: string,
): Promise<LLMResult> {
  const res = await fetch('/api/claude/v1/messages', {
    method: 'POST',
    headers: {
      ...(await providerHeaders(workspaceId)),
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages,
    }),
    signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(providerErrorMessage(err, res.status, 'Anthropic API 실패'));
  }

  const data = await res.json();
  const text = data.content?.[0]?.type === 'text' ? data.content[0].text : '';
  return { text, usage: { inputTokens: data.usage?.input_tokens || 0, outputTokens: data.usage?.output_tokens || 0 } };
}

/** OpenAI GPT API */
async function callOpenAI(
  config: ModelConfig, systemPrompt: string, messages: ChatMessage[], maxTokens: number,
  signal?: AbortSignal, workspaceId?: string,
): Promise<LLMResult> {
  const res = await fetch('/api/openai/v1/chat/completions', {
    method: 'POST',
    headers: await providerHeaders(workspaceId),
    body: JSON.stringify({
      model: config.model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    }),
    signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(providerErrorMessage(err, res.status, 'OpenAI API 실패'));
  }

  const data = await res.json();
  return { text: data.choices?.[0]?.message?.content || '', usage: { inputTokens: data.usage?.prompt_tokens || 0, outputTokens: data.usage?.completion_tokens || 0 } };
}

/** Perplexity Sonar API */
async function callPerplexity(
  config: ModelConfig, systemPrompt: string, messages: ChatMessage[], maxTokens: number,
  signal?: AbortSignal, workspaceId?: string,
): Promise<LLMResult> {
  const res = await fetch('/api/perplexity/chat/completions', {
    method: 'POST',
    headers: await providerHeaders(workspaceId),
    body: JSON.stringify({
      model: config.model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    }),
    signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(providerErrorMessage(err, res.status, 'Perplexity API 실패'));
  }

  const data = await res.json();
  let content = data.choices?.[0]?.message?.content || '';
  const citations: string[] = data.citations || [];

  if (citations.length > 0) {
    // [1][2] 같은 인라인 출처 마커 제거
    content = content.replace(/\[(\d+)\]/g, '');
    // 연속 공백 정리
    content = content.replace(/ {2,}/g, ' ').trim();
    // 하단에 출처 링크 추가
    content += '\n\n---\n📎 **출처**\n';
    citations.forEach((url: string) => {
      try {
        const domain = new URL(url).hostname.replace('www.', '');
        content += `- [${domain}](${url})\n`;
      } catch {
        content += `- ${url}\n`;
      }
    });
  }

  return { text: content, usage: { inputTokens: data.usage?.prompt_tokens || 0, outputTokens: data.usage?.completion_tokens || 0 } };
}

/**
 * AI 채팅 메시지 전송 (roomId에 따라 자동으로 모델/API 분기)
 */
export async function sendChatMessage(
  systemPrompt: string,
  messages: ChatMessage[],
  roomId: string,
  maxTokens = 2048,
  signal?: AbortSignal,
  workspaceId?: string,
): Promise<string> {
  const config = MODEL_MAP[roomId] || DEFAULT_CONFIG;

  switch (config.provider) {
    case 'openai':
      return (await callOpenAI(config, systemPrompt, messages, maxTokens, signal, workspaceId)).text;
    case 'perplexity':
      return (await callPerplexity(config, systemPrompt, messages, maxTokens, signal, workspaceId)).text;
    default:
      return (await callAnthropic(config, systemPrompt, messages, maxTokens, signal, workspaceId)).text;
  }
}

/**
 * 모델을 직접 지정해서 호출 (AI 직원 실행 엔진용) — 토큰 usage 포함 반환.
 * ★ workspaceId 필수: 직원 실행은 항상 특정 워크스페이스의 일이고, 서버가 그 워크스페이스의
 *   D-007 정책을 검사해야 한다. 빠뜨리면 정책을 우회하게 되므로 타입으로 강제한다.
 */
export async function sendWithModel(
  config: { provider: 'anthropic' | 'openai' | 'perplexity'; model: string },
  systemPrompt: string,
  messages: ChatMessage[],
  workspaceId: string,
  maxTokens = 1500,
  signal?: AbortSignal,
): Promise<LLMResult> {
  switch (config.provider) {
    case 'openai':
      return callOpenAI(config, systemPrompt, messages, maxTokens, signal, workspaceId);
    case 'perplexity':
      return callPerplexity(config, systemPrompt, messages, maxTokens, signal, workspaceId);
    default:
      return callAnthropic(config, systemPrompt, messages, maxTokens, signal, workspaceId);
  }
}
