# screens/ — 화면 3종 디자인 참고본 (할일)

다른 앱에 **밋업 화면이 어떻게 생겼는지 그대로 보여주기 위한** 파일 3개.
각 파일이 화면 하나에 대응하고, 그 화면에서 **보이는 것 전부를 한 파일에** 담았다
(원본은 여러 파일로 나뉘어 있지만 여기서는 합쳐 두었다).

| 파일 | 화면 | 라우트 |
| --- | --- | --- |
| [`01-할일-목록-페이지.tsx`](01-할일-목록-페이지.tsx) | 할일 목록 (헤더·탭·필터·행·페이저·추가폼) | `/tasks` |
| [`02-할일-상세-뷰어.tsx`](02-할일-상세-뷰어.tsx) | 행을 눌렀을 때 열리는 **새 페이지** | `/tasks/:id` |
| [`03-할일-상세-편집.tsx`](03-할일-상세-편집.tsx) | 뷰어에서 [편집] 을 눌렀을 때 | `/tasks/:id` (URL 동일) |

## 화면 흐름

```
/tasks                       /tasks/:id                    /tasks/:id
목록                          뷰 모드                        편집 모드
                  행 클릭                   [편집] 클릭
  ┌────────┐    ────────▶   ┌────────┐   ────────▶       ┌────────┐
  │ 리스트  │                │ 읽기    │                   │ 폼      │
  └────────┘    ◀────────   └────────┘   ◀────────       └────────┘
                 ← 할일                     취소 / 저장
```

**02 와 03 은 같은 URL 이다.** 원본(`src/pages/task-detail.tsx`)은 한 파일에서
`mode` state 로 전환한다 — 새 라우트도, 팝업/모달도 아니다.
여기서는 화면을 보기 쉽게 파일만 둘로 쪼갠 것뿐이다.

```tsx
const [mode, setMode] = useState<"view" | "edit">("view");
{mode === "view" ? <ViewMode … /> : <EditMode … />}
{mode === "view" && <LikeCommentBlock … />}   // 편집 중엔 소셜 블록을 감춤
```

## 원본 파일 대응

| 이 파일에 합쳐진 것 | 밋업 원본 |
| --- | --- |
| 01 페이지 본체 | `src/pages/tasks.tsx` |
| 01 리스트 행 `TaskRow` | `src/features/tasks/task-row.tsx` |
| 01 인라인 추가 폼 | `src/features/tasks/task-quick-add.tsx` |
| 01 페이저 | `src/components/pager.tsx` |
| 02 페이지 셸 + `ViewMode` | `src/pages/task-detail.tsx` |
| 03 `EditMode` | `src/pages/task-detail.tsx` |
| 03 `useDraft` | `src/lib/use-draft.ts` |
| 03 임시저장 배너/버튼 | `src/features/common/draft-bar.tsx` |
| 03 `inputClass` / `labelClass` / `errorBox` | `src/features/auth/_shared.tsx` |
| 01·02 `Avatar` | `src/components/avatar.tsx` |

**합치지 않고 import 로 남긴 것** (덩치가 커서 별도 복사본으로 둠):

| import | 복사본 |
| --- | --- |
| `RichEditor` / `RichRender` | `reference/src/features/editor/rich-editor.tsx` |
| `AttachmentsSection` | `reference/src/features/attachments/attachments-section.tsx` |
| `LikeCommentBlock` | `reference/src/features/social/like-comment-block.tsx` |
| `useAsync` | `reference/src/lib/use-async.ts` |
| `lib/data/tasks.ts` | `reference/src/lib/data/tasks.ts` |

## 그대로 돌리려면

`className` 과 마크업은 원본 그대로다. 붙여 넣고 고칠 곳은 세 군데.

1. **import alias** — `@/` → 대상 앱 설정에 맞게
2. **훅** — `useAuth` / `useActiveWorkspace` / `useAsync` 를 대상 앱 동등물로
3. **색 토큰** — `bg-surface` `text-foreground-muted` `border-line`
   `text-accent-teal` `bg-surface-muted` `text-danger` `bg-danger-bg` 등.
   정의는 `reference/src/index.css` 에 있다. 여기에 더해 `.label` 유틸리티
   (영문 대문자 + 넓은 트래킹 + 작은 글자)도 필요하다.

## 이 3화면에 박혀 있는 디자인 규칙

1. **팝업이 없다.** 목록 → 상세 → 편집이 전부 페이지(또는 같은 페이지의 모드).
   푸시 알림의 `url` 이 착지할 곳이 있으려면 구조적으로 이래야 한다.
2. **그림자 없음 · 둥근 모서리 없음.** 깊이는 hairline `border-line` 하나로.
   체크박스도 사각형. 원형은 아바타뿐.
3. **입력칸은 박스가 아니라 밑줄.** 포커스 시 밑줄만 진해진다.
4. **액센트 색은 세 상황만** — 현재 위치(활성 탭), 완료 상태(체크·라벨),
   긍정 액션(등록/저장 버튼). 나머지는 전부 무채색 + 투명도.
5. **위험한 동작일수록 시각적으로 약하게.** 삭제는 테두리 없는 텍스트 링크.
6. **같은 정보를 폭에 따라 재배치.** 담당/기한이 모바일에선 제목 아래 줄로,
   데스크탑에선 오른쪽 고정폭 열로. 가로 스크롤은 어떤 폭에서도 생기지 않는다.
7. **헤더의 `border-b` 와 첫 행이 곧장 맞닿는다.** 사이에 큰 여백을 두지 않는다.

자세한 배경은 상위 폴더의 [`05-할일.md`](../../05-할일.md) 와
[`00-이식-원칙.md`](../../00-이식-원칙.md) 참고.
