import { useEffect, useState } from "react";
import {
  NOTIFICATION_TYPES,
  type NotificationTypeKey,
  getAdminSettings,
  saveAdminSettings,
} from "@/lib/push";

/**
 * /admin 페이지의 알림 설정 섹션. 어떤 종류의 알림을 모임 전체에서
 * 보낼지 운영자가 끄고 켤 수 있다. 개인 토글 (notification_prefs) 과
 * AND 조합 — 둘 중 하나라도 꺼져 있으면 발송 안 됨.
 */
export function AdminNotificationSection({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const [enabled, setEnabled] = useState<Record<NotificationTypeKey, boolean>>(
    () =>
      Object.fromEntries(
        NOTIFICATION_TYPES.map((t) => [t.key, true]),
      ) as Record<NotificationTypeKey, boolean>,
  );
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState<NotificationTypeKey | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAdminSettings(workspaceId).then((row) => {
      if (cancelled) return;
      if (row?.enabled) {
        setEnabled((cur) => ({ ...cur, ...row.enabled }));
      }
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  async function handleToggle(key: NotificationTypeKey, value: boolean) {
    setSaving(key);
    const next = { ...enabled, [key]: value };
    setEnabled(next);
    await saveAdminSettings(workspaceId, next);
    setSaving(null);
  }

  if (!loaded) return null;

  return (
    <div className="border-y border-line divide-y divide-line">
      {NOTIFICATION_TYPES.map((t) => (
        <div key={t.key} className="py-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm">{t.label}</p>
            <p className="text-xs text-foreground-muted mt-0.5">{t.desc}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled[t.key]}
            onClick={() => handleToggle(t.key, !enabled[t.key])}
            disabled={saving === t.key}
            className={`relative w-10 h-6 shrink-0 transition-colors disabled:opacity-60 ${
              enabled[t.key] ? "bg-accent-teal" : "bg-line-strong"
            }`}
          >
            <span
              aria-hidden
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-surface transition-transform ${
                enabled[t.key] ? "translate-x-4" : ""
              }`}
            />
          </button>
        </div>
      ))}
    </div>
  );
}
