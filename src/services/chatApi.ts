/**
 * @file src/services/chatApi.ts
 * @description AI 채팅 API 클라이언트
 * - roomId별 모델/API 자동 분기
 * - 플래니(Claude Sonnet 4), 데비(Claude Opus 4), 모디(Claude Sonnet 4)
 * - 마키(GPT-4o), 서치(Sonar Pro)
 */

const ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;
const OPENAI_KEY = import.meta.env.VITE_OPENAI_API_KEY;
const PERPLEXITY_KEY = import.meta.env.VITE_PERPLEXITY_API_KEY;

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
  strategy:  { provider: 'anthropic',  model: 'claude-sonnet-4-20250514' },   // 플래니
  dev:       { provider: 'anthropic',  model: 'claude-opus-4-20250514' },     // 데비
  meeting:   { provider: 'anthropic',  model: 'claude-sonnet-4-20250514' },   // 모디 (회의실)
  secretary: { provider: 'anthropic',  model: 'claude-sonnet-4-20250514' },   // 모디 (비서)
  marketing: { provider: 'openai',     model: 'gpt-4o' },                     // 마키
  research:  { provider: 'perplexity', model: 'sonar-pro' },                  // 서치
};

const DEFAULT_CONFIG: ModelConfig = { provider: 'anthropic', model: 'claude-sonnet-4-20250514' };

/** Anthropic Claude API */
async function callAnthropic(
  config: ModelConfig, systemPrompt: string, messages: ChatMessage[], maxTokens: number,
): Promise<string> {
  const res = await fetch('/api/claude/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Anthropic API 실패 (${res.status})`);
  }

  const data = await res.json();
  return data.content?.[0]?.type === 'text' ? data.content[0].text : '';
}

/** OpenAI GPT API */
async function callOpenAI(
  config: ModelConfig, systemPrompt: string, messages: ChatMessage[], maxTokens: number,
): Promise<string> {
  const res = await fetch('/api/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `OpenAI API 실패 (${res.status})`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

/** Perplexity Sonar API */
async function callPerplexity(
  config: ModelConfig, systemPrompt: string, messages: ChatMessage[], maxTokens: number,
): Promise<string> {
  const res = await fetch('/api/perplexity/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${PERPLEXITY_KEY}`,
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Perplexity API 실패 (${res.status})`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

/**
 * AI 채팅 메시지 전송 (roomId에 따라 자동으로 모델/API 분기)
 */
export async function sendChatMessage(
  systemPrompt: string,
  messages: ChatMessage[],
  roomId: string,
  maxTokens = 2048,
): Promise<string> {
  const config = MODEL_MAP[roomId] || DEFAULT_CONFIG;

  switch (config.provider) {
    case 'openai':
      return callOpenAI(config, systemPrompt, messages, maxTokens);
    case 'perplexity':
      return callPerplexity(config, systemPrompt, messages, maxTokens);
    default:
      return callAnthropic(config, systemPrompt, messages, maxTokens);
  }
}
