# 콘텐츠 허브 + 인사이트 통합 설계

**작성:** 2026-09-15 · **상태:** 설계(리뷰 대기) · **관련:** `docs/DATA_SCHEMA.md`, `docs/FEATURE_ROADMAP.md`

## 0. 결정사항 (사용자 확정)
1. **콘텐츠 = 마스터 허브**, 유튜브 라이브 데이터는 **연결(FK)** 로 붙인다. 유튜브 기능은 유지.
2. **인사이트 + 기억 → '인사이트' 하나로 통합**. `company_memory`(상위집합)를 흡수하되 메뉴 이름·진입점은 '인사이트'. `kind`는 '종류' 필터로.
3. **설계 문서 먼저** → 리뷰 후 단계별 빌드.

## 1. 통합 후 메뉴 구조 (nav)
현재 `콘텐츠` 그룹: `인사이트 · 콘텐츠 · 유튜브 · 기억 · 기록` (5개)
→ 통합 후: **`인사이트 · 콘텐츠 · 기록`** (3개)

| 변화 | 내용 |
|------|------|
| 유튜브(`content`) | 별도 메뉴 제거 → 콘텐츠 허브의 **채널 필터 "유튜브"** 안으로. 코드(`ContentPage`)는 콘텐츠 내부 채널뷰로 재사용 |
| 기억(`memory`) | 별도 메뉴 제거 → **인사이트**에 흡수(종류=기억 계열). `CompanyMemoryView`는 통합 인사이트 뷰로 병합 |
| ViewId 혼란 | `contents`(콘텐츠)/`content`(유튜브) 이원화 해소 → `content` 제거, `contents`만 |

---

## 2. 콘텐츠 허브 설계

### 2.1 핵심 개념
> **아이디어 1개 → 채널별 발행물 N개 + 각 수치** 를 "타고타고" 기록.
> 예: 아이디어 "원목 무드 스타일링" → [유튜브 쇼츠 A(조회 3.2K)] + [인스타 릴스 B(저장 210)] + [스레드 C(좋아요 88)]

### 2.2 데이터 모델 변경 (`content_items`)
| 신규 컬럼 | 타입 | 의미 |
|-----------|------|------|
| `idea_id` | UUID, self-FK → content_items(id), nullable | 이 콘텐츠가 속한 **부모 아이디어**. NULL이면 자기 자신이 아이디어(루트) |
| `category` | TEXT, nullable | 자유 카테고리(할일 tcat 세트 재사용 또는 문자열). contentType(desire/info/worldview/behind)과 별개 |
| `channel` | TEXT, nullable | **정규화된 채널 키**(`youtube`/`instagram`/`threads`/`blog`/`tiktok`/`etc`). 기존 `platform`(자유문자열)은 표시용으로 두고, 필터·그래프는 `channel` 사용 |

- 기존 `platform` 자유문자열 → `channel` 정규화 매핑(백필): `Instagram→instagram`, `YouTube/YouTube Shorts→youtube`, `Blog→blog`, `Pinterest→etc`, `오늘의집→etc`, `Other→etc`. **threads 신규 추가.**
- 아이디어 트리는 **1단계**만(아이디어→발행물). 발행물이 또 자식을 갖지 않음(단순화).

### 2.3 유튜브 연결 (`youtube_videos`)
| 신규 컬럼 | 타입 | 의미 |
|-----------|------|------|
| `content_item_id` | UUID, FK → content_items(id), nullable | 이 유튜브 영상이 연결된 콘텐츠 발행물. 연결 시 조회/좋아요/댓글이 그 콘텐츠 수치로 자동 반영 |

- 스코프 정리 선행: youtube_*는 `user_id`+`workspace_id` 혼합 → 오피스에선 `workspace_id` 기준으로 조회하도록 서비스 정리(기존 동작 보존, 추가 필터만).
- 연결 UX: 콘텐츠 발행물(채널=유튜브) 상세에서 "유튜브 영상 연결" → 워크스페이스의 `youtube_videos` 목록에서 선택 → FK 세팅.
- 자동수치: 연결되면 상세/그래프에서 `youtube_videos.view_count/like_count/comment_count`를 **라이브 수치**로 표시(수기 `content_metrics`와 병행, 소스 라벨로 구분).

### 2.4 화면 (3가지 보기 + 필터)
```
┌ 콘텐츠 (CONTENT) ─────────────────────────────┐
│ [아이디어] [카테고리] [채널]   ← 보기 탭         │
│ 채널칩: 전체 · 유튜브 · 인스타 · 스레드 · 블로그  │  ← 채널 필터(유튜브 메뉴 톤)
│ 검색 · + 콘텐츠                                 │
├───────────────────────────────────────────────┤
│ ▼ 아이디어 보기                                 │
│  💡 원목 무드 스타일링           [+ 발행물 연결] │
│    └ ▶ 쇼츠 A · 유튜브 · 조회 3.2K · 발행       │
│    └ 📷 릴스 B · 인스타 · 저장 210 · 발행        │
│    └ 🧵 스레드 C · 스레드 · 좋아요 88 · 예약     │
│  💡 PTE 스피킹 팁 …                             │
├───────────────────────────────────────────────┤
│ ▼ 채널 보기 (채널=유튜브 선택 시)               │
│  [채널별 통계 그래프 — 조회/좋아요/댓글 추이]    │  ← WeeklyTrendChart 이식
│  유튜브 라이브 영상 목록(ContentPage 재사용)     │
└───────────────────────────────────────────────┘
```
- **아이디어 보기**: 루트(idea_id=null) 아이디어 → 자식 발행물 트리. 아이디어에서 "발행물 연결/추가".
- **카테고리 보기**: `category`로 그룹.
- **채널 보기**: `channel`로 그룹 + 선택 채널 **통계 그래프** + (유튜브면) 라이브 영상.
- **채널 필터 칩**: 모든 보기에 공통. 유튜브 메뉴의 `activeChannel` 패턴(ContentPage.tsx:64,101-108,210-233) 이식.

### 2.5 채널별 통계 그래프
- 소스: (a) 연결된 유튜브 영상의 라이브 수치, (b) 수기 `content_metrics` 체크포인트.
- 어댑터로 `{ date, views, likes, comments }[]`로 정규화 → 유튜브 `WeeklyTrendChart`(ContentPage.tsx:29 `buildWeeklyStats`) 재사용.
- 채널별 카드: 발행 수 · 총 조회 · 총 좋아요 · 추이 스파크라인.

---

## 3. 인사이트 통합 설계

### 3.1 방향
- 진입점·이름 = **인사이트**. 내부 데이터는 `company_memory`(상위집합)로 일원화.
- `insights` 테이블 데이터 → `company_memory`로 마이그레이션(무손실).
- `company_memory.kind` 8종을 **'종류' 필터**로 노출: 인사이트 ✨ · 아이디어 💡 · 철학 · 실패 · 실험 · 레퍼런스 · 경쟁사 · 대표메모.

### 3.2 데이터 마이그레이션 (`insights` → `company_memory`)
| insights | → company_memory | 비고 |
|----------|------------------|------|
| title | title | |
| content | body | |
| tags | tags | |
| category | tags에 병합 or 신규 `category` 컬럼 | 결정 필요(3.4) |
| source, link | `company_memory`에 `source`,`link` 컬럼 신규 추가 | 무손실 위해 |
| priority, starred | `salience`(priority 매핑) / `pinned`(starred) | high→80, med→50, low→20 |
| is_shared | (워크스페이스 값이면 공유로 간주) | company_memory는 workspace_id 필수 |
| kind | `'insight'` 고정 | |

### 3.3 기능 이식 (손실 방지)
- 인사이트에만 있던 연동을 `companyMemory.service.ts`에 이식:
  - `recordActivity` (활동 로그) — 생성/수정 시
  - `notify({ type: 'notify_content' … })` (팀 알림) — insights.service.ts:60 패턴
  - `is_shared` 개념 = workspace_id 존재로 대체(오피스는 항상 workspace 스코프)
- `InsightRow`(service) / `InsightItem`(types) 이원화 → 통합 타입으로 정리.

### 3.4 열린 결정
- insights.category(tcat-*)를 **company_memory에 category 컬럼으로 살릴지**, tags로 흡수할지. → **category 컬럼 추가 권장**(콘텐츠 category와도 개념 일치).

---

## 4. DB 마이그레이션 (다음 번호 051~)
> CLAUDE.md 규칙: idempotent, nullable+default, 파일명·상단주석에 번호, DATA_SCHEMA.md 갱신, Mock 3곳 동기화.

| # | 파일 | 내용 |
|---|------|------|
| 052 | `052_content_idea_category_channel.sql` | content_items에 `idea_id`(self-FK)·`category`·`channel` 추가 + platform→channel 백필 + 인덱스(idea_id, channel) |
| 053 | `053_youtube_video_content_link.sql` | youtube_videos에 `content_item_id` FK 추가 + 인덱스 |
| 054 | `054_company_memory_source_category.sql` | company_memory에 `source`·`link`·`category` 추가 |
| 055 | `055_migrate_insights_into_memory.sql` | insights → company_memory 복사(kind='insight', 매핑). **insights 테이블은 드롭하지 않고 보존**(롤백 안전), 앱은 company_memory만 읽음 |
| — | 참고 | 051은 Phase 0 카테고리(`051_options_workspace.sql`)가 이미 사용 |

## 5. Mock 3곳 동기화 (필수)
각 신규 컬럼마다: `types.ts`(camelCase) / `*.service.ts` Row(snake_case)+변환 / `mockSupabase.ts` 매핑.
- ContentItem: `ideaId`, `category`, `channel`
- YoutubeVideo: `contentItemId`
- CompanyMemory: `source`, `link`, `category`
- mock 시드에 아이디어→발행물 트리 + 채널 예시 + 연결된 유튜브 영상 샘플 → 그래프/필터 검증
- `_LS_KEY` 버전 bump

## 6. 단계별 빌드 플랜
1. **마이그 051 + 콘텐츠 채널 정규화·필터 칩·카테고리** (저위험 승수: platform→channel, 필터 UI)
2. **아이디어→연결 콘텐츠** (idea_id 트리, 아이디어 보기, 발행물 연결 UX)
3. **채널별 통계 그래프** (WeeklyTrendChart 이식 + 어댑터) + **유튜브 연결(052)** + 유튜브 메뉴를 채널뷰로 편입
4. **인사이트 통합** (053/054 + company_memory를 '인사이트' 메뉴로 + 기능 이식 + nav에서 기억/유튜브 제거)

각 단계: 빌드→브라우저 확인→커밋. DATA_SCHEMA.md·Mock 동기화 동반.

## 7. 리스크 & 유의
- **유튜브 스코프 혼합**(user_id+workspace_id): 052 전에 서비스 조회를 workspace 기준으로 정리(기존 개인 동작 보존).
- **데이터 무손실**: insights는 드롭하지 않고 복사만(롤백 대비). 검증 후 별도 정리 단계.
- **수치 소스 이질성**(수기 체크포인트 vs API 누적): 그래프는 어댑터로 정규화, UI에 소스 라벨.
- **아이디어 트리 단순화**: 2단계까지만(아이디어→발행물). 무한 중첩 금지.
- **모바일**: 채널 칩·보기 탭 가로 스크롤 처리.

---

## 부록 A. 공통 에디터 개선 — 툴바 고정 + 내부 스크롤 (전 앱)
> 배경: 에디터 본문이 길어지면(대부분 그렇게 됨) 지금은 에디터가 통째로 늘어나 **툴바가 위로 사라진다.** 이미지·서식을 넣으려면 한참 위로 스크롤해야 함. → 일정 높이 이상이면 **툴바 고정 + 본문 영역만 내부 스크롤**.

### 조사 결과 (단일 컴포넌트)
`src/components/tiptap/TiptapEditor.tsx` **하나**를 4곳이 공유 → 여기만 고치면 전부 전파:
| 사용처 | 메뉴 |
|--------|------|
| `RecordForm.tsx` | 기록(개인) 메모 |
| `readings/StudyNoteEditor.tsx` | 독서(개인) 스터디 노트 |
| `office/MeetingsView.tsx` | 회의(오피스) 회의록 |
| `office/views.tsx` | 인사이트/콘텐츠(오피스) 본문 |
+ 콘텐츠 허브의 **아이디어 에디터**도 동일 컴포넌트를 쓸 것.

### 현재 구조 & 문제
```
<div className="border rounded-xl bg-white">   ← outer 카드
  <div className="tiptap-toolbar"> …버튼… </div>  ← 툴바 (static)
  <EditorContent/>  ( .tiptap = ProseMirror, 높이 제한 없음 → 무한 성장 )
</div>
```
`.tiptap`에 max-height/overflow가 없어 본문이 길어지면 카드가 끝없이 커지고, 부모(팝업/페이지)가 스크롤되며 툴바가 밀려남.

### 수정안 (TiptapEditor + tiptap.css, 중앙집중)
1. `<EditorContent>`를 **`.tiptap-scroll`** 래퍼로 감싼다: `max-height:var(--tiptap-max, 52vh); overflow-y:auto;`.
2. `.tiptap-toolbar`: `position:sticky; top:0; z-index:2; background:var(--surface); border-bottom` — 스크롤 컨테이너 최상단 고정(래퍼 밖에 두면 자연 고정, sticky는 이중 안전).
3. **props 추가**: `maxHeight?`(기본 52vh)·`minHeight?`·`autoGrow?`(페이지형은 캡 없이). 모달형(아이디어 에디터·기록 메모)은 캡, 페이지형은 크게/무제한 선택.
4. `TiptapReadOnly`(보기 전용)는 스크롤 캡 없이 그대로(상세 팝업에서 전체 표시).

### 적용 & 검증
- 4개 사용처 + 아이디어 에디터에서: 길게 입력 시 **툴바 항상 상단**, 본문만 내부 스크롤, 팝업/페이지 자체는 안 늘어남.
- 모바일 캡 높이 별도(예: `--tiptap-max:60vh`).
- 이미지 삽입 시 스크롤 위치 유지 확인.

### 순서
카테고리 기반(Phase 0)과 함께 **공통 인프라**로 먼저 반영 → 콘텐츠 허브 아이디어 에디터가 곧바로 이 동작을 상속.
