// ============================================================
// 밋업 — Web Push 송신 모듈 (Supabase Edge Function / Deno)
//
// 가이드 (docs/guides/push_notification_guide.md) 의 §7 코드를 그대로
// 단일 모임 모드에 맞춰 정리한 버전.
//
// 환경 변수 (supabase secrets set):
//   VAPID_PUBLIC_KEY  — VITE_VAPID_PUBLIC_KEY 와 동일한 값
//   VAPID_PRIVATE_KEY
//   VAPID_SUBJECT     — mailto:owner@example.com
//
// 사용처: ./notify/index.ts 의 sendPushToUsers
// ============================================================

function base64urlEncode(data: Uint8Array): string {
  // deno-lint-ignore no-explicit-any
  return btoa(String.fromCharCode.apply(null, Array.from(data) as any))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64urlDecode(str: string): Uint8Array {
  const padding = "=".repeat((4 - (str.length % 4)) % 4);
  const base64 = (str + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return new Uint8Array([...raw].map((c) => c.charCodeAt(0)));
}

// ---- VAPID JWT (ES256) ----
async function createVapidJwt(
  audience: string,
  subject: string,
  publicKey: string,
  privateKey: string,
): Promise<string> {
  const header = base64urlEncode(
    new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" })),
  );
  const now = Math.floor(Date.now() / 1000);
  const payload = base64urlEncode(
    new TextEncoder().encode(
      JSON.stringify({
        aud: audience,
        exp: now + 12 * 3600,
        sub: subject,
      }),
    ),
  );
  const unsigned = `${header}.${payload}`;

  const pubBytes = base64urlDecode(publicKey);
  const privBytes = base64urlDecode(privateKey);
  const jwk = {
    kty: "EC",
    crv: "P-256",
    x: base64urlEncode(pubBytes.slice(1, 33)),
    y: base64urlEncode(pubBytes.slice(33, 65)),
    d: base64urlEncode(privBytes),
  };
  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(unsigned),
  );
  return `${unsigned}.${base64urlEncode(new Uint8Array(sig))}`;
}

// ---- Payload 암호화 (aes128gcm / RFC 8188 + 8291) ----
async function encryptPayload(
  payload: string,
  p256dh: string,
  authSecret: string,
): Promise<{
  encrypted: Uint8Array;
  salt: Uint8Array;
  localPublicKey: Uint8Array;
}> {
  const clientPub = base64urlDecode(p256dh);
  const clientAuth = base64urlDecode(authSecret);

  const localKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  );
  const localPub = new Uint8Array(
    await crypto.subtle.exportKey("raw", localKeyPair.publicKey),
  );

  const clientKey = await crypto.subtle.importKey(
    "raw",
    clientPub,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: clientKey },
      localKeyPair.privateKey,
      256,
    ),
  );

  const salt = crypto.getRandomValues(new Uint8Array(16));

  const authInfo = new Uint8Array([
    ...new TextEncoder().encode("WebPush: info\0"),
    ...clientPub,
    ...localPub,
  ]);
  const sharedKey = await crypto.subtle.importKey(
    "raw",
    shared,
    { name: "HKDF" },
    false,
    ["deriveBits"],
  );
  const ikm = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "HKDF", salt: clientAuth, info: authInfo, hash: "SHA-256" },
      sharedKey,
      256,
    ),
  );

  const ikmKey = await crypto.subtle.importKey(
    "raw",
    ikm,
    { name: "HKDF" },
    false,
    ["deriveBits"],
  );
  const cek = new Uint8Array(
    await crypto.subtle.deriveBits(
      {
        name: "HKDF",
        salt,
        info: new TextEncoder().encode("Content-Encoding: aes128gcm\0"),
        hash: "SHA-256",
      },
      ikmKey,
      128,
    ),
  );
  const nonce = new Uint8Array(
    await crypto.subtle.deriveBits(
      {
        name: "HKDF",
        salt,
        info: new TextEncoder().encode("Content-Encoding: nonce\0"),
        hash: "SHA-256",
      },
      ikmKey,
      96,
    ),
  );

  const aesKey = await crypto.subtle.importKey(
    "raw",
    cek,
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
  // RFC 8188: padding delimiter (0x02) goes AT THE END
  const padded = new Uint8Array([...new TextEncoder().encode(payload), 2]);
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, padded),
  );

  return { encrypted, salt, localPublicKey: localPub };
}

function buildBody(
  encrypted: Uint8Array,
  salt: Uint8Array,
  localPublicKey: Uint8Array,
  rs = 4096,
): Uint8Array {
  const header = new Uint8Array(16 + 4 + 1 + localPublicKey.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, rs);
  header[20] = localPublicKey.length;
  header.set(localPublicKey, 21);
  const body = new Uint8Array(header.length + encrypted.length);
  body.set(header);
  body.set(encrypted, header.length);
  return body;
}

export type Subscription = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type PushPayload = {
  title: string;
  body: string;
  tag?: string;
  url?: string;
};

export async function sendPush(
  sub: Subscription,
  payload: PushPayload,
): Promise<{ ok: boolean; status?: number; gone?: boolean }> {
  // deno-lint-ignore no-explicit-any
  const env = (Deno as any).env;
  const VAPID_PUBLIC = env.get("VAPID_PUBLIC_KEY")!;
  const VAPID_PRIVATE = env.get("VAPID_PRIVATE_KEY")!;
  // Apple(web.push.apple.com) 은 sub 가 mailto: / https: 로 시작하지 않으면
  // JWT 를 거부(BadJwtToken) → 안드로이드(FCM)는 통과하지만 iOS 만 실패하는
  // 전형적 케이스. 형식이 어긋나면 mailto: 를 강제로 붙여 방어한다.
  let VAPID_SUBJECT = env.get("VAPID_SUBJECT") || "mailto:owner@example.com";
  if (!/^(mailto:|https:\/\/)/.test(VAPID_SUBJECT)) {
    VAPID_SUBJECT = `mailto:${VAPID_SUBJECT}`;
  }

  const isApple = sub.endpoint.includes("push.apple.com");

  try {
    const audience = new URL(sub.endpoint).origin;
    const jwt = await createVapidJwt(audience, VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
    const { encrypted, salt, localPublicKey } = await encryptPayload(
      JSON.stringify(payload),
      sub.p256dh,
      sub.auth,
    );
    const body = buildBody(encrypted, salt, localPublicKey);

    const res = await fetch(sub.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        Authorization: `vapid t=${jwt}, k=${VAPID_PUBLIC}`,
        TTL: "86400",
        // iOS(Safari/web.push.apple.com) 는 normal 우선순위 푸시를 적극적으로
        // 지연·합치거나 잠금화면에서 드롭한다 ("갤럭시는 뜨는데 아이폰은 잘
        // 안 뜸" 의 주원인). high 로 보내면 즉시 깨워 표시. 어차피 모든 푸시는
        // userVisibleOnly(알림 표시 보장)라 high 가 적절.
        Urgency: "high",
      },
      body,
    });

    if (res.status === 410 || res.status === 404) {
      return { ok: false, status: res.status, gone: true };
    }
    // 실패 시 원인 진단을 위해 상태 + 응답 본문을 남긴다. Apple 은
    // 400 BadJwtToken / 403 등으로 거부 사유를 본문에 실어 보낸다.
    if (!res.ok) {
      let detail = "";
      try {
        detail = (await res.text()).slice(0, 300);
      } catch {
        /* ignore */
      }
      console.error(
        `[push] send failed status=${res.status} apple=${isApple} endpoint=${sub.endpoint.slice(0, 60)}… detail=${detail}`,
      );
    }
    return { ok: res.ok, status: res.status };
  } catch (err) {
    console.error("[push] sendPush error", err);
    return { ok: false };
  }
}

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

export async function sendPushToUsers(
  supabase: SupabaseClient,
  userIds: string[],
  payload: PushPayload,
): Promise<void> {
  if (!userIds.length) return;

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
    .in("user_id", userIds);

  if (!subs?.length) return;

  const results = await Promise.allSettled(
    (subs as Subscription[]).map((s) => sendPush(s, payload)),
  );

  const goneIds: string[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled" && r.value.gone) {
      goneIds.push((subs as Subscription[])[i].id);
    }
  });
  if (goneIds.length) {
    await supabase.from("push_subscriptions").delete().in("id", goneIds);
  }
}
