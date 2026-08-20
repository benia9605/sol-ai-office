# 회의 · 회의록 · 할일 배정 — 데이터 연동 전체 가이드

> **이 문서의 목적** — 「회의를 잡고 → 회의록을 쓰고 → 그 자리에서 할일을 배정하면 →
> 담당자 폰에 알림이 가고 → 각 메뉴와 개인 화면에 그 할일이 나타난다」는 흐름 하나를,
> AI 코딩 에이전트가 **혼자 구현할 수 있을 만큼** 빠짐없이 적은 문서.
>
> 밋업 앱의 실제 프로덕션 코드를 기준으로 작성. AI 오피스 앱에 이식할 때는 테이블명/경로만
> 바꾸면 된다.
>
> **범위에서 제외** — 참석자 관리, 지각·불참 보고. (요청에 따라 의도적으로 뺌.
> `meeting_attendees` 테이블 자체를 안 만들어도 이 문서의 모든 내용이 성립한다.)
>
> 좋아요·댓글·푸시 인프라 자체의 구축은 자매 문서
> [`social-notifications-guide.md`](./social-notifications-guide.md) 참고.
> 이 문서는 **회의↔할일 도메인 연결**에 집중한다.

---

## 목차

1. [먼저 읽기 — 절대 헷갈리면 안 되는 5가지](#1-먼저-읽기--절대-헷갈리면-안-되는-5가지)
2. [3층 모델 — 일정 · 회의록 · 할일](#2-3층-모델--일정--회의록--할일)
3. [테이블 정의 + 컬럼마다 뭘 적는가](#3-테이블-정의--컬럼마다-뭘-적는가)
4. [연결 규칙 — FK 4개와 삭제 동작](#4-연결-규칙--fk-4개와-삭제-동작)
5. [작성 흐름 ① 일정 등록](#5-작성-흐름--일정-등록)
6. [작성 흐름 ② 회의록 작성 — 폼 필드 하나하나](#6-작성-흐름--회의록-작성--폼-필드-하나하나)
7. [작성 흐름 ③ 할일 배정 — syncTasksForNote 알고리즘](#7-작성-흐름--할일-배정--synctasksfornote-알고리즘)
8. [할일을 회의 없이 그냥 만드는 경로](#8-할일을-회의-없이-그냥-만드는-경로)
9. [알림 — 저장 버튼 한 번에 무슨 알림이 몇 개 나가나](#9-알림--저장-버튼-한-번에-무슨-알림이-몇-개-나가나)
10. [역참조 맵 — 이 데이터가 어느 화면 어디에 뜨는가](#10-역참조-맵--이-데이터가-어느-화면-어디에-뜨는가)
11. [진행률 — 계산 · 표시 · 작성자](#11-진행률--계산--표시--작성자)
12. [쿼리 카탈로그](#12-쿼리-카탈로그)
13. [상태 · 기한 규칙](#13-상태--기한-규칙)
14. [전체 시나리오 워크스루](#14-전체-시나리오-워크스루)
15. [AI가 자주 틀리는 것 16가지](#15-ai가-자주-틀리는-것-16가지)
16. [구현 체크리스트](#16-구현-체크리스트)

---

## 1. 먼저 읽기 — 절대 헷갈리면 안 되는 5가지

AI가 이 도메인을 이해 못 하는 이유는 거의 항상 아래 5개 중 하나다.

### ① 「일정」과 「회의록」은 **다른 테이블**이다

```
meetings       = 일정.   언제 · 어디서 · 무슨 종류의 모임인가.   ← 회의 "전"에 만든다
meeting_notes  = 회의록. 무슨 얘기를 했나 · 뭘 하기로 했나.      ← 회의 "중/후"에 쓴다
```

같은 것이 아니다. 한 일정에 회의록이 **0개일 수도, 여러 개일 수도** 있다.
반대로 회의록이 **일정 없이 혼자** 존재할 수도 있다 (카톡으로 논의한 경우).

### ② 할일은 **회의록의 자식 테이블이 아니다**

`tasks` 는 독립 테이블이고, `note_id` / `meeting_id` 는 **nullable FK**다.

```
tasks.note_id    = null 이면 "회의록에서 나온 할일이 아님"
tasks.meeting_id = null 이면 "특정 일정과 무관"
```

할일 메뉴에서 그냥 만든 할일은 둘 다 null 이다. 이걸 not null 로 만들면 안 된다.

### ③ 회의록을 저장하면 할일이 **같이** 저장된다 (단일 트랜잭션처럼 동작)

회의록 폼 안에 할일 입력 줄들이 들어있다. `저장` 한 번에:

```
1) meeting_notes  insert/update
2) tasks          delete (지운 줄) + update (수정한 줄) + insert (새 줄)
3) 새로 배정된 담당자에게 푸시 알림
```

이 2번을 담당하는 함수가 `syncTasksForNote()` 다. §7 에서 상세히 다룬다.

### ④ 「담당자(assignee)」와 「작성자(created_by)」는 다르다

| 컬럼 | 뜻 | 알림 |
| --- | --- | --- |
| `tasks.assignee_id` | 이 일을 **할 사람** | `new_task` 를 받는다 |
| `tasks.created_by` | 이 할일을 **적은 사람** | 그 할일의 댓글/좋아요 알림을 받는다 |

회의록을 쓴 사람이 6명에게 할일을 배정하면 → `created_by` 는 전부 작성자 1명,
`assignee_id` 는 6명 각각. 알림은 **6명에게** 간다 (작성자 본인이 담당인 건은 제외).

### ⑤ 데이터는 한 곳에 저장되고 **여러 화면에서 역참조**된다

같은 `tasks` row 하나가 최소 7군데에 나타난다.

```
할일 목록(전체) · 할일 목록(내 할일 탭) · 할일 상세
회의록 상세(액션 아이템) · 회의록 목록(진행률 바)
일정 상세(할일 진행률) · 대시보드(확인이 필요한 일 + 내 할일 버킷)
```

새 화면을 만들 때 데이터를 **복사하지 말고** 항상 `tasks` 를 필터해서 읽는다. §10 참고.

---

## 2. 3층 모델 — 일정 · 회의록 · 할일

### 2.1 ERD

```
┌─────────────────────┐
│ meeting_types       │  일정 종류 (모임 / 인터뷰 / 촬영 …) + 컬러
│  id, name, color    │
└──────────┬──────────┘
           │ type_id (nullable)
           ▼
┌───────────────────────────────────────────┐
│ meetings  (일정)                          │
│  id, workspace_id, title, description,    │
│  location, starts_at, ends_at,            │
│  type_id, project_id, created_by          │
└───┬───────────────────────────────┬───────┘
    │ meeting_id (nullable)         │ meeting_id (nullable)
    ▼                               │
┌───────────────────────────────┐   │
│ meeting_notes  (회의록)       │   │
│  id, workspace_id,            │   │
│  meeting_id,                  │   │
│  title, agenda, content,      │   │
│  summary, created_by          │   │
└───┬───────────────────────────┘   │
    │ note_id (nullable)            │
    ▼                               ▼
┌───────────────────────────────────────────┐
│ tasks  (할일)                             │
│  id, workspace_id, title, description,    │
│  status, priority, due_date,              │
│  assignee_id ★, created_by,               │
│  meeting_id, note_id, category,           │
│  created_at, completed_at                 │
└───┬───────────────────────────────────────┘
    │
    ├── task_likes     (task_id + user_id)
    └── task_comments  (task_id, user_id, content, parent_id)
```

**핵심**: `tasks` 는 `meeting_id` 와 `note_id` **둘 다** 갖는다. 하나면 충분해 보이지만
아니다 — 회의록 없이 일정에만 붙는 할일이 가능하고, 일정 없는 회의록(카톡 논의)에서
나온 할일도 가능하기 때문이다.

### 2.2 왜 일정과 회의록을 나눴나

밋업은 원래 `meetings` 안에 `agenda` / `content` 컬럼이 있었는데, 004 마이그레이션에서
분리했다. 이유:

| 문제 | 분리 후 |
| --- | --- |
| 한 모임에서 두 세션을 따로 기록하고 싶다 | 회의록을 2개 만든다 |
| 카톡으로 논의한 걸 기록하고 싶은데 일정이 없다 | `meeting_id = null` 회의록 |
| 일정은 미리 잡고, 기록은 나중에 | 일정만 먼저 존재 |
| 일정 목록엔 시간/장소만 보이고 싶다 | 본문이 다른 테이블이라 가볍다 |

### 2.3 4가지 조합 상태 (전부 유효하다)

| 상태 | `note.meeting_id` | `task.note_id` | `task.meeting_id` | 예시 |
| --- | --- | --- | --- | --- |
| A. 정식 흐름 | 있음 | 있음 | 있음 | 8/20 정기모임 → 회의록 → 액션 3개 |
| B. 일정 없는 회의록 | **null** | 있음 | **null** | 카톡 논의 정리 → 할일 2개 |
| C. 회의록 없는 할일 | — | **null** | **null** | 할일 메뉴에서 직접 추가 |
| D. 일정만 | — | — | — | 아직 회의 전 |

코드는 이 4가지를 전부 처리해야 한다. `note.meeting_id` 가 항상 있다고 가정하면 B가 깨지고,
`task.note_id` 가 항상 있다고 가정하면 C가 깨진다.

---

## 3. 테이블 정의 + 컬럼마다 뭘 적는가

### 3.1 `meetings` — 일정

```sql
create table public.meetings (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title        text not null,
  description  text,
  location     text,
  starts_at    timestamptz not null,
  ends_at      timestamptz,
  type_id      uuid references public.meeting_types(id) on delete set null,
  project_id   uuid references public.projects(id)      on delete set null,
  created_by   uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index meetings_workspace_idx on public.meetings(workspace_id, starts_at desc);
create index meetings_type_idx      on public.meetings(type_id);

create trigger meetings_touch
  before update on public.meetings
  for each row execute function public.touch_updated_at();
```

| 컬럼 | 화면 라벨 | 필수 | 여기에 무엇을 적나 | 예시 |
| --- | --- | --- | --- | --- |
| `title` | 제목 * | ✅ | 이 회의를 한 줄로. 목록·캘린더·알림 본문에 그대로 나온다 | `8월 셋째주 정기모임` |
| `description` | 설명 | | 한 줄 소개. 없으면 비워둔다 | `하반기 목표 점검` |
| `location` | 장소 | | 오프라인 주소 또는 `Zoom` / `Google Meet` 링크 | `강남 위워크 12F` |
| `starts_at` | 시작 * | ✅ | `datetime-local` 입력 → ISO 문자열. **정렬·캘린더·리마인더의 기준** | `2026-08-20T19:00` |
| `ends_at` | 종료 | | 비워도 됨. 캘린더에서 길이 계산용 | `2026-08-20T21:00` |
| `type_id` | 종류 | | `meeting_types` 참조. 캘린더 컬러 배지 | 정기모임 / 인터뷰 / 촬영 |
| `project_id` | 연결 프로젝트 | | 프로젝트 기능이 있을 때만 | |
| `created_by` | (자동) | ✅ | 로그인 사용자. 화면에서는 **호스트**로 표시 | |

> `starts_at` 은 반드시 **timestamptz** 로 저장한다. `datetime-local` 입력값은 로컬 시각
> 문자열이라 `new Date(value).toISOString()` 으로 변환해서 넣어야 한다 (§13.3).

### 3.2 `meeting_types` — 일정 종류 (선택 기능)

```sql
create table public.meeting_types (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name         text not null,               -- '정기모임' '인터뷰' '촬영'
  color        text not null default '#0a4145',
  sort_order   int  not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
```

운영자가 관리한다. 캘린더/목록에서 컬러 점으로 구분하는 용도. 없어도 전체 흐름은 동작한다.

### 3.3 `meeting_notes` — 회의록

```sql
create table public.meeting_notes (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  meeting_id   uuid references public.meetings(id) on delete set null,  -- ★ nullable
  title        text not null,
  agenda       text,          -- 줄바꿈으로 구분된 아젠다 목록
  content      text,          -- 본문 (리치 에디터 HTML)
  summary      text,          -- 요약 (선택, AI 요약을 붙이기 좋은 자리)
  created_by   uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index meeting_notes_workspace_idx on public.meeting_notes(workspace_id, created_at desc);
create index meeting_notes_meeting_idx   on public.meeting_notes(meeting_id);
```

| 컬럼 | 화면 라벨 | 여기에 무엇을 적나 |
| --- | --- | --- |
| `meeting_id` | 연결 | 드롭다운에서 일정 선택. **「— 일정 미연결 (카톡 등) —」 옵션이 반드시 있어야 한다** |
| `title` | (자동 생성) | 사용자가 안 적는다. 일정 연결됐으면 **그 일정 제목 그대로**, 아니면 `YYYY-MM-DD 회의록` |
| `agenda` | 아젠다 | 번호 매긴 안건 목록. UI 는 입력칸 여러 줄, DB 엔 `\n` 으로 join 한 **하나의 text** |
| `content` | 본문 | 아젠다별 토론 내용. 리치 에디터 HTML |
| `summary` | (현재 미사용) | 3줄 요약. 목록 미리보기/AI 요약용으로 남겨둔 자리 |

**아젠다를 별도 테이블로 만들지 않은 이유** — 순서 바꾸기/삭제가 잦은데 row 단위로 관리하면
동기화 코드가 복잡해진다. 텍스트 한 덩어리로 저장하고 화면에서 `split("\n")` 한다.

```ts
// 저장할 때 (배열 → text)
const agendaText = agendaItems.map((s) => s.trim()).filter(Boolean).join("\n") || null;

// 읽을 때 (text → 배열)
note.agenda?.split("\n").map((s) => s.trim()).filter(Boolean) ?? []
```

**제목 자동 생성 규칙**:

```ts
/**
 * 회의록 제목은 사용자가 직접 입력하지 않는다.
 * - 일정에 연결됨 → 그 일정 제목을 그대로 사용
 * - 미연결       → "YYYY-MM-DD 회의록"
 */
function autoTitle(meetingId: string | null, meetings: Meeting[]): string {
  if (meetingId) {
    const m = meetings.find((x) => x.id === meetingId);
    if (m) return m.title;
  }
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} 회의록`;
}
```

> 편집 모드에서는 `initial.title` 을 유지한다 — 일정 제목이 나중에 바뀌어도
> 이미 쓴 회의록 제목은 안 바뀐다 (기록물이므로).

### 3.4 `tasks` — 할일

```sql
create table public.tasks (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title        text not null,
  description  text,                                   -- 리치 에디터 HTML
  status       text not null default 'todo'
    check (status in ('todo', 'in_progress', 'done')),
  priority     text not null default 'medium'
    check (priority in ('low', 'medium', 'high')),
  due_date     timestamptz,                            -- ★ 기한
  assignee_id  uuid references auth.users(id) on delete set null,   -- ★ 담당자
  created_by   uuid not null references auth.users(id) on delete cascade,
  meeting_id   uuid references public.meetings(id)      on delete set null,
  note_id      uuid references public.meeting_notes(id) on delete set null,
  category     text,
  created_at   timestamptz not null default now(),
  completed_at timestamptz                             -- done 전환 시 자동 기록
);
create index tasks_workspace_idx on public.tasks(workspace_id);
create index tasks_assignee_idx  on public.tasks(assignee_id);   -- ★ "내 할일" 쿼리용
```

| 컬럼 | 화면 라벨 | 여기에 무엇을 적나 |
| --- | --- | --- |
| `title` | 내용 | 액션 아이템 한 줄. 동사로 끝나게 (`8월 매출 자료 정리`) |
| `description` | 내용(상세) | 할일 상세 화면에서만 편집. 회의록 폼에는 없다 |
| `status` | 체크박스 | `todo` → `done` 토글이 기본. `in_progress` 는 상세에서만 |
| `priority` | (현재 UI 없음) | 스키마엔 있지만 밋업 UI 는 안 쓴다. 필요하면 상세에 셀렉트 추가 |
| `due_date` | 기한 | `<input type="date">` → `new Date(v).toISOString()`. 비우면 `null` = 기한 없음 |
| `assignee_id` | 담당자 | 멤버 셀렉트. **미지정(null) 허용** — 미지정이면 알림이 안 간다 |
| `created_by` | (자동) | 이 할일을 적은 사람 |
| `meeting_id` | (자동) | 회의록이 연결된 일정을 그대로 상속 |
| `note_id` | (자동) | 이 할일을 만든 회의록 |
| `completed_at` | (자동) | `status='done'` 전환 시각. 통계/주간 리포트용 |

### 3.5 RLS (4테이블 공통 패턴)

```sql
-- meetings / meeting_notes / tasks 모두 동일한 모양
alter table public.meetings enable row level security;

-- 조회: 워크스페이스 멤버 전원
create policy meetings_select on public.meetings
  for select to authenticated using (public.is_workspace_member(workspace_id));

-- 생성: 멤버면 가능, 단 created_by 는 본인이어야 함
create policy meetings_insert on public.meetings
  for insert to authenticated
  with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());

-- 수정/삭제: 작성자 본인 또는 운영자
create policy meetings_update on public.meetings
  for update to authenticated
  using (public.is_workspace_admin(workspace_id) or created_by = auth.uid());
create policy meetings_delete on public.meetings
  for delete to authenticated
  using (public.is_workspace_admin(workspace_id) or created_by = auth.uid());
```

**`tasks` 만 예외** — 담당자도 수정할 수 있어야 한다 (본인이 완료 체크를 해야 하므로):

```sql
create policy tasks_update on public.tasks
  for update to authenticated
  using (
    public.is_workspace_admin(workspace_id)
    or created_by = auth.uid()
    or assignee_id = auth.uid()        -- ★ 담당자도 수정 가능
  );
```

> 화면에서도 같은 조건으로 버튼을 노출한다:
> `const canManage = task.created_by === user.id || task.assignee_id === user.id || myRole === 'owner' || myRole === 'admin'`

---

## 4. 연결 규칙 — FK 4개와 삭제 동작

### 4.1 FK 4개

| FK | 방향 | nullable | on delete |
| --- | --- | --- | --- |
| `meeting_notes.meeting_id` | 회의록 → 일정 | ✅ | `set null` |
| `tasks.note_id` | 할일 → 회의록 | ✅ | `set null` |
| `tasks.meeting_id` | 할일 → 일정 | ✅ | `set null` |
| `tasks.assignee_id` | 할일 → 사용자 | ✅ | `set null` |

**전부 `set null` 이고 `cascade` 가 하나도 없다.** 의도적이다.

### 4.2 삭제하면 무슨 일이 일어나나

| 지운 것 | 결과 |
| --- | --- |
| 일정 삭제 | 회의록은 남고 `meeting_id` 만 null (= "일정 미연결" 로 표시)<br>할일도 남고 `meeting_id` 만 null |
| 회의록 삭제 | **할일은 안 지워진다.** `note_id` 만 null → 할일 목록엔 계속 보임 |
| 멤버 탈퇴 | 담당 할일은 남고 `assignee_id` 만 null (= "미지정") |
| 할일 삭제 | `task_likes` / `task_comments` 는 cascade 로 함께 삭제 |

> **이유** — 회의록은 "기록"이고 할일은 "실행"이다. 기록을 지웠다고 실행 중인 일이
> 사라지면 안 된다. 회의록을 지우면 할일이 고아가 되지만, 할일 메뉴에서 여전히 보이고
> 수정할 수 있으므로 문제가 없다.
>
> 만약 "회의록 지울 때 딸린 할일도 지울까요?" 를 묻고 싶다면 **애플리케이션 레벨**에서
> 확인 다이얼로그를 띄우고 명시적으로 `deleteTask()` 를 부른다. FK 를 cascade 로 바꾸지 말 것.

### 4.3 `meeting_id` 를 할일에 중복 저장하는 이유

`task → note → meeting` 으로 조인하면 되는데 왜 `task.meeting_id` 를 또 두나?

1. **일정 상세에서 할일 진행률을 보여줄 때** 조인 없이 `tasks.meeting_id = ?` 한 방이면 된다.
2. 회의록 없이 일정에만 붙는 할일이 가능해진다 (조합 D).
3. 회의록이 삭제돼도 (`note_id` → null) 어느 일정에서 나온 일인지는 남는다.

**정합성 규칙**: 회의록의 `meeting_id` 가 바뀌면, 그 회의록에 속한 할일들의 `meeting_id` 도
같이 갱신해야 한다. `syncTasksForNote()` 가 이걸 담당한다 (§7).

---

## 5. 작성 흐름 ① 일정 등록

### 5.1 화면 흐름

```
/meetings  (일정 목록)
   └ [+ 일정 등록] → /meetings/new
                       └ 저장 → /meetings/:id  (일정 상세)
                                  └ [+ 회의록 작성] → /notes/new?meeting=:id
```

### 5.2 폼 필드 (참석자 제외 버전)

```tsx
<Section title="기본 정보">
  <Stacked label="종류">        {/* meeting_types 셀렉트 — 선택 */}
  <Stacked label="제목 *">      {/* placeholder: "예: 5월 셋째주 모임" */}
  <Stacked label="설명">        {/* placeholder: "일정 한 줄 소개." */}
  <Stacked label="장소">
</Section>

<Section title="일시">
  <Stacked label="시작 *">  <input type="datetime-local" />
  <Stacked label="종료">    <input type="datetime-local" />
</Section>
```

검증은 두 개면 충분하다:

```ts
if (!title.trim())  { setError("제목은 필수입니다."); return; }
if (!startsAt)      { setError("시작 일시는 필수입니다."); return; }
```

### 5.3 datetime-local ↔ timestamptz 변환 (자주 틀리는 부분)

```ts
/** DB(ISO UTC) → <input type="datetime-local"> 값 (로컬 시각 문자열) */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** <input> 값 → DB 에 넣을 ISO 문자열 */
function fromLocalInput(v: string): string {
  return new Date(v).toISOString();
}

/** 새 일정의 기본 시작값 = 다음 정시 */
function nextHourLocal(): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return toLocalInput(d);
}
```

### 5.4 생성 함수 + 알림

```ts
export async function createMeeting(
  input: MeetingInput, createdBy: string,
): Promise<Meeting | null> {
  const { data, error } = await supabase!
    .from("meetings")
    .insert({ ...input, created_by: createdBy })
    .select().single();
  if (error || !data) return null;

  const creatorName = await getActorName(createdBy);
  await notify({
    type: "new_meeting",
    workspace_id: data.workspace_id,
    actor_id: createdBy,               // 본인은 자동 제외
    title: "📅 새 일정",
    body: `${creatorName} 님이 「${data.title}」 일정을 등록했어요.`,
    url: `/meetings/${data.id}`,
    tag: `meeting-${data.id}`,
    // target_user_ids 없음 → 워크스페이스 전체 멤버
  });
  return data as Meeting;
}
```

---

## 6. 작성 흐름 ② 회의록 작성 — 폼 필드 하나하나

이 화면이 **이 문서 전체의 핵심**이다. 회의록과 할일 배정이 한 폼에서 같이 일어난다.

### 6.1 화면 전체 구조

```
┌───────────────────────────────────────────────────────────┐
│  MEETING NOTE                                             │
│  8월 셋째주 정기모임              ← 제목 자동 (편집 불가) │
├───────────────────────────────────────────────────────────┤
│  연결                                                     │
│  [ 8/20 19:00 · 8월 셋째주 정기모임          ▾ ]          │  ← 일정 셀렉트
├───────────────────────────────────────────────────────────┤
│  아젠다                                                   │
│   1. [ 하반기 목표 점검              ] ×                  │
│   2. [ 신규 채널 운영안              ] ×                  │
│   + 아젠다 추가                                           │
├───────────────────────────────────────────────────────────┤
│  회의 내용                                                │
│  본문                                                     │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ (리치 에디터 — 아젠다 별로 정리한 토론 내용)        │  │
│  └─────────────────────────────────────────────────────┘  │
├───────────────────────────────────────────────────────────┤
│  할일                                                     │
│  회의 결과로 정해진 액션 아이템. 저장 시 회의록에 연결된  │
│  할일로 등록됩니다.                                       │
│                                                           │
│  ┌ 전체 과제 · 모든 멤버에게 일괄 배정 ─────────────────┐ │
│  │ [ 다음 모임 전까지 책 1챕터 읽기 ] [8/27] [6명에 추가]│ │
│  └──────────────────────────────────────────────────────┘ │
│                                                           │
│   [ 8월 매출 자료 정리    ][ 김대표 ▾ ][ 8/25 ] ×         │  ← 내용·담당자·기한
│   [ 채널 운영안 초안      ][ 박이사 ▾ ][ 8/27 ] ×         │
│   + 할일 추가    + 기존 할일 불러오기                     │
├───────────────────────────────────────────────────────────┤
│  [임시저장]              [취소] [삭제] [회의록 작성]      │
└───────────────────────────────────────────────────────────┘
```

### 6.2 섹션별 상세

#### (1) 연결 — 어느 일정의 회의록인가

```tsx
<Section title="연결">
  <select
    value={meetingId ?? ""}
    onChange={(e) => setMeetingId(e.target.value || null)}
    className={inputClass}
    aria-label="연결된 일정"
  >
    {/* ★ 이 옵션이 반드시 있어야 한다 — 조합 B 를 지원 */}
    <option value="">— 일정 미연결 (카톡 등) —</option>
    {meetings.map((m) => (
      <option key={m.id} value={m.id}>
        {formatShortDate(m.starts_at)} {formatTime(m.starts_at)} · {m.title}
      </option>
    ))}
  </select>
</Section>
```

- 일정 상세에서 `+ 회의록 작성` 으로 들어오면 `?meeting=<id>` 쿼리로 **미리 선택**된다.
- 여기서 선택한 일정이 곧 **할일들의 `meeting_id`** 가 된다.

#### (2) 아젠다 — 안건 목록

```tsx
<Section title="아젠다">
  <ul className="space-y-2">
    {agendaItems.map((item, i) => (
      <li key={i} className="flex items-center gap-2">
        <span className="text-xs text-foreground-faint w-6 shrink-0 text-right tabular-nums">
          {i + 1}.
        </span>
        <input
          value={item}
          onChange={(e) => updateAgenda(i, e.target.value)}
          placeholder="안건"
          className={inputClass}
        />
        <button
          type="button"
          onClick={() => removeAgenda(i)}
          aria-label="아젠다 삭제"
          className="text-xl leading-none text-foreground-faint hover:text-danger px-2 -mr-2 disabled:opacity-30"
          disabled={agendaItems.length === 1 && !agendaItems[0]}
        >
          ×
        </button>
      </li>
    ))}
  </ul>
  <button type="button" onClick={addAgenda}
          className="mt-3 text-xs text-foreground-muted hover:text-foreground">
    + 아젠다 추가
  </button>
</Section>
```

상태 관리 3함수 (배열 편집의 표준 패턴 — 할일 줄에도 똑같이 쓴다):

```ts
function updateAgenda(i: number, value: string) {
  setAgendaItems((items) => items.map((v, idx) => (idx === i ? value : v)));
}
function addAgenda() {
  setAgendaItems((items) => [...items, ""]);
}
function removeAgenda(i: number) {
  // 마지막 한 줄은 지우지 않고 비운다 — 입력칸이 0개가 되면 UI 가 사라져 어색하다
  setAgendaItems((items) => (items.length === 1 ? [""] : items.filter((_, idx) => idx !== i)));
}
```

#### (3) 회의 내용 — 본문

리치 에디터. 플레이스홀더는 **무엇을 적어야 하는지 알려주는 문장**으로:

```tsx
<RichEditor
  value={content}
  onChange={setContent}
  placeholder="아젠다 별로 정리한 토론 내용을 적습니다."
  minHeight={240}
/>
```

#### (4) 할일 — 액션 아이템 (★ 핵심)

섹션 부제로 **저장하면 무슨 일이 일어나는지** 명시한다:

```tsx
<Section
  title="할일"
  subtitle="회의 결과로 정해진 액션 아이템. 저장 시 회의록에 연결된 할일로 등록됩니다."
>
```

한 줄의 데이터 모양:

```ts
export type ActionItemDraft = {
  /** 기존 할일이면 그 id, 새로 입력한 줄이면 null */
  id: string | null;
  title: string;
  assignee_id: string | null;
  /** YYYY-MM-DD 또는 빈 문자열 */
  due_date: string;
};

function emptyAction(): ActionItemDraft {
  return { id: null, title: "", assignee_id: null, due_date: "" };
}
```

편집 모드로 들어올 때는 기존 할일로 줄을 채운다:

```ts
const [actions, setActions] = useState<ActionItemDraft[]>(() => {
  const seeded = (initialTasks ?? []).map<ActionItemDraft>((t) => ({
    id: t.id,                                        // ★ 기존 id 유지 → keep 으로 분류됨
    title: t.title,
    assignee_id: t.assignee_id,
    due_date: t.due_date ? t.due_date.slice(0, 10) : "",   // ISO → YYYY-MM-DD
  }));
  return seeded.length > 0 ? seeded : [emptyAction()];
});
```

행 렌더 — **모바일에서는 제목 아래 한 줄, 데스크탑에서는 4열 그리드**:

```tsx
<li
  key={row.id ?? `new-${i}`}
  className="space-y-2 sm:space-y-0 sm:grid sm:grid-cols-[1fr_160px_140px_auto] sm:gap-2 sm:items-center"
>
  <input
    value={row.title}
    onChange={(e) => updateAction(i, { title: e.target.value })}
    placeholder="내용"
    className={inputClass}
  />
  {/* 모바일에선 아래 3개를 한 줄로 묶고, sm+ 에선 sm:contents 로 래퍼를 없애
      각 컨트롤이 바깥 그리드의 직접 자식이 되게 한다 */}
  <div className="grid grid-cols-[1fr_auto_auto] gap-2 sm:contents">
    <select
      value={row.assignee_id ?? ""}
      onChange={(e) => updateAction(i, { assignee_id: e.target.value || null })}
      className={inputClass}
      aria-label="담당자"
    >
      <option value="">담당자 미지정</option>
      {members.map((m) => (
        <option key={m.user_id} value={m.user_id}>
          {m.profile.name ?? m.profile.email}
        </option>
      ))}
    </select>
    <input
      type="date"
      value={row.due_date}
      onChange={(e) => updateAction(i, { due_date: e.target.value })}
      className={`${inputClass} w-32 sm:w-auto`}
      aria-label="기한"
    />
    <button
      type="button"
      onClick={() => removeAction(i)}
      aria-label="할일 삭제"
      className="text-xl leading-none text-foreground-faint hover:text-danger px-2 sm:px-0 sm:w-8 sm:text-right disabled:opacity-30"
      disabled={actions.length === 1 && !row.title && !row.assignee_id && !row.due_date}
    >
      ×
    </button>
  </div>
</li>
```

> `sm:contents` 트릭 — 모바일에선 래퍼 div 가 3개를 한 줄로 묶고, `sm:` 이상에선
> `display: contents` 로 래퍼가 사라져 자식들이 바깥 그리드의 열에 그대로 배치된다.
> DOM 구조 하나로 두 레이아웃을 만든다.

#### (5) 전체 과제 — 모든 멤버에게 일괄 배정

"다음 모임까지 각자 책 1챕터 읽기" 처럼 **같은 일을 전원에게** 배정하는 경우가 잦다.
한 번에 N줄을 만들어 준다.

```tsx
function BulkAssignForm({ members, onAdd }: {
  members: MemberWithProfile[];
  onAdd: (rows: ActionItemDraft[]) => void;
}) {
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");

  function handleAdd() {
    const t = title.trim();
    if (!t || members.length === 0) return;
    // ★ 멤버 수만큼 행을 만든다 — 각각 다른 assignee_id, 같은 title/due
    const rows: ActionItemDraft[] = members.map((m) => ({
      id: null, title: t, assignee_id: m.user_id, due_date: due,
    }));
    onAdd(rows);
    setTitle("");
    setDue("");
  }

  return (
    <div className="border border-line p-4 space-y-3 bg-surface-muted">
      <p className="label">전체 과제 · 모든 멤버에게 일괄 배정</p>
      <div className="space-y-2 sm:space-y-0 sm:grid sm:grid-cols-[1fr_140px_auto] sm:gap-2 sm:items-center">
        <input value={title} onChange={(e) => setTitle(e.target.value)}
               placeholder="예: 다음 모임 전까지 책 1챕터 읽기" className={inputClass} />
        <input type="date" value={due} onChange={(e) => setDue(e.target.value)}
               className={`${inputClass} w-32 sm:w-auto`} aria-label="기한" />
        <button type="button" onClick={handleAdd}
                disabled={!title.trim() || members.length === 0}
                className="bg-accent-teal text-accent-foreground px-4 py-2 text-xs hover:bg-accent-teal/85 disabled:opacity-60">
          멤버 {members.length}명에게 추가
        </button>
      </div>
    </div>
  );
}
```

**결과**: 6명 워크스페이스면 할일 6개가 생기고, 알림도 **6명에게 각각** 간다.

#### (6) 기존 할일 불러오기 — 이미 있는 할일을 이 회의록에 연결

지난 회의에서 넘어온 할일이나 개인이 만든 할일을 이번 회의록에 붙일 때 쓴다.

```tsx
function ExistingTaskPanel({ candidates, members, onAdd, onClose }) {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  function handleAdd() {
    const rows: ActionItemDraft[] = candidates
      .filter((t) => checked.has(t.id))
      .map((t) => ({
        id: t.id,                                     // ★ id 를 유지 → keep 으로 분류
        title: t.title,
        assignee_id: t.assignee_id,
        due_date: t.due_date ? t.due_date.slice(0, 10) : "",
      }));
    if (rows.length === 0) return;
    onAdd(rows);
    setChecked(new Set());
    onClose();
  }
  // ... 체크박스 목록 렌더 (다른 회의록에 연결된 건 "· 다른 회의록에 연결됨" 표시)
}
```

후보 목록에서 **이미 이 폼에 올라온 할일은 제외**한다:

```ts
const candidates = (workspaceTasks ?? []).filter(
  (t) => !actions.some((a) => a.id === t.id),
);
```

추가할 때 빈 첫 줄이 있으면 그 자리를 대체한다 (빈 줄이 위에 남으면 지저분):

```ts
onAdd={(rows) =>
  setActions((prev) => {
    const base = prev.length === 1 && !prev[0].title && !prev[0].id ? [] : prev;
    return base.concat(rows);
  })
}
```

### 6.3 제출 — 폼이 부모에게 넘기는 것

`onSubmit` 은 **두 개의 인자**를 받는다. 회의록 값과 할일 목록이 분리돼 있다.

```ts
async function handleSubmit(e: FormEvent) {
  e.preventDefault();
  setBusy(true);
  setError(null);

  const agendaText =
    agendaItems.map((s) => s.trim()).filter(Boolean).join("\n") || null;
  const title = initial?.title ?? autoTitle(meetingId, meetings);

  // ★ 제목이 빈 줄은 버린다 (담당자만 고르고 내용 안 적은 줄)
  const filteredActions = actions
    .map((a) => ({ ...a, title: a.title.trim() }))
    .filter((a) => a.title.length > 0);

  try {
    await onSubmit(
      { meeting_id: meetingId, title, agenda: agendaText,
        content: content.trim() || null, summary: null },
      filteredActions,
    );
    clearDraft();
  } catch (err) {
    setError((err as Error).message || "저장 중 오류가 발생했습니다.");
    setBusy(false);
  }
}
```

### 6.4 임시저장 (선택이지만 강력 추천)

회의록은 길다. 실수로 페이지를 나가면 다 날아간다. **수동** 임시저장을 붙인다
(자동 저장은 "언제 저장됐는지" 를 사용자가 모르게 만들어 오히려 불안하다).

```ts
const { draft, save: saveDraft, clear: clearDraft, savedAt } = useDraft<{
  meetingId: string | null;
  agendaItems: string[];
  content: string;
  actions: ActionItemDraft[];
}>(draftKey ?? null);

// draftKey 예시 — 새 글과 편집을 구분하고, 사용자별로 격리
//   새 회의록: `note-draft:new:${workspace.id}:${user.id}`
//   편집:      `note-draft:${note.id}:${user.id}`
```

폼 상단에 복구 배너, 하단 좌측에 저장 버튼 + `savedAt` 표시. 제출 성공 시 `clearDraft()`.

---

## 7. 작성 흐름 ③ 할일 배정 — `syncTasksForNote` 알고리즘

### 7.1 문제 정의

회의록 편집 화면에서 사용자는 할일 줄을 **추가/수정/삭제**한다. 저장 시 DB 를
그 상태와 똑같이 맞춰야 한다. 단순 "전부 지우고 다시 만들기"는 안 된다 —
그러면 할일 id 가 바뀌어서 **댓글·좋아요·완료 상태가 전부 날아간다.**

### 7.2 3분류 규칙

폼에서 넘어온 `ActionItemDraft[]` 를 `id` 유무로 나눈다.

```
draft.id 가 있다  →  keep    : 기존 할일. patch 로 업데이트 (id 유지 → 댓글/좋아요 보존)
draft.id 가 없다  →  create  : 새 할일. insert + 담당자에게 알림
DB 엔 있는데 폼엔 없다 → delete : 사용자가 × 로 지운 줄
```

호출부에서 `keep` / `create` 로 미리 갈라서 넘긴다:

```ts
await syncTasksForNote(
  note.id,
  workspace.id,
  updated.meeting_id,      // 회의록이 연결된 일정 → 할일에 상속
  user.id,
  {
    keep: actions
      .filter((a) => a.id)
      .map((a) => ({
        id: a.id!,
        patch: {
          title: a.title,
          assignee_id: a.assignee_id,
          due_date: a.due_date ? new Date(a.due_date).toISOString() : null,
          meeting_id: updated.meeting_id,     // ★ 일정이 바뀌었으면 여기서 따라 바뀐다
        },
      })),
    create: actions
      .filter((a) => !a.id)
      .map((a) => ({
        title: a.title,
        assignee_id: a.assignee_id,
        due_date: a.due_date ? new Date(a.due_date).toISOString() : null,
      })),
  },
);
```

### 7.3 구현

```ts
/**
 * 회의록에 연결된 할일 목록을 폼 상태와 일치시킨다.
 *
 *  - existing 에는 있는데 keep 에 없는 것 → 삭제
 *  - keep      → update (note_id 를 이 노트로 강제 설정)
 *  - create    → insert (+ 담당자에게 new_task 푸시)
 */
export async function syncTasksForNote(
  noteId: string,
  workspaceId: string,
  meetingId: string | null,
  createdBy: string,
  rows: {
    keep: { id: string; patch: TaskPatch }[];
    create: { title: string; assignee_id: string | null; due_date: string | null }[];
  },
): Promise<void> {
  const existing = await getTasksForNote(noteId);
  const keepIds = new Set(rows.keep.map((r) => r.id));

  // ① 유지 목록에 없는 기존 할일 삭제
  for (const t of existing) {
    if (!keepIds.has(t.id)) {
      await deleteTask(t.id);
    }
  }

  // ② 유지되는 할일 업데이트.
  //    note_id 를 이 노트로 강제 설정하는 게 핵심 —
  //    "기존 할일 불러오기" 로 다른 노트/무연결 할일을 끌어왔을 때
  //    실제로 이 회의록에 연결되도록 만든다.
  for (const k of rows.keep) {
    await updateTask(k.id, { ...k.patch, note_id: noteId });
  }

  // ③ 새 할일 생성 — createTask 안에서 담당자에게 알림이 나간다
  for (const c of rows.create) {
    await createTask(
      {
        workspace_id: workspaceId,
        title: c.title,
        assignee_id: c.assignee_id,
        due_date: c.due_date,
        meeting_id: meetingId,     // 회의록의 일정을 상속
        note_id: noteId,
      },
      createdBy,
    );
  }
}
```

### 7.4 순서가 중요한 이유

**반드시 삭제 → 수정 → 생성 순.** 생성을 먼저 하면 방금 만든 할일이 `existing` 에 없어서
(이미 조회한 스냅샷) 문제는 없지만, `existing` 을 루프 중에 다시 조회하는 구현으로 바꿨을 때
새 할일이 곧바로 삭제되는 버그가 난다. 순서를 고정해 두면 안전하다.

### 7.5 새 회의록 작성 시에도 같은 함수를 쓴다

새로 만드는 경우엔 `existing` 이 비어 있으므로 삭제 단계가 자연히 no-op 이 된다.
분기할 필요가 없다.

```ts
const created = await createNote({ ...values, workspace_id: workspace.id }, user.id);
if (!created) throw new Error("회의록 생성에 실패했습니다.");

await syncTasksForNote(created.id, workspace.id, created.meeting_id, user.id, {
  keep:   /* "기존 할일 불러오기" 로 끌어온 것들 */,
  create: /* 새로 입력한 줄들 */,
});
navigate(`/notes/${created.id}`);
```

### 7.6 성능 메모

루프 안에서 순차 await 라 할일 N개면 쿼리가 N번 돈다. 회의록 하나에 할일이 보통 3~10개라
문제되지 않는다. 20개를 넘기는 워크스페이스라면 `Promise.all` 로 묶되, **알림 순서가
뒤섞이는 것**만 감안하면 된다.

```ts
// 대량일 때
await Promise.all(rows.create.map((c) => createTask({ ... }, createdBy)));
```

---

## 8. 할일을 회의 없이 그냥 만드는 경로

`/tasks` 화면 상단의 `+ 할일 추가` → 인라인 퀵애드 폼.

```tsx
<TaskQuickAddForm
  members={members ?? []}
  defaultAssigneeId={user.id}      // ★ 기본 담당자 = 나 (가장 흔한 케이스)
  onCreate={async (input) => {
    await createTask(
      {
        workspace_id: workspace.id,
        title: input.title,
        assignee_id: input.assignee_id,
        due_date: input.due_date,
        // meeting_id / note_id 를 넘기지 않는다 → null (조합 C)
      },
      user.id,
    );
    bump();          // refreshKey++ 로 목록 재조회
    setAddOpen(false);
  }}
  onClose={() => setAddOpen(false)}
/>
```

퀵애드 폼 자체는 **제목 + 담당자 + 기한** 3개만 받는다. 상세 내용/첨부는 상세 화면에서.

```tsx
<form onSubmit={handleSubmit} className="border border-line p-4 space-y-3">
  <input value={title} onChange={...} placeholder="할 일 내용을 입력하세요."
         className={inputClass} autoFocus />
  <div className="grid gap-3 sm:grid-cols-2">
    <div>
      <label className={labelClass}>담당자</label>
      <select value={assigneeId ?? ""} onChange={...} className={`${inputClass} mt-1`}>
        <option value="">미지정</option>
        {members.map((m) => (
          <option key={m.user_id} value={m.user_id}>
            {m.profile.name ?? m.profile.email}
          </option>
        ))}
      </select>
    </div>
    <div>
      <label className={labelClass}>기한</label>
      <input type="date" value={dueDate} onChange={...} className={`${inputClass} mt-1`} />
    </div>
  </div>
  <div className="flex justify-end gap-2">
    <button type="button" onClick={onClose} className="border border-line-strong px-4 py-2 text-xs ...">닫기</button>
    <button type="submit" disabled={busy || !title.trim()}
            className="bg-accent-teal text-accent-foreground px-4 py-2 text-xs ...">
      {busy ? "저장 중..." : "할일 추가"}
    </button>
  </div>
</form>
```

기한 변환에 주의 — `<input type="date">` 값은 `YYYY-MM-DD` 문자열이다:

```ts
due_date: dueDate ? new Date(dueDate).toISOString() : null,
```

---

## 9. 알림 — 저장 버튼 한 번에 무슨 알림이 몇 개 나가나

### 9.1 이 흐름에서 쓰는 알림 종류 3개

| type | 언제 | 누구에게 | 문구 |
| --- | --- | --- | --- |
| `new_meeting` | 일정 등록 | **전체 멤버** (등록자 제외) | `📅 새 일정` / `○○ 님이 「제목」 일정을 등록했어요.` |
| `new_note` | 회의록 생성 | **전체 멤버** (작성자 제외) | `📝 새 회의록` / `○○ 님이 「제목」 회의록을 작성했어요.` |
| `new_task` | 할일 생성 시 담당자 지정 / 담당자 변경 | **담당자 1명** | `📝 새 할일` / `○○ 님이 회원님께 「제목」을 배정했어요.` |
| `task_completed` | 할일 done 전환 | **전체 멤버** (완료한 사람 제외) | `✅ 할일 완료` / `○○ 님이 「제목」을 완료했어요.` |

### 9.2 실제 발송 시뮬레이션

**전제**: 워크스페이스 멤버 6명 (김대표=작성자, 박이사, 이팀장, 최과장, 정대리, 한사원).
김대표가 회의록을 쓰면서 할일 4개를 배정한다.

| 할일 | 담당자 |
| --- | --- |
| 8월 매출 자료 정리 | 박이사 |
| 채널 운영안 초안 | 이팀장 |
| 계약서 검토 | 김대표 (본인) |
| 다음 모임 전까지 책 1챕터 (전체 과제) | 6명 각각 |

`회의록 작성` 버튼 한 번 → 나가는 푸시:

```
createNote()
  └ new_note  → 박이사·이팀장·최과장·정대리·한사원  (5명, 김대표 제외)   … 5건

syncTasksForNote() → createTask() × 9
  ├ 매출 자료(박이사)   → new_task → 박이사                              … 1건
  ├ 채널 초안(이팀장)   → new_task → 이팀장                              … 1건
  ├ 계약서(김대표)      → new_task → (actor_id === 담당자 → 서버가 제외)  … 0건
  └ 전체 과제 6건       → new_task → 김대표 제외 5명                      … 5건
                                                          ─────────────────
                                                          합계 12건
```

**핵심 규칙 3개**:
1. `actor_id` 를 항상 넘긴다 → 서버가 본인을 자동 제외한다. 안 넘기면 **자기가 만든 할일 알림을 자기가 받는다.**
2. 담당자가 `null` 인 할일은 알림이 **안 간다** (`if (data.assignee_id)` 가드).
3. 전체 과제 6건은 알림이 6번 나간다. 소음이라고 생각되면 `tag` 를 공유시켜 폰에서 1개로 합칠 수 있다:
   `tag: "task-bulk-<noteId>"` — 다만 각자 다른 사람에게 가므로 실제로는 각 1개씩 보인다.

### 9.3 코드 — 할일 생성 시 알림

```ts
// createTask 안, insert 직후
if (data && (data as Task).assignee_id) {
  const t = data as Task;
  const name = await getActorName(createdBy);
  await notify({
    type: "new_task",
    workspace_id: t.workspace_id,
    actor_id: createdBy,               // ★ 본인이 본인에게 배정한 건 서버가 걸러냄
    title: "📝 새 할일",
    body: `${name} 님이 회원님께 「${t.title}」을 배정했어요.`,
    url: `/tasks/${t.id}`,             // ★ 알림 클릭 → 할일 상세로 바로 이동
    tag: `task-${t.id}`,
    target_user_ids: [t.assignee_id!], // ★ 담당자 1명에게만
  });
}
```

### 9.4 코드 — 재배정 알림 (담당자가 바뀔 때)

`updateTask` 안에서 **변경 전 값을 먼저 읽어** 비교한다.

```ts
// 업데이트 전 스냅샷
const { data: prev } = await supabase!
  .from("tasks").select("status, completed_at, assignee_id")
  .eq("id", id).maybeSingle();
const prevAssignee = (prev as any)?.assignee_id ?? null;

// ... update 실행 ...

// 담당자가 실제로 바뀌었을 때만
if (
  Object.prototype.hasOwnProperty.call(patch, "assignee_id") &&
  updated.assignee_id &&
  updated.assignee_id !== prevAssignee
) {
  const name = await getActorName(actor);
  await notify({
    type: "new_task",
    workspace_id: updated.workspace_id,
    actor_id: actor,
    title: "🔄 할일 담당자 변경",
    body: `${name} 님이 「${updated.title}」을 회원님께 넘겼어요.`,
    url: `/tasks/${updated.id}`,
    tag: `task-assign-${updated.id}-${updated.assignee_id}`,
    target_user_ids: [updated.assignee_id],
  });
}
```

> ⚠️ **주의** — `syncTasksForNote` 의 `keep` 경로는 매번 `updateTask` 를 부른다.
> 담당자를 안 바꿨는데도 알림이 나가면 안 되므로, 위처럼 `prevAssignee` 와 **다를 때만**
> 보내는 가드가 필수다. 밋업 현재 코드에는 재배정 알림 자체가 없어서 이 문제가 없지만,
> 추가할 땐 반드시 이 가드와 함께.

### 9.5 코드 — 완료 알림

```ts
const wasDone = (prev as any)?.status === "done";
const justCompleted = !wasDone && updated.status === "done";

if (justCompleted) {
  await recordActivity({
    workspace_id: updated.workspace_id,
    action: "completed_task",
    resource_type: "task",
    resource_id: updated.id,
    metadata: { title: updated.title },
  }, actor);

  const name = await getActorName(actor);
  await notify({
    type: "task_completed",
    workspace_id: updated.workspace_id,
    actor_id: actor,
    title: "✅ 할일 완료",
    body: `${name} 님이 「${updated.title}」을 완료했어요.`,
    url: `/tasks/${updated.id}`,
    tag: `task-${updated.id}-done`,
    // target 없음 → 전체 멤버. "우리 팀이 굴러가고 있다" 는 신호를 공유
  });
}
```

**`actor` 를 정확히 잡는 게 중요하다.** 운영자가 남의 할일을 대신 완료 처리할 수 있기 때문:

```ts
export type UpdateTaskOpts = { actorId?: string };

const actor = opts?.actorId ?? updated.assignee_id ?? updated.created_by;
```

화면에서는 항상 명시적으로 넘긴다:

```ts
await updateTask(task.id, { status: "done" }, { actorId: user.id });
```

---

## 10. 역참조 맵 — 이 데이터가 어느 화면 어디에 뜨는가

**한 장 요약**

| # | 화면 | 경로 | 보여주는 것 | 쿼리 |
| --- | --- | --- | --- | --- |
| 1 | 일정 목록 | `/meetings` | 일정 카드 (제목·시간·장소·종류) | `getWorkspaceMeetings(wsId)` |
| 2 | 캘린더 | `/calendar` | 월 그리드 위 일정 점 | 같음 |
| 3 | **일정 상세** | `/meetings/:id` | 일시/장소 + **할일 진행률 바** + **회의록 목록** | `getMeeting` + `getNotesForMeeting` + `getTasks().filter(meeting_id)` |
| 4 | 회의록 목록 | `/notes` | 제목·작성일·본문 미리보기 + **할일 진행률 (compact)** | `getWorkspaceNotes` + `getTasks` |
| 5 | **회의록 상세** | `/notes/:id` | 연결 일정 · 아젠다 · 본문 · **할일 리스트(담당·기한·완료)** | `getNote` + `getTasksForNote` + `getProfiles` |
| 6 | 할일 목록 | `/tasks` | 전체 / **내 할일** 탭, 담당자·상태 필터 | `getTasks({ workspaceId })` |
| 7 | 할일 상세 | `/tasks/:id` | 담당자·기한·작성자 + **↗회의록 링크** + 댓글/좋아요 | `getTaskById` + `getNote(note_id)` |
| 8 | 대시보드 · 확인이 필요한 일 | `/dashboard` | 오늘/지난 마감 내 할일 상위 5건 | `getTasks({ assigneeId: me })` |
| 9 | 대시보드 · 내 할일 | `/dashboard` | 지연/오늘/이번주/나중/기한없음 **버킷** | 같음 |
| 10 | 활동 피드 | `/activity` | `completed_task` 등 활동 로그 | `getWorkspaceActivities` |
| 11 | 멤버 상세 | `/members/:id` | (현재 없음 — §10.9 에서 추가) | `getTasks({ assigneeId: id })` |

아래에서 하나씩 코드로 본다.

### 10.1 일정 상세 — 할일 진행률 + 회의록 목록

```tsx
// 이 일정에서 나온 할일 (note 를 거치지 않고 meeting_id 로 직접)
const { data: meetingTasks } = useAsync(
  () => (id
    ? getTasks({ workspaceId: workspace?.id ?? "" })
        .then((rows) => rows.filter((t) => t.meeting_id === id))
    : Promise.resolve([])),
  [id, workspace?.id, refreshKey],
);

// 이 일정에 딸린 회의록들
const { data: notes } = useAsync(
  () => (id ? getNotesForMeeting(id) : Promise.resolve([])),
  [id, refreshKey],
);
```

렌더:

```tsx
{/* 할일이 하나라도 있을 때만 — 0건일 때 빈 박스가 뜨면 어수선하다 */}
{(meetingTasks ?? []).length > 0 && (
  <section>
    <p className="label mb-3">할일 · {(meetingTasks ?? []).length}</p>
    <TaskProgress
      done={(meetingTasks ?? []).filter((t) => t.status === "done").length}
      total={(meetingTasks ?? []).length}
    />
  </section>
)}

<section>
  <div className="mb-4 flex items-baseline justify-between border-b border-line pb-3">
    <h2 className="text-base">회의록 · {noteList.length}</h2>
    {/* ★ 여기가 회의록 작성 진입점 — meeting 을 쿼리로 넘겨 미리 선택되게 한다 */}
    <Link to={`/notes/new?meeting=${meeting.id}`}
          className="text-xs text-foreground-muted hover:text-foreground">
      + 회의록 작성
    </Link>
  </div>
  {noteList.length === 0 ? (
    <p className="border-b border-line py-10 text-center text-sm text-foreground-faint">
      아직 이 일정에 작성된 회의록이 없습니다.
    </p>
  ) : (
    <ul className="divide-y divide-line border-b border-line">
      {noteList.map((n) => (
        <li key={n.id}>
          <Link to={`/notes/${n.id}`} className="block py-4 hover:bg-surface-muted -mx-2 px-2 transition-colors">
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-sm">{n.title}</p>
              <span className="text-xs text-foreground-faint shrink-0">
                {formatShortDateTime(n.created_at)}
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )}
</section>
```

### 10.2 `TaskProgress` — 진행률 바 컴포넌트

일정 상세·회의록 목록·회의록 상세 3곳에서 재사용한다. 아래는 최소판이고,
**라벨 · 지연 건수 뱃지 · 100% 반올림 보정이 들어간 확장판은 §11.5** 에 있다.
새로 만든다면 확장판부터 쓰는 게 낫다.

```tsx
type Props = {
  done: number;
  total: number;
  /** 리스트 행 안에서 쓸 축소판 (박스 없음, 작은 글씨) */
  compact?: boolean;
};

export function TaskProgress({ done, total, compact = false }: Props) {
  if (total === 0) return null;             // ★ 0건이면 아예 렌더하지 않는다
  const pct = Math.round((done / total) * 100);

  if (compact) {
    return (
      <div>
        <div className="flex items-baseline justify-between gap-2 text-[11px] text-foreground-muted mb-1 tabular-nums">
          <span>{done}/{total}</span>
          <span className="text-foreground">{pct}%</span>
        </div>
        <div className="h-1 bg-line">
          <div className="h-full bg-accent-teal transition-all"
               style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
        </div>
      </div>
    );
  }

  return (
    <div className="border border-accent-teal/40 bg-accent-teal/[0.03] px-4 py-3">
      <div className="flex items-baseline justify-between gap-2 text-xs text-foreground-muted mb-1.5 tabular-nums">
        <span>{done}/{total}</span>
        <span className="text-foreground">{pct}%</span>
      </div>
      <div className="h-1 bg-line">
        <div className="h-full bg-accent-teal transition-all"
             style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
      </div>
    </div>
  );
}
```

### 10.3 회의록 목록 — 행마다 진행률

목록 화면에서 할일을 노트별로 **한 번에 집계**한다 (노트마다 쿼리를 날리면 N+1).

```tsx
const { data: tasks } = useAsync(
  () => (workspace ? getTasks({ workspaceId: workspace.id }) : Promise.resolve([])),
  [workspace?.id],
);

/** note_id 별 { done, total } 맵 — 한 번의 순회로 집계.
    (§11.4 의 progressBy(tasks, t => t.note_id) 로 대체 가능 — 지연 건수까지 같이 나온다) */
const progressByNote = useMemo(() => {
  const map = new Map<string, { done: number; total: number }>();
  (tasks ?? []).forEach((t) => {
    if (!t.note_id) return;
    const prev = map.get(t.note_id) ?? { done: 0, total: 0 };
    prev.total += 1;
    if (t.status === "done") prev.done += 1;
    map.set(t.note_id, prev);
  });
  return map;
}, [tasks]);

// 행 안에서
const p = progressByNote.get(n.id);
{p && <TaskProgress done={p.done} total={p.total} compact />}
```

### 10.4 회의록 상세 — 액션 아이템 리스트

```tsx
const { data: tasks } = useAsync(
  () => (id ? getTasksForNote(id) : Promise.resolve([])),
  [id],
);

// 담당자 프로필은 한 번에 묶어서 조회 (N+1 방지)
const assigneeIds = (tasks ?? [])
  .map((t) => t.assignee_id)
  .filter((x): x is string => !!x);
const { data: assigneeProfiles } = useAsync(
  () => getProfiles(assigneeIds),
  [assigneeIds.join(",")],       // ★ 배열은 deps 로 못 쓰니 문자열로 join
);
```

렌더 — 체크박스는 **읽기 전용 표시**(`<span>`)다. 상태 변경은 상세로 들어가서 한다:

```tsx
{(tasks ?? []).length > 0 && (
  <section>
    <div className="mb-4 space-y-3">
      <h2 className="label">할일 · {(tasks ?? []).length}</h2>
      <TaskProgress
        done={(tasks ?? []).filter((t) => t.status === "done").length}
        total={(tasks ?? []).length}
      />
    </div>
    <ul className="divide-y divide-line border-y border-line">
      {(tasks ?? []).map((t) => {
        const assignee = assigneeProfiles?.find((p) => p.user_id === t.assignee_id) ?? null;
        const done = t.status === "done";
        const overdue = t.due_date && !done && new Date(t.due_date).getTime() < Date.now();
        const assigneeName = assignee ? (assignee.name ?? assignee.email) : "미지정";
        const dueText = t.due_date ? formatShortDate(t.due_date) : "기한 없음";
        return (
          <li key={t.id}>
            <Link to={`/tasks/${t.id}`}
                  className={`block py-4 -mx-2 px-2 hover:bg-surface-muted transition-colors ${done ? "bg-surface-muted" : ""}`}>
              <div className="flex items-start gap-3 sm:items-center">
                <span aria-hidden title={done ? "완료" : "미완료"}
                      className={`size-5 mt-0.5 sm:mt-0 shrink-0 border flex items-center justify-center ${
                        done ? "border-accent-teal bg-accent-teal text-accent-foreground" : "border-line-strong"
                      }`}>
                  {done && <span className="text-xs leading-none">✓</span>}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <p className={`text-sm min-w-0 truncate max-w-full ${
                        done ? "line-through text-foreground-faint" : "text-foreground"}`}>
                      {t.title}
                    </p>
                    <span className={`shrink-0 text-[10px] uppercase tracking-wider ${
                        done ? "text-accent-teal" : "text-foreground-faint"}`}>
                      {done ? "완료" : "미완료"}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-foreground-muted">
                    <span>담당 · {assigneeName}</span>
                    <span className={overdue ? "text-danger" : ""}>기한 · {dueText}</span>
                  </div>
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
    <p className="mt-3 text-xs text-foreground-faint">
      행을 클릭하면 상세에서 상태 변경 · 본문 / 첨부 편집이 가능합니다.
    </p>
  </section>
)}
```

### 10.5 할일 목록 — 전체 / 내 할일 탭 + 필터

```tsx
type Tab = "all" | "mine";
type StatusFilter = "open" | "done" | "all";

// URL 로 진입점 제어: /tasks?scope=mine → "내 할일" 탭으로 열림
const [params] = useSearchParams();
const scope = params.get("scope");
const [tab, setTab] = useState<Tab>(scope === "mine" ? "mine" : "all");
useEffect(() => { setTab(scope === "mine" ? "mine" : "all"); }, [scope]);

// 한 번만 불러오고 클라이언트에서 필터 — 6명 규모에선 이게 가장 빠르다
const { data: tasks } = useAsync(
  () => (workspace ? getTasks({ workspaceId: workspace.id }) : Promise.resolve([])),
  [workspace?.id, refreshKey],
);

const tabFiltered = useMemo(
  () => (tab === "mine" ? list.filter((t) => t.assignee_id === user?.id) : list),
  [list, tab, user?.id],
);

const counts = useMemo(() => ({
  all: list.length,
  mine: list.filter((t) => t.assignee_id === user?.id).length,
}), [list, user?.id]);

const filtered = useMemo(() => tabFiltered
  .filter((t) => (tab === "all" && assigneeFilter ? t.assignee_id === assigneeFilter : true))
  .filter((t) => {
    if (statusFilter === "open") return t.status !== "done";
    if (statusFilter === "done") return t.status === "done";
    return true;
  })
  .sort(compareForList),
  [tabFiltered, tab, assigneeFilter, statusFilter]);

/** 완료는 항상 아래로, 그 외엔 최신 생성순 */
function compareForList(a: Task, b: Task): number {
  if (a.status === "done" && b.status !== "done") return 1;
  if (b.status === "done" && a.status !== "done") return -1;
  return b.created_at.localeCompare(a.created_at);
}
```

목록 행에서 **체크박스로 바로 완료 처리**가 된다 (`<Link>` 안의 버튼이므로 이벤트 차단 필수):

```tsx
<TaskRow
  key={t.id}
  task={t}
  members={members ?? []}
  onToggle={(next) => handleToggle(t, next)}
  noteLink={t.note_id ? `/notes/${t.note_id}` : null}   // ★ 회의록 역링크
/>

// TaskRow 내부
<button
  type="button"
  onClick={(e) => {
    e.preventDefault();     // ★ Link 이동 막기
    e.stopPropagation();
    if (onToggle) void onToggle(done ? "todo" : "done");
  }}
  className={`size-5 shrink-0 border flex items-center justify-center transition-colors ${
    done ? "border-accent-teal bg-accent-teal text-accent-foreground"
         : "border-line-strong hover:border-foreground"}`}
>
  {done && <span className="text-xs leading-none">✓</span>}
</button>
```

그리고 회의록으로 돌아가는 링크:

```tsx
{noteLink && (
  <Link to={noteLink} onClick={(e) => e.stopPropagation()}
        className="shrink-0 text-xs text-foreground-faint hover:text-accent-teal">
    ↗ 회의록
  </Link>
)}
```

### 10.6 할일 상세 — 메타 3칸 + 회의록 링크

```tsx
<section className="grid gap-px bg-surface-muted border border-line sm:grid-cols-3">
  <MetaCell label="담당자" person={assignee ?? { name: "미지정", avatar_url: null }} />
  <MetaCell label="기한" value={task.due_date ? formatFullDate(task.due_date) : "기한 없음"} />
  <MetaCell label="작성자" person={creator ?? { name: "—", avatar_url: null }} />
</section>

{/* 회의록에서 나온 할일이면 되돌아가는 링크 */}
{linkedNote && (
  <section className="border border-line">
    <Link to={`/notes/${linkedNote.id}`}
          className="flex items-center gap-3 px-4 py-3 hover:bg-surface-muted transition-colors">
      <span className="label shrink-0">회의록</span>
      <span className="text-sm truncate flex-1">{linkedNote.title}</span>
      <span aria-hidden className="text-foreground-faint">›</span>
    </Link>
  </section>
)}
```

> `gap-px` + `bg-surface-muted` 조합 — 셀 사이 1px 틈으로 배경색이 비쳐 보더처럼 보인다.
> 그림자 없이 격자를 만드는 MUJI 스타일 트릭.

편집 모드에서는 **회의록 연결도 바꿀 수 있다** (`notes` 셀렉트):

```tsx
<div>
  <label className={labelClass}>담당자</label>
  <select value={assigneeId ?? ""} onChange={(e) => setAssigneeId(e.target.value || null)}
          className={`${inputClass} mt-2`}>
    <option value="">미지정</option>
    {members.map((m) => (
      <option key={m.user_id} value={m.user_id}>{m.profile.name ?? m.profile.email}</option>
    ))}
  </select>
</div>
<div>
  <label className={labelClass}>기한</label>
  <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
         className={`${inputClass} mt-2`} />
</div>
```

### 10.7 대시보드 ① 「확인이 필요한 일」 패널

로그인하면 가장 먼저 보이는 카드. **오늘 마감 / 지난 마감 내 할일**을 위로 끌어올린다.

```tsx
// 미완료 내 할일 — 기한 빠른 순 (기한 없는 건 뒤로). 상위 5건.
const pendingTasks = useMemo(() => {
  return (myTasks ?? [])
    .filter((t) => t.status !== "done")
    .sort((a, b) => {
      const ad = a.due_date ?? "9999";     // ★ 기한 없는 건 문자열 비교상 맨 뒤
      const bd = b.due_date ?? "9999";
      return ad.localeCompare(bd);
    })
    .slice(0, 5);
}, [myTasks]);

<MyActionPanel
  pendingAgendas={pendingAgendas}
  pendingTasks={pendingTasks}
  draftCount={draftCount}
/>
```

패널 자체 — **항목이 0개면 통째로 사라진다** (빈 카드를 남기지 않는다):

```tsx
export function MyActionPanel({ pendingAgendas, pendingTasks, draftCount }: Props) {
  const total = pendingAgendas.length + pendingTasks.length + (draftCount > 0 ? 1 : 0);
  if (total === 0) return null;

  return (
    <section>
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="label">
          확인이 필요한 일{" "}
          <span className="ml-1 text-foreground-faint tabular-nums">{total}</span>
        </h2>
      </div>
      <ul className="border border-accent-teal/40 bg-accent-teal/[0.03] divide-y divide-line">
        {pendingTasks.map((t) => (
          <ActionRow
            key={t.id}
            to={`/tasks/${t.id}`}
            tag="할일"
            title={t.title}
            sub={taskDueLabel(t.due_date)}
            danger={taskOverdue(t.due_date)}
          />
        ))}
      </ul>
    </section>
  );
}

/** "3일 지남" / "오늘 마감" / "내일 마감" / "5일 남음" / "기한 없음" */
function taskDueLabel(due: string | null | undefined): string {
  if (!due) return "기한 없음";
  const dueDay = new Date(due);  dueDay.setHours(0, 0, 0, 0);
  const today  = new Date();     today.setHours(0, 0, 0, 0);
  const diff = Math.round((dueDay.getTime() - today.getTime()) / 86400000);
  if (diff < 0)  return `${Math.abs(diff)}일 지남`;
  if (diff === 0) return "오늘 마감";
  if (diff === 1) return "내일 마감";
  return `${diff}일 남음`;
}

function taskOverdue(due: string | null | undefined): boolean {
  if (!due) return false;
  return new Date(due).getTime() < Date.now();
}
```

### 10.8 대시보드 ② 「내 할일」 버킷 뷰

기한을 기준으로 5개 버킷으로 나눠 보여준다. 리스트를 쭉 나열하는 것보다 **지금 뭘 해야 하는지**가 즉시 읽힌다.

```tsx
type Bucket = "overdue" | "today" | "this_week" | "later" | "no_date";
const ORDER: Bucket[] = ["overdue", "today", "this_week", "later", "no_date"];
const BUCKET_LABEL: Record<Bucket, string> = {
  overdue: "지연", today: "오늘", this_week: "이번 주", later: "나중", no_date: "기한 없음",
};
const BUCKET_TONE: Record<Bucket, string> = {
  overdue:   "text-danger",
  today:     "text-accent-teal",
  this_week: "text-foreground",
  later:     "text-foreground-muted",
  no_date:   "text-foreground-faint",
};

function bucketFor(t: Task): Bucket {
  if (!t.due_date) return "no_date";
  const today = startOfDay(new Date());
  const due   = startOfDay(new Date(t.due_date));
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0)  return "overdue";
  if (diffDays === 0) return "today";
  if (diffDays <= 7)  return "this_week";
  return "later";
}

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function MyTasksPreview({ tasks }: { tasks: Task[] }) {
  const open = tasks.filter((t) => t.status !== "done");
  const grouped = new Map<Bucket, Task[]>();
  for (const t of open) {
    const b = bucketFor(t);
    if (!grouped.has(b)) grouped.set(b, []);
    grouped.get(b)!.push(t);
  }

  return (
    <section>
      <SectionHeader title="내 할일" href="/tasks" cta={`전체 ${tasks.length}건`} />
      {open.length === 0 ? (
        <EmptyRow message="할당된 할일이 없습니다." />
      ) : (
        <div className="divide-y divide-line border-b border-line">
          {ORDER.filter((b) => (grouped.get(b)?.length ?? 0) > 0).map((b) => (
            <div key={b} className="py-6">
              <p className={`text-xs font-medium ${BUCKET_TONE[b]} mb-4`}>
                {BUCKET_LABEL[b]}
                <span className="ml-1 font-normal text-foreground-faint">
                  · {grouped.get(b)!.length}
                </span>
              </p>
              <ul className="divide-y divide-line/50">
                {/* 버킷당 4건까지만, 나머지는 "그 외 N건 →" */}
                {grouped.get(b)!.slice(0, 4).map((t) => (
                  <li key={t.id}>
                    <Link to={`/tasks/${t.id}`}
                          className="grid grid-cols-[1fr_auto] items-center gap-3 py-3 hover:bg-surface-muted -mx-2 px-2 transition-colors">
                      <p className="text-sm truncate">{t.title}</p>
                      <span className={`text-xs shrink-0 ${
                          b === "overdue" ? "text-danger" : "text-foreground-faint"}`}>
                        {t.due_date ? formatShortDate(t.due_date) : "—"}
                      </span>
                    </Link>
                  </li>
                ))}
                {grouped.get(b)!.length > 4 && (
                  <li>
                    <Link to="/tasks?scope=mine"
                          className="block py-3 -mx-2 px-2 text-xs text-foreground-muted hover:text-foreground">
                      그 외 {grouped.get(b)!.length - 4}건 →
                    </Link>
                  </li>
                )}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
```

### 10.9 멤버 상세 — 담당 할일 (추가 권장)

밋업 현재 코드에는 **없다.** "각자 페이지에서도 할일이 보이게" 하려면 아래를 추가한다.
`/members/:id` 에 붙이면 "이 사람이 지금 뭘 맡고 있나" 를 한눈에 볼 수 있다.

```tsx
// src/pages/member-detail.tsx 에 추가

import { getTasks } from "@/lib/data/tasks";
import { TaskProgress } from "@/components/task-progress";
import { formatShortDate } from "@/lib/format";

const { data: memberTasks } = useAsync(
  () =>
    workspace && id
      ? getTasks({ workspaceId: workspace.id, assigneeId: id })
      : Promise.resolve([]),
  [workspace?.id, id],
);

const openTasks = (memberTasks ?? []).filter((t) => t.status !== "done");
const doneCount = (memberTasks ?? []).length - openTasks.length;
```

```tsx
{(memberTasks ?? []).length > 0 && (
  <section>
    <div className="mb-4 space-y-3">
      <h2 className="label">담당 할일 · {openTasks.length}건 진행 중</h2>
      <TaskProgress done={doneCount} total={(memberTasks ?? []).length} />
    </div>
    {openTasks.length === 0 ? (
      <p className="border-y border-line py-10 text-center text-sm text-foreground-faint">
        진행 중인 할일이 없습니다.
      </p>
    ) : (
      <ul className="divide-y divide-line border-y border-line">
        {openTasks.map((t) => {
          const overdue = t.due_date && new Date(t.due_date).getTime() < Date.now();
          return (
            <li key={t.id}>
              <Link to={`/tasks/${t.id}`}
                    className="flex items-center gap-3 py-4 -mx-2 px-2 hover:bg-surface-muted transition-colors">
                <span aria-hidden className="size-4 shrink-0 border border-line-strong" />
                <span className="min-w-0 flex-1 text-sm truncate">{t.title}</span>
                <span className={`shrink-0 text-xs tabular-nums ${
                    overdue ? "text-danger" : "text-foreground-muted"}`}>
                  {t.due_date ? formatShortDate(t.due_date) : "기한 없음"}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    )}
  </section>
)}
```

> **프라이버시 판단** — 이 앱은 6명짜리 한 팀이라 서로의 할일이 다 보이는 게 정상이다.
> 조직이 커지면 "본인 또는 운영자만" 으로 제한하는 조건을 추가한다:
> `const canSeeTasks = id === user.id || myRole === 'owner' || myRole === 'admin'`

### 10.10 활동 피드

푸시는 휘발되지만 `activities` 는 남는다. 할일 완료·회의록 작성 같은 사건을 시간순으로 본다.

```ts
// 도메인 함수에서 notify() 바로 앞에 같이 기록하는 게 규칙
await recordActivity({
  workspace_id: updated.workspace_id,
  action: "completed_task",           // 'created_meeting_note' | 'completed_task' | ...
  resource_type: "task",
  resource_id: updated.id,
  metadata: { title: updated.title },
}, actor);
```

---

## 11. 진행률 — 계산 · 표시 · 작성자

「할일 9개 중 3개 완료 · 33%」 같은 숫자가 회의록·일정·멤버 화면 곳곳에 나온다.
이 장은 **그 숫자를 어떻게 만들고, 어떤 축으로 자르고, 누가 시킨 일인지(작성자)를
어떻게 함께 보여주는지**를 정리한다.

### 11.1 대원칙 — 진행률은 저장하지 않는다

```
❌  meeting_notes.task_done_count / task_total_count 컬럼을 두고 갱신
✅  화면에서 tasks 를 읽어 그때그때 계산
```

카운트를 컬럼으로 두면 갱신 지점이 **할일 생성 · 삭제 · 완료 · 완료취소 · 회의록 재연결**
5곳으로 늘어나고, 하나만 빠뜨려도 영원히 어긋난 숫자가 화면에 남는다.
할일은 워크스페이스당 많아야 수백 건이라 매번 계산해도 체감 비용이 0이다.

> 수천 건 규모가 되면 §11.11 의 SQL 집계 뷰로 옮긴다. 그때도 **컬럼에 캐시하지 않고**
> 뷰/RPC 로 계산한다.

### 11.2 계산 공식과 두 가지 함정

```ts
const total = tasks.length;
const done  = tasks.filter((t) => t.status === "done").length;
const pct   = Math.round((done / total) * 100);
```

**함정 ①: `total === 0`** — `0/0` 은 `NaN` 이다. 컴포넌트 첫 줄에서 막는다.

```ts
if (total === 0) return null;      // 0건이면 진행률 UI 자체를 렌더하지 않는다
```

「0/0 · 0%」 를 보여주면 "할 일이 없다" 가 아니라 "아무도 안 했다" 로 읽힌다.

**함정 ②: 반올림 100%** — 99건 중 99건이 아닌 `199/200` 은 `99.5% → 100%` 로 반올림된다.
아직 남았는데 100% 로 보이면 신뢰가 깨진다. **100% 는 실제로 다 끝났을 때만.**

```ts
/** done === total 일 때만 100. 그 외엔 최대 99 로 묶는다. */
export function progressPct(done: number, total: number): number {
  if (total === 0) return 0;
  if (done >= total) return 100;
  return Math.min(99, Math.round((done / total) * 100));
}
```

### 11.3 5가지 집계 축

같은 `tasks` 배열을 무엇으로 묶느냐만 다르다.

| # | 축 | 키 | 답하는 질문 | 나오는 화면 |
| --- | --- | --- | --- | --- |
| 1 | 회의록별 | `note_id` | 이 회의에서 정한 일들이 얼마나 진행됐나 | 회의록 목록·상세 |
| 2 | 일정별 | `meeting_id` | 이 모임의 후속 조치가 끝났나 | 일정 상세 |
| 3 | **담당자별** | `assignee_id` | 각자 얼마나 하고 있나 | 멤버 상세, 팀 현황 |
| 4 | **작성자별** | `created_by` | **내가 배정한 일들이 굴러가고 있나** | 할일 「내가 배정」 탭 |
| 5 | 기간별 | `completed_at` | 이번 주에 몇 건 끝냈나 | 대시보드 주간 펄스 |

3번과 4번이 짝이다. 담당자 축은 **내가 할 일**, 작성자 축은 **내가 시킨 일**.
회의록을 쓰는 사람(보통 리더)에게는 4번이 실제로 더 자주 필요하다.

### 11.4 집계 유틸 — 한 번 순회로 Map 만들기

축이 5개라고 함수를 5개 만들지 않는다. **키 추출 함수만 갈아끼운다.**

```ts
// src/lib/task-progress.ts

import type { Task } from "@/lib/types/database";

export type Progress = {
  done: number;
  total: number;
  /** 미완료 중 기한이 지난 건수 */
  overdue: number;
};

const EMPTY: Progress = { done: 0, total: 0, overdue: 0 };

function isOverdue(t: Task): boolean {
  if (t.status === "done" || !t.due_date) return false;
  return new Date(t.due_date).getTime() < Date.now();
}

/** 배열 전체를 하나로 집계 */
export function progressOf(tasks: ReadonlyArray<Task>): Progress {
  let done = 0, overdue = 0;
  for (const t of tasks) {
    if (t.status === "done") done += 1;
    else if (isOverdue(t)) overdue += 1;
  }
  return { done, total: tasks.length, overdue };
}

/**
 * 키별로 묶어 집계. 한 번의 순회로 Map 을 만든다 (N+1 쿼리도, 중첩 filter 도 없음).
 * keyFn 이 null 을 반환하면 그 행은 제외된다.
 *
 *   progressBy(tasks, (t) => t.note_id)      // 회의록별
 *   progressBy(tasks, (t) => t.meeting_id)   // 일정별
 *   progressBy(tasks, (t) => t.assignee_id)  // 담당자별
 *   progressBy(tasks, (t) => t.created_by)   // 작성자별
 */
export function progressBy(
  tasks: ReadonlyArray<Task>,
  keyFn: (t: Task) => string | null | undefined,
): Map<string, Progress> {
  const map = new Map<string, Progress>();
  for (const t of tasks) {
    const key = keyFn(t);
    if (!key) continue;
    const prev = map.get(key) ?? { ...EMPTY };
    prev.total += 1;
    if (t.status === "done") prev.done += 1;
    else if (isOverdue(t)) prev.overdue += 1;
    map.set(key, prev);
  }
  return map;
}

export function progressPct(done: number, total: number): number {
  if (total === 0) return 0;
  if (done >= total) return 100;
  return Math.min(99, Math.round((done / total) * 100));
}
```

화면에서는 `useMemo` 로 감싼다:

```ts
const byNote     = useMemo(() => progressBy(tasks ?? [], (t) => t.note_id),     [tasks]);
const byAssignee = useMemo(() => progressBy(tasks ?? [], (t) => t.assignee_id), [tasks]);
const byCreator  = useMemo(() => progressBy(tasks ?? [], (t) => t.created_by),  [tasks]);
```

> **담당자 미지정 할일은 3번 축에서 빠진다** (`keyFn` 이 null). 그래서
> `Σ 멤버별 total ≠ 전체 total` 이 될 수 있다. 팀 현황 화면에서는 「미지정 N건」 행을
> 따로 만들어 총합이 맞아 보이게 한다 (§11.7).

### 11.5 `TaskProgress` 컴포넌트 — 3가지 변형

```tsx
// src/components/task-progress.tsx
import { progressPct } from "@/lib/task-progress";

type Props = {
  done: number;
  total: number;
  /** 리스트 행 안에서 쓰는 축소판 — 박스 없음, 11px */
  compact?: boolean;
  /** 왼쪽에 붙일 라벨 (예: "김대표", "내가 배정") */
  label?: string;
  /** 지연 건수 — 있으면 빨간 뱃지로 표시 */
  overdue?: number;
};

export function TaskProgress({ done, total, compact = false, label, overdue = 0 }: Props) {
  if (total === 0) return null;              // ★ 0건이면 아무것도 그리지 않는다
  const pct = progressPct(done, total);
  const complete = done >= total;

  const meta = (
    <div className="flex items-baseline justify-between gap-2 tabular-nums">
      <span className="min-w-0 truncate">
        {label && <span className="text-foreground mr-2">{label}</span>}
        <span className="text-foreground-muted">{done}/{total}</span>
        {overdue > 0 && (
          <span className="ml-2 text-danger">지연 {overdue}</span>
        )}
      </span>
      <span className={complete ? "text-accent-teal" : "text-foreground"}>{pct}%</span>
    </div>
  );

  const bar = (
    <div className="h-1 bg-line">
      <div
        className="h-full bg-accent-teal transition-all"
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </div>
  );

  // ① compact — 리스트 행 안
  if (compact) {
    return (
      <div>
        <div className="text-[11px] mb-1">{meta}</div>
        {bar}
      </div>
    );
  }

  // ② full — 독립 섹션 (연한 teal 박스)
  return (
    <div className="border border-accent-teal/40 bg-accent-teal/[0.03] px-4 py-3">
      <div className="text-xs mb-1.5">{meta}</div>
      {bar}
    </div>
  );
}
```

세 번째 변형은 **아바타가 붙는 행**이다. 담당자별/작성자별 보드에서 쓴다.

```tsx
export function TaskProgressRow({
  name, avatarUrl, done, total, overdue = 0, href,
}: {
  name: string;
  avatarUrl: string | null;
  done: number;
  total: number;
  overdue?: number;
  href?: string;
}) {
  const body = (
    <div className="flex items-center gap-3 py-3">
      <Avatar url={avatarUrl} name={name} size="sm" />
      <div className="min-w-0 flex-1">
        <TaskProgress compact label={name} done={done} total={total} overdue={overdue} />
      </div>
    </div>
  );
  return href ? (
    <Link to={href} className="block -mx-2 px-2 hover:bg-surface-muted transition-colors">
      {body}
    </Link>
  ) : body;
}
```

**디자인 규칙** — 진행률 바는 항상 `h-1` (4px 아님, 1px 그리드 감각), 트랙은 `bg-line`,
채움은 `bg-accent-teal`. 숫자는 `tabular-nums` 로 자릿수 흔들림 방지.
100% 여도 축하 애니메이션 같은 건 넣지 않는다 (MUJI 톤).

### 11.6 축 1·2 — 회의록별 / 일정별

**회의록 목록** — 행마다 compact 바. 전체 할일을 한 번만 받아 Map 으로 집계한다.

```tsx
const { data: tasks } = useAsync(
  () => (workspace ? getTasks({ workspaceId: workspace.id }) : Promise.resolve([])),
  [workspace?.id],
);
const byNote = useMemo(() => progressBy(tasks ?? [], (t) => t.note_id), [tasks]);

// 행 안에서
const p = byNote.get(n.id);
{p && <TaskProgress compact done={p.done} total={p.total} overdue={p.overdue} />}
```

**회의록 상세 / 일정 상세** — full 변형.

```tsx
// 회의록 상세
const p = progressOf(tasks ?? []);
<div className="mb-4 space-y-3">
  <h2 className="label">할일 · {p.total}</h2>
  <TaskProgress done={p.done} total={p.total} overdue={p.overdue} />
</div>

// 일정 상세 — note 를 거치지 않고 meeting_id 로 직접
const meetingTasks = (tasks ?? []).filter((t) => t.meeting_id === meeting.id);
const mp = progressOf(meetingTasks);
{mp.total > 0 && (
  <section>
    <p className="label mb-3">할일 · {mp.total}</p>
    <TaskProgress done={mp.done} total={mp.total} overdue={mp.overdue} />
  </section>
)}
```

> 일정 진행률은 그 일정에서 나온 **모든** 할일이다. 회의록이 2개면 두 회의록의 할일이
> 합산된다 (`task.meeting_id` 를 따로 두는 이유 — §4.3).

### 11.7 축 3 — 담당자별 진행률 (팀 현황 보드)

「누가 얼마나 하고 있나」. 멤버 목록이나 관리 화면 상단에 놓는다.

```tsx
// src/components/tasks/team-progress-board.tsx
import { progressBy, progressOf } from "@/lib/task-progress";
import { TaskProgress, TaskProgressRow } from "@/components/task-progress";

export function TeamProgressBoard({
  tasks, members,
}: {
  tasks: Task[];
  members: MemberWithProfile[];
}) {
  const overall  = useMemo(() => progressOf(tasks), [tasks]);
  const byAssignee = useMemo(() => progressBy(tasks, (t) => t.assignee_id), [tasks]);
  const unassigned = useMemo(
    () => progressOf(tasks.filter((t) => !t.assignee_id)),
    [tasks],
  );

  if (overall.total === 0) return null;

  // 진행률 낮은 사람이 위로 — "도움이 필요한 곳"이 먼저 보이게
  const rows = members
    .map((m) => ({ m, p: byAssignee.get(m.user_id) }))
    .filter((r): r is { m: MemberWithProfile; p: Progress } => !!r.p && r.p.total > 0)
    .sort((a, b) => {
      const ap = a.p.done / a.p.total;
      const bp = b.p.done / b.p.total;
      if (ap !== bp) return ap - bp;
      return b.p.overdue - a.p.overdue;
    });

  return (
    <section>
      <div className="mb-4 space-y-3">
        <h2 className="label">팀 진행률</h2>
        <TaskProgress
          label="전체"
          done={overall.done}
          total={overall.total}
          overdue={overall.overdue}
        />
      </div>

      <ul className="divide-y divide-line border-y border-line">
        {rows.map(({ m, p }) => (
          <li key={m.user_id}>
            <TaskProgressRow
              name={m.profile.name ?? m.profile.email}
              avatarUrl={m.profile.avatar_url}
              done={p.done}
              total={p.total}
              overdue={p.overdue}
              href={`/members/${m.user_id}`}
            />
          </li>
        ))}

        {/* ★ 담당자 미지정 — 이 행이 없으면 멤버별 합계와 전체가 안 맞아 보인다 */}
        {unassigned.total > 0 && (
          <li className="py-3">
            <TaskProgress
              compact
              label="담당자 미지정"
              done={unassigned.done}
              total={unassigned.total}
              overdue={unassigned.overdue}
            />
          </li>
        )}
      </ul>
    </section>
  );
}
```

**멤버 상세**(`/members/:id`)에서는 그 사람 것만:

```tsx
const { data: memberTasks } = useAsync(
  () => (workspace && id
    ? getTasks({ workspaceId: workspace.id, assigneeId: id })
    : Promise.resolve([])),
  [workspace?.id, id],
);
const p = progressOf(memberTasks ?? []);

<div className="mb-4 space-y-3">
  <h2 className="label">담당 할일 · {p.total - p.done}건 진행 중</h2>
  <TaskProgress done={p.done} total={p.total} overdue={p.overdue} />
</div>
```

### 11.8 축 4 — 작성자별 진행률 「내가 배정한 일」 ★

회의록을 쓰면서 6명에게 할일을 뿌린 사람은, 그 다음부터 **"내가 시킨 게 굴러가고 있나"**
가 궁금하다. 담당자 축(`assignee_id`)만 있으면 이 질문에 답할 수 없다.
`created_by` 로 자르면 된다.

#### (1) 할일 페이지에 세 번째 탭

```tsx
type Tab = "all" | "mine" | "assigned";     // ★ assigned 추가

const counts = useMemo(() => ({
  all:      list.length,
  mine:     list.filter((t) => t.assignee_id === user?.id).length,
  // 내가 만들었지만 남에게 맡긴 것 — 내가 나에게 준 일은 "내 할일" 탭에 이미 있다
  assigned: list.filter(
    (t) => t.created_by === user?.id && t.assignee_id && t.assignee_id !== user?.id,
  ).length,
}), [list, user?.id]);

const tabFiltered = useMemo(() => {
  if (tab === "mine") return list.filter((t) => t.assignee_id === user?.id);
  if (tab === "assigned") {
    return list.filter(
      (t) => t.created_by === user?.id && t.assignee_id && t.assignee_id !== user?.id,
    );
  }
  return list;
}, [list, tab, user?.id]);
```

```tsx
<div className="flex gap-6 text-sm">
  <TabButton active={tab === "all"}      onClick={() => setTab("all")}      label="전체"     count={counts.all} />
  <TabButton active={tab === "mine"}     onClick={() => setTab("mine")}     label="내 할일"  count={counts.mine} />
  <TabButton active={tab === "assigned"} onClick={() => setTab("assigned")} label="내가 배정" count={counts.assigned} />
</div>
```

#### (2) 탭 상단에 요약 카드 — 담당자별로 쪼개서

「내가 배정」 탭에서는 진행률을 **담당자별로 나눠** 보여주는 게 핵심이다.
전체 12건 중 5건 완료보다, **누가 안 하고 있는지**가 필요한 정보다.

```tsx
function AssignedByMePanel({
  tasks, members, myId,
}: {
  tasks: Task[];       // 이미 "내가 배정" 으로 필터된 목록
  members: MemberWithProfile[];
  myId: string;
}) {
  const overall = useMemo(() => progressOf(tasks), [tasks]);
  const byAssignee = useMemo(() => progressBy(tasks, (t) => t.assignee_id), [tasks]);
  if (overall.total === 0) return null;

  const rows = members
    .map((m) => ({ m, p: byAssignee.get(m.user_id) }))
    .filter((r): r is { m: MemberWithProfile; p: Progress } => !!r.p && r.p.total > 0)
    .sort((a, b) => b.p.overdue - a.p.overdue);      // 지연 많은 사람 먼저

  return (
    <section className="space-y-4">
      <TaskProgress
        label="내가 배정한 일"
        done={overall.done}
        total={overall.total}
        overdue={overall.overdue}
      />
      <ul className="divide-y divide-line border-y border-line">
        {rows.map(({ m, p }) => (
          <li key={m.user_id}>
            <TaskProgressRow
              name={m.profile.name ?? m.profile.email}
              avatarUrl={m.profile.avatar_url}
              done={p.done}
              total={p.total}
              overdue={p.overdue}
              href={`/members/${m.user_id}`}
            />
          </li>
        ))}
      </ul>
      {overall.overdue > 0 && (
        <p className="text-xs text-danger">
          기한이 지난 항목이 {overall.overdue}건 있어요. 상세에서 댓글로 상황을 물어보세요.
        </p>
      )}
    </section>
  );
}
```

#### (3) 회의록 상세에도 「이 회의에서 내가 배정한 것」

회의록 작성자가 자기 회의록을 다시 열었을 때, 자기가 뿌린 할일의 진행 상황을 바로 본다.

```tsx
// 회의록 상세 — 작성자 본인에게만 노출
{note.created_by === user.id && (() => {
  const mine = (tasks ?? []).filter(
    (t) => t.created_by === user.id && t.assignee_id !== user.id,
  );
  const p = progressOf(mine);
  if (p.total === 0) return null;
  return (
    <section>
      <p className="label mb-3">내가 배정한 · {p.total}</p>
      <TaskProgress done={p.done} total={p.total} overdue={p.overdue} />
    </section>
  );
})()}
```

#### (4) 회의록/일정 목록에 작성자 진행률을 섞지 말 것

목록에서는 **회의록별 전체 진행률** 하나만 보여준다. "이 회의록 중 내가 배정한 것"
같은 개인화 숫자를 목록에 넣으면 사람마다 다른 숫자가 보여서 대화가 어긋난다
("3/9라던데?" "난 1/2인데?"). 개인화 진행률은 **상세 화면과 「내가 배정」 탭에서만**.

### 11.9 작성자(created_by)를 화면에 어떻게 보여주나

진행률과 작성자는 한 세트다. 숫자가 나쁠 때 **누구에게 물어봐야 하는지**가 같이 보여야
한다.

| 자원 | 컬럼 | 화면 라벨 | 어디에 |
| --- | --- | --- | --- |
| 일정 | `meetings.created_by` | **호스트** | 일정 상세 하단 카드 |
| 회의록 | `meeting_notes.created_by` | **작성자** | 회의록 상세 하단 카드 |
| 할일 | `tasks.created_by` | **작성자** (= 배정한 사람) | 할일 상세 메타 3칸 |
| 할일 | `tasks.assignee_id` | **담당자** (= 할 사람) | 목록 행 + 상세 메타 |

#### 할일 상세 — 담당자 · 기한 · 작성자 3칸

```tsx
<section className="grid gap-px bg-surface-muted border border-line sm:grid-cols-3">
  <MetaCell label="담당자" person={assignee ?? { name: "미지정", avatar_url: null }} />
  <MetaCell label="기한"   value={task.due_date ? formatFullDate(task.due_date) : "기한 없음"} />
  <MetaCell label="작성자" person={creator ?? { name: "—", avatar_url: null }} />
</section>
```

```tsx
function MetaCell({ label, value, person }: {
  label: string;
  value?: string;
  person?: { name: string; avatar_url: string | null };
}) {
  return (
    <div className="bg-surface px-4 py-4">
      <p className="label">{label}</p>
      {person ? (
        <div className="mt-2 flex items-center gap-2">
          <Avatar url={person.avatar_url} name={person.name} size="sm" />
          <span className="text-sm truncate">{person.name}</span>
        </div>
      ) : (
        <p className="mt-2 text-sm">{value}</p>
      )}
    </div>
  );
}
```

> `gap-px` + `bg-surface-muted` 로 셀 사이에 1px 선이 생긴다. 그림자 없이 격자를 만드는
> 방법 — 각 셀은 `bg-surface` 로 덮어야 한다.

#### 목록 행 — 담당자 옆에 배정자

할일 목록에서 남이 나에게 준 일과 내가 만든 일을 구분해야 할 때만 붙인다.
**항상 붙이면 행이 지저분해진다** — 「내가 배정」 탭에서만 표시하는 것을 권장.

```tsx
<div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-foreground-muted">
  <span className="inline-flex items-center gap-1">
    담당 ·
    {assigneeName ? (
      <>
        <Avatar url={assignee?.profile.avatar_url ?? null} name={assigneeName} size="xs" />
        {assigneeName}
      </>
    ) : "미지정"}
  </span>
  {/* 작성자가 담당자와 다를 때만 — 같으면 중복 정보 */}
  {creatorName && creatorName !== assigneeName && (
    <span className="text-foreground-faint">배정 · {creatorName}</span>
  )}
  {task.due_date && (
    <span className={overdue ? "text-danger" : undefined}>
      기한 · {formatShortDate(task.due_date)}
    </span>
  )}
</div>
```

#### 회의록 · 일정 상세 — 작성자 카드

```tsx
{author && (
  <section>
    <h2 className="label mb-4">작성자</h2>
    <Link to={`/members/${author.user_id}`}
          className="flex items-center gap-4 border border-line p-5 hover:border-foreground transition-colors">
      <Avatar url={author.avatar_url} name={author.name ?? author.email} size="lg" />
      <div>
        <p className="text-sm">{author.name ?? author.email}</p>
        <p className="mt-0.5 text-xs text-foreground-muted">
          {[author.company, author.position].filter(Boolean).join(" · ") || "—"}
        </p>
      </div>
    </Link>
  </section>
)}
```

일정 상세에서는 같은 컴포넌트에 라벨만 `Host` 로 바꾼다.

#### 작성자 프로필 조회 (N+1 주의)

```tsx
// 상세 — 단건이라 그냥 조회
const { data: creator } = useAsync(
  () => (task?.created_by ? getProfile(task.created_by) : Promise.resolve(null)),
  [task?.created_by],
);

// 목록 — 담당자 + 작성자 id 를 한 번에 모아서 묶음 조회
const personIds = useMemo(() => {
  const s = new Set<string>();
  for (const t of list) {
    if (t.assignee_id) s.add(t.assignee_id);
    s.add(t.created_by);
  }
  return Array.from(s);
}, [list]);
const { data: people } = useAsync(() => getProfiles(personIds), [personIds.join(",")]);
```

> 워크스페이스 멤버 목록(`getWorkspaceMembers`)을 이미 받았다면 그걸 쓰는 게 더 낫다.
> 탈퇴한 사람이 만든 할일만 프로필이 없을 수 있으니 `?? "—"` 폴백을 둔다.

### 11.10 축 5 — 기간별 진행률 (주간 펄스)

「이번 주에 몇 건 끝냈나」는 `completed_at` 으로 센다. `status` 로는 시점을 알 수 없다.

```ts
/** 이번 주 월요일 00:00 */
function thisWeekStart(): Date {
  const d = new Date();
  const day = (d.getDay() + 6) % 7;      // 월=0 … 일=6
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

const weekStart = thisWeekStart().toISOString();

const weekly = useMemo(() => {
  const all = tasks ?? [];
  return {
    completed: all.filter((t) => t.completed_at && t.completed_at >= weekStart).length,
    created:   all.filter((t) => t.created_at >= weekStart).length,
    // 이번 주 안에 기한이 있는 미완료
    dueThisWeek: all.filter(
      (t) => t.status !== "done" && t.due_date && t.due_date >= weekStart,
    ).length,
  };
}, [tasks, weekStart]);
```

```tsx
<section className="grid gap-px bg-surface-muted border border-line grid-cols-3">
  <PulseCell label="이번 주 완료" value={weekly.completed} />
  <PulseCell label="새로 생긴 일" value={weekly.created} />
  <PulseCell label="이번 주 마감" value={weekly.dueThisWeek} />
</section>
```

> `completed_at` 을 신뢰하려면 `updateTask` 가 done 전환 때 반드시 채워야 한다 (§13.2).
> 완료를 취소하면 `null` 로 되돌리므로, 취소된 건은 주간 집계에서 자동으로 빠진다.

### 11.11 대량일 때 — SQL 집계로 옮기기

할일이 수천 건이 되면 전체를 클라이언트로 내려받는 게 부담이다. 그때는 뷰를 만든다.

```sql
-- 회의록별 진행률 뷰
create or replace view public.note_task_progress as
select
  t.note_id,
  count(*)                                            as total,
  count(*) filter (where t.status = 'done')           as done,
  count(*) filter (
    where t.status <> 'done'
      and t.due_date is not null
      and t.due_date < now()
  )                                                   as overdue
from public.tasks t
where t.note_id is not null
group by t.note_id;

-- 작성자별 (내가 배정한 일)
create or replace view public.creator_task_progress as
select
  t.workspace_id,
  t.created_by,
  t.assignee_id,
  count(*)                                  as total,
  count(*) filter (where t.status = 'done') as done
from public.tasks t
group by t.workspace_id, t.created_by, t.assignee_id;
```

> **뷰에는 RLS 가 자동 적용되지 않는다.** `security_invoker = true` 옵션을 주거나
> (`create view … with (security_invoker = true)`), 기반 테이블 정책이 통하는지 반드시
> 확인한다. 안 그러면 남의 워크스페이스 집계가 새어 나간다.

### 11.12 (선택) 100% 달성 알림

회의록의 액션 아이템이 전부 끝났을 때 한 번 축하 알림을 보낸다. `updateTask` 의
완료 처리 직후에 붙인다.

```ts
if (justCompleted && updated.note_id) {
  const siblings = await getTasksForNote(updated.note_id);
  const allDone = siblings.length > 0 && siblings.every((t) => t.status === "done");
  if (allDone) {
    const note = await getNote(updated.note_id);
    await notify({
      type: "task_completed",
      workspace_id: updated.workspace_id,
      actor_id: null,                       // ★ 모두에게 (완료자 포함) 보내고 싶으면 null
      title: "🎉 액션 아이템 전부 완료",
      body: `「${note?.title ?? "회의록"}」의 할일 ${siblings.length}건이 모두 끝났어요.`,
      url: `/notes/${updated.note_id}`,
      tag: `note-alldone-${updated.note_id}`,   // ★ 회의록당 1회로 묶임
    });
  }
}
```

> `tag` 가 회의록 단위라 완료 취소 후 재완료해도 폰에서는 알림 1개로 덮어쓴다.
> 진짜로 한 번만 보내려면 `notification_log(user_id, 'note_alldone', note_id)` 유니크
> 제약으로 막는다.

### 11.13 진행률 함정 정리

| 함정 | 해결 |
| --- | --- |
| `0/0` → `NaN%` | `total === 0` 이면 컴포넌트가 `null` 반환 |
| `199/200` 이 100% 로 반올림 | `progressPct` 에서 `done < total` 이면 최대 99 |
| 멤버별 합계 ≠ 전체 | 「담당자 미지정」 행을 따로 표시 |
| 카운트를 컬럼에 저장했다가 어긋남 | 저장하지 말고 항상 계산 |
| `in_progress` 를 완료로 셈 | 완료는 `status === 'done'` 뿐. 진행중은 미완료 |
| 주간 집계에 `updated_at` 사용 | 제목만 고쳐도 바뀐다. `completed_at` 을 쓸 것 |
| 삭제된 할일이 분모에 남음 | 계산식이면 자동 해결. 캐시했다면 발생 |
| 목록마다 개인화 진행률 | 목록은 전체 기준 하나만. 개인화는 상세/전용 탭 |
| 진행률 옆에 작성자가 없어 누구에게 물을지 모름 | 지연 건이 있는 축에는 항상 사람(아바타+이름)을 붙인다 |

---

## 12. 쿼리 카탈로그

이 흐름에 필요한 데이터 함수 전부. **화면에서는 절대 `supabase` 를 직접 부르지 않는다.**

```ts
// ─── 일정 ────────────────────────────────────────────────────
getWorkspaceMeetings(workspaceId)         // 목록 (starts_at desc)
getMeeting(id)                            // 단건
createMeeting(input, createdBy)           // + new_meeting 알림
updateMeeting(id, patch)
deleteMeeting(id)

// ─── 회의록 ──────────────────────────────────────────────────
getWorkspaceNotes(workspaceId)            // 목록 (created_at desc)
getNotesForMeeting(meetingId)             // 특정 일정에 딸린 회의록
getNote(id)
createNote(input, createdBy)              // + new_note 알림
updateNote(id, patch)
deleteNote(id)                            // ★ 할일은 안 지워진다 (note_id 만 null)

// ─── 할일 ────────────────────────────────────────────────────
getTasks({ workspaceId, assigneeId?, openOnly? })   // 만능 필터
getMyOpenTasks(workspaceId, userId)                 // = getTasks({ ws, assignee, openOnly:true })
getTasksForNote(noteId)                             // 회의록의 액션 아이템
getTaskById(id)
createTask(input, createdBy)                        // + new_task 알림 (담당자에게)
updateTask(id, patch, { actorId })                  // + task_completed / 재배정 알림
deleteTask(id)
syncTasksForNote(noteId, wsId, meetingId, createdBy, { keep, create })   // ★ 회의록 저장의 핵심

// ─── 진행률 유틸 (§11.4 — 쿼리가 아니라 순수 계산) ──────────
progressOf(tasks)                                   // { done, total, overdue }
progressBy(tasks, (t) => t.note_id)                 // 회의록별 Map
progressBy(tasks, (t) => t.meeting_id)              // 일정별 Map
progressBy(tasks, (t) => t.assignee_id)             // 담당자별 Map
progressBy(tasks, (t) => t.created_by)              // 작성자별 Map ★ "내가 배정한 일"
progressPct(done, total)                            // 100% 반올림 보정 포함

// ─── 사람 조회 (담당자 · 작성자 표시용) ──────────────────────
getProfile(userId)                                  // 상세 화면 단건
getProfiles(userIds)                                // 목록 화면 묶음 (N+1 방지)
getWorkspaceMembers(workspaceId)                    // 셀렉트 · 팀 진행률 보드

// ─── 할일 소셜 ───────────────────────────────────────────────
getTaskLikeState(taskId, userId)
toggleTaskLike(taskId, userId)
getTaskComments(taskId)
addTaskComment(taskId, userId, content, parentId?)
deleteTaskComment(id)
```

### 12.1 `getTasks` 구현 (만능 필터 하나로 통일)

```ts
type Filters = {
  workspaceId?: string;
  assigneeId?: string;
  /** status='done' 제외 */
  openOnly?: boolean;
};

export async function getTasks({
  workspaceId, assigneeId, openOnly = false,
}: Filters): Promise<Task[]> {
  let query = supabase!.from("tasks").select("*");
  if (workspaceId) query = query.eq("workspace_id", workspaceId);
  if (assigneeId)  query = query.eq("assignee_id", assigneeId);
  if (openOnly)    query = query.neq("status", "done");
  query = query.order("created_at", { ascending: false });
  const { data } = await query;
  return (data as Task[]) ?? [];
}

/** 특정 회의록의 액션 아이템 */
export async function getTasksForNote(noteId: string): Promise<Task[]> {
  const { data } = await supabase!
    .from("tasks").select("*")
    .eq("note_id", noteId)
    .order("created_at", { ascending: false });
  return (data as Task[]) ?? [];
}
```

> **왜 `meeting_id` 전용 함수가 없나** — 일정 상세에서는 `getTasks({workspaceId})` 를 받아
> 클라이언트에서 `.filter(t => t.meeting_id === id)` 한다. 팀 규모(수십~수백 row)에선
> 이게 더 빠르고, 어차피 같은 화면의 다른 위젯이 전체 목록을 이미 갖고 있다.
> 수천 건 규모가 되면 `.eq("meeting_id", id)` 전용 함수를 추가한다.

### 12.2 데이터 페칭 훅

```ts
const { data, loading } = useAsync(() => fn(), [deps]);
```

`refreshKey` 를 deps 에 넣어 mutation 후 재조회한다:

```ts
const [refreshKey, setRefreshKey] = useState(0);
function bump() { setRefreshKey((v) => v + 1); }

const { data: tasks } = useAsync(
  () => getTasks({ workspaceId: workspace.id }),
  [workspace?.id, refreshKey],
);

async function handleToggle(t: Task, next: TaskStatus) {
  await updateTask(t.id, { status: next }, { actorId: user.id });
  bump();
}
```

---

## 13. 상태 · 기한 규칙

### 13.1 `status` 3단계

```
todo  →  in_progress  →  done
```

- 목록의 체크박스는 `todo ⇄ done` 만 토글한다 (2단계가 실사용의 95%).
- `in_progress` 는 상세 화면에서만 설정. UI 를 단순하게 유지하는 선택.
- `done` 이면 목록에서 **맨 아래로**, 제목에 `line-through`, 행 배경 `bg-surface-muted`.

### 13.2 `completed_at` 자동 관리

사용자가 직접 입력하지 않는다. `updateTask` 안에서 상태 전환을 감지해 세팅한다.

```ts
const finalPatch: TaskPatch = { ...patch };
if (patch.status === "done" && !prev?.completed_at) {
  finalPatch.completed_at = new Date().toISOString();     // 완료 시각 기록
} else if (patch.status && patch.status !== "done") {
  finalPatch.completed_at = null;                          // 완료 취소하면 지움
}
```

주간 리포트("이번 주 완료 N건")는 `completed_at` 으로 집계한다. `updated_at` 은 제목만
고쳐도 바뀌므로 쓰면 안 된다.

### 13.3 `due_date` 타입과 변환 (가장 자주 틀리는 부분)

| 위치 | 형태 | 예시 |
| --- | --- | --- |
| DB | `timestamptz` | `2026-08-25T00:00:00+00` |
| `<input type="date">` | `YYYY-MM-DD` 문자열 | `2026-08-25` |
| 폼 → DB | `new Date(v).toISOString()` | |
| DB → 폼 | `t.due_date.slice(0, 10)` | |

```ts
// 저장
due_date: dueDate ? new Date(dueDate).toISOString() : null,

// 폼 채우기
due_date: t.due_date ? t.due_date.slice(0, 10) : "",
```

> `slice(0,10)` 은 UTC 기준 날짜를 자른다. 한국(UTC+9)에서 자정 근처 기한은 하루 밀려
> 보일 수 있다. 기한을 **날짜(date)** 로만 쓸 거라면 컬럼 타입을 `date` 로 두는 게 더 정확하다.
> 밋업은 `timestamptz` 를 쓰되 표시 시 항상 날짜만 보여주는 방식으로 정리했다.

### 13.4 지연(overdue) 판정

```ts
const overdue = !done && task.due_date && new Date(task.due_date).getTime() < Date.now();
```

지연이면 기한 텍스트를 `text-danger` 로. **행 전체를 빨갛게 칠하지 않는다** — 지연 항목이
많은 날 화면이 경고판이 된다.

### 13.5 정렬 규칙 (화면마다 다르다)

| 화면 | 정렬 |
| --- | --- |
| 할일 목록 | 완료는 아래로 → 최신 생성순 |
| 대시보드 「확인이 필요한 일」 | 기한 빠른 순 (기한 없는 건 맨 뒤) |
| 대시보드 「내 할일」 | 버킷(지연→오늘→이번주→나중→기한없음), 버킷 안은 입력순 |
| 회의록의 액션 아이템 | 생성 역순 (회의록에 적은 순서가 대체로 중요도순) |

---

## 14. 전체 시나리오 워크스루

멤버 6명 워크스페이스에서 실제로 일어나는 일을 시간순으로.

### 8/17 (월) — 김대표가 일정을 등록

```
[화면]  /meetings/new
        제목: 8월 셋째주 정기모임
        종류: 정기모임
        시작: 2026-08-20 19:00   종료: 21:00
        장소: 강남 위워크 12F
        → [일정 등록]

[DB]    meetings insert
          { title:'8월 셋째주 정기모임', starts_at:'2026-08-20T10:00:00Z',
            location:'강남 위워크 12F', created_by:'김대표', type_id:'정기모임' }

[알림]  new_meeting → 나머지 5명 폰
          "📅 새 일정 — 김대표 님이 「8월 셋째주 정기모임」 일정을 등록했어요."
          클릭 → /meetings/<id>

[화면 반영]
        /meetings        목록 최상단에 카드
        /calendar        8/20 칸에 정기모임 컬러 점
        /dashboard       Featured Meeting 영역 (다음 일정)
```

### 8/20 (목) 21:00 — 회의 끝, 김대표가 회의록 작성

```
[화면]  /meetings/<id> → [+ 회의록 작성] → /notes/new?meeting=<id>
        연결:   8/20 19:00 · 8월 셋째주 정기모임   ← 자동 선택됨
        아젠다: 1. 하반기 목표 점검
                2. 신규 채널 운영안
        본문:   (아젠다별 토론 내용)
        할일:
          [전체 과제] "다음 모임 전까지 책 1챕터" 기한 8/27 → [멤버 6명에게 추가]
          [8월 매출 자료 정리]   [박이사] [8/25]
          [채널 운영안 초안]     [이팀장] [8/27]
          [계약서 검토]          [김대표] [8/22]
        → [회의록 작성]
```

저장 시 실행되는 것:

```
① createNote()
     meeting_notes insert
       { meeting_id:<일정>, title:'8월 셋째주 정기모임',   ← 일정 제목 자동 상속
         agenda:'하반기 목표 점검\n신규 채널 운영안', content:'<p>…</p>' }
     → new_note 알림 5건

② syncTasksForNote(noteId, wsId, meetingId, '김대표', { keep: [], create: [9건] })
     existing = []            → 삭제 0건
     keep     = []            → 수정 0건
     create   = 9건           → tasks insert × 9
       각각 { note_id:<회의록>, meeting_id:<일정>, created_by:'김대표',
              assignee_id:<각자>, due_date:<ISO>, status:'todo' }
     → new_task 알림 8건 (김대표 담당 1건은 본인이라 제외)

③ navigate(`/notes/<noteId>`)
```

**총 푸시 13건.** 각자 폰에서 보이는 건:

```
박이사 폰:  📝 새 회의록 — 김대표 님이 「8월 셋째주 정기모임」 회의록을 작성했어요.
            📝 새 할일  — 김대표 님이 회원님께 「8월 매출 자료 정리」를 배정했어요.
            📝 새 할일  — 김대표 님이 회원님께 「다음 모임 전까지 책 1챕터」를 배정했어요.
김대표 폰:  (없음 — 본인이 한 일)
```

### 8/20 직후 — 화면에 나타나는 곳

| 화면 | 무엇이 보이나 |
| --- | --- |
| `/notes` | 새 회의록 행 + 진행률 `0/9 · 0%` |
| `/notes/<id>` | 아젠다 2개, 본문, 할일 9개 리스트(담당·기한) |
| `/meetings/<id>` | 「할일 · 9」 진행률 바 + 「회의록 · 1」 |
| `/tasks` | 전체 탭에 9건 추가 |
| `/tasks?scope=mine` (박이사) | 내 할일 2건 |
| 박이사 `/dashboard` | 「확인이 필요한 일」에 8/25 마감 건, 「내 할일」 이번 주 버킷에 2건 |
| `/activity` | `created_meeting_note` 로그 |

### 8/23 (일) — 박이사가 완료 처리

```
[화면]  /tasks?scope=mine → 「8월 매출 자료 정리」 체크박스 클릭
[코드]  updateTask(id, { status:'done' }, { actorId: 박이사 })
[DB]    tasks update { status:'done', completed_at:'2026-08-23T…' }
[기록]  activities insert { action:'completed_task', metadata:{title:…} }
[알림]  task_completed → 박이사 제외 5명
          "✅ 할일 완료 — 박이사 님이 「8월 매출 자료 정리」를 완료했어요."

[화면 반영 — 자동으로 전부]
  /tasks              해당 행이 취소선 + 회색 배경 + 맨 아래로
  /notes/<id>         할일 리스트 체크 ✓, 진행률 1/9 · 11%
  /meetings/<id>      진행률 바 1/9
  /notes 목록         해당 행 compact 진행률 1/9
  박이사 /dashboard   「확인이 필요한 일」에서 사라짐
  /activity           "박이사 님이 「8월 매출 자료 정리」을 완료했어요"
```

**한 번의 `updateTask` 로 6개 화면이 갱신된다** — 각 화면이 `tasks` 를 직접 읽기 때문.
어디에도 카운트를 복사 저장해두지 않았다.

### 8/24 (월) — 김대표가 회의록을 수정

```
[화면]  /notes/<id>/edit
        - 「계약서 검토」 줄을 × 로 삭제
        - 「채널 운영안 초안」 담당자를 이팀장 → 최과장 으로 변경
        - 새 줄 「홍보 문구 3안」 [정대리] [8/30] 추가
        → [수정 저장]

[코드]  syncTasksForNote(noteId, …, {
          keep:   [8건의 patch],           // 삭제한 1건은 keep 에 없음
          create: [{ 홍보 문구 3안 }],
        })

[DB]    ① existing 9건 중 keep 에 없는 「계약서 검토」 → deleteTask()
              (딸린 task_comments / task_likes 도 cascade 삭제)
        ② keep 8건 → updateTask(patch + note_id)
              「채널 운영안 초안」의 assignee_id 가 이팀장 → 최과장 으로 변경
        ③ create 1건 → createTask() → new_task 알림 → 정대리

[알림]  정대리:  📝 새 할일 — 「홍보 문구 3안」
        최과장:  (재배정 알림을 구현했다면) 🔄 할일 담당자 변경 — 「채널 운영안 초안」
```

**보존되는 것** — 「8월 매출 자료 정리」의 `id`, `status='done'`, `completed_at`,
달려있던 댓글과 좋아요가 전부 그대로다. keep 경로가 update 를 쓰기 때문.

---

## 15. AI가 자주 틀리는 것 16가지

### Q1. 회의록을 저장할 때 할일을 전부 지우고 다시 만들면 안 되나?

**안 된다.** 할일 id 가 바뀌면 댓글·좋아요(`task_id` FK)가 cascade 로 사라지고,
완료 상태와 `completed_at` 도 초기화된다. 반드시 `keep`(update) / `create`(insert) /
`delete` 3분류를 지킨다.

### Q2. `tasks.note_id` 를 `not null` 로 해도 되나?

**안 된다.** 할일 메뉴에서 직접 만든 할일(조합 C)이 존재한다. 마찬가지로 `meeting_id`,
`assignee_id` 도 전부 nullable 이어야 한다.

### Q3. 회의록을 지우면 할일도 지워지나?

**아니다.** `on delete set null` 이라 할일은 살아남고 `note_id` 만 null 이 된다.
기록(회의록)과 실행(할일)은 수명이 다르다.

### Q4. `task.meeting_id` 는 `note.meeting_id` 와 중복 아닌가?

중복이지만 **의도된 비정규화**다. 일정 상세에서 조인 없이 진행률을 계산하기 위함
(§4.3). 대신 회의록의 일정이 바뀌면 할일들의 `meeting_id` 도 같이 갱신해야 한다 —
`syncTasksForNote` 의 `keep.patch.meeting_id` 가 그 역할.

### Q5. 회의록 제목은 왜 입력칸이 없나?

일정에 연결되면 그 일정 제목을 그대로 쓰고, 아니면 `YYYY-MM-DD 회의록` 으로 자동 생성한다.
회의록 제목을 따로 고민하게 만드는 건 불필요한 마찰이다. 편집 시엔 기존 제목을 유지한다.

### Q6. 아젠다는 왜 별도 테이블이 아닌가?

순서 변경·삭제가 잦은데 row 단위 동기화는 복잡하다. `\n` 으로 join 한 text 한 덩어리로
저장하고 화면에서 `split("\n")` 한다. 아젠다에 담당자나 투표를 붙일 계획이 있다면
그때 별도 테이블(`agendas`)로 승격한다.

### Q7. 담당자를 안 정한 할일은 알림이 가나?

**안 간다.** `if (data.assignee_id)` 가드가 있다. 미지정 할일은 목록에 "담당 · 미지정"
으로 보이고, 누군가 상세에서 담당자를 지정하면 그때 알림이 나간다(재배정 알림 구현 시).

### Q8. 자기가 만든 할일 알림을 자기가 받나?

**안 받는다.** `notify({ actor_id: createdBy, target_user_ids: [assignee] })` 에서
서버가 `candidateIds.filter(u => u !== actor_id)` 로 걸러낸다. `actor_id` 를 안 넘기면
본인에게도 가므로 **항상 넘긴다**.

### Q9. 6명에게 일괄 배정하면 할일 row 는 1개인가 6개인가?

**6개다.** 담당자가 각각 다르고, 각자 따로 완료 처리해야 하므로 row 를 나눈다.
"누가 했는지"를 추적하려면 이 구조여야 한다. 알림도 6명에게 각각 간다.

### Q10. 목록 화면에서 할일마다 담당자 프로필을 조회하면 되나?

**N+1 이 난다.** 두 가지 방법 중 하나를 쓴다:
- 부모에서 `getWorkspaceMembers(wsId)` 로 전원을 한 번에 받아 `members.find(...)` (목록 화면)
- id 배열을 모아 `getProfiles(ids)` 한 번 (회의록 상세)

```ts
const assigneeIds = tasks.map((t) => t.assignee_id).filter((x): x is string => !!x);
const { data: profiles } = useAsync(() => getProfiles(assigneeIds), [assigneeIds.join(",")]);
```
deps 에 배열을 그대로 넣으면 매 렌더 새 참조라 무한 루프가 난다. `join(",")` 필수.

### Q11. 화면마다 완료 카운트를 DB 에 저장해두면 빠르지 않나?

**하지 마라.** 진행률은 항상 `tasks` 에서 실시간 계산한다. 카운트를 저장하면 6개 화면의
동기화 지점이 6개 생기고 반드시 어긋난다. `TaskProgress` 는 `done`/`total` 숫자 두 개만
받는 순수 컴포넌트라 어디서든 재사용된다.

### Q12. `updated_at` 으로 완료 시각을 쓰면 안 되나?

**안 된다.** 제목만 고쳐도 `updated_at` 이 바뀐다. 완료 시각은 `completed_at` 을 따로 둔다.
완료를 취소하면 `null` 로 되돌린다.

### Q13. 목록 행 안의 체크박스가 클릭되면 상세로도 이동해버린다

행 전체가 `<Link>` 라서 그렇다. 체크박스 핸들러에서 두 줄을 반드시 호출한다:

```ts
e.preventDefault();    // Link 내비게이션 취소
e.stopPropagation();   // 상위로 전파 차단
```

### Q14. 대시보드 「내 할일」과 할일 목록의 「내 할일」 탭은 같은 쿼리인가?

같은 데이터, 다른 가공이다.

| | 대시보드 | 할일 목록 탭 |
| --- | --- | --- |
| 쿼리 | `getTasks({ workspaceId, assigneeId: me })` | `getTasks({ workspaceId })` 후 클라이언트 필터 |
| 표시 | 미완료만, 기한 버킷 5개, 버킷당 4건 | 전체(완료 포함), 상태 필터 |
| 목적 | "지금 뭘 해야 하나" | "내 일 전부 훑어보기" |

대시보드는 서버에서 `assigneeId` 로 좁히고, 목록은 탭 전환 시 재조회가 없도록 전체를
받아 클라이언트에서 나눈다.

### Q15. 「내 할일」과 「내가 배정」은 뭐가 다른가?

기준 컬럼이 다르다.

| 탭 | 필터 | 뜻 |
| --- | --- | --- |
| 내 할일 | `assignee_id === me` | **내가 해야 할** 일 |
| 내가 배정 | `created_by === me && assignee_id && assignee_id !== me` | **내가 남에게 시킨** 일 |

「내가 배정」에서 `assignee_id !== me` 조건을 빼면 내가 나에게 만든 할일이 두 탭에
중복으로 나온다. 그리고 이 탭의 진행률은 **담당자별로 쪼개서** 보여줘야 쓸모가 있다
(§11.8).

### Q16. 진행률에 `in_progress` 를 반쯤 완료로 계산해도 되나?

**하지 마라.** `done` 만 완료다. "0.5건 완료" 같은 숫자는 신뢰를 잃는다.
진행 중임을 보여주고 싶으면 바를 쪼개지 말고 텍스트로 병기한다:
`3/9 · 진행중 2`. 그리고 지연 건수는 별도 뱃지로 (`지연 1`) — 이게 실제로 행동을
유발하는 유일한 숫자다.

---

## 16. 구현 체크리스트

### DB

- [ ] `meetings` (`starts_at` 인덱스, `touch_updated_at` 트리거)
- [ ] `meeting_types` (선택 — 컬러 배지 쓸 때만)
- [ ] `meeting_notes` (`meeting_id` **nullable**, `meeting_notes_meeting_idx`)
- [ ] `tasks` (`assignee_id` / `note_id` / `meeting_id` **전부 nullable**, `tasks_assignee_idx`)
- [ ] FK 는 **전부 `on delete set null`** — cascade 금지
- [ ] `task_likes` / `task_comments` (+ `parent_id`) — 여기만 cascade
- [ ] RLS: 조회=멤버 / 생성=멤버+본인 / 수정·삭제=작성자 or 운영자
- [ ] **`tasks` 수정 정책에만 `assignee_id = auth.uid()` 추가**
- [ ] `notify pgrst, 'reload schema';`

### 데이터 레이어

- [ ] `getTasks({ workspaceId, assigneeId, openOnly })` 만능 필터
- [ ] `getTasksForNote(noteId)` / `getNotesForMeeting(meetingId)`
- [ ] `createTask` — 담당자 있으면 `new_task` 알림
- [ ] `updateTask(id, patch, { actorId })` — 완료 전환 감지 + `completed_at` 자동 + 재배정 알림
- [ ] `syncTasksForNote` — **삭제 → 수정 → 생성** 순서 고정
- [ ] `createNote` / `createMeeting` — 각각 전체 멤버 알림

### 화면

- [ ] `/meetings/new` — 제목·시작 필수 검증, datetime-local 변환
- [ ] `/meetings/:id` — 할일 진행률 + 회의록 목록 + `+ 회의록 작성` (`?meeting=` 전달)
- [ ] `/notes/new` — `?meeting=` 미리 선택, **「일정 미연결」 옵션 필수**
- [ ] `/notes/new` 할일 섹션 — 3열(내용·담당자·기한) + 전체과제 일괄배정 + 기존할일 불러오기
- [ ] `/notes/:id` — 아젠다 번호 목록, 본문, 할일 리스트(담당·기한·완료 배지)
- [ ] `/notes` — 행마다 `TaskProgress compact` (한 번의 집계로)
- [ ] `/tasks` — 전체/내 할일 탭 + 담당자·상태 필터 + 행 체크박스 토글
- [ ] `/tasks/:id` — 메타 3칸 + 회의록 역링크 + 댓글/좋아요
- [ ] `/dashboard` — 「확인이 필요한 일」 + 「내 할일」 버킷
- [ ] `/members/:id` — 담당 할일 섹션 (§10.9, 신규 추가)
- [ ] 모든 목록에서 완료 항목은 아래로 + 취소선

### 진행률 · 작성자

- [ ] `progressOf` / `progressBy` / `progressPct` 유틸 (§11.4) — **카운트 컬럼 저장 금지**
- [ ] `TaskProgress` — `total === 0` 이면 `null` 반환, `done < total` 이면 최대 99%
- [ ] 회의록 목록·상세 / 일정 상세 진행률 (축 1·2)
- [ ] 팀 진행률 보드 — 담당자별 + **「담당자 미지정」 행** (축 3, §11.7)
- [ ] 할일 「내가 배정」 탭 + 담당자별 breakdown (축 4, §11.8)
- [ ] 주간 완료 집계는 `completed_at` 기준 (축 5, §11.10)
- [ ] 할일 상세 메타 3칸에 **작성자** 포함 (담당자 · 기한 · 작성자)
- [ ] 회의록/일정 상세에 **작성자 / 호스트 카드**
- [ ] 목록 행의 배정자 표기는 `작성자 !== 담당자` 일 때만
- [ ] 지연 건수가 있는 진행률에는 **항상 사람(아바타+이름)을 함께** 표시
- [ ] 작성자·담당자 프로필은 `getProfiles(ids)` 묶음 조회 (N+1 금지)

### 알림

- [ ] `new_meeting` / `new_note` — 전체 멤버, `actor_id` 필수
- [ ] `new_task` — `target_user_ids: [assignee]`, 담당자 null 이면 스킵
- [ ] `task_completed` — 전체 멤버, `actorId` 명시적 전달
- [ ] 재배정 알림 — `prevAssignee !== newAssignee` 가드 필수 (안 그러면 회의록 저장마다 폭탄)
- [ ] 알림 `url` 은 항상 상세 경로 (`/tasks/<id>` · `/notes/<id>` · `/meetings/<id>`)

---

*작성 기준: 밋업 앱 프로덕션 코드 — `note-form.tsx`, `syncTasksForNote`, `task-row.tsx`,
`my-action-panel.tsx`, `my-tasks-preview.tsx`, `task-progress.tsx`,
마이그레이션 002 / 004 / 009 / 047 / 048.*
*알림 인프라 구축은 [`social-notifications-guide.md`](./social-notifications-guide.md) 참고.*
