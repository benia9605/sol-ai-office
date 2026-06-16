/**
 * @file src/services/imageGen.service.ts
 * @description 이미지 생성 — 비주얼 디렉터 프롬프트 → 실제 이미지 (OpenAI gpt-image-1)
 * - /api/openai 프록시 경유(CORS 회피). 응답 b64_json → data URL.
 * - 비용: gpt-image-1 약 $0.04/장(1024) → 코인 40 (1코인=$0.001 기준 근사)
 */
const OPENAI_KEY = import.meta.env.VITE_OPENAI_API_KEY;

/** 비율 → gpt-image-1 size */
export function ratioToSize(ratio?: string): string {
  switch (ratio) {
    case '16:9': return '1536x1024';
    case '1:1': return '1024x1024';
    case '9:16':
    case '4:5':
    default: return '1024x1536';
  }
}

/** 프롬프트로 이미지 1장 생성. data URL + 소모 코인 반환 */
export async function generateImage(prompt: string, size = '1024x1024'): Promise<{ url: string; coins: number }> {
  const res = await fetch('/api/openai/v1/images/generations', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'authorization': `Bearer ${OPENAI_KEY}` },
    body: JSON.stringify({ model: 'gpt-image-1', prompt, size, n: 1 }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `이미지 생성 실패 (${res.status})`);
  }
  const j = await res.json();
  const b64 = j.data?.[0]?.b64_json;
  const url = b64 ? `data:image/png;base64,${b64}` : (j.data?.[0]?.url || '');
  return { url, coins: 40 };
}
