/**
 * @file supabase/functions/_shared/push.ts
 * @description Web Push 전송 모듈
 * - VAPID JWT 생성 (ES256) + aes128gcm 암호화 + 전송
 * - 알림 설정 확인, 중복 방지 로그
 * - Firebase 없이 Web Push Protocol (RFC 8030) 직접 사용
 */

// ── Base64 유틸리티 ──

function base64urlEncode(data: Uint8Array): string {
  let binary = '';
  for (const byte of data) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(str: string): Uint8Array {
  const padding = '='.repeat((4 - (str.length % 4)) % 4);
  const base64 = (str + padding).replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// ── VAPID JWT 생성 (ES256) ──

async function createVapidJwt(
  audience: string,
  subject: string,
  publicKeyBase64: string,
  privateKeyBase64: string,
): Promise<string> {
  const header = { typ: 'JWT', alg: 'ES256' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 3600,
    sub: subject,
  };

  const encHeader = base64urlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const encPayload = base64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${encHeader}.${encPayload}`;

  // 공개키(uncompressed point, 65 bytes)에서 x, y 추출
  const pubKeyBytes = base64urlDecode(publicKeyBase64);
  // uncompressed point: 0x04 || x(32) || y(32)
  const x = base64urlEncode(pubKeyBytes.slice(1, 33));
  const y = base64urlEncode(pubKeyBytes.slice(33, 65));
  const d = privateKeyBase64;

  const key = await crypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', x, y, d },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );

  const sigBuf = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(unsignedToken),
  );

  // Web Crypto는 P-256 ECDSA에서 r || s (각 32바이트, 총 64바이트) raw format을 반환
  const sigBytes = new Uint8Array(sigBuf);
  return `${unsignedToken}.${base64urlEncode(sigBytes)}`;
}

// ── Payload 암호화 (aes128gcm, RFC 8188) ──

async function encryptPayload(
  payloadStr: string,
  p256dhBase64: string,
  authBase64: string,
): Promise<Uint8Array> {
  const clientPublicKey = base64urlDecode(p256dhBase64);
  const clientAuth = base64urlDecode(authBase64);

  // 1. 서버 ECDH 키페어 생성
  const localKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits'],
  );

  // 2. Shared Secret 유도
  const clientKey = await crypto.subtle.importKey(
    'raw',
    clientPublicKey,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );

  const sharedSecret = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: clientKey },
    localKeyPair.privateKey,
    256,
  );

  // 3. 서버 공개키 내보내기 (uncompressed)
  const localPublicKey = new Uint8Array(
    await crypto.subtle.exportKey('raw', localKeyPair.publicKey),
  );

  // 4. Salt 생성
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // 5. IKM 유도 (HKDF)
  const authInfo = new Uint8Array([
    ...new TextEncoder().encode('WebPush: info\0'),
    ...clientPublicKey,
    ...localPublicKey,
  ]);

  const sharedHkdfKey = await crypto.subtle.importKey(
    'raw', new Uint8Array(sharedSecret), { name: 'HKDF' }, false, ['deriveBits'],
  );

  const prk = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'HKDF', hash: 'SHA-256', salt: clientAuth, info: authInfo },
      sharedHkdfKey,
      256,
    ),
  );

  // 6. CEK + Nonce 유도
  const prkKey = await crypto.subtle.importKey('raw', prk, { name: 'HKDF' }, false, ['deriveBits']);

  const cekInfo = new TextEncoder().encode('Content-Encoding: aes128gcm\0');
  const nonceInfo = new TextEncoder().encode('Content-Encoding: nonce\0');

  const cekBits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: cekInfo },
    prkKey, 128,
  );

  const nonceBits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: nonceInfo },
    prkKey, 96,
  );

  // 7. AES-128-GCM 암호화
  const cek = await crypto.subtle.importKey(
    'raw', cekBits, { name: 'AES-GCM' }, false, ['encrypt'],
  );

  const padded = new Uint8Array([...new TextEncoder().encode(payloadStr), 2]);

  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: new Uint8Array(nonceBits) },
      cek,
      padded,
    ),
  );

  // 8. aes128gcm 헤더: salt(16) || rs(4) || idlen(1) || keyid(65)
  const rs = 4096;
  const header = new Uint8Array(16 + 4 + 1 + localPublicKey.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, rs, false);
  header[20] = localPublicKey.length;
  header.set(localPublicKey, 21);

  // 최종 body = header || encrypted
  const body = new Uint8Array(header.length + encrypted.length);
  body.set(header, 0);
  body.set(encrypted, header.length);

  return body;
}

// ── 푸시 전송 ──

interface Subscription {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

interface PushPayload {
  title: string;
  body: string;
  tag?: string;
  url?: string;
}

async function sendPush(
  subscription: Subscription,
  payload: PushPayload,
): Promise<{ success: boolean; status?: number; gone?: boolean }> {
  try {
    const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY')!;
    const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')!;
    const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT')!;

    const audience = new URL(subscription.endpoint).origin;
    const jwt = await createVapidJwt(audience, VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
    const encrypted = await encryptPayload(
      JSON.stringify(payload),
      subscription.p256dh,
      subscription.auth,
    );

    const res = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        'Authorization': `vapid t=${jwt}, k=${VAPID_PUBLIC}`,
        'TTL': '86400',
        'Urgency': 'normal',
      },
      body: encrypted,
    });

    if (res.status === 410 || res.status === 404) {
      return { success: false, status: res.status, gone: true };
    }

    return { success: res.status >= 200 && res.status < 300, status: res.status };
  } catch (e) {
    console.error('[Push] sendPush error:', e);
    return { success: false };
  }
}

// ── 유저의 모든 기기에 전송 ──

export async function sendPushToUser(
  supabaseClient: any,
  userId: string,
  payload: PushPayload,
): Promise<number> {
  const { data: subs } = await supabaseClient
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId);

  if (!subs?.length) return 0;

  const results = await Promise.allSettled(
    subs.map((sub: Subscription) => sendPush(sub, payload)),
  );

  // 만료된 구독 정리
  const goneIds: string[] = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value.gone) {
      goneIds.push(subs[i].id);
    }
  });

  if (goneIds.length) {
    await supabaseClient.from('push_subscriptions').delete().in('id', goneIds);
  }

  return results.filter(r => r.status === 'fulfilled' && r.value.success).length;
}

// ── 여러 유저에게 전송 ──

export async function sendPushToUsers(
  supabaseClient: any,
  userIds: string[],
  payload: PushPayload,
): Promise<void> {
  if (!userIds.length) return;
  await Promise.allSettled(
    userIds.map((id) => sendPushToUser(supabaseClient, id, payload)),
  );
}

// ── 워크스페이스 멤버 전원에게 전송 (공유 항목/AI 리포트용) ──
// 빌드 B: 공유 워크스페이스의 알림은 멤버 전원에게. actor(행위자) 본인은 제외.
export async function sendPushToWorkspace(
  supabaseClient: any,
  workspaceId: string,
  payload: PushPayload,
  excludeUserId?: string,
): Promise<void> {
  const { data: members } = await supabaseClient
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', workspaceId);

  if (!members?.length) return;

  const userIds = [...new Set(members.map((m: any) => m.user_id))]
    .filter((id) => id !== excludeUserId) as string[];

  await sendPushToUsers(supabaseClient, userIds, payload);
}

// ── 알림 설정 확인 ──

export async function checkPreference(
  supabaseClient: any,
  userId: string,
  prefKey: string,
): Promise<boolean> {
  const { data } = await supabaseClient
    .from('notification_preferences')
    .select(prefKey)
    .eq('user_id', userId)
    .maybeSingle();

  if (!data) return true; // 설정 없으면 기본값 true
  return data[prefKey] !== false;
}

// ── 중복 방지 로그 ──

export async function isAlreadySent(
  supabaseClient: any,
  userId: string,
  type: string,
  refKey: string,
): Promise<boolean> {
  const { data } = await supabaseClient
    .from('notification_log')
    .select('id')
    .eq('user_id', userId)
    .eq('type', type)
    .eq('ref_key', refKey)
    .maybeSingle();

  return !!data;
}

export async function logNotification(
  supabaseClient: any,
  userId: string,
  type: string,
  refKey: string,
): Promise<void> {
  await supabaseClient.from('notification_log').insert({
    user_id: userId,
    type,
    ref_key: refKey,
  });
}

// ── 구독이 있는 유저 ID 목록 조회 ──

export async function getSubscribedUserIds(supabaseClient: any): Promise<string[]> {
  const { data } = await supabaseClient
    .from('push_subscriptions')
    .select('user_id');

  if (!data?.length) return [];
  return [...new Set(data.map((d: any) => d.user_id))];
}
