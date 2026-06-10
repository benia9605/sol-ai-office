/**
 * @file src/services/youtubeOAuth.ts
 * @description YouTube 쓰기 권한 OAuth (Google Identity Services 토큰 모델)
 * - 답글 발행(comments.insert)은 youtube.force-ssl 스코프 필요 → API 키론 불가
 * - 클라이언트 사이드 토큰 흐름: 발행 시 구글 동의 팝업 → access token 획득(약 1시간)
 *
 * 필요 환경변수: VITE_GOOGLE_CLIENT_ID
 *   (Google Cloud → OAuth 클라이언트 ID(웹) → 승인된 JS 원본에 앱 도메인 등록)
 */

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const SCOPE = 'https://www.googleapis.com/auth/youtube.force-ssl';
const GIS_SRC = 'https://accounts.google.com/gsi/client';

let accessToken: string | null = null;
let tokenExpiry = 0;
let gisLoaded: Promise<void> | null = null;

export function hasYoutubeOAuth(): boolean {
  return !!CLIENT_ID;
}

/** GIS 스크립트 1회 로드 */
function loadGis(): Promise<void> {
  if (gisLoaded) return gisLoaded;
  gisLoaded = new Promise((resolve, reject) => {
    if ((window as any).google?.accounts?.oauth2) { resolve(); return; }
    const s = document.createElement('script');
    s.src = GIS_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Google 로그인 스크립트 로드 실패'));
    document.head.appendChild(s);
  });
  return gisLoaded;
}

/**
 * access token 획득 (없거나 만료 임박 시 동의 팝업)
 * - 첫 호출/만료 시 팝업, 캐시된 토큰이 유효하면 즉시 반환
 */
export async function getYoutubeAccessToken(): Promise<string> {
  if (!CLIENT_ID) {
    throw new Error('VITE_GOOGLE_CLIENT_ID가 설정되지 않았어요 (발행하려면 OAuth 클라이언트 ID 필요)');
  }
  if (accessToken && Date.now() < tokenExpiry - 60_000) return accessToken;

  await loadGis();
  const google = (window as any).google;

  return new Promise<string>((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (resp: any) => {
        if (resp.error) {
          reject(new Error(resp.error_description || resp.error || 'Google 인증 실패'));
          return;
        }
        accessToken = resp.access_token;
        tokenExpiry = Date.now() + (Number(resp.expires_in) || 3600) * 1000;
        resolve(accessToken!);
      },
    });
    // 캐시 토큰 없으면 동의, 있으면 조용히 갱신
    client.requestAccessToken({ prompt: accessToken ? '' : 'consent' });
  });
}

/** 연동 해제 (토큰 폐기) */
export function clearYoutubeToken(): void {
  accessToken = null;
  tokenExpiry = 0;
}
