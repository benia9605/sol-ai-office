import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useActiveWorkspace } from "@/lib/active-workspace";
import { useAsync } from "@/lib/use-async";
import {
  NOTIFICATION_TYPES,
  type NotificationTypeKey,
  getMyPrefs,
  hasActiveSubscription,
  isPushSupported,
  permissionState,
  saveMyPrefs,
  subscribePush,
  unsubscribePush,
} from "@/lib/push";
import { notify } from "@/lib/data/notify";
import { isDemoMode } from "@/lib/demo/mode";

/**
 * 내 정보 관리 페이지에 들어가는 알림 섹션.
 * - 마스터 스위치: 알림 켜기/끄기 (브라우저 권한 + 구독)
 * - 종류별 토글: 가입신청 / 새 일정 / 새 회의록 등
 */
export function NotificationSection() {
  const { user } = useAuth();
  const { workspace } = useActiveWorkspace();
  const demo = isDemoMode();
  const supported = isPushSupported();
  const [perm, setPerm] = useState(permissionState());
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: prefs } = useAsync(
    () => (user ? getMyPrefs(user.id) : Promise.resolve(null)),
    [user?.id, refreshKey],
  );

  useEffect(() => {
    let cancelled = false;
    hasActiveSubscription().then((v) => {
      if (!cancelled) setSubscribed(v);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (!user) return null;

  async function handleEnable() {
    if (!user) return;
    setBusy(true);
    const ok = await subscribePush(user.id);
    if (ok) {
      await saveMyPrefs(user.id, { enabled: true });
      setSubscribed(true);
      setPerm("granted");
    } else {
      alert(
        "알림 권한을 허용해주세요.\niOS: 설정 > Safari > 알림에서 활성화 후 홈 화면에 추가한 PWA 에서 시도하세요.",
      );
    }
    setBusy(false);
    setRefreshKey((v) => v + 1);
  }

  async function handleDisable() {
    if (!user) return;
    setBusy(true);
    await unsubscribePush(user.id);
    await saveMyPrefs(user.id, { enabled: false });
    setSubscribed(false);
    setBusy(false);
    setRefreshKey((v) => v + 1);
  }

  async function handleToggleType(key: NotificationTypeKey, value: boolean) {
    if (!user) return;
    const next = {
      ...((prefs?.preferences ?? {}) as Record<string, boolean>),
      [key]: value,
    };
    await saveMyPrefs(user.id, { preferences: next });
    setRefreshKey((v) => v + 1);
  }

  async function handleTestNotification() {
    if (!user || !workspace) return;
    setTestStatus("보내는 중...");
    // actor_id 를 안 넘기면 self-filter 가 안 걸려 본인도 받음.
    await notify({
      type: "member_joined",
      workspace_id: workspace.id,
      title: "🔔 테스트 알림",
      body: "푸시 알림이 잘 도착하면 성공!",
      url: "/profile",
      tag: `test-${Date.now()}`,
      target_user_ids: [user.id],
    });
    setTestStatus("전송 완료 — 몇 초 안에 알림이 도착할 거예요.");
    setTimeout(() => setTestStatus(null), 6000);
  }

  const masterOn = subscribed && (prefs?.enabled ?? true);

  return (
    <section>
      <h2 className="label mb-3">알림</h2>

      {!supported && (
        <p className="text-xs text-foreground-faint border-y border-line py-4">
          이 브라우저는 푸시 알림을 지원하지 않습니다. iOS 는 16.4+ 의
          홈 화면에 추가된 PWA 에서만 동작합니다.
        </p>
      )}

      {supported && (
        <div className="border-y border-line divide-y divide-line">
          <Row
            label="푸시 알림"
            desc={
              demo
                ? "데모 모드에서는 실제 알림이 전송되지 않습니다."
                : masterOn
                ? "활성화됨 — 종류별로 아래에서 세부 조정"
                : "꺼져있음 — 알림 받으려면 켜주세요"
            }
            right={
              demo ? (
                <span className="text-xs text-foreground-faint">데모</span>
              ) : masterOn ? (
                <button
                  type="button"
                  onClick={handleDisable}
                  disabled={busy}
                  className="text-xs text-foreground-muted hover:text-danger border border-line-strong px-3 py-1.5 hover:border-danger disabled:opacity-60"
                >
                  알림 끄기
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleEnable}
                  disabled={busy || perm === "denied"}
                  className="text-xs bg-accent-teal text-accent-foreground px-3 py-1.5 hover:bg-accent-teal/85 disabled:opacity-60"
                >
                  {busy ? "설정 중..." : "알림 켜기"}
                </button>
              )
            }
          />

          {masterOn && (
            <Row
              label="테스트 알림 보내기"
              desc={
                testStatus ??
                "이 버튼을 누르면 본인에게 한 번 전송 — 도착 안 하면 권한 / VAPID 키 / SW 등록 점검"
              }
              right={
                <button
                  type="button"
                  onClick={handleTestNotification}
                  disabled={busy}
                  className="text-xs border border-line-strong px-3 py-1.5 hover:border-foreground"
                >
                  보내기
                </button>
              }
            />
          )}

          {masterOn &&
            NOTIFICATION_TYPES.map((t) => (
              <Row
                key={t.key}
                label={t.label}
                desc={t.desc}
                right={
                  <ToggleSwitch
                    checked={(prefs?.preferences?.[t.key] ?? true) === true}
                    onChange={(v) => handleToggleType(t.key, v)}
                  />
                }
              />
            ))}
        </div>
      )}

      {perm === "denied" && (
        <p className="mt-3 text-xs text-danger">
          브라우저에서 알림 권한이 차단되어 있습니다. 브라우저 설정에서
          이 사이트의 알림을 다시 허용해 주세요.
        </p>
      )}
    </section>
  );
}

function Row({
  label,
  desc,
  right,
}: {
  label: string;
  desc?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="py-4 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm">{label}</p>
        {desc && (
          <p className="text-xs text-foreground-muted mt-0.5">{desc}</p>
        )}
      </div>
      <div className="shrink-0">{right}</div>
    </div>
  );
}

function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-6 transition-colors ${
        checked ? "bg-accent-teal" : "bg-line-strong"
      }`}
    >
      <span
        aria-hidden
        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-surface transition-transform ${
          checked ? "translate-x-4" : ""
        }`}
      />
    </button>
  );
}
