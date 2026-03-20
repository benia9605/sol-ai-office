# Web Push 알림 구현 가이드

> React + Supabase 기반 PWA에서 **Firebase 없이** 브라우저 네이티브 Web Push API로 푸시 알림을 구현하는 가이드.
> VAPID 서명, aes128gcm 암호화 모두 자체 구현 (외부 라이브러리 불필요).

---

## 목차
1. [아키텍처 개요](#1-아키텍처-개요)
2. [VAPID 키 생성](#2-vapid-키-생성)
3. [DB 스키마 (Supabase)](#3-db-스키마-supabase)
4. [Service Worker](#4-service-worker)
5. [클라이언트: 구독/해지 로직](#5-클라이언트-구독해지-로직)
6. [클라이언트: 설정 UI](#6-클라이언트-설정-ui)
7. [서버: 푸시 전송 모듈](#7-서버-푸시-전송-모듈-supabase-edge-function)
8. [서버: 알림 트리거 예시](#8-서버-알림-트리거-예시)
9. [Supabase 설정 (Webhook, Cron)](#9-supabase-설정-webhook-cron)
10. [PWA 매니페스트](#10-pwa-매니페스트)
11. [iOS Safari 주의사항](#11-ios-safari-주의사항)
12. [디버깅 & 테스트](#12-디버깅--테스트)
13. [체크리스트](#13-체크리스트)

---

## 1. 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────┐
│  클라이언트 (React PWA)                                      │
│                                                              │
│  Settings UI ──→ subscribePush() ──→ PushManager.subscribe() │
│       │                                     │                │
│       │              ┌──────────────────────┘                │
│       ↓              ↓                                       │
│  notification_    push_subscriptions                         │
│  preferences      (endpoint, p256dh, auth)                   │
│       │              │                                       │
│  ════╪══════════════╪════════════════════════════════════    │
│       ↓              ↓                                       │
│  Supabase DB     Supabase DB                                │
│                                                              │
│  ════════════════════════════════════════════════════════    │
│                                                              │
│  Supabase Edge Functions (서버)                              │
│                                                              │
│  트리거 (Webhook/Cron)                                       │
│       │                                                      │
│       ↓                                                      │
│  sendPushToUsers()                                           │
│       │                                                      │
│       ├─ VAPID JWT 생성 (ES256)                              │
│       ├─ Payload 암호화 (aes128gcm)                          │
│       └─ fetch(endpoint) → Push Service → 브라우저 → SW      │
│                                                              │
│  ════════════════════════════════════════════════════════    │
│                                                              │
│  Service Worker (sw.js)                                      │
│       │                                                      │
│       ├─ push 이벤트 → showNotification()                    │
│       └─ notificationclick → 앱 열기/포커스                   │
└─────────────────────────────────────────────────────────────┘
```

**핵심 포인트:**
- Firebase/FCM 없이 **Web Push Protocol (RFC 8030)** 직접 사용
- VAPID 인증 (RFC 8292) + aes128gcm 암호화 (RFC 8188) 자체 구현
- Supabase Edge Function (Deno) + Web Crypto API만 사용

---

## 2. VAPID 키 생성

터미널에서 한 번만 실행:

```bash
# Node.js로 VAPID 키페어 생성
node -e "
const crypto = require('crypto');
const ecdh = crypto.createECDH('prime256v1');
ecdh.generateKeys();
const pub = ecdh.getPublicKey().toString('base64url');
const priv = ecdh.getPrivateKey().toString('base64url');
console.log('VAPID_PUBLIC_KEY=' + pub);
console.log('VAPID_PRIVATE_KEY=' + priv);
"
```

또는 `web-push` 라이브러리 사용:

```bash
npx web-push generate-vapid-keys
```

생성된 키를 환경변수에 설정:

```bash
# 클라이언트 (.env)
VITE_VAPID_PUBLIC_KEY=BOt4aA8o68by...  # 공개키

# Supabase Edge Functions (supabase secrets set)
supabase secrets set VAPID_PUBLIC_KEY=BOt4aA8o68by...
supabase secrets set VAPID_PRIVATE_KEY=개인키_여기에
supabase secrets set VAPID_SUBJECT=mailto:your@email.com
```

> **주의:** VAPID_PRIVATE_KEY는 절대 클라이언트에 노출하지 말 것.

---

## 3. DB 스키마 (Supabase)

```sql
-- =============================================
-- 1. 푸시 구독 정보 (기기별 저장)
-- =============================================
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, endpoint)  -- 같은 유저+같은 기기 → 덮어쓰기
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_subscriptions_own" ON push_subscriptions
  FOR ALL USING (user_id = auth.uid());

-- =============================================
-- 2. 알림 설정 (유저별)
-- =============================================
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  daily_reminder BOOLEAN DEFAULT true,
  -- ↑ 앱에 맞게 필드 추가/수정
  -- member_activity BOOLEAN DEFAULT true,
  -- budget_alert BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notification_preferences_own" ON notification_preferences
  FOR ALL USING (user_id = auth.uid());

-- =============================================
-- 3. 알림 발송 로그 (중복 방지)
-- =============================================
CREATE TABLE notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,       -- 'daily_reminder' 등
  ref_key TEXT NOT NULL,    -- '2025-01-15' 등 (중복 체크 키)
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, type, ref_key)
);

ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notification_log_select_own" ON notification_log
  FOR SELECT USING (user_id = auth.uid());

-- Edge Function은 service_role 키로 INSERT하므로 별도 INSERT 정책 불필요
-- (필요시 추가)

-- =============================================
-- 4. 유저 프로필에 마지막 접속 시간 추가
-- =============================================
-- (일일 리마인더 등에서 미접속 유저 필터링용)
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS last_access_at TIMESTAMPTZ;
```

---

## 4. Service Worker

**파일:** `public/sw.js`

```js
// ============================================
// Service Worker - 푸시 알림 + PWA 캐싱
// ============================================

const CACHE_NAME = 'app-v1';

// --- 설치 ---
self.addEventListener('install', () => {
  self.skipWaiting();
});

// --- 활성화 (이전 캐시 정리) ---
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// --- Fetch 캐싱 (선택사항, 순수 알림만 원하면 제거 가능) ---
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('/api/')) return;

  event.respondWith(
    caches.match(event.request).then(
      (cached) => cached || fetch(event.request).then((res) => {
        if (res.ok && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
        }
        return res;
      })
    ).catch(() => caches.match('/'))
  );
});

// ============================================
// 푸시 알림 수신
// ============================================
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || '앱이름', {
      body: data.body || '',
      icon: '/icon-192.png',     // 앱 아이콘
      badge: '/favicon-32.png',  // 작은 뱃지 아이콘
      tag: data.tag || 'default',
      data: { url: data.url || '/' },
    })
  );
});

// ============================================
// 알림 클릭 → 앱 열기/포커스
// ============================================
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      // 이미 열린 앱 창이 있으면 포커스
      for (const client of list) {
        if (new URL(client.url).origin === self.location.origin) {
          client.navigate(url);
          return client.focus();
        }
      }
      // 없으면 새 창 열기
      return clients.openWindow(url);
    })
  );
});
```

**SW 등록** (`main.tsx` 또는 `index.tsx`):

```tsx
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
```

---

## 5. 클라이언트: 구독/해지 로직

**파일:** `src/lib/pushNotification.ts`

```ts
import { supabase } from './supabase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

// ============================================
// 유틸리티
// ============================================

/** base64url → Uint8Array (applicationServerKey 변환용) */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) arr[i] = raw.charCodeAt(i);
  return arr;
}

// ============================================
// 브라우저 지원 확인
// ============================================

export function isPushSupported(): boolean {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function getPermissionState(): 'granted' | 'denied' | 'default' | 'unsupported' {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission as 'granted' | 'denied' | 'default';
}

// ============================================
// 구독 (Subscribe)
// ============================================

export async function subscribePush(userId: string): Promise<boolean> {
  try {
    // 1. 권한 요청
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return false;

    // 2. SW 준비 대기
    const reg = await navigator.serviceWorker.ready;

    // 3. 기존 구독 확인 또는 새로 생성
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,  // 필수: 알림 없이 사일런트 푸시 금지
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    // 4. 구독 정보 추출
    const json = sub.toJSON();
    const endpoint = sub.endpoint;
    const p256dh = json.keys?.p256dh || '';
    const auth = json.keys?.auth || '';

    if (!endpoint || !p256dh || !auth) return false;

    // 5. DB에 저장 (upsert)
    const { error } = await supabase.from('push_subscriptions').upsert(
      { user_id: userId, endpoint, p256dh, auth },
      { onConflict: 'user_id,endpoint' }
    );

    return !error;
  } catch (e) {
    console.error('subscribePush error:', e);
    return false;
  }
}

// ============================================
// 해지 (Unsubscribe)
// ============================================

export async function unsubscribePush(userId: string): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      // DB에서 삭제
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', userId)
        .eq('endpoint', sub.endpoint);

      // 브라우저 구독 해지
      await sub.unsubscribe();
    }
  } catch (e) {
    console.error('unsubscribePush error:', e);
  }
}

// ============================================
// 상태 확인
// ============================================

export async function hasActiveSubscription(): Promise<boolean> {
  try {
    if (!isPushSupported()) return false;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  } catch {
    return false;
  }
}

// ============================================
// 알림 설정 (Notification Preferences)
// ============================================

export interface NotificationPreferences {
  daily_reminder: boolean;
  // 앱에 맞게 추가:
  // member_activity: boolean;
  // budget_alert: boolean;
  // marketing: boolean;
}

const DEFAULT_PREFS: NotificationPreferences = {
  daily_reminder: true,
};

export async function getNotificationPreferences(
  userId: string
): Promise<NotificationPreferences> {
  const { data } = await supabase
    .from('notification_preferences')
    .select('daily_reminder')  // 필드 맞게 수정
    .eq('user_id', userId)
    .maybeSingle();

  return data || DEFAULT_PREFS;
}

export async function saveNotificationPreferences(
  userId: string,
  prefs: NotificationPreferences
): Promise<void> {
  await supabase.from('notification_preferences').upsert(
    { user_id: userId, ...prefs },
    { onConflict: 'user_id' }
  );
}

// ============================================
// 마지막 접속 시간 업데이트
// ============================================

export async function updateLastAccess(userId: string): Promise<void> {
  await supabase
    .from('user_profiles')
    .update({ last_access_at: new Date().toISOString() })
    .eq('id', userId);
}
```

---

## 6. 클라이언트: 설정 UI

설정 페이지에 알림 토글을 넣는 방법.

### 6.1 토글 컴포넌트

```tsx
function NotifToggle({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[#1A1A1A]">{label}</p>
        <p className="text-[11px] text-[#8A8A8A]">{desc}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
          checked ? 'bg-[#3DA06A]' : 'bg-[#E5E7EB]'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
            checked ? 'translate-x-5' : ''
          }`}
        />
      </button>
    </div>
  );
}
```

### 6.2 설정 섹션

```tsx
import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import {
  isPushSupported,
  getPermissionState,
  hasActiveSubscription,
  subscribePush,
  unsubscribePush,
  getNotificationPreferences,
  saveNotificationPreferences,
  NotificationPreferences,
} from '../lib/pushNotification';

function NotificationSettings({ userId }: { userId: string }) {
  const [supported] = useState(isPushSupported());
  const [permission, setPermission] = useState(getPermissionState());
  const [subscribed, setSubscribed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPreferences>({
    daily_reminder: true,
  });

  // 초기 로드
  useEffect(() => {
    async function load() {
      setPermission(getPermissionState());
      setSubscribed(await hasActiveSubscription());
      setPrefs(await getNotificationPreferences(userId));
    }
    load();
  }, [userId]);

  // 푸시 활성화
  async function handleEnable() {
    setSaving(true);
    const ok = await subscribePush(userId);
    setSaving(false);
    if (ok) {
      setSubscribed(true);
      setPermission('granted');
    } else {
      alert(
        '알림 권한을 허용해주세요.\niOS: 설정 > 앱이름 > 알림 에서 허용할 수 있습니다.'
      );
    }
  }

  // 푸시 비활성화
  async function handleDisable() {
    await unsubscribePush(userId);
    setSubscribed(false);
  }

  // 개별 토글
  async function handleToggle(
    key: keyof NotificationPreferences,
    value: boolean
  ) {
    // 알림을 켤 때 아직 구독 안 됐으면 먼저 구독 시도
    if (value && !subscribed) {
      setSaving(true);
      const ok = await subscribePush(userId);
      setSaving(false);
      if (!ok) {
        alert('알림 권한을 허용해주세요.');
        return;
      }
      setSubscribed(true);
      setPermission('granted');
    }

    const newPrefs = { ...prefs, [key]: value };
    setPrefs(newPrefs);
    await saveNotificationPreferences(userId, newPrefs);
  }

  return (
    <div className="bg-white rounded-3xl p-5 space-y-4">
      {/* 헤더 */}
      <div className="flex items-center gap-2 mb-2">
        <Bell size={16} className="text-[#8A8A8A]" />
        <span className="text-sm font-semibold text-[#1A1A1A]">알림 설정</span>
      </div>

      {/* 브라우저 미지원 */}
      {!supported && (
        <p className="text-xs text-[#8A8A8A]">
          이 브라우저는 푸시 알림을 지원하지 않습니다.
        </p>
      )}

      {/* 미구독 상태 */}
      {supported && !subscribed && (
        <button
          onClick={handleEnable}
          disabled={saving}
          className="w-full py-2.5 rounded-xl text-sm font-medium bg-[#F2FAEB] text-[#3DA06A] hover:bg-[#E8F5E9]"
        >
          {saving ? '설정 중...' : '알림 허용'}
        </button>
      )}

      {/* 구독 완료 상태 */}
      {supported && subscribed && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-[#3DA06A]">
              <span>✓</span>
              <span>알림이 활성화되어 있습니다</span>
            </div>
            <button
              onClick={handleDisable}
              className="text-xs text-[#8A8A8A] hover:text-[#E8546A]"
            >
              해제
            </button>
          </div>

          {/* 알림 종류별 토글 — 앱에 맞게 수정 */}
          <div className="space-y-3 pt-2">
            <NotifToggle
              label="일일 리마인더"
              desc="접속하지 않은 날 저녁에 알림"
              checked={prefs.daily_reminder}
              onChange={(v) => handleToggle('daily_reminder', v)}
            />
            {/* 필요한 만큼 토글 추가:
            <NotifToggle
              label="마케팅 알림"
              desc="이벤트 및 프로모션 소식"
              checked={prefs.marketing}
              onChange={(v) => handleToggle('marketing', v)}
            />
            */}
          </div>
        </>
      )}
    </div>
  );
}
```

### 6.3 앱 초기화 (App.tsx)

```tsx
import { updateLastAccess, hasActiveSubscription, subscribePush } from './lib/pushNotification';

function App() {
  const [user, setUser] = useState(null);
  const lastAccessUpdated = useRef(false);

  useEffect(() => {
    if (!user || lastAccessUpdated.current) return;
    lastAccessUpdated.current = true;

    // 마지막 접속 시간 업데이트
    updateLastAccess(user.id);

    // 기존 구독이 있으면 갱신 (endpoint 변경 대비)
    hasActiveSubscription().then((active) => {
      if (active) subscribePush(user.id);
    });
  }, [user]);

  // ...
}
```

---

## 7. 서버: 푸시 전송 모듈 (Supabase Edge Function)

**파일:** `supabase/functions/_shared/push.ts`

이 파일이 핵심. VAPID JWT 생성 + aes128gcm 암호화 + 전송을 모두 처리한다.

```ts
// ============================================
// VAPID + Web Push 전송 (Deno, 외부 라이브러리 없음)
// ============================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// --- Base64 유틸리티 ---

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

function base64ToUint8Array(b64: string): Uint8Array {
  const padding = '='.repeat((4 - (b64.length % 4)) % 4);
  const binary = atob((b64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// --- VAPID JWT 생성 (ES256) ---

async function createVapidJwt(
  audience: string,     // push endpoint의 origin
  subject: string,      // mailto:your@email.com
  publicKey: string,    // VAPID 공개키 (base64url)
  privateKey: string,   // VAPID 개인키 (base64url)
): Promise<string> {
  const header = { typ: 'JWT', alg: 'ES256' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 3600,  // 12시간 유효
    sub: subject,
  };

  const encHeader = base64urlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const encPayload = base64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${encHeader}.${encPayload}`;

  // 개인키로 서명
  const privKeyBytes = base64urlDecode(privateKey);
  const key = await crypto.subtle.importKey(
    'jwk',
    {
      kty: 'EC', crv: 'P-256',
      x: publicKey.substring(1, 44),   // 공개키에서 x 좌표
      y: publicKey.substring(44),       // 공개키에서 y 좌표
      d: privateKey,                    // 개인키
    },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  // ⚠️ 실제 구현에서는 공개키를 uncompressed point에서 x, y로 분리해야 함
  // 아래는 간소화된 버전. 실제 코드는 프로젝트의 push.ts 참조

  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(unsignedToken)
  );

  // DER → raw (r || s) 변환
  const sigBytes = new Uint8Array(sig);
  // ... DER 파싱 로직 (프로젝트 push.ts 참조)

  return `${unsignedToken}.${base64urlEncode(sigBytes)}`;
}

// --- Payload 암호화 (aes128gcm, RFC 8188) ---

async function encryptPayload(
  payload: string,
  p256dhBase64: string,   // 클라이언트 ECDH 공개키
  authBase64: string,     // 클라이언트 auth secret
): Promise<{ encrypted: Uint8Array; salt: Uint8Array; localPublicKey: Uint8Array }> {
  const clientPublicKey = base64ToUint8Array(p256dhBase64);
  const clientAuth = base64ToUint8Array(authBase64);

  // 1. 서버 ECDH 키페어 생성
  const localKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );

  // 2. Shared Secret 유도
  const clientKey = await crypto.subtle.importKey(
    'raw', clientPublicKey,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  const sharedSecret = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: clientKey },
    localKeyPair.privateKey,
    256
  );

  // 3. 서버 공개키 내보내기 (uncompressed)
  const localPublicKey = new Uint8Array(
    await crypto.subtle.exportKey('raw', localKeyPair.publicKey)
  );

  // 4. Salt 생성
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // 5. HKDF로 IKM 유도
  //    IKM = HKDF-Extract(auth, sharedSecret)
  //    with info = "WebPush: info\0" || clientPublicKey || localPublicKey
  const authInfo = new Uint8Array([
    ...new TextEncoder().encode('WebPush: info\0'),
    ...clientPublicKey,
    ...localPublicKey,
  ]);

  const authHkdfKey = await crypto.subtle.importKey(
    'raw', clientAuth, { name: 'HKDF' }, false, ['deriveBits']
  );

  // PRK
  const prk = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(sharedSecret), info: authInfo },
      authHkdfKey,
      256
    )
  );

  // 6. CEK + Nonce 유도
  const prkKey = await crypto.subtle.importKey('raw', prk, { name: 'HKDF' }, false, ['deriveBits']);

  const cekInfo = new TextEncoder().encode('Content-Encoding: aes128gcm\0');
  const nonceInfo = new TextEncoder().encode('Content-Encoding: nonce\0');

  const cekBits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: cekInfo },
    prkKey, 128
  );

  const nonceBits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: nonceInfo },
    prkKey, 96
  );

  // 7. AES-128-GCM 암호화
  const cek = await crypto.subtle.importKey(
    'raw', cekBits, { name: 'AES-GCM' }, false, ['encrypt']
  );

  // 패딩: \x02 + payload (단일 레코드)
  const padded = new Uint8Array([2, ...new TextEncoder().encode(payload)]);

  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: new Uint8Array(nonceBits) },
      cek,
      padded
    )
  );

  // 8. aes128gcm 헤더 구성
  //    salt(16) || rs(4, big-endian uint32) || idlen(1) || keyid(65, localPublicKey)
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

  return { encrypted: body, salt, localPublicKey };
}

// --- 푸시 전송 ---

interface Subscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export async function sendPush(
  subscription: Subscription,
  payload: object,
): Promise<{ success: boolean; status?: number; gone?: boolean }> {
  try {
    const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY')!;
    const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')!;
    const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT')!;

    const audience = new URL(subscription.endpoint).origin;
    const jwt = await createVapidJwt(audience, VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
    const { encrypted } = await encryptPayload(
      JSON.stringify(payload),
      subscription.p256dh,
      subscription.auth
    );

    const res = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        'Authorization': `vapid t=${jwt}, k=${VAPID_PUBLIC}`,
        'TTL': '86400',       // 24시간 보관
        'Urgency': 'normal',
      },
      body: encrypted,
    });

    if (res.status === 410 || res.status === 404) {
      return { success: false, status: res.status, gone: true };
    }

    return { success: res.status >= 200 && res.status < 300, status: res.status };
  } catch (e) {
    console.error('sendPush error:', e);
    return { success: false };
  }
}

// --- 여러 유저에게 전송 ---

export async function sendPushToUsers(
  supabaseClient: any,
  userIds: string[],
  payload: { title: string; body: string; tag?: string; url?: string },
): Promise<void> {
  if (!userIds.length) return;

  const { data: subs } = await supabaseClient
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth')
    .in('user_id', userIds);

  if (!subs?.length) return;

  const results = await Promise.allSettled(
    subs.map((sub: any) => sendPush(sub, payload))
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
}
```

> **⚠️ 참고:** 위 암호화 코드는 개념을 보여주는 간소화 버전입니다.
> 실제 동작하는 전체 코드는 프로젝트의 `supabase/functions/_shared/push.ts`를 참고하세요.
> (특히 VAPID JWT의 JWK 파라미터 파싱, DER→raw 서명 변환 등 디테일이 있음)

---

## 8. 서버: 알림 트리거 예시

### 8.1 일일 리마인더 (Cron)

**파일:** `supabase/functions/daily-reminder/index.ts`

```ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendPushToUsers } from '../_shared/push.ts';

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // 한국시간 오늘 00:00:00
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstNow = new Date(now.getTime() + kstOffset);
  const todayStr = kstNow.toISOString().slice(0, 10);
  const todayStart = `${todayStr}T00:00:00+09:00`;

  // 1. 오늘 접속하지 않은 유저 조회
  const { data: users } = await supabase
    .from('user_profiles')
    .select('id')
    .or(`last_access_at.is.null,last_access_at.lt.${todayStart}`);

  if (!users?.length) return new Response(JSON.stringify({ ok: true, sent: 0 }));

  const userIds = users.map((u: any) => u.id);

  // 2. daily_reminder=true인 유저만 필터
  const { data: prefs } = await supabase
    .from('notification_preferences')
    .select('user_id, daily_reminder')
    .in('user_id', userIds);

  const prefsMap = new Map(prefs?.map((p: any) => [p.user_id, p]) || []);
  const targetIds = userIds.filter((id: string) => {
    const pref = prefsMap.get(id);
    return !pref || pref.daily_reminder !== false;  // 설정 없으면 기본 true
  });

  if (!targetIds.length) return new Response(JSON.stringify({ ok: true, sent: 0 }));

  // 3. 오늘 이미 전송한 유저 제외 (중복 방지)
  const { data: alreadySent } = await supabase
    .from('notification_log')
    .select('user_id')
    .eq('type', 'daily_reminder')
    .eq('ref_key', todayStr)
    .in('user_id', targetIds);

  const sentSet = new Set(alreadySent?.map((r: any) => r.user_id) || []);
  const finalIds = targetIds.filter((id: string) => !sentSet.has(id));

  if (!finalIds.length) return new Response(JSON.stringify({ ok: true, sent: 0 }));

  // 4. 로그 기록 (전송 전에 기록 → 중복 방지)
  await supabase.from('notification_log').insert(
    finalIds.map((id: string) => ({
      user_id: id,
      type: 'daily_reminder',
      ref_key: todayStr,
    }))
  );

  // 5. 전송
  await sendPushToUsers(supabase, finalIds, {
    title: '리마인더',
    body: '오늘 아직 확인하지 않았어요!',
    tag: `daily-${todayStr}`,
    url: '/',
  });

  return new Response(JSON.stringify({ ok: true, sent: finalIds.length }));
});
```

### 8.2 이벤트 기반 알림 (Webhook)

**파일:** `supabase/functions/notify-transaction/index.ts`
(테이블 INSERT/UPDATE 시 Webhook으로 호출되는 예시)

```ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendPushToUsers } from '../_shared/push.ts';

Deno.serve(async (req) => {
  const { type, record, old_record } = await req.json();
  // type: 'INSERT' | 'UPDATE' | 'DELETE'
  // record: 새 데이터
  // old_record: 이전 데이터

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // 예: 같은 그룹의 다른 멤버에게 알림
  const actorId = record.created_by || record.updated_by;

  // 같은 그룹의 다른 멤버 조회
  const { data: members } = await supabase
    .from('group_members')
    .select('user_id')
    .eq('group_id', record.group_id)
    .neq('user_id', actorId);  // 본인 제외

  if (!members?.length) {
    return new Response(JSON.stringify({ ok: true }));
  }

  const memberIds = members.map((m: any) => m.user_id);

  // notification_preferences에서 해당 알림 켠 유저만 필터
  // (생략 - daily-reminder와 같은 패턴)

  await sendPushToUsers(supabase, memberIds, {
    title: '새 활동',
    body: `${record.title}`,
    tag: `activity-${record.id}`,
    url: '/activities',
  });

  return new Response(JSON.stringify({ ok: true }));
});
```

---

## 9. Supabase 설정 (Webhook, Cron)

### 9.1 Database Webhook 설정

Supabase 대시보드 → Database → Webhooks:

```
Name:     notify-transaction
Table:    transactions (또는 원하는 테이블)
Events:   INSERT, UPDATE
Type:     Supabase Edge Function
Function: notify-transaction
```

### 9.2 Cron Job 설정 (pg_cron)

Supabase SQL Editor에서:

```sql
-- 일일 리마인더: 매일 오후 9시 KST = 12:00 UTC
SELECT cron.schedule(
  'daily-reminder',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/daily-reminder',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

또는 `supabase/config.toml`에서:

```toml
[functions.daily-reminder]
schedule = "0 12 * * *"  # 매일 12:00 UTC = 21:00 KST
```

### 9.3 Edge Function 배포

```bash
# 개별 배포
supabase functions deploy daily-reminder
supabase functions deploy notify-transaction

# 전체 배포
supabase functions deploy
```

---

## 10. PWA 매니페스트

**파일:** `public/manifest.json`

```json
{
  "name": "앱 이름",
  "short_name": "앱이름",
  "description": "앱 설명",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#1B5E3A",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

**`index.html`에 추가:**

```html
<link rel="manifest" href="/manifest.json" />
<meta name="theme-color" content="#1B5E3A" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<link rel="apple-touch-icon" href="/icon-192.png" />
```

---

## 11. iOS Safari 주의사항

iOS에서 Web Push는 **iOS 16.4+**부터 지원되며, 다음 조건이 필요:

1. **PWA로 설치해야 함** (홈 화면에 추가)
   - Safari 브라우저에서는 푸시 알림 불가
   - 반드시 "홈 화면에 추가" 후 PWA에서 알림 허용

2. **manifest.json 필수**
   - `display: "standalone"` 필수

3. **HTTPS 필수**
   - localhost에서는 테스트 가능

4. **권한 요청은 유저 제스처 필요**
   - 버튼 클릭 등 유저 인터랙션 내에서만 `Notification.requestPermission()` 호출 가능
   - 페이지 로드 시 자동 요청 불가

5. **알림 거부 시 안내 필요**
   ```
   알림 권한을 허용해주세요.
   iOS: 설정 > 앱이름 > 알림 에서 허용할 수 있습니다.
   ```

---

## 12. 디버깅 & 테스트

### 브라우저 콘솔

```js
// 1. Service Worker 등록 상태
navigator.serviceWorker.getRegistrations().then(rs => console.log(rs));

// 2. 푸시 구독 확인
navigator.serviceWorker.ready.then(reg => {
  reg.pushManager.getSubscription().then(sub => console.log(sub));
});

// 3. 알림 권한
console.log(Notification.permission);  // 'granted', 'denied', 'default'

// 4. 로컬 알림 테스트 (서버 없이)
navigator.serviceWorker.ready.then(reg => {
  reg.showNotification('테스트 알림', {
    body: '이것은 테스트입니다',
    icon: '/icon-192.png',
    tag: 'test',
  });
});
```

### Supabase Edge Function 로컬 테스트

```bash
# Edge Function 로컬 실행
supabase functions serve daily-reminder --env-file .env.local

# 다른 터미널에서 호출
curl -X POST http://localhost:54321/functions/v1/daily-reminder \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### DB에서 구독 확인

```sql
-- 활성 구독 확인
SELECT user_id, endpoint, created_at
FROM push_subscriptions
ORDER BY created_at DESC;

-- 알림 로그 확인
SELECT * FROM notification_log
ORDER BY created_at DESC
LIMIT 20;
```

---

## 13. 실전 배포 기록 (Claude Code로 배포)

> 아래는 **Sol AI Office (Teamie)** 앱에 푸시 알림을 구현하면서 실제로 수행한 모든 단계를 기록한 것이다.
> 다른 앱에서도 같은 패턴으로 적용 가능하다.

---

### 13-1. VAPID 키 생성

```bash
npx web-push generate-vapid-keys
```

생성 결과 예시:
```
Public Key:  BFgZzb_vZ-wl4S2HHwokkBW48320KM93xymUjALoTLfwqEEy9o9YR3sYLmxaDUxeQKJFUv1SUzbDk-lgccxvwew
Private Key: (비공개)
```

- Public Key → 클라이언트 `.env`의 `VITE_VAPID_PUBLIC_KEY`에 설정
- Private Key → Supabase secrets에만 설정 (코드에 절대 넣지 않음)

---

### 13-2. Supabase CLI 인증 + 프로젝트 연결

```bash
# 1. Access Token 발급: https://supabase.com/dashboard/account/tokens
# 2. 환경변수로 인증 (비대화형 환경에서 필수)
export SUPABASE_ACCESS_TOKEN=sbp_xxxxx...

# 3. 프로젝트 연결 (최초 1회)
npx supabase link --project-ref {프로젝트_ref}

# 프로젝트 ref 확인: Supabase 대시보드 URL의 /project/{여기} 부분
```

---

### 13-3. Supabase Secrets 설정

```bash
SUPABASE_ACCESS_TOKEN=sbp_xxxxx npx supabase secrets set \
  VAPID_PUBLIC_KEY=BFgZzb... \
  VAPID_PRIVATE_KEY=비공개키... \
  VAPID_SUBJECT=mailto:your@email.com \
  --project-ref {프로젝트_ref}
```

- `VAPID_SUBJECT`: 푸시 서비스에 보내는 식별자 (이메일로 알림이 오는 건 아님)
- Edge Function에서 `Deno.env.get('VAPID_PUBLIC_KEY')` 등으로 접근

---

### 13-4. DB 스키마 생성

```bash
# SQL 실행 (Supabase CLI)
SUPABASE_ACCESS_TOKEN=sbp_xxxxx npx supabase db query --linked "SQL문"
```

필요한 테이블 3개 + 컬럼 1개:

```sql
-- 1. 푸시 구독 정보
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, endpoint)
);
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "push_subscriptions_own" ON push_subscriptions
  FOR ALL USING (user_id = auth.uid());

-- 2. 알림 설정 (앱에 맞게 boolean 컬럼 추가/수정)
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  -- 앱별로 필요한 알림 토글 컬럼 추가
  task_deadline BOOLEAN DEFAULT true,
  task_overdue BOOLEAN DEFAULT true,
  morning_routine BOOLEAN DEFAULT true,
  schedule_reminder BOOLEAN DEFAULT true,
  morning_briefing BOOLEAN DEFAULT true,
  pomodoro_done BOOLEAN DEFAULT true,
  morning_journal BOOLEAN DEFAULT true,
  evening_journal BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notification_preferences_own" ON notification_preferences
  FOR ALL USING (user_id = auth.uid());

-- 3. 알림 발송 로그 (중복 방지)
CREATE TABLE notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  ref_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, type, ref_key)
);
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notification_log_select_own" ON notification_log
  FOR SELECT USING (user_id = auth.uid());

-- 4. 마지막 접속 시간 (기존 테이블에 컬럼 추가)
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS last_access_at TIMESTAMPTZ;
```

---

### 13-5. Edge Function 배포

```bash
# 개별 배포
SUPABASE_ACCESS_TOKEN=sbp_xxxxx npx supabase functions deploy {함수명} --project-ref {프로젝트_ref}

# 예시
npx supabase functions deploy morning-briefing --project-ref eadhobeluoivppoaxzbh
npx supabase functions deploy morning-routine --project-ref eadhobeluoivppoaxzbh
npx supabase functions deploy morning-journal --project-ref eadhobeluoivppoaxzbh
npx supabase functions deploy schedule-reminder --project-ref eadhobeluoivppoaxzbh
npx supabase functions deploy task-deadline --project-ref eadhobeluoivppoaxzbh
npx supabase functions deploy evening-journal --project-ref eadhobeluoivppoaxzbh
npx supabase functions deploy overdue-tasks --project-ref eadhobeluoivppoaxzbh
npx supabase functions deploy test-push --project-ref eadhobeluoivppoaxzbh
```

---

### 13-6. pg_cron + pg_net 활성화 및 Cron 등록

```sql
-- 확장 활성화 (최초 1회)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Cron 등록 (시간은 UTC 기준, KST = UTC + 9)
-- anon key를 Authorization 헤더에 넣어서 호출
SELECT cron.schedule(
  'morning-briefing',    -- job 이름
  '0 23 * * *',          -- UTC 23:00 = KST 08:00
  $$SELECT net.http_post(
    url := 'https://{프로젝트}.supabase.co/functions/v1/morning-briefing',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer {ANON_KEY}'
    ),
    body := '{}'::jsonb
  )$$
);
```

**Cron 관리 명령:**

```sql
-- 등록된 cron 확인
SELECT jobname, schedule FROM cron.job ORDER BY jobname;

-- cron 삭제 후 재등록 (시간 변경 시)
SELECT cron.unschedule('job이름');
SELECT cron.schedule('job이름', '새스케줄', $$ ... $$);

-- DB 컬럼 추가 (알림 유형 추가 시)
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS 컬럼명 BOOLEAN DEFAULT true;
```

---

### 13-7. Sol AI Office — 최종 알림 스케줄

| Cron (UTC) | KST | 함수명 | 제목 | 내용 |
|-----------|-----|--------|------|------|
| `0 23 * * *` | 08:00 | morning-briefing | 오늘 브리핑 ☀️ | "일정 3개, 할일 5개 있어요" |
| `0 0 * * *` | 09:00 | morning-routine | 루틴 체크 ✅ | "오늘 루틴을 확인해보세요" |
| `5 0 * * *` | 09:05 | morning-journal | 아침 일기 🌿 | "오늘 아침 일기를 써보세요" |
| `*/5 * * * *` | 5분 간격 | schedule-reminder | {일정 제목} | "30분 후 시작" |
| `1 1 * * *` | 10:01 | task-deadline | 오늘 마감 🔴 / 마감 D-1 🟡 | "{할일} 오늘까지!" |
| `0 12 * * *` | 21:00 | evening-journal | 저녁 일기 🌇 | "오늘 하루를 정리해보세요" |
| `0 13 * * *` | 22:00 | overdue-tasks | 미완료 알림 | "아직 못 한 일 3개가 있어요" |
| 수동 | - | test-push | 테스트 알림 | 디버깅용 수동 발송 |

**뽀모도로 타이머 종료**: 서버 푸시가 아닌 **클라이언트에서 직접** `reg.showNotification()` 호출 (document.hidden일 때만)

---

### 13-8. 파일 구조 (Sol AI Office 기준)

```
프로젝트/
├── public/
│   ├── sw.js                              # Service Worker (push + notificationclick)
│   └── manifest.json                      # purpose: "any maskable" 필수
├── src/
│   ├── main.tsx                           # SW 등록
│   ├── App.tsx                            # lastAccess 갱신 + 기존 구독 갱신
│   ├── types.ts                           # NotificationPreferences 인터페이스
│   ├── services/
│   │   ├── pushNotification.service.ts    # 구독/해지/설정 CRUD
│   │   └── mockSupabase.ts               # mock 테이블 3개 추가
│   ├── hooks/
│   │   └── useNotification.ts             # 알림 상태 관리 훅
│   ├── components/
│   │   └── NotificationSettings.tsx       # 설정 UI (토글 목록)
│   └── pages/
│       └── SettingsPage.tsx               # NotificationSettings 통합
├── supabase/
│   └── functions/
│       ├── _shared/
│       │   ├── push.ts                    # VAPID JWT + aes128gcm + 전송 (핵심)
│       │   ├── supabaseAdmin.ts           # createClient(service_role)
│       │   └── kst.ts                     # KST 시간 유틸
│       ├── morning-briefing/index.ts
│       ├── morning-routine/index.ts
│       ├── morning-journal/index.ts
│       ├── schedule-reminder/index.ts
│       ├── task-deadline/index.ts
│       ├── evening-journal/index.ts
│       ├── overdue-tasks/index.ts
│       └── test-push/index.ts
├── docs/
│   └── push_notification_setup.sql        # 전체 DB 스키마 + cron SQL
└── index.html                             # iOS PWA 메타 태그
```

---

### 13-9. 새 필드/알림 추가 시 수정해야 할 곳 (체크리스트)

알림 유형을 추가할 때 아래 **7곳**을 모두 수정해야 함:

1. **DB**: `ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS 컬럼명 BOOLEAN DEFAULT true;`
2. **`src/types.ts`**: `NotificationPreferences`에 camelCase 필드 추가
3. **`src/services/pushNotification.service.ts`**: `NotificationPreferencesRow`에 snake_case 필드 + `DEFAULT_PREFS` 추가
4. **`src/services/mockSupabase.ts`**: mock 데이터에 새 필드 추가
5. **`src/hooks/useNotification.ts`**: `DEFAULT_PREFS` + `toPrefs()` + `toRow()` 매핑 추가
6. **`src/components/NotificationSettings.tsx`**: 토글 UI 추가
7. **`supabase/functions/새함수/index.ts`**: Edge Function 생성 + 배포 + cron 등록

---

### 13-10. 보안 주의사항

- **`.env` 파일은 `.gitignore`에 등록** — git에 절대 커밋하지 않음
- **Replit은 Secrets 탭** 사용 — `.env` 파일 불필요
- **Supabase Access Token**: 로컬 환경변수(`SUPABASE_ACCESS_TOKEN`)로만 사용, 코드에 하드코딩 금지
- **VAPID Private Key**: Supabase secrets에만 저장, 클라이언트/코드에 절대 노출 금지
- **Anon Key는 클라이언트에 노출 OK** — RLS로 보호됨
- **Claude Code 메모리** (`.claude/projects/.../memory/`)에 토큰/배포 정보 저장 가능 — git 추적 안 됨

---

## 14. 체크리스트

### 초기 설정
- [ ] VAPID 키페어 생성 (`npx web-push generate-vapid-keys`)
- [ ] 클라이언트 환경변수에 `VITE_VAPID_PUBLIC_KEY` 설정
- [ ] Supabase secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
- [ ] DB 테이블 3개 생성 + RLS 정책
- [ ] `user_profiles`에 `last_access_at` 컬럼 추가
- [ ] pg_cron + pg_net 확장 활성화

### 클라이언트
- [ ] `public/sw.js` 생성 (push + notificationclick)
- [ ] `main.tsx`에서 SW 등록
- [ ] `pushNotification.service.ts` — 구독/해지/설정 CRUD
- [ ] `useNotification.ts` 훅 — snake↔camelCase 매핑
- [ ] `NotificationSettings.tsx` — 설정 UI
- [ ] `manifest.json` — `purpose: "any maskable"`
- [ ] `index.html` — `apple-mobile-web-app-capable` 메타 태그
- [ ] `App.tsx` — lastAccess 업데이트 + 기존 구독 갱신
- [ ] mockSupabase에 mock 테이블 추가

### 서버
- [ ] `_shared/push.ts` — VAPID JWT + aes128gcm + 전송
- [ ] `_shared/supabaseAdmin.ts` — service_role 클라이언트
- [ ] `_shared/kst.ts` — KST 시간 유틸
- [ ] 알림별 Edge Function 생성
- [ ] Edge Function 배포 (`npx supabase functions deploy`)
- [ ] pg_cron 등록 (UTC 시간 주의!)

### 테스트
- [ ] test-push 함수 수동 호출 → 알림 수신 확인
- [ ] 알림 허용 → push_subscriptions 행 생성 확인
- [ ] 알림 클릭 → 앱 열기/포커스 확인
- [ ] 알림 해제 → 구독 삭제 확인
- [ ] iOS PWA (홈 화면 추가) → 알림 수신 확인
- [ ] 각 Edge Function 개별 호출 테스트
- [ ] Cron 자동 실행 확인 (`SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;`)