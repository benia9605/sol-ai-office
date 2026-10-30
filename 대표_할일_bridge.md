# 대표가 하실 일 — bridge 로그인 (딱 3줄)

**작성:** 2026-10-06 · AI Office Claude Code
**왜:** Office 데이터를 로컬 폴더로 꺼내서 **GPT가 읽게** 하는 도구(bridge)가 코드는 완성됐는데,
대표 계정으로 **한 번 로그인**해야 실제로 돌아갑니다.
제가 대신 못 하는 이유 — 비밀번호가 필요한데, 저는 비밀번호를 받지 않도록 만들어뒀습니다.
(값은 **맥 키체인**에만 들어가고 공유폴더·git·문서에는 안 들어갑니다.)

---

## ① 준비 — URL·키 미리 채우기

> 이걸 먼저 하면 ②에서 **이메일·비밀번호만** 치면 됩니다.
> 클로드코드 채팅창에 아래 한 줄을 그대로 붙여넣고 엔터.

```
! node -e 'const fs=require("fs"),os=require("os"),p=require("path").join(os.homedir(),".sol-ai-office-bridge.json"),e=fs.readFileSync(".env","utf8"),g=k=>e.match(new RegExp("^"+k+"=(.*)$","m"))[1].trim();fs.writeFileSync(p,JSON.stringify({supabaseUrl:g("VITE_SUPABASE_URL"),anonKey:g("VITE_SUPABASE_ANON_KEY")},null,2),{mode:384});console.log("준비 완료 →",p)'
```

`준비 완료 → /Users/solmac/.sol-ai-office-bridge.json` 이 나오면 성공.

---

## ② 로그인

```
! node scripts/bridge.mjs login
```

물어보는 순서:

| 물어보는 것 | 뭘 하면 되나 |
|---|---|
| `Supabase URL [https://...]` | **그냥 엔터** (①에서 채워둠) |
| `anon key (공개 키...)` | **그냥 엔터** (①에서 채워둠) |
| `이메일:` | `benia9605@gmail.com` |
| `비밀번호:` | Supabase 비밀번호 — **화면에 안 보이는 게 정상**입니다 |

성공하면:

```
✓ 저장했습니다.
  자격증명 : macOS Keychain (서비스 "sol-ai-office-bridge")
```

---

## ③ 꺼내보기

```
! node scripts/bridge.mjs pull
```

성공하면 아래 폴더에 MD·JSON 파일들이 생깁니다.

```
/Users/solmac/.codex/.chatgpt-projects/g-p-6a5f60f490f08191a6af058b45a467c3/deliverables/simok-ai-office-v1/operations/bridge
```

**이 폴더를 GPT한테 "읽어" 하면 끝입니다.**

---

## ⚠️ 하나 걸릴 수 있는 것 — 구글 로그인이면 비번이 없습니다

AI 오피스를 평소 **구글 버튼**으로 로그인하시면 **비밀번호가 아예 없을 수 있습니다.**

②에서 이렇게 나오면 그 경우입니다:

```
로그인 실패 (400). 이메일·비밀번호·URL 을 확인해 주세요.
```

그때는 **"구글 로그인이라 안 되네, 이메일 코드 방식으로 바꿔줘"** 라고만 말씀해 주세요.
비밀번호 대신 **이메일로 6자리 코드 받아 넣는 방식**으로 제가 바꿔드립니다(10분).
그게 대표한테 훨씬 편합니다.

---

## 그 외 명령어 (참고)

```
! node scripts/bridge.mjs status     # 연결 상태 · 마지막 동기화 · 열린 요청 수
! node scripts/bridge.mjs push       # GPT가 작업한 결과를 Office 에 저장
! node scripts/bridge.mjs logout     # 키체인에서 자격증명 삭제
```

---

## 지금 상태 한 줄 요약

> **그릇은 다 만들어졌고 아직 물이 안 들어간 상태입니다.**
> ③ 이 돌아가는 순간 처음으로 실제 데이터가 흐릅니다.
> (`source_snapshots` 0건 · `bridge_runs` 0건 · `edit_requests` 0건)
