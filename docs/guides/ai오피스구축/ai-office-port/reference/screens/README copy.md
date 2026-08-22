# screens/ — 화면 디자인 참고본

다른 앱에 **밋업 화면이 어떻게 생겼는지 그대로 보여주기 위한** 파일들.
각 파일이 화면 하나에 대응하고, 그 화면에서 **보이는 것 전부를 한 파일에** 담았다
(원본은 여러 파일로 나뉘어 있지만 여기서는 합쳐 두었다).

## 할일 (Tasks)

| 파일 | 화면 | 라우트 |
| --- | --- | --- |
| [`01-할일-목록-페이지.tsx`](01-할일-목록-페이지.tsx) | 목록 (헤더·탭·필터·행·페이저·인라인 추가폼) | `/tasks` |
| [`02-할일-상세-뷰어.tsx`](02-할일-상세-뷰어.tsx) | 행 클릭 시 열리는 **새 페이지** | `/tasks/:id` |
| [`03-할일-상세-편집.tsx`](03-할일-상세-편집.tsx) | 뷰어에서 [편집] — **같은 URL, mode 토글** | `/tasks/:id` |

## 회의록 (Meeting Notes)

| 파일 | 화면 | 라우트 |
| --- | --- | --- |
| [`04-회의록-목록-페이지.tsx`](04-회의록-목록-페이지.tsx) | 목록 (제목·미리보기·진행률 3줄 행) | `/notes` |
| [`05-회의록-상세-뷰어.tsx`](05-회의록-상세-뷰어.tsx) | 행 클릭 시 열리는 **새 페이지** | `/notes/:id` |
| [`06-회의록-작성편집-페이지.tsx`](06-회의록-작성편집-페이지.tsx) | [편집] — **별도 페이지**. 작성도 같은 폼 | `/notes/:id/edit`, `/notes/new` |

---

## 화면 흐름

```
할일 — 편집이 같은 URL 안의 mode 전환
  /tasks              /tasks/:id            /tasks/:id
  ┌────────┐  클릭   ┌────────┐  [편집]   ┌────────┐
  │ 리스트  │ ─────▶ │ 뷰 모드 │ ─────▶   │ 편집폼  │
  └────────┘ ◀─────  └────────┘ ◀─────    └────────┘
                      ← 할일                취소/저장

회의록 — 편집이 별도 라우트
  /notes              /notes/:id            /notes/:id/edit
  ┌────────┐  클릭   ┌────────┐  [편집]   ┌────────┐
  │ 리스트  │ ─────▶ │ 뷰어    │ ─────▶   │ 편집폼  │
  └────────┘ ◀─────  └────────┘ ◀─────    └────────┘
                      ← 회의록              취소/저장
       └──── [+ 회의록 작성] ────▶ /notes/new  (같은 폼, initial 없음)
```

### 왜 둘이 다른가 (중요)

**할일** — 폼이 작다(제목·담당자·기한·본문·첨부). 스크롤이 짧아서 같은 화면에서
갈아끼워도 위치가 안 튄다. → `mode` state 토글.

**회의록** — 폼이 크다(아젠다 N줄 + 에디터 + 할일 3방식 + 임시저장). 스크롤이
길어서 같은 화면에서 갈아끼우면 위치가 튄다. → 별도 라우트.

**둘 다 모달이 아니다.** 판단 기준은 "팝업이냐 아니냐"가 아니라
"같은 URL 안의 모드냐, 다른 URL 이냐"다. 어느 쪽이든 URL 이 있어서
새로고침·뒤로가기·링크 공유·알림 착지가 전부 정상 동작한다.

---

## 원본 파일 대응

### 할일

| 이 파일에 합쳐진 것 | 밋업 원본 |
| --- | --- |
| 01 페이지 본체 | `src/pages/tasks.tsx` |
| 01 리스트 행 `TaskRow` | `src/features/tasks/task-row.tsx` |
| 01 인라인 추가 폼 | `src/features/tasks/task-quick-add.tsx` |
| 02 페이지 셸 + `ViewMode` + `MetaCell` | `src/pages/task-detail.tsx` |
| 03 `EditMode` | `src/pages/task-detail.tsx` |

### 회의록

| 이 파일에 합쳐진 것 | 밋업 원본 |
| --- | --- |
| 04 페이지 본체 | `src/pages/notes.tsx` |
| 04 미리보기 추출 `notePreview` | `src/lib/note-preview.ts` |
| 05 페이지 본체 + `Stat` | `src/pages/note-detail.tsx` |
| 06 페이지 셸 + `syncTasksForNote` 배선 | `src/pages/note-edit.tsx` |
| 06 작성 페이지 차이점 (주석) | `src/pages/note-new.tsx` |
| 06 `NoteForm` · `BulkAssignForm` · `ExistingTaskPanel` · `Section` · `Stacked` | `src/features/notes/note-form.tsx` |

### 공통

| 조각 | 밋업 원본 | 들어있는 파일 |
| --- | --- | --- |
| `Avatar` | `src/components/avatar.tsx` | 01 · 02 · 05 |
| `Pager` / `paginate` | `src/components/pager.tsx` | 01 · 04 |
| `TaskProgress` | `src/components/task-progress.tsx` | 04 · 05 |
| `useDraft` | `src/lib/use-draft.ts` | 03 · 06 |
| `DraftRestoreBanner` / `DraftSaveButton` | `src/features/common/draft-bar.tsx` | 03 · 06 |
| `inputClass` / `labelClass` / `errorBox` | `src/features/auth/_shared.tsx` | 03 · 06 |

**합치지 않고 import 로 남긴 것** (덩치가 커서 별도 복사본으로 둠):

| import | 복사본 |
| --- | --- |
| `RichEditor` / `RichRender` | `reference/src/features/editor/rich-editor.tsx` |
| `AttachmentsSection` | `reference/src/features/attachments/attachments-section.tsx` |
| `LikeCommentBlock` | `reference/src/features/social/like-comment-block.tsx` |
| `useAsync` | `reference/src/lib/use-async.ts` |
| 데이터 레이어 | `reference/src/lib/data/tasks.ts`, `meeting-notes.ts`, `meetings.ts` |

---

## 그대로 돌리려면

`className` 과 마크업은 원본 그대로다. 붙여 넣고 고칠 곳은 세 군데.

1. **import alias** — `@/` → 대상 앱 설정에 맞게
2. **훅** — `useAuth` / `useActiveWorkspace` / `useAsync` 를 대상 앱 동등물로
3. **색 토큰** — `bg-surface` `bg-surface-muted` `text-foreground-muted`
   `text-foreground-faint` `border-line` `border-line-strong` `text-accent-teal`
   `bg-accent` `text-danger` `bg-danger-bg`.
   정의는 `reference/src/index.css`. `.label` 유틸리티(영문 대문자 + 넓은
   트래킹 + 작은 글자)도 함께 필요하다.

---

## 이 화면들에 박혀 있는 디자인 규칙

1. **팝업이 없다.** 목록 → 상세 → 편집이 전부 URL 을 가진다.
   푸시 알림의 `url` 이 착지할 곳이 있으려면 구조적으로 이래야 한다.
2. **그림자 없음 · 둥근 모서리 없음.** 깊이는 hairline `border-line` 하나로.
   체크박스도 사각형. 원형은 아바타뿐.
3. **입력칸은 박스가 아니라 밑줄.** 포커스 시 밑줄만 진해진다.
4. **액센트 색은 세 상황만** — 현재 위치(활성 탭), 완료(체크·진행률),
   긍정 액션(등록/저장). 나머지는 무채색 + 투명도.
5. **위험한 동작일수록 시각적으로 약하게.** 삭제는 테두리 없는 텍스트 링크.
6. **같은 정보를 폭에 따라 재배치.** 담당/기한이 모바일에선 아랫줄로,
   데스크탑에선 오른쪽 고정폭 열로. 폼 행은 `sm:contents` 로 wrapper 를 없애
   모바일 2줄 ↔ 데스크탑 1줄 4열을 마크업 중복 없이 만든다.
   가로 스크롤은 어떤 폭에서도 생기지 않는다.
7. **헤더의 `border-b` 와 첫 행이 곧장 맞닿는다.** 사이에 큰 여백을 두지 않는다.
8. **여러 칸을 나눌 땐 `gap-px` + 배경색.** 셀마다 border 를 그리면 이중선이 생긴다.
9. **결과를 미리 알려준다.** "멤버 6명에게 추가", "2개 선택",
   "행을 클릭하면 상세에서 상태 변경…" 처럼 누르기 전에 뭐가 되는지 적는다.
10. **빈 상태는 문장으로.** "아직 작성된 회의록이 없습니다." — 빈 카드나
    일러스트를 두지 않는다.

자세한 배경은 상위 폴더의 [`05-할일.md`](../../05-할일.md) ·
[`06-회의-일정-회의록.md`](../../06-회의-일정-회의록.md) ·
[`00-이식-원칙.md`](../../00-이식-원칙.md) 참고.
