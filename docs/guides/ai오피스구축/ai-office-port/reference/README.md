# reference/ — 밋업 실제 소스 복사본

여기 있는 파일은 전부 **밋업 저장소에서 실제로 돌아가는 코드의 스냅샷**이다.
설명용으로 다시 쓴 게 아니라 그대로 복사한 것이므로, **복붙해서 이름만 바꿔 쓰면 된다.**

## 경로 규칙

밋업 저장소의 경로를 그대로 미러링한다.

```
reference/src/features/social/like-comment-block.tsx
        ↓ 대응
        src/features/social/like-comment-block.tsx      (밋업 원본)
```

`reference/supabase/…`, `reference/public/…` 도 마찬가지.

## 복사해 올 때 손대야 하는 곳 3가지

1. **import alias** — 밋업은 `@/` → `src/`. 대상 앱 설정에 맞게.
2. **훅 경로** — `@/lib/auth-context` 의 `useAuth`,
   `@/lib/active-workspace` 의 `useActiveWorkspace`. 대상 앱의 동등물로 교체.
3. **색 토큰 이름** — `bg-surface` / `text-foreground-muted` / `border-line` /
   `text-accent-teal` 등. 대상 앱 토큰으로 치환하거나
   `reference/src/index.css` 의 정의를 가져간다.

## 스냅샷 기준

- 밋업 `main` 브랜치, 2026-08-21 시점
- 마이그레이션 `001` ~ `055` 적용 상태
- Tiptap 3.23.x / React 19 / React Router 7 / Tailwind v4

원본이 이후에 바뀌었을 수 있으니, 큰 차이가 의심되면 밋업 저장소의 같은 경로를
직접 확인하는 게 확실하다.

## 무엇을 먼저 볼까

| 목적 | 이 파일부터 |
| --- | --- |
| 상세 페이지 표준형이 궁금 | `src/pages/task-detail.tsx` |
| 좋아요·댓글·답글 UI | `src/features/social/like-comment-block.tsx` |
| 데이터 레이어가 알림까지 책임지는 모양 | `src/lib/data/tasks.ts` |
| 회의록 저장 한 번에 할일까지 | `src/features/notes/note-form.tsx` + `src/lib/data/tasks.ts` 의 `syncTasksForNote` |
| 알림 서버 로직 | `supabase/functions/notify/index.ts` |
| 좋아요/댓글 SQL 템플릿 | `supabase/migrations/047_task_social.sql` |
