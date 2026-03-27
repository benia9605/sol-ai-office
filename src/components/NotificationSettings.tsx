/**
 * @file src/components/NotificationSettings.tsx
 * @description 알림 설정 컴포넌트
 * - 푸시 알림 활성화/비활성화
 * - 7가지 알림 유형별 토글
 * - iOS PWA 미설치 시 안내
 */
import { useState } from 'react';
import { useNotification } from '../hooks/useNotification';
import { supabase } from '../services/supabase';

/** 벨 아이콘 (SVG) */
function BellIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

/** 토글 스위치 */
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
        <p className="text-sm text-gray-700">{label}</p>
        <p className="text-[11px] text-gray-400">{desc}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
          checked ? 'bg-primary-500' : 'bg-gray-200'
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

/** 카테고리 구분선 */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider pt-2">
      {children}
    </p>
  );
}

/** 푸시 알림 진단 도구 */
function PushDiagnostics({ userId }: { userId: string }) {
  const [results, setResults] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [serverTesting, setServerTesting] = useState(false);
  const [serverResult, setServerResult] = useState<string | null>(null);

  async function runDiagnostics() {
    setRunning(true);
    const log: string[] = [];

    // 1. 브라우저 지원
    const hasSW = 'serviceWorker' in navigator;
    const hasPush = 'PushManager' in window;
    const hasNotif = 'Notification' in window;
    log.push(`[1] 브라우저 지원: SW=${hasSW}, Push=${hasPush}, Notif=${hasNotif}`);

    // 2. 알림 권한
    log.push(`[2] 알림 권한: ${Notification.permission}`);

    // 3. Service Worker 상태
    if (hasSW) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        const sw = reg.active || reg.waiting || reg.installing;
        log.push(`[3] SW 상태: ${sw?.state || '없음'} (scope: ${reg.scope})`);
      } else {
        log.push('[3] SW 등록 안 됨!');
      }
    }

    // 4. 로컬 알림 테스트 (push 없이 직접)
    if (Notification.permission === 'granted' && hasSW) {
      try {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification('진단 테스트', {
          body: '이 알림이 보이면 알림 권한은 정상입니다!',
          tag: 'diagnostic-test',
        });
        log.push('[4] 로컬 알림 발송 성공 — 폰에 뜨는지 확인!');
      } catch (e: any) {
        log.push(`[4] 로컬 알림 실패: ${e.message}`);
      }
    } else {
      log.push('[4] 로컬 알림 테스트 불가 (권한 없음)');
    }

    // 5. Push 구독 상태
    if (hasSW && hasPush) {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        log.push(`[5] 구독 있음: ${sub.endpoint.slice(0, 60)}...`);
        const key = sub.options?.applicationServerKey;
        if (key) {
          const arr = new Uint8Array(key as ArrayBuffer);
          // base64url 인코딩
          let binary = '';
          for (const byte of arr) binary += String.fromCharCode(byte);
          const b64 = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
          log.push(`[5] 구독 VAPID key: ${b64.slice(0, 20)}...${b64.slice(-10)}`);

          const envKey = import.meta.env.VITE_VAPID_PUBLIC_KEY || '(없음)';
          const match = b64 === envKey;
          log.push(`[5] 환경변수 VAPID key: ${envKey.slice(0, 20)}...${envKey.slice(-10)}`);
          log.push(`[5] 키 일치: ${match ? 'YES' : 'NO — 재구독 필요!'}`);
        } else {
          log.push('[5] applicationServerKey 없음');
        }
      } else {
        log.push('[5] Push 구독 없음 — 알림을 먼저 켜주세요');
      }
    }

    setResults(log);
    setRunning(false);
  }

  async function testServerPush() {
    setServerTesting(true);
    setServerResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('test-push', {
        body: {
          user_id: userId,
          title: '서버 푸시 테스트',
          body: '이 알림이 오면 서버 푸시가 정상 작동합니다!',
          tag: 'server-test',
        },
      });
      if (error) {
        setServerResult(`실패: ${error.message}`);
      } else if (data?.ok) {
        setServerResult(`성공! (sent: ${data.sent ?? '?'}) — 알림이 오는지 확인!`);
      } else {
        setServerResult(`응답: ${JSON.stringify(data)}`);
      }
    } catch (e: any) {
      setServerResult(`오류: ${e.message}`);
    }
    setServerTesting(false);
  }

  if (!results.length && !running) {
    return (
      <button
        onClick={runDiagnostics}
        className="w-full mt-2 py-2 rounded-xl text-xs font-medium border border-dashed border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-500 transition-colors"
      >
        푸시 알림 진단하기
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      <div className="bg-gray-50 rounded-2xl p-3 space-y-1">
        {running && <p className="text-xs text-gray-400">진단 중...</p>}
        {results.map((line, i) => {
          const isError = line.includes('NO') || line.includes('실패') || line.includes('안 됨') || line.includes('없음');
          const isOk = line.includes('YES') || line.includes('성공') || line.includes('granted');
          return (
            <p key={i} className={`text-[11px] font-mono leading-relaxed ${isError ? 'text-red-500' : isOk ? 'text-green-600' : 'text-gray-500'}`}>
              {line}
            </p>
          );
        })}
      </div>
      <button
        onClick={runDiagnostics}
        className="w-full py-1.5 rounded-xl text-[11px] text-gray-400 hover:text-gray-500 transition-colors"
      >
        다시 진단
      </button>
      {/* 서버 푸시 테스트 */}
      <button
        onClick={testServerPush}
        disabled={serverTesting}
        className="w-full py-2 rounded-xl text-xs font-medium border border-dashed border-primary-300 text-primary-500 hover:border-primary-400 hover:bg-primary-50 transition-colors disabled:opacity-50"
      >
        {serverTesting ? '서버 푸시 전송 중...' : '서버 푸시 테스트 (Edge Function)'}
      </button>
      {serverResult && (
        <p className={`text-[11px] font-mono px-1 ${serverResult.includes('성공') ? 'text-green-600' : 'text-red-500'}`}>
          {serverResult}
        </p>
      )}
    </div>
  );
}

interface Props {
  userId: string;
}

export function NotificationSettings({ userId }: Props) {
  const {
    supported,
    isStandalone,
    permission,
    subscribed,
    prefs,
    loading,
    saving,
    enablePush,
    disablePush,
    togglePref,
  } = useNotification(userId);

  if (loading) {
    return (
      <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-soft p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-2">
          <BellIcon className="w-5 h-5 text-gray-400" />
          <h2 className="text-base font-bold text-gray-800">알림 설정</h2>
        </div>
        <p className="text-xs text-gray-400">로딩 중...</p>
      </div>
    );
  }

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-soft p-4 sm:p-6 space-y-4">
      {/* 헤더 */}
      <div className="flex items-center gap-2">
        <BellIcon className="w-5 h-5 text-gray-400" />
        <h2 className="text-base font-bold text-gray-800">알림 설정</h2>
      </div>

      {/* 브라우저 미지원 */}
      {!supported && (
        <p className="text-xs text-gray-400">
          이 브라우저는 푸시 알림을 지원하지 않습니다.
        </p>
      )}

      {/* iOS Safari — PWA 미설치 안내 */}
      {supported && isIOS && !isStandalone && (
        <div className="bg-amber-50 rounded-2xl p-3 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-xs">📱</span>
            <p className="text-xs font-medium text-amber-700">홈 화면에 추가 필요</p>
          </div>
          <p className="text-[11px] text-amber-600 leading-relaxed">
            iOS에서 푸시 알림을 받으려면 Safari 하단의 공유 버튼 → "홈 화면에 추가"로 앱을 설치한 후 알림을 허용해주세요.
          </p>
        </div>
      )}

      {/* 권한 거부됨 */}
      {supported && permission === 'denied' && (
        <div className="bg-red-50 rounded-2xl p-3">
          <p className="text-xs text-red-600">
            알림 권한이 차단되어 있습니다.
            {isIOS
              ? ' 설정 > Teamie > 알림에서 허용해주세요.'
              : ' 브라우저 주소창 왼쪽 자물쇠 아이콘에서 알림을 허용해주세요.'}
          </p>
        </div>
      )}

      {/* 미구독 — 안내 + 허용 버튼 */}
      {supported && !subscribed && permission !== 'denied' && (
        <div className="flex items-center gap-3">
          <p className="flex-1 text-xs text-gray-400 leading-relaxed">
            알림을 받으려면 권한을 허용해주세요.
          </p>
          <button
            onClick={enablePush}
            disabled={saving}
            className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            {saving ? '설정 중...' : '알림 허용'}
          </button>
        </div>
      )}

      {/* 구독 완료 — 토글 목록 */}
      {supported && subscribed && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-green-600">
              <span>✓</span>
              <span>알림이 활성화되어 있습니다</span>
            </div>
            <button
              onClick={disablePush}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors"
            >
              해제
            </button>
          </div>

          <div className="space-y-3">
            {/* 할일 */}
            <SectionLabel>할일</SectionLabel>
            <NotifToggle
              label="마감 알림 (D-1, D-Day)"
              desc="마감 하루 전, 당일에 알림"
              checked={prefs.taskDeadline}
              onChange={(v) => togglePref('taskDeadline', v)}
            />
            <NotifToggle
              label="미완료 할일 알림 (밤 10시)"
              desc="못 끝낸 할일이 있으면 밤 10시에 알림"
              checked={prefs.taskOverdue}
              onChange={(v) => togglePref('taskOverdue', v)}
            />
            <NotifToggle
              label="아침 루틴 체크 (9시)"
              desc="매일 오전 9시 루틴 확인 알림"
              checked={prefs.morningRoutine}
              onChange={(v) => togglePref('morningRoutine', v)}
            />

            {/* 일정 */}
            <SectionLabel>일정</SectionLabel>
            <NotifToggle
              label="일정 시작 전 알림"
              desc="설정한 시간(15분/30분/1시간) 전 알림"
              checked={prefs.scheduleReminder}
              onChange={(v) => togglePref('scheduleReminder', v)}
            />
            <NotifToggle
              label="오늘 일정 아침 브리핑 (8시)"
              desc="매일 오전 8시 오늘 일정 요약"
              checked={prefs.morningBriefing}
              onChange={(v) => togglePref('morningBriefing', v)}
            />

            {/* 스터디 */}
            <SectionLabel>스터디</SectionLabel>
            <NotifToggle
              label="뽀모도로 타이머 종료"
              desc="작업 시간 종료 시 알림 (백그라운드)"
              checked={prefs.pomodoroDone}
              onChange={(v) => togglePref('pomodoroDone', v)}
            />

            {/* 기록 */}
            <SectionLabel>기록</SectionLabel>
            <NotifToggle
              label="아침 일기 리마인더 (9시)"
              desc="아침 일기를 안 쓰면 오전 9시에 알림"
              checked={prefs.morningJournal}
              onChange={(v) => togglePref('morningJournal', v)}
            />
            <NotifToggle
              label="저녁 일기 리마인더 (9시)"
              desc="저녁 일기를 안 쓰면 밤 9시에 알림"
              checked={prefs.eveningJournal}
              onChange={(v) => togglePref('eveningJournal', v)}
            />
          </div>

          {/* 진단 도구 */}
          <PushDiagnostics userId={userId} />
        </>
      )}
    </div>
  );
}
