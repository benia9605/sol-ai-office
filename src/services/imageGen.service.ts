/**
 * @file src/services/imageGen.service.ts
 * @description 이미지 생성 — 비주얼 디렉터 프롬프트 → 실제 이미지 (OpenAI gpt-image-1)
 * - /api/openai 프록시 경유(CORS 회피). 응답 b64_json → data URL.
 * - 비용: gpt-image-1 약 $0.04/장(1024) → 코인 40 (1코인=$0.001 기준 근사)
 */
// AI 키는 서버(server.js)가 주입. 브라우저는 로그인 토큰(x-sb-auth)만 보낸다.
import { sbAccessToken } from './supabase';

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

/**
 * 프롬프트로 이미지 1장 생성. data URL + 소모 코인 반환.
 * ★ workspaceId 필수 — 서버가 D-007 정책(ai_provider_enabled)을 검사한다.
 */
export async function generateImage(prompt: string, workspaceId: string, size = '1024x1024'): Promise<{ url: string; coins: number }> {
  const res = await fetch('/api/openai/v1/images/generations', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-sb-auth': await sbAccessToken(),
      'x-ws-id': workspaceId,
    },
    body: JSON.stringify({ model: 'gpt-image-1', prompt, size, n: 1 }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const e = (err as { error?: { code?: string; message?: string } })?.error;
    throw new Error(e?.message || `이미지 생성 실패 (${res.status})`);
  }
  const j = await res.json();
  const b64 = j.data?.[0]?.b64_json;
  const url = b64 ? `data:image/png;base64,${b64}` : (j.data?.[0]?.url || '');
  return { url, coins: 40 };
}
