# 밋업 — 독서/강의 챌린지 & 글쓰기 상세 명세

> **연결 문서:** [meetup-spec.md](meetup-spec.md) — 본 문서는 그 중 §2.3(독서)·§2.4(글쓰기)를 확장한 상세 스펙
> **용도:** Claude Code 구현용 — 데이터 모델, API 연동, 화면 구조, UI 레이아웃, 컴포넌트 트리까지
> **작성일:** 2026-05-19 (v1 작성) / 2026-05-19 (v2 — Sol AI Office 실제 코드 검증 후 정정)
> **디자인:** 색상/폰트는 앱 전체 톤에 맞추므로 본 문서에서는 다루지 않음. **레이아웃/구성/인터랙션만** 정의.

---

## ⚠️ 변경 이력 — v1 → v2 (Claude Code 필독)

v1(초안)에서 추측으로 적었던 부분을 Sol AI Office 실제 코드와 대조해 **8가지를 정정**했다.
v1만 보고 구현하면 데이터 모델/UI/API 호출이 모두 어긋난다. **반드시 v2 기준으로 구현할 것.**

검증한 원본 파일: `src/services/aladinApi.ts`, `src/services/claudeApi.ts`, `src/services/readings.service.ts`,
`src/pages/ReadingsPage.tsx`, `src/components/readings/ReadingDetailView.tsx`,
`src/types.ts`, `vite.config.ts`, `server.js`.

### 정정 8가지

| # | v1 (틀림 — 무시할 것) | v2 (정확 — 이걸로 구현) | 근거 위치 |
|---|----------------------|------------------------|----------|
| 1 | `reading_toc` 별도 테이블 + `id/order_index/level/page/is_completed/completed_at` 컬럼 | `readings.chapters: text[]` **단일 컬럼** | `readings.service.ts:32` / `types.ts:241` |
| 2 | 챕터별 **체크박스 토글 UI**, 등록자만 토글 | 체크박스 없음. **노트의 `chapter[]` union으로 자동 판정** (`writtenChapters` Set) | `ReadingDetailView.tsx:438~485` |
| 3 | `toc_source` 컬럼 + "YES24 ✓ / AI 추정" **배지** | 출처 구분 없음. 배지 만들지 말 것 | (없음 — 원본도 구분 안 함) |
| 4 | 등록 시 **자동 백그라운드** YES24 크롤링 | 사용자가 **[AI 목차 생성] 버튼 명시적 클릭** 시에만 호출 | `ReadingsPage.tsx:157~168` |
| 5 | `server.js`의 알라딘도 `createProxyMiddleware` | 알라딘은 **수동 `fetch` + `redirect: 'follow'`** (리다이렉트 처리). YES24만 `proxyMiddleware` | `server.js:47~74` |
| 6 | 진행률 계산 로직 없음 | 페이지 우선 → 챕터 비율(`written/total * totalPages`) 폴백 + **역주행 방지**(estimated > current 일 때만) | `ReadingDetailView.tsx:110~127` |
| 7 | Claude 프롬프트 "정리해줘" 정도로 추상 | **원문 규칙 10개** + `'챕터번호-세부번호 제목'` 형식 + 결과 후처리 정규식 `/^\d+-\d+\s/` | `claudeApi.ts:95~133` |
| 8 | YES24 HTML 분리 "스크래핑" 한 줄 | `infoset_toc` indexOf → +10000자 슬라이스 → `<textarea class="txtContentText">` 매칭 → `<br>`→\n + 태그 제거 | `claudeApi.ts:33~61` |

### v2에서 추가된 핵심 디테일
- **알라딘 응답 정제 4종 정규식**: title 부제 제거, author `(지은이)/(옮긴이)` 제거, `parseCategoryToTags` ("국내도서" 제외), `priceSales || priceStandard`
- **Claude 호출 사양**: 모델 `claude-sonnet-4-20250514`, `max_tokens: 8192`, 헤더 `anthropic-version: 2023-06-01`
- **YES24 헤더 조작**: `origin`/`referer`/`sec-fetch-mode/site/dest` 제거 + UA를 `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36`로 강제 (이거 빠지면 봇 차단)
- **ISBN 폴백 흐름**: `generateBookToc` 호출 시 ISBN 없으면 → `searchBooks(title)`로 알라딘 검색 → `results[0].isbn13`을 자동 확보 → YES24로 진행
- **이식 시 의존성**: `tocCrawler.ts`가 `aladinApi.ts`의 `searchBooks`를 import 함 (ISBN 폴백 위해)
- **카테고리 분기**: 도서(`rcat-book`)만 `chapters`/`totalPages`, 강좌(`rcat-course`)는 `totalLessons` 사용 — 강좌 자동 진행률 추정 없음
- **C.7 표**: Sol AI Office와 밋업의 차이를 한눈에 정리 (`workspace_id` 추가 / 공유 토글 / 외부 블로그 노트 / 댓글·좋아요만 신규)

### 옮길 파일 (Sol AI Office → 밋업) — 빠짐없이
1. `src/services/aladinApi.ts` — **전체 그대로**
2. `src/services/claudeApi.ts` 중 `searchYes24`/`fetchYes24Toc`/`crawlBookToc`/`formatTocWithClaude`/`generateBookToc` 5개 함수 → `src/services/tocCrawler.ts`로 분리
3. `src/utils/readingProgress.ts` — `calcReadingProgress`/`progressLabel`
4. `server.js`의 `/api/aladin`(수동 fetch)·`/api/yes24`(proxyMiddleware) 블록
5. `vite.config.ts` 의 dev 프록시 (claude/aladin/yes24 필수, openai/perplexity는 밋업에서 불필요)
6. `src/components/readings/StudyNoteEditor.tsx` — chapter 드롭다운 + 도서/강좌 분기 로직 베이스

> **신호:** 이 변경 이력 표(8개)와 § A.2 / A.3 본문이 충돌하면 **본문이 우선**. v2 본문은 모두 실제 코드 기준으로 다시 쓴 것이다.

---

## 0. 두 메뉴의 공통 원칙

밋업의 독서/강의·글쓰기는 **"챌린지형 공유 모임"** 컨셉이다. Sol AI Office의 단일 사용자 기록과 달리,
**누가 무엇을 어디까지 했는지가 모임 안에서 자연스럽게 보이는 것이 가장 중요**하다.

### 공통 원칙 (5가지)
1. **2가지 등록 방식** — 사용자가 ① 앱 내 에디터로 직접 작성, ② 외부 블로그 URL 불러오기 (네이버/티스토리/브런치/벨로그/미디엄) 중 선택
2. **공유 토글** — 모든 항목은 `is_shared`로 모임 공개/비공개를 작성자가 제어
3. **작성자 표시 필수** — 카드/리스트 어디서든 상단에 멤버 아바타 + 닉네임 항상 노출 (챌린지 본질)
4. **댓글/좋아요** — 공유된 항목에는 멤버끼리 피드백 가능
5. **활동 피드 연동** — 등록/완료 이벤트가 워크스페이스 활동 피드(`activities`)에 자동 기록

### 등록 흐름 (독서·글쓰기 공통)
```
[+ 새로 추가] 버튼
    ├─ 직접 쓰기 → 앱 내 에디터
    └─ 블로그 불러오기 → URL 입력 → 메타데이터/본문 자동 추출 → 미리보기 → 저장
                                  ↓
                            (제목/대표이미지/요약/원문링크 보존)
```

---

# Part A. 독서/강의 챌린지

## A.1 기능 개요

### 한 줄 정의
> 멤버들이 책·강의를 등록하고 진행률·노트·후기를 공유하며 서로 자극받는 **모임형 학습 챌린지**.

### 핵심 기능
1. **자료 등록**
   - 책: 알라딘 검색으로 표지/저자/페이지수 자동 입력
   - 강의: URL 또는 수동 입력 (커버 이미지 업로드 가능)
2. **목차 자동 생성** — 책은 YES24 크롤링으로 자동 추출, 실패 시 Claude AI 추측 폴백
3. **진행률 추적** — 책: 현재 페이지 / 강의: 현재 회차
4. **노트(독후감) 작성** — ① 앱 내 에디터 ② 블로그 URL 불러오기
5. **챌린지 보드** — 멤버별 진행률·완료 수를 한눈에 보는 리더보드
6. **추천 도서/강의** — 멤버가 모임에 추천, 다른 멤버가 "나도 읽을래" 표시
7. **댓글/좋아요** — 노트 공개 시 멤버끼리 피드백

---

## A.2 데이터 모델

> 기존 `meetup-spec.md §4.5`의 `readings` / `reading_notes`를 확장.

### A.2.1 `readings` (책/강의 항목)

**Sol AI Office의 `readings` 테이블 구조를 그대로 가져와 워크스페이스 컬럼만 추가**.
목차는 별도 테이블 없이 `chapters text[]` 단일 컬럼으로 보관 (실제 운영 검증된 구조).

```sql
readings (
  id              uuid pk,
  workspace_id    uuid not null,            -- ★ 밋업에서 추가
  user_id         uuid not null,            -- 등록한 멤버 (= 챌린지 참여자)

  -- 기본
  title           text not null,
  author          text,
  category        text not null,            -- 'rcat-book' | 'rcat-course' (Sol AI Office 카테고리 ID 그대로)
                                            -- 또는 커스텀 카테고리 ID
  cover_emoji     text default '📖',
  cover_image     text,                     -- 표지 이미지 URL (알라딘 cover 또는 업로드 URL)

  -- 진행률
  status          text not null default 'planned',  -- 'planned' | 'reading' | 'completed'
                                                    -- (Sol AI Office와 동일)
  current_page    int,                      -- 도서
  total_pages     int,                      -- 도서 (알라딘 subInfo.itemPage)
  current_lesson  int,                      -- 강좌
  total_lessons   int,                      -- 강좌
  start_date      date,
  completed_date  date,

  -- 후기
  rating          int,                      -- 1~5
  review          text,                     -- 한줄평

  -- 외부 메타
  tags            text[],                   -- 알라딘 카테고리 파싱 결과 (parseCategoryToTags)
  link            text,                     -- 외부 URL (알라딘 link 또는 강의 URL)
  price           int,                      -- 가격
  isbn13          text,                     -- ★ ISBN13 (목차 크롤링 키)

  -- 목차 (★ 핵심: 별도 테이블 없이 컬럼 두 개로 처리)
  toc             text,                     -- 원본 raw 목차 (YES24 HTML 정제 텍스트, 옵션)
  chapters        text[],                   -- ★ 파싱된 챕터 배열 ('0-1 제목', '1-1 제목' 형식)

  -- 챌린지/공유 (밋업 추가)
  is_shared       boolean default true,     -- 모임 공개 (default true: 챌린지 본질)
  recommended_by  uuid,                     -- 다른 멤버가 추천했다면 그 멤버 id

  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
)
```

**핵심 결정 — 별도 `reading_toc` 테이블 만들지 않는다:**
- Sol AI Office에서 검증된 구조: 단순 `chapters: text[]` 배열로 충분
- 챕터 단위 "완료 체크박스"는 **DB 컬럼이 아니라 노트로부터 자동 계산** (A.4 참조)
- `toc` 원본은 디버깅/재처리용으로만 보관 (필수 아님)

### A.2.2 `reading_notes` (노트/독후감 — Sol AI Office `study_notes` 확장)

Sol AI Office의 `StudyNote`는 도서용(`content`)/강좌용(`rawText`/`sections`/`actionItems`)을 한 테이블에 담음.
밋업은 여기에 **외부 블로그 불러오기** 분기만 추가.

```sql
reading_notes (
  id              uuid pk,
  workspace_id    uuid not null,            -- ★ 밋업 추가
  reading_id      uuid not null references readings(id) on delete cascade,
  user_id         uuid not null,
  date            date not null,            -- YYYY-MM-DD
  time            text,                     -- HH:mm
  chapter         text[],                   -- ★ 복수 챕터 선택 가능 (Sol AI Office와 동일)
                                            --   readings.chapters 배열 중에서 선택

  -- 소스 분기 (밋업 신규)
  source_type     text not null default 'editor',  -- 'editor' | 'external_blog'

  -- editor 본문
  content         jsonb,                    -- Tiptap JSON (도서용)
  raw_text        text,                     -- 원본 텍스트 (강좌 녹음 텍스트 등)
  sections        jsonb,                    -- 강좌용 요약 섹션 배열
  action_items    jsonb,                    -- 강좌용 액션 아이템 체크리스트

  -- external_blog 본문 (밋업 신규)
  external_url       text,                  -- 원문 URL
  external_title     text,                  -- 블로그 글 제목 (og:title)
  external_excerpt   text,                  -- 요약 (og:description)
  external_thumbnail text,                  -- 대표 이미지 (og:image)

  -- 챌린지/공유
  is_shared       boolean default true,

  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
)
```

### A.2.3 `challenges` (선택 — 챌린지 그룹화)
```sql
-- "이번 분기 마케팅 책 3권 읽기" 같은 묶음 챌린지를 만들고 싶을 때.
-- MVP에서는 없어도 됨. readings.is_shared=true 자체가 챌린지로 동작.
challenges (
  id            uuid pk,
  workspace_id  uuid not null,
  title         text not null,
  description   text,
  type          text not null,              -- 'reading' | 'lecture' | 'mixed'
  target_count  int,                        -- 목표 개수 (예: 책 5권)
  start_date    date,
  end_date      date,
  created_by    uuid,
  created_at    timestamptz
)
-- readings.challenge_id로 N:1 연결 (선택 컬럼)
```

### A.2.4 댓글/좋아요 (재사용)
- `insight_likes` / `insight_comments` 패턴을 그대로 차용해
  `reading_note_likes`, `reading_note_comments` 테이블 생성.

### A.2.5 RLS 정책 요약
| 동작 | 권한 |
|------|------|
| `readings` 조회 | 워크스페이스 멤버 (단, `is_shared=false`면 본인만) |
| `readings` 생성/수정 | 본인 항목만 (`user_id = auth.uid()`) |
| `readings.chapters` 업데이트 | 본인만 (목차 생성/수정도 readings UPDATE로 처리) |
| `reading_notes` 조회 | 멤버 (`is_shared=false`면 본인만) |
| `reading_notes` 생성/수정 | 부모 `readings.user_id`만 (= 본인 책에만 노트 작성) |

> 챕터 단위 "체크"는 DB 컬럼이 아니라 노트 작성에서 파생되므로 별도 RLS 불필요.

---

## A.2.6 진행률 자동 계산 (★ 핵심 로직 — Sol AI Office 원본 그대로)

별도 체크박스 UI 없이 **"노트가 작성된 챕터 = 완료한 챕터"**로 간주.
`src/components/readings/ReadingDetailView.tsx`의 `handleSaveNote` 안에 구현됨.

### 챕터 진행률 표시 (도서)
```ts
// "완료한 챕터" 집합 = 모든 노트의 chapter[] union
const writtenChapters = new Set<string>();
studyNotes.forEach((n) => {
  n.chapter?.forEach((ch) => writtenChapters.add(ch));
});

// 표시: "(writtenChapters.size / reading.chapters.length 완료)"
// 각 챕터 row: done=writtenChapters.has(ch) ? 초록색 ✓ : 회색 + [노트 작성] 버튼
```

### `currentPage` 자동 업데이트 (노트 저장 시점)
```ts
if (reading.category === 'rcat-book') {
  if (pageNumber && pageNumber > 0) {
    // 1) 페이지 직접 입력했으면 그걸 그대로 사용
    onUpdateReading({ ...reading, currentPage: pageNumber });
  } else if (
    noteData.chapter?.length > 0 &&
    reading.chapters?.length > 0 &&
    reading.totalPages
  ) {
    // 2) 페이지 미입력 + 챕터만 선택 → 비율로 추정
    const allWritten = new Set<string>();
    studyNotes.forEach((n) => n.chapter?.forEach((ch) => allWritten.add(ch)));
    noteData.chapter.forEach((ch) => allWritten.add(ch));  // 방금 저장한 노트도 포함
    const ratio = allWritten.size / reading.chapters.length;
    const estimatedPage = Math.round(ratio * reading.totalPages);

    // ★ 역주행 방지: 현재 page보다 클 때만 업데이트
    if (estimatedPage > (reading.currentPage || 0)) {
      onUpdateReading({ ...reading, currentPage: estimatedPage });
    }
  }
}
```

### 강좌(`rcat-course`)의 경우
- 챕터 = 회차로 간주 가능하지만 Sol AI Office는 강좌에 자동 추정 적용 안 함
- `currentLesson`은 사용자가 직접 업데이트 (UI에 회차 입력 필드 제공)

### 챌린지 보드의 멤버별 집계 (밋업 신규)
- **완독 수:** `count(readings where status='completed' and user_id=member)`
- **진행 중:** `count(readings where status='reading' and user_id=member)`
- **이번 달 노트 수:** `count(reading_notes where user_id=member and date >= 1일)`
- → 리더보드 정렬은 완독 수 desc → 노트 수 desc 순

---

## A.3 외부 API 연동 (Sol AI Office 구현 — 코드 그대로 이식)

밋업의 책 등록·목차 추출은 **알라딘(검색/메타) → YES24(목차 크롤링) → Claude(형식 정리, 폴백 추정)** 3단 파이프라인. Sol AI Office에서 운영 검증된 정확한 로직을 그대로 가져온다.

### A.3.1 알라딘 API — 검색 + 메타정보

**원본:** `src/services/aladinApi.ts`

#### 검색 (`searchBooks(query)`)
```
GET /api/aladin/ItemSearch.aspx?
    ttbkey={VITE_ALADIN_TTB_KEY}
   &Query={검색어}
   &QueryType=Keyword
   &MaxResults=10
   &output=js
   &Version=20131101
   &Cover=Big
```
응답 `item[]`의 각 원소 (`AladinSearchItem`):
`title`, `author`, `isbn13`, `cover`, `categoryName`, `priceStandard`, `priceSales`, `link`, `pubDate`, `publisher`, `description`

#### 상세 (`getBookDetail(isbn13)`)
```
GET /api/aladin/ItemLookUp.aspx?
    ttbkey={KEY}
   &itemIdType=ISBN13
   &ItemId={isbn13}
   &output=js
   &Version=20131101
   &OptResult=Toc,itemPage
   &Cover=Big
```
응답 `item[0]`의 추가 필드: `subInfo.itemPage` (총 페이지수), `subInfo.toc` (있을 때만, 비어있는 경우 많음)

#### 응답 정제 (필수 — 그대로 옮길 것)
사용자가 검색 결과를 선택하면 폼 값으로 채워 넣을 때 이 정제 4가지를 반드시 적용:

```ts
title:    item.title.replace(/ - .*$/, '')                          // " - 부제..." 제거
author:   item.author
            .replace(/ \(지은이\).*$/, '')
            .replace(/ \(옮긴이\).*$/, '')                          // "(지은이)/(옮긴이)" 정리
tags:     parseCategoryToTags(item.categoryName)
          // "국내도서>자기계발>성공학" → ["자기계발", "성공학"]
          // 첫 토큰("국내도서")은 제외
totalPages: detail?.subInfo?.itemPage  // ItemLookUp 응답
price:      item.priceSales || item.priceStandard
isbn13:     item.isbn13
cover:      item.cover                  // 그대로 cover_image에 저장
link:       item.link
```

#### 환경변수
- `VITE_ALADIN_TTB_KEY` — 클라이언트에 노출 (알라딘 TTB Key는 키 자체가 호출 식별자, 별도 시크릿 없음)

---

### A.3.2 YES24 크롤링 — 목차 원본 추출 (★ 핵심)

**원본:** `src/services/claudeApi.ts`의 `searchYes24` + `fetchYes24Toc` + `crawlBookToc`

**왜 YES24인가:** 알라딘 `subInfo.toc`는 한국 책에서 비어있는 경우가 많음 → YES24 상품 페이지의 목차 영역이 가장 풍부. 단, **공식 API가 아닌 HTML 스크래핑**이라 마크업 변경 시 깨질 수 있어 폴백(A.3.3) 필수.

#### 1단계: ISBN으로 상품 ID 검색 (`searchYes24(isbn)`)
```ts
const res = await fetch(`/api/yes24/Product/Search?domain=BOOK&query=${isbn}`);
const html = await res.text();

// 검색결과 페이지의 모든 "goods/{숫자}" 링크 패턴 추출
const matches = html.match(/goods\/(\d+)/gi) || [];

// 중복 제거 + 상위 3개만 (목차 있는 첫 번째 상품 찾기 위해)
const ids = [...new Set(matches.map((m) => m.replace(/goods\//i, '')))];
return ids.slice(0, 3);
```

#### 2단계: 상품 페이지에서 목차 영역 분리 (`fetchYes24Toc(goodsId)`)
```ts
const res = await fetch(`/api/yes24/Product/Goods/${goodsId}`);
const html = await res.text();

// ★ 목차 섹션 위치 찾기
const tocIdx = html.indexOf('infoset_toc');
if (tocIdx === -1) return null;   // 목차 섹션 없음

// ★ 그 위치부터 10000자 슬라이스 (성능 + 다른 섹션 침범 방지)
const chunk = html.slice(tocIdx, tocIdx + 10000);

// ★ <textarea class="txtContentText">...</textarea> 내용 추출
const match = chunk.match(/<textarea[^>]*class="txtContentText"[^>]*>([\s\S]*?)<\/textarea>/);
if (!match) return null;

// ★ HTML → 평문 변환
const raw = match[1]
  .replace(/<br\s*\/?>/gi, '\n')   // <br/> → 줄바꿈
  .replace(/<[^>]+>/g, '')         // 나머지 HTML 태그 제거
  .trim();

return raw || null;
```

#### 3단계: 여러 상품 중 첫 성공 사용 (`crawlBookToc(isbn)`)
```ts
const goodsIds = await searchYes24(isbn);
for (const id of goodsIds) {
  const toc = await fetchYes24Toc(id);
  if (toc) return toc;
}
return null;
```

#### CORS 프록시 (dev + prod 양쪽 필수)

**dev — `vite.config.ts`:**
```ts
'/api/yes24': {
  target: 'https://www.yes24.com',
  changeOrigin: true,
  rewrite: (path) => path.replace(/^\/api\/yes24/, ''),
  configure: (proxy) => {
    proxy.on('proxyReq', (proxyReq) => {
      // ★ 봇 차단 우회: 출처 헤더 제거 + UA 정상화
      proxyReq.removeHeader('origin');
      proxyReq.removeHeader('referer');
      proxyReq.removeHeader('sec-fetch-mode');
      proxyReq.removeHeader('sec-fetch-site');
      proxyReq.removeHeader('sec-fetch-dest');
      proxyReq.setHeader('User-Agent',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
    });
  },
},
```

**prod — `server.js`:** `createProxyMiddleware` + `onProxyReq`로 동일한 헤더 조작.

---

### A.3.3 Claude API — 목차 형식 정리 + 폴백 추정 (★ 가장 정밀한 부분)

**원본:** `src/services/claudeApi.ts`의 `formatTocWithClaude` + `generateBookToc`

#### 메인 함수: `generateBookToc(title, author, isbn?)`
사용자가 [AI 목차 생성] 버튼을 누르면 호출됨. **자동 백그라운드 실행 아님** — 명시적 사용자 액션.

```
generateBookToc(title, author, isbn?)
  │
  ├─ 0. ISBN 없으면 → searchBooks(title) → results[0].isbn13 로 확보
  │
  ├─ 1. ISBN 있으면 → crawlBookToc(isbn) (YES24)
  │       ├─ 성공 → 2번 (Claude 형식 정리)
  │       └─ 실패 → 3번 (Claude 추정)
  │
  ├─ 2. (크롤링 성공) formatTocWithClaude(rawToc, title)
  │       → Claude에게 raw 텍스트와 규칙 보내서 'N-M 제목' 배열로 출력
  │
  └─ 3. (크롤링 실패 폴백) Claude에 title+author만 보내서 추정 목차 생성
          → 같은 'N-M 제목' 형식
```

#### Claude 호출 공통 설정
- **엔드포인트:** `POST /api/claude/v1/messages`
- **헤더:** `x-api-key: VITE_ANTHROPIC_API_KEY` + `anthropic-version: 2023-06-01`
- **모델:** `claude-sonnet-4-20250514`
- **max_tokens:** `8192`

#### 형식 정리 프롬프트 (★ 정확한 원문 유지 — 변경 시 결과 깨짐)
```
아래 목차 원본을 '챕터번호-세부번호 제목' 형식으로 정리해줘. 규칙:
- 서문, 추천사, 개정판 서문 등은 완전히 제외 (목차에 넣지 마)
- 프롤로그/들어가며가 0장의 시작. 프롤로그 자체는 제목에서 빼고 그 뒤 소제목부터 0-1
  예: "프롤로그 | 30대 초반..." → 0-1 30대 초반...
- 챕터 이름(CHAPTER1, 1장, Part1 등)은 제외하고 소제목만 넣어
- 에필로그/맺음말은 마지막 챕터+1 번호로. 에필로그 뒤 소제목만 넣기
- 부록/참고/독자후기 등은 완전히 제외
- 각 챕터 안의 소제목은 챕터번호-순서로
- 소제목의 "1막/", "2막/" 같은 접두사는 제거하고 본제목만
- 각 줄에 하나씩, 다른 설명 없이 목차만 출력해

예시:
원본: 프롤로그 | 30대 초반, 일하지 않아도... / 인생에도 공략집이 있다면 / CHAPTER1 ... / 1막/ 3개의 벽_ 설명
결과:
0-1 30대 초반, 일하지 않아도 월 1억씩 버는 자동 수익이 완성되다
0-2 인생에도 공략집이 있다면
1-1 3개의 벽_ 인생에서 절대 넘을 수 없을 거라 믿었던 것

책: {title}

목차 원본:
{rawToc}
```

#### 폴백(추정) 프롬프트
```
이 책의 목차를 '챕터번호-세부번호 제목' 형식으로 정리해줘.
프롤로그/들어가며는 0장으로.
에필로그/나가며는 마지막 장 다음 번호로.
각 줄에 하나씩, 다른 설명 없이 목차만 출력해.

형식 예시:
0-1 프롤로그
1-1 첫 번째 소제목
1-2 두 번째 소제목

책: {title}
저자: {author}
```

#### 결과 후처리 (필터링)
```ts
return text
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => /^\d+-\d+\s/.test(line));   // ★ 'N-M 제목' 패턴만 통과
```
→ 이 정규식이 핵심. 설명문장이나 깨진 줄이 섞여도 자동으로 걸러짐.

#### 결과 저장
- `chapters: string[]` 그대로 저장 (예: `["0-1 프롤로그", "1-1 첫 소제목", ...]`)
- 노트 작성 시 `chapter` 드롭다운에 `chapters`가 그대로 옵션으로 표시됨

---

### A.3.4 강의 메타데이터

강의는 통일된 API가 없음. **OpenGraph 스크래핑**으로 처리:
- Edge Function `/fetch-lecture-og?url=...` 또는 `server.js`의 일반 OG 프록시
- 응답: `og:title`, `og:image`, `og:description`
- 도메인별 fallback 파서: 인프런 / 클래스101 / 패스트캠퍼스 / YouTube / 유데미
- 강의 목차(회차)는 자동 추출 어려우므로 **수동 입력 + Claude 추정 보조** 두 가지만 제공

---

### A.3.5 server.js 프록시 정확한 구성 (★ 알라딘/YES24 차이 주의)

```js
// Claude / OpenAI / Perplexity — createProxyMiddleware (Origin 빈 값)
app.use('/api/claude', createProxyMiddleware({
  target: 'https://api.anthropic.com',
  changeOrigin: true,
  pathRewrite: { '^/api/claude': '' },
  headers: { Origin: '' },
}));

// ★ 알라딘 — createProxyMiddleware 아님!
// 알라딘은 internal redirect가 발생해서 미들웨어가 못 따라감
// 직접 fetch + redirect: 'follow' 로 처리해야 함
app.use('/api/aladin', async (req, res) => {
  const targetPath = req.originalUrl.replace(/^\/api\/aladin/, '/ttb/api');
  const targetUrl = `https://www.aladin.co.kr${targetPath}`;
  const response = await fetch(targetUrl, { redirect: 'follow' });
  const text = await response.text();
  res.set('Content-Type', response.headers.get('content-type') || 'application/json');
  res.status(response.status).send(text);
});

// ★ YES24 — createProxyMiddleware + 헤더 조작 (봇 차단 우회)
app.use('/api/yes24', createProxyMiddleware({
  target: 'https://www.yes24.com',
  changeOrigin: true,
  pathRewrite: { '^/api/yes24': '' },
  onProxyReq: (proxyReq) => {
    proxyReq.removeHeader('origin');
    proxyReq.removeHeader('referer');
    proxyReq.removeHeader('sec-fetch-mode');
    proxyReq.removeHeader('sec-fetch-site');
    proxyReq.removeHeader('sec-fetch-dest');
    proxyReq.setHeader('User-Agent',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
  },
}));
```

---

### A.3.6 환경변수 / 시크릿
```env
# 클라이언트 .env
VITE_ALADIN_TTB_KEY=          # 알라딘 ItemSearch/ItemLookUp 키
VITE_ANTHROPIC_API_KEY=       # Claude (목차 정리 + 폴백 추정)

# YES24는 무인증 HTML 크롤링 → 키 없음
# 블로그 OG도 무인증 → 키 없음
```

---

### A.3.7 옮길 파일 체크리스트 (Sol AI Office → 밋업)

| 출처 파일 | 옮길 위치 | 내용 |
|----------|----------|------|
| `src/services/aladinApi.ts` | 그대로 | 4개 함수: `searchBooks`, `getBookDetail`, `parseCategoryToTags`, `parseTocToChapters` |
| `src/services/claudeApi.ts` | `src/services/tocCrawler.ts` (분리) | 4개 함수: `searchYes24`, `fetchYes24Toc`, `crawlBookToc`, `formatTocWithClaude`, `generateBookToc` |
| `server.js` (47~74행) | 그대로 복사 | 알라딘 수동 fetch 블록 + YES24 createProxyMiddleware 블록 |
| `vite.config.ts` (17~62행) | 그대로 복사 | dev 프록시 5개 (claude, openai, perplexity, aladin, yes24) — 밋업은 perplexity/openai 빼도 됨 |

이식 시 **claudeApi.ts 안의 `searchBooks` import 의존성**도 같이 가져갈 것 (`generateBookToc`이 ISBN 없을 때 알라딘 검색으로 ISBN 확보하는 흐름이 있음).

---

## A.4 블로그 글 불러오기 (노트 작성 대체)

### 지원 플랫폼 (우선순위)
1. 네이버 블로그 — `og:` 태그 정상, 단 일부 페이지는 iframe 처리 필요
2. 티스토리 — `og:` 태그 정상
3. 브런치 — `og:` 태그 + 본문 추출 용이
4. 벨로그 — RSS도 제공 (`/{userId}/rss`)
5. 미디엄 — OG 정상
6. 그 외 — 일반 OpenGraph fallback

### 구현
- **Edge Function: `/fetch-blog-og?url=...`** (또는 `server.js`의 일반 프록시 + 프론트에서 OG 파싱)
  - URL fetch → HTML 파싱 → `og:title`, `og:image`, `og:description`, 본문 미리보기(첫 300자) 추출
  - 응답: `{ title, thumbnail, excerpt, author, published_at, url }`
- **본문 자체는 저장하지 않음** — 외부 링크 + 메타데이터만 보관 (저작권/이용약관)
- UI에는 카드 형태로 표시: 썸네일 + 제목 + 요약 + "원문 보기" 버튼

### 흐름
```
[블로그 불러오기] 선택
  → URL 입력 (예: https://blog.naver.com/abc/123)
  → "불러오기" 클릭 → Edge Function 호출 → 메타데이터 미리보기
  → 필요시 제목/요약 수정 가능
  → [저장] → reading_notes 테이블에 source_type='external_blog'로 저장
```

---

## A.5 화면 구조

### A.5.1 라우트
| 경로 | 페이지 |
|------|--------|
| `/readings` | 독서/강의 메인 (탭: 챌린지 보드 / 내 자료 / 모임 추천) |
| `/readings/:id` | 자료 상세 (목차 + 노트 목록 + 멤버 진행률) |
| `/readings/:id/notes/new` | 노트 작성 (에디터 or 블로그 불러오기) |
| `/readings/:id/notes/:noteId` | 노트 상세 (댓글/좋아요) |
| `/readings/new` | 새 자료 등록 (검색/수동/URL) |

### A.5.2 메인 페이지 `/readings` — 레이아웃

```
┌────────────────────────────────────────────────────────────┐
│ 상단 헤더                                                    │
│  ┌───────────────────────────────┬───────────────────────┐ │
│  │ 📚 독서 / 강의 챌린지            │  [+ 새로 추가 ▾]      │ │
│  │  이번 달 N권 · 챌린지 N개 진행 중 │   ├ 책 검색해서 등록    │ │
│  └───────────────────────────────┴── ├ 강의 URL로 등록 ──┘ │
│                                                              │
│ ┌─ 탭 ─────────────────────────────────────────────────────┐│
│ │ [챌린지 보드]  [모든 자료]  [내 것만]  [위시리스트]      ││
│ └──────────────────────────────────────────────────────────┘│
│                                                              │
│ ── 챌린지 보드 탭 ─────────────────────────────────────────  │
│                                                              │
│  멤버별 진행률 (리더보드)                                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 🥇 [👤] 김멤버   ████████████░  완독 8 · 진행 2       │  │
│  │ 🥈 [👤] 이멤버   ██████░░░░░░░  완독 4 · 진행 3       │  │
│  │ 🥉 [👤] 박멤버   ████░░░░░░░░░  완독 2 · 진행 1       │  │
│  │    [👤] 나       ███░░░░░░░░░░  완독 1 · 진행 2       │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  진행 중 (멤버 카드 그리드)                                   │
│  ┌─────────────┬─────────────┬─────────────┐               │
│  │ [표지]      │ [표지]      │ [표지]      │               │
│  │ 책 제목       │ 강의 제목     │ 책 제목       │               │
│  │ 저자          │ 강사          │ 저자          │               │
│  │ [👤 김멤버]   │ [👤 이멤버]   │ [👤 김멤버]   │               │
│  │ 진행 ███─ 60% │ 진행 ██── 40% │ 진행 ████ 80% │               │
│  │ 노트 3 · ♥ 5 │ 노트 1 · ♥ 2 │ 노트 5 · ♥ 8 │               │
│  └─────────────┴─────────────┴─────────────┘               │
│                                                              │
│  최근 완독                                                    │
│  ┌─────────────┬─────────────┐                              │
│  │ ...                          │                              │
│  └─────────────┴─────────────┘                              │
│                                                              │
└────────────────────────────────────────────────────────────┘
```

**탭별 내용:**
- **챌린지 보드** — 리더보드 + 진행 중 + 최근 완독 (모임 전체 활동 노출)
- **모든 자료** — 멤버 필터, 카테고리 필터, 상태 필터, 정렬(최신/진행률/완독일)
- **내 것만** — 내가 등록한 자료만, 위시리스트/진행중/완독 탭
- **위시리스트** — 모임 멤버가 추천한 책 중 "나도 읽을래" 한 것

**모바일:**
- 멤버 카드 그리드 → 1열
- 리더보드 → 상단 collapsable, 기본 상위 3명만 표시 → "전체 보기" 토글

### A.5.3 상세 페이지 `/readings/:id` — 레이아웃

```
┌────────────────────────────────────────────────────────────┐
│ ← 뒤로                                          [⋯ 메뉴]   │
│                                                              │
│  ┌──────┬──────────────────────────────────────────────┐  │
│  │      │ 책 제목                                          │  │
│  │ 표지 │ 저자 · 출판사 · 페이지수                          │  │
│  │      │ [👤 등록: 김멤버] · 2026-05-12                   │  │
│  │      │ ⭐⭐⭐⭐☆ "한줄평…"                            │  │
│  │      │                                                  │  │
│  │      │ 진행률: ████████░░  240 / 320p (75%)            │  │
│  │      │ [페이지 업데이트]  [완독 처리]                  │  │
│  │      │                                                  │  │
│  │      │ [🔗 알라딘에서 보기]  [🔖 나도 읽을래]          │  │
│  └──────┴──────────────────────────────────────────────┘  │
│                                                              │
│  ┌─ 탭 ───────────────────────────────────────────────┐    │
│  │ [목차]  [노트 N개]  [멤버 활동]                   │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ── 목차 탭 (도서일 때만, chapters 있을 때만) ──             │
│  ┌──────────────────────────────────────────────────┐      │
│  │  목차  (3/10 완료)                  [접기/펼치기] │      │
│  │ ─────────────────────────────────────────────    │      │
│  │ ✓  0-1 프롤로그: 30대 초반…                       │      │
│  │ ✓  1-1 3개의 벽 (배경=초록, 노트가 다룬 챕터)    │      │
│  │ ✓  1-2 첫 시도                                   │      │
│  │ 4  2-1 적용                       [노트 작성]    │      │
│  │ 5  2-2 사례                       [노트 작성]    │      │
│  │ ...                                              │      │
│  │ [목차 직접 편집]   [AI 목차 생성]                │      │
│  └──────────────────────────────────────────────────┘      │
│                                                              │
│  ── 노트 탭 ──                                              │
│  [+ 노트 작성 ▾]                                            │
│      ├ 직접 작성                                            │
│      └ 블로그에서 불러오기                                  │
│                                                              │
│  ┌──────────────────────────────────────────────────┐      │
│  │ [👤 김멤버]  2026-05-15                          │      │
│  │ 3장. 적용 — "이 개념을 우리 사업에…"              │      │
│  │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━              │      │
│  │ 본문 미리보기 3줄…                                │      │
│  │ ♥ 4   💬 2   [더보기]                            │      │
│  └──────────────────────────────────────────────────┘      │
│                                                              │
│  ┌──────────────────────────────────────────────────┐      │
│  │ [👤 이멤버]  🔗 외부 블로그                       │      │
│  │ [썸네일] 블로그 글 제목                           │      │
│  │ 요약 텍스트…                                      │      │
│  │ ♥ 2   💬 0   [원문 보기 ↗]                       │      │
│  └──────────────────────────────────────────────────┘      │
└────────────────────────────────────────────────────────────┘
```

**핵심 인터랙션 (★ Sol AI Office 동작 그대로):**
- **체크박스 없음** — 챕터별 ✓는 **노트가 다룬 챕터**(노트 `chapter[]`에 포함)인지 자동 판정
  - 다룬 챕터: 초록 배경 + ✓ 아이콘
  - 안 다룬 챕터: 회색 + 순번 + `[노트 작성]` 버튼 (클릭 시 해당 챕터 preselected로 노트 에디터 오픈)
- **[AI 목차 생성] 버튼** — 명시적 클릭 시 `generateBookToc()` 호출
  - 진행 중: 스피너 + "생성 중..." 표시
  - 실패: `alert('목차 생성에 실패했습니다. 다시 시도해주세요.')`
  - 결과는 `chapters: string[]`에 덮어쓰기 → 다시 누르면 새로 생성
- **[목차 직접 편집]** — textarea로 `chapters.join('\n')` 보여주고 줄 단위로 분리해 저장
  - Sol AI Office와 동일: `value.split('\n').filter(line => line.trim())`
- **목차는 도서일 때만 표시** — `reading.category === 'rcat-book'` && `chapters.length > 0` 일 때만
- **노트 카드 2종** — 내부 작성 / 외부 블로그를 시각적으로 구분 (외부는 🔗 아이콘 + 썸네일 좌측)
- **메뉴 (⋯)** — 자료 수정 / 삭제 / 공유 토글 / 모임에 추천 등록

### A.5.4 새 자료 등록 페이지 `/readings/new`

```
┌────────────────────────────────────────────────────┐
│  새 자료 등록                                       │
│                                                     │
│  유형:  [● 책]  [○ 강의]                            │
│                                                     │
│  ── 책일 때 (알라딘 검색) ──                          │
│  검색: [____________________] 🔍                   │
│        (제목, 저자, ISBN)                          │
│                                                     │
│  검색 결과 ────────────────────────────────         │
│  ┌──────┬─────────────────────────────────┐        │
│  │표지  │ 책 제목                            │        │
│  │      │ 저자 · 출판사 · 페이지수            │        │
│  │      │ 카테고리 태그: [자기계발] [성공학]  │        │
│  │      │ [선택]                            │        │
│  └──────┴─────────────────────────────────┘        │
│  ... (최대 10개 결과)                                │
│                                                     │
│  검색 결과가 없거나 직접 입력 하고 싶으면:           │
│  [수동으로 입력하기]                                 │
│                                                     │
│  ── 강의일 때 (OG 스크래핑) ──                        │
│  URL 입력: [___________________________]           │
│  [불러오기] → 미리보기 → 편집 가능                  │
│  또는 [수동 입력]                                   │
│                                                     │
│  ── 공통 (선택 후) ──                                │
│  카테고리: [_________]                              │
│  상태:     [위시리스트 / 진행중 / 완독]              │
│  공유:     [☑ 모임에 공개]                         │
│                                                     │
│  목차 (도서일 때 폼에 표시 — 선택 입력):              │
│  ┌─ 목차 (N개) ──────────────── [AI 목차 생성] ──┐  │
│  │ 0-1 프롤로그…                                  │  │
│  │ 1-1 첫 번째 소제목                             │  │
│  │ ...                                            │  │
│  │ (textarea: 줄 단위 직접 편집 가능)              │  │
│  └────────────────────────────────────────────────┘  │
│   ★ [AI 목차 생성] 클릭 시 generateBookToc 호출       │
│      → ISBN/제목/저자로 YES24 크롤링 → Claude 정리   │
│      → 실패 시 Claude 추정 폴백 → chapters에 채움    │
│                                                     │
│  [취소]                            [등록]           │
└────────────────────────────────────────────────────┘
```

### A.5.5 노트 작성 페이지 `/readings/:id/notes/new`

```
┌────────────────────────────────────────────────────┐
│  새 노트 — 책 제목                                  │
│                                                     │
│  방식 선택:                                          │
│   ┌────────────────────┬─────────────────────┐    │
│   │ ✍ 직접 작성        │ 🔗 블로그에서 불러오기 │    │
│   │ 앱 안에서 작성       │ 네이버/티스토리/...   │    │
│   └────────────────────┴─────────────────────┘    │
│                                                     │
│  ── 직접 작성 선택 시 ──                              │
│  챕터: [3장. 적용                ▾]                │
│        (목차에서 선택 또는 자유 입력)               │
│                                                     │
│  ┌──────────────────────────────────────────────┐  │
│  │ Tiptap 에디터                                 │  │
│  │ [B I U  •  H1 H2  ─  ❝  </>  📷  🔗]        │  │
│  │ ───────────────────────────────────────────  │  │
│  │                                              │  │
│  │  본문…                                       │  │
│  │                                              │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
│  ── 블로그 불러오기 선택 시 ──                        │
│  URL: [https://blog.naver.com/...      ] [불러오기]│
│                                                     │
│  미리보기 ──────────────────────                    │
│  ┌──────┬───────────────────────────┐              │
│  │ 썸네일│ 글 제목                    │              │
│  │      │ 요약 텍스트…                │              │
│  │      │ 원문: https://...           │              │
│  └──────┴───────────────────────────┘              │
│  제목 수정: [_________________________]            │
│  챕터:      [3장. 적용             ▾]              │
│                                                     │
│  공유: [☑ 모임에 공개]                             │
│  [취소]                            [저장]           │
└────────────────────────────────────────────────────┘
```

---

## A.6 컴포넌트 트리

```
src/components/readings/
├── ReadingsTabs.tsx              # 챌린지보드/모든자료/내것/위시리스트 탭
├── ChallengeLeaderboard.tsx      # 멤버별 진행률 리더보드
├── ReadingCard.tsx               # 카드 (표지/제목/멤버/진행률)
├── ReadingDetail.tsx             # 상세 페이지 컨테이너 (Sol AI의 ReadingDetailView 베이스)
│   ├── ReadingHeader.tsx         # 표지 + 메타정보 + 진행률 바
│   ├── ReadingChaptersList.tsx   # ★ 목차 = chapters 배열 렌더 (체크박스 아님, writtenChapters 기반)
│   ├── ReadingNoteList.tsx       # 노트 카드 리스트 (타임라인)
│   └── ReadingMemberActivity.tsx # 멤버 진행 활동
├── ReadingNoteCard.tsx           # 노트 카드 (내부/외부 분기 렌더)
│   ├── NoteCardInternal.tsx
│   └── NoteCardExternal.tsx
├── StudyNoteEditor.tsx           # ★ Sol AI Office에서 그대로 복사
│                                 #   - readings.chapters 배열을 chapter 드롭다운 옵션으로
│                                 #   - 도서: Tiptap content / 강좌: rawText+sections+actionItems
│                                 #   - 밋업 신규: source_type 토글 (editor / external_blog)
├── BlogImportPanel.tsx           # 외부 블로그 URL → OG 미리보기 (글쓰기와 공유)
├── NewReadingForm.tsx            # 자료 등록 (Sol AI Office 폼 그대로)
│   ├── AladinSearchPicker.tsx    # 알라딘 검색 + 결과 선택 + 응답 정제 적용
│   ├── ChaptersField.tsx         # ★ textarea + [AI 목차 생성] 버튼
│   ├── LectureUrlPicker.tsx      # 강의 URL OG 불러오기
│   └── ManualEntryForm.tsx       # 수동 입력
├── StarRating.tsx                # Sol AI Office에서 그대로
└── BookCoverFallback.tsx         # 표지 없을 때 placeholder
```

### 서비스 / 훅
```
src/services/
├── readings.service.ts            # readings CRUD (Sol AI Office에서 가져옴 + workspace_id 추가)
├── readingNotes.service.ts        # reading_notes CRUD
├── aladinApi.ts                   # ★ Sol AI Office에서 그대로 복사
├── tocCrawler.ts                  # ★ claudeApi.ts에서 분리
│                                  #   searchYes24 + fetchYes24Toc + crawlBookToc
│                                  #   + formatTocWithClaude + generateBookToc
├── blogFetch.service.ts           # 블로그 OG 메타데이터 (Edge Function 호출)
└── lectureFetch.service.ts        # 강의 OG 메타데이터

src/hooks/
├── useReadings.ts                 # CRUD 훅 (Sol AI Office 베이스)
├── useReadingDetail.ts
├── useChallengeLeaderboard.ts     # 멤버별 집계 (완독 수 desc → 노트 수 desc)
└── useBookSearch.ts               # 검색 디바운스 + 결과 캐시
```

### 유틸
```
src/utils/
└── readingProgress.ts             # ★ Sol AI Office에서 가져옴
                                   #   - calcReadingProgress: 도서=current/total*100, 강좌=lesson 기준
                                   #   - progressLabel: "240 / 320p" 또는 "12 / 30회차"
                                   #   - writtenChaptersFromNotes(notes): 노트로부터 완료 챕터 Set 계산
```

### 서버측 프록시 (필수)
```
server.js              # Sol AI Office의 /api/aladin, /api/yes24 블록 그대로 복사
vite.config.ts         # dev 프록시 동일

# 또는 Supabase Edge Function 변형:
supabase/functions/
├── search-book/       # 알라딘 ItemSearch + ItemLookUp
├── crawl-toc/         # YES24 크롤링 + Claude 정리
├── fetch-blog-og/     # 블로그 OG
└── fetch-lecture-og/  # 강의 OG
```

---

# Part B. 글쓰기

## B.1 기능 개요

### 한 줄 정의
> 멤버들이 정기적으로 글을 쓰고 공유하는 **모임형 글쓰기 챌린지**.
> 템플릿으로 진입 장벽을 낮추고, 캘린더로 꾸준함을 시각화.

### 핵심 기능
1. **2가지 작성 방식**
   - 앱 내 Tiptap 에디터 (템플릿 기반 / 빈 문서)
   - 외부 블로그 URL 불러오기 (독서 노트와 동일 모듈 재사용)
2. **템플릿 선택** — 주간/월간 회고, 비즈니스 플랜, 아이디어 정리 등 시스템 템플릿 + 워크스페이스 커스텀 템플릿
3. **캘린더 뷰** — 작성일 기준 월간 캘린더, 멤버별 색상 도트로 활동량 시각화
4. **3가지 뷰** — 캘린더 / 리스트 / 멤버별 챌린지 보드
5. **공유/댓글/좋아요** — 독서 노트와 동일

---

## B.2 데이터 모델

### B.2.1 `writing_templates`
```sql
writing_templates (
  id            uuid pk,
  workspace_id  uuid,                     -- null이면 시스템 전체 템플릿
  name          text not null,            -- "주간 회고", "월간 회고", "비즈니스 플랜 1페이지"
  description   text,
  emoji         text,                     -- 카드에 표시
  category      text,                     -- '회고' | '기획' | '인터뷰' | '아이디어' | '기타'
  structure     jsonb not null,           -- Tiptap JSON (placeholder 포함)
  is_system     boolean default false,    -- 시스템 기본 제공 여부
  created_by    uuid,
  created_at    timestamptz
)
```

**시스템 기본 템플릿 (10종 권장):**
1. 주간 회고 (KPT: Keep / Problem / Try)
2. 월간 회고 (성과 / 학습 / 다음달)
3. 비즈니스 플랜 1페이지
4. 아이디어 정리 (문제 / 가설 / 검증 방안)
5. 고객 인터뷰 노트
6. 강점 분석 (SWOT)
7. 책 한 권 요약 (3줄 / 핵심 인용 / 적용)
8. 강의 한 회차 요약
9. 모임 발표 자료 (3분 스피치)
10. 자유 메모 (빈 문서)

### B.2.2 `writings`
```sql
writings (
  id              uuid pk,
  workspace_id    uuid not null,
  user_id         uuid not null,
  template_id     uuid,                     -- null이면 빈 문서 또는 외부

  title           text not null,
  category        text,

  -- 본문 — 2가지 소스
  source_type     text not null,            -- 'editor' | 'external_blog'
  content         jsonb,                    -- editor일 때: Tiptap JSON
  external_url    text,                     -- external_blog일 때
  external_thumbnail text,
  external_excerpt text,

  is_shared       boolean default true,
  written_date    date not null default current_date,  -- ★ 캘린더 표시 기준
  word_count      int,                      -- 진행률 표시용 (선택)

  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
)
```

### B.2.3 `writing_comments` / `writing_likes`
- `reading_note_*`와 동일 패턴.

### B.2.4 RLS
| 동작 | 권한 |
|------|------|
| `writings` 조회 | 멤버 (`is_shared=false`면 본인만) |
| `writings` 생성/수정/삭제 | 본인만 |
| `writing_templates` 조회 | 시스템(`workspace_id is null`) 또는 본인 워크스페이스 |
| `writing_templates` 커스텀 생성 | 워크스페이스 운영자(`is_workspace_admin`) |

---

## B.3 블로그 불러오기

- 독서 노트의 `Edge Function: /fetch-blog-og`를 **그대로 재사용**.
- 같은 컴포넌트 `BlogImportPanel`을 readings/writings 양쪽에서 import.

---

## B.4 화면 구조

### B.4.1 라우트
| 경로 | 페이지 |
|------|--------|
| `/writings` | 글쓰기 메인 (3개 뷰 토글) |
| `/writings/new` | 새 글 작성 (템플릿 선택 → 에디터 or 블로그 불러오기) |
| `/writings/:id` | 글 상세 (본문 + 댓글) |
| `/writings/:id/edit` | 글 편집 |
| `/writings/templates` | 워크스페이스 커스텀 템플릿 관리 (운영자) |

### B.4.2 메인 페이지 `/writings` — 레이아웃

```
┌────────────────────────────────────────────────────────────┐
│ 헤더                                                         │
│ ┌─────────────────────────────────┬──────────────────────┐ │
│ │ ✍ 글쓰기 챌린지                  │ [+ 새 글 ▾]          │ │
│ │ 이번 달 N개 글 · 활동 멤버 N명     │  ├ 템플릿으로 작성    │ │
│ └─────────────────────────────────┴── ├ 빈 문서 ─────────  │
│                                        └ 블로그 불러오기 ── │
│                                                              │
│ ┌─ 뷰 토글 ────────────────────────────────────────────┐    │
│ │ [📅 캘린더] [📋 리스트] [🏆 챌린지]                 │    │
│ │ 필터: [전체 / 내것 / 멤버 선택 ▾]  [카테고리 ▾]    │    │
│ └────────────────────────────────────────────────────┘    │
│                                                              │
│ ── 캘린더 뷰 ──────────────────────────────────────────     │
│                                                              │
│  ◄ 2026년 5월 ►                          [오늘로]           │
│  ┌────┬────┬────┬────┬────┬────┬────┐                      │
│  │ 일 │ 월 │ 화 │ 수 │ 목 │ 금 │ 토 │                      │
│  ├────┼────┼────┼────┼────┼────┼────┤                      │
│  │    │    │    │    │  1 │  2 │  3 │                      │
│  │    │    │    │    │ ●● │ ●  │    │                      │
│  ├────┼────┼────┼────┼────┼────┼────┤                      │
│  │  4 │  5 │  6 │  7 │  8 │  9 │ 10 │                      │
│  │ ●● │ ●●●│    │ ●  │    │ ●● │    │                      │
│  │    │    │    │    │    │    │    │                      │
│  └────┴────┴────┴────┴────┴────┴────┘                      │
│   ● 멤버별 색상 도트 (도트 수 = 그날 작성한 글 수)            │
│                                                              │
│  날짜 클릭 → 우측 패널(PC) 또는 바텀시트(모바일)에 그날 글 목록│
│                                                              │
│  ┌── 선택된 날짜: 2026-05-09 ────────────────┐               │
│  │ [👤 김멤버] 주간 회고: 5월 둘째주          │               │
│  │ [👤 이멤버] 고객 인터뷰 #3                 │               │
│  │ [👤 이멤버] 🔗 블로그: "마케팅 실험 결과"  │               │
│  └──────────────────────────────────────────┘               │
│                                                              │
│ ── 리스트 뷰 ──────────────────────────────────────────     │
│                                                              │
│  ┌──────────────────────────────────────────────────┐      │
│  │ [👤 김멤버] · 주간 회고 · 2026-05-12             │      │
│  │ 5월 둘째주 회고                                   │      │
│  │ KPT — Keep: 모임 발표 잘했고… (3줄 미리보기)     │      │
│  │ ♥ 5  💬 2                                        │      │
│  └──────────────────────────────────────────────────┘      │
│  ┌──────────────────────────────────────────────────┐      │
│  │ [👤 이멤버] · 🔗 외부 블로그 · 2026-05-11        │      │
│  │ [썸네일] 마케팅 실험 결과 정리                    │      │
│  │ 요약 텍스트…                          [원문 ↗]   │      │
│  └──────────────────────────────────────────────────┘      │
│                                                              │
│ ── 챌린지 뷰 ──────────────────────────────────────────     │
│                                                              │
│  멤버별 작성 통계 (이번 달)                                  │
│  ┌──────────────────────────────────────────────┐           │
│  │ 🥇 [👤] 김멤버   ███████████  12개            │           │
│  │ 🥈 [👤] 이멤버   ████████░░░   8개            │           │
│  │    [👤] 나       ███░░░░░░░░   3개            │           │
│  └──────────────────────────────────────────────┘           │
│  연속 작성 스트릭: 김멤버 🔥 7일 / 이멤버 🔥 3일             │
│                                                              │
└────────────────────────────────────────────────────────────┘
```

**모바일:**
- 캘린더 뷰: 셀 더 컴팩트, 도트 최대 3개만 + "+N" 표시
- 리스트 뷰가 기본
- 챌린지 뷰는 별도 탭

### B.4.3 새 글 작성 페이지 `/writings/new`

**1단계: 방식 선택**
```
┌────────────────────────────────────────────────────┐
│  새 글 작성                                          │
│                                                     │
│  방식 선택:                                          │
│   ┌────────────────────────────────────────────┐   │
│   │ 📝 템플릿으로 작성                          │   │
│   │   주간 회고, 비즈니스 플랜 등 10종            │   │
│   └────────────────────────────────────────────┘   │
│   ┌────────────────────────────────────────────┐   │
│   │ ✨ 빈 문서로 시작                            │   │
│   └────────────────────────────────────────────┘   │
│   ┌────────────────────────────────────────────┐   │
│   │ 🔗 블로그에서 불러오기                       │   │
│   │   네이버 / 티스토리 / 브런치 / 벨로그 등      │   │
│   └────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────┘
```

**2단계: 템플릿 선택 화면**
```
┌────────────────────────────────────────────────────┐
│  ← 뒤로     템플릿 선택                              │
│                                                     │
│  카테고리:  [전체] [회고] [기획] [인터뷰] [기타]    │
│                                                     │
│  ┌─────────┬─────────┬─────────┐                  │
│  │ 📅      │ 📊      │ 💡      │                  │
│  │ 주간회고 │ 월간회고 │ 아이디어│                  │
│  │ KPT     │ 성과·학습│ 문제-가설│                  │
│  │ [선택]  │ [선택]  │ [선택]  │                  │
│  └─────────┴─────────┴─────────┘                  │
│  ┌─────────┬─────────┬─────────┐                  │
│  │ 🎯      │ 🎤      │ ...     │                  │
│  └─────────┴─────────┴─────────┘                  │
│                                                     │
│  워크스페이스 커스텀 템플릿                          │
│  ┌─────────┐                                       │
│  │ ⭐      │                                       │
│  │ 우리모임│                                        │
│  │ 발표양식│                                        │
│  └─────────┘                                       │
└────────────────────────────────────────────────────┘
```

**3단계: 에디터 화면**
```
┌────────────────────────────────────────────────────┐
│ ← 취소    [주간 회고] 글 작성        [임시저장][발행]│
│                                                     │
│ 제목: [_____________________________________]      │
│ 작성일: [2026-05-19]  카테고리: [회고 ▾]           │
│                                                     │
│ ┌────────────────────────────────────────────────┐ │
│ │ [B I U S H1 H2 H3  •  • 1.  ❝  </>  ─  📷 🔗] │ │
│ │ ────────────────────────────────────────────  │ │
│ │                                                │ │
│ │ ## Keep — 잘했던 것                            │ │
│ │ - (placeholder: 이번 주 잘했던 점을 적어보세요)│ │
│ │                                                │ │
│ │ ## Problem — 문제                              │ │
│ │ - (placeholder)                                │ │
│ │                                                │ │
│ │ ## Try — 다음에 시도할 것                       │ │
│ │ - (placeholder)                                │ │
│ │                                                │ │
│ └────────────────────────────────────────────────┘ │
│                                                     │
│ 공유: [☑ 모임에 공개]                              │
│ 작성 시간 · 단어 수 N자                              │
└────────────────────────────────────────────────────┘
```

**블로그 불러오기 화면 (독서 노트와 동일 컴포넌트 재사용)**
```
┌────────────────────────────────────────────────────┐
│ ← 뒤로    블로그에서 불러오기                        │
│                                                     │
│ URL: [https://brunch.co.kr/...        ] [불러오기] │
│                                                     │
│ 미리보기 ─────────────────────                      │
│ ┌──────┬───────────────────────┐                   │
│ │썸네일 │ 글 제목                │                   │
│ │      │ 요약…                  │                   │
│ │      │ 작성자 · 작성일         │                   │
│ │      │ [원문 보기 ↗]          │                   │
│ └──────┴───────────────────────┘                   │
│                                                     │
│ 제목 수정: [___________________________]           │
│ 작성일:   [2026-05-19] (원문 날짜로 자동입력)       │
│ 카테고리: [회고 ▾]                                  │
│ 공유:    [☑ 모임에 공개]                          │
│                                                     │
│ [취소]                                  [저장]      │
└────────────────────────────────────────────────────┘
```

### B.4.4 상세 페이지 `/writings/:id`

```
┌────────────────────────────────────────────────────┐
│ ← 뒤로                                  [⋯ 메뉴]   │
│                                                     │
│  [👤 김멤버] · 주간 회고 · 2026-05-12              │
│                                                     │
│  # 5월 둘째주 회고                                  │
│                                                     │
│  ## Keep — 잘했던 것                                │
│  ...                                                │
│                                                     │
│  ## Problem                                         │
│  ...                                                │
│                                                     │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━           │
│  ♥ 5명이 좋아합니다     [♥ 좋아요]                  │
│                                                     │
│  댓글 (2)                                            │
│  ┌──────────────────────────────────────────────┐  │
│  │ [👤 이멤버] · 1시간 전                        │  │
│  │ Problem 부분 공감돼요…                        │  │
│  └──────────────────────────────────────────────┘  │
│  [댓글 입력_____________________] [등록]            │
└────────────────────────────────────────────────────┘
```

**외부 블로그 글 상세는 카드 + 원문 링크만 표시, 본문은 자체 호스팅 안 함.**

---

## B.5 컴포넌트 트리

```
src/components/writings/
├── WritingsViewSwitcher.tsx       # 캘린더/리스트/챌린지 토글
├── WritingsCalendar.tsx           # 월간 캘린더 (셀에 멤버 도트)
│   ├── WritingsCalendarCell.tsx
│   └── WritingsDayPanel.tsx       # 날짜 선택 시 그날 글 목록
├── WritingsList.tsx
├── WritingsChallengeBoard.tsx     # 멤버별 통계 + 스트릭
├── WritingCard.tsx                # 카드 (내부/외부 분기)
│   ├── WritingCardInternal.tsx
│   └── WritingCardExternal.tsx
├── WritingDetail.tsx
├── WritingComposer.tsx            # 작성 컨테이너 (방식 선택→템플릿→에디터)
│   ├── ComposeMethodPicker.tsx    # 1단계: 방식 선택
│   ├── TemplatePicker.tsx         # 2단계: 템플릿 선택
│   ├── WritingEditor.tsx          # 3단계: Tiptap (독서 노트 에디터와 베이스 공유)
│   └── BlogImportPanel.tsx        # 블로그 불러오기 (독서와 공유 컴포넌트)
└── TemplateManager.tsx            # 운영자용 커스텀 템플릿 관리
```

### 서비스 / 훅
```
src/services/writings.service.ts
src/services/writingTemplates.service.ts
src/services/blogFetch.service.ts        # readings와 공유

src/hooks/useWritings.ts
src/hooks/useWritingsCalendar.ts         # 월간 집계
src/hooks/useWritingTemplates.ts
src/hooks/useWritingChallenge.ts         # 멤버 통계 + 스트릭
```

### 공통 모듈 (독서/글쓰기 양쪽에서 사용)
```
src/components/common/
├── BlogImportPanel.tsx       # 외부 블로그 URL 입력 + 미리보기
├── ExternalContentCard.tsx   # 외부 컨텐츠 카드 (썸네일+제목+요약+링크)
├── TiptapEditor.tsx          # 공용 에디터 래퍼
├── MemberAvatar.tsx          # 작성자 표시
└── ShareToggle.tsx           # 공유 토글
```

---

# Part C. 공통 사항

## C.1 활동 피드 연동

다음 이벤트는 `activities` 테이블에 자동 기록:
| 이벤트 | action |
|--------|--------|
| 책/강의 등록 | `created_reading` |
| 책/강의 완독 | `finished_reading` |
| 독서 노트 작성 | `created_reading_note` |
| 글쓰기 발행 | `created_writing` |
| 노트/글에 좋아요 | `liked_content` |
| 노트/글에 댓글 | `commented_content` |

→ 대시보드 / 활동 피드 사이드패널에 멤버 활동으로 표시.

## C.2 알림

| 트리거 | 수신자 | 메시지 예시 |
|--------|--------|------------|
| 내 노트/글에 좋아요 | 작성자 | "이멤버님이 회원님의 글을 좋아합니다" |
| 내 노트/글에 댓글 | 작성자 | "이멤버님이 댓글을 남겼습니다" |
| 멤버가 책 추천 | 모임 전체 (운영자 설정) | "김멤버님이 [책 제목]을 모임에 추천했어요" |
| 챌린지 마감 임박 | 챌린지 참여자 | "독서 챌린지 마감 3일 남음" |

알림 시스템은 `meetup-spec.md §4.9 notifications` 테이블 그대로 사용.

## C.3 환경변수 / 시크릿

```env
# 클라이언트 (.env)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_ALADIN_TTB_KEY=           # 알라딘 책 검색
VITE_ANTHROPIC_API_KEY=        # YES24 raw → 챕터 배열 정리 + 폴백 추정

# YES24는 무인증 HTML 크롤링 → 별도 키 없음
# 블로그 OG도 무인증 → 별도 키 없음
```

## C.4 로컬 Mock 모드 체크리스트

[CLAUDE.md] Mock 모드 규칙에 따라 새 테이블 추가 시 3곳 동시 수정:
1. `src/types.ts`
   - `ReadingItem` (category, status, currentPage, totalPages, currentLesson, totalLessons,
     chapters?: string[], toc?: string, isbn13?, tags?, link?, price?, rating?, review?, ...)
   - `StudyNote` 확장 (chapter?: string[], sourceType, externalUrl/Title/Excerpt/Thumbnail)
   - `WritingItem`, `WritingTemplate`
2. `src/services/*.service.ts`
   - Row 타입 + `toDb*` / `fromDb*` 변환
   - readings.chapters는 snake_case에서도 `chapters`로 그대로 (다른 컬럼들은 snake_case 변환)
3. `src/services/mockSupabase.ts`
   - readings / reading_notes / writings / writing_templates 매핑
   - (★ reading_toc 테이블은 만들지 않음 — chapters 배열로 통합)

**MockQueryBuilder 주의:** insert/update/delete는 절대 async로 만들지 말 것 — `this` 반환 + `_resolve()`에서 await.

## C.5 개발 우선순위

### Phase 1 — 독서 MVP (4~5일)
1. `readings` 스키마 + RLS (`chapters: text[]` 컬럼 포함, 별도 toc 테이블 없음)
2. Sol AI Office에서 옮기기: `aladinApi.ts` + `server.js` 프록시(`/api/aladin`, `/api/yes24`)
3. 등록 폼 (알라딘 검색 → 선택 → 응답 정제 4가지 → 페이지수 자동 입력)
4. 상세 페이지 (메타 + 목차 영역 + 노트 타임라인) — 목차는 수동 입력만 우선
5. 노트: 앱 내 에디터 작성 + `chapter[]` 드롭다운 (readings.chapters 옵션)
6. 진행률 자동 계산 (페이지 우선 → 챕터 비율 폴백, 역주행 방지)

### Phase 2 — 목차 자동 생성 (2~3일)
7. YES24 크롤링 + Claude 정리 4개 함수 이식 (`searchYes24`, `fetchYes24Toc`, `crawlBookToc`, `formatTocWithClaude`, `generateBookToc`)
8. **[AI 목차 생성] 버튼 UI** (등록 폼 + 상세 페이지 양쪽) — 자동 백그라운드 아님
9. 결과 후처리(`/^\d+-\d+\s/` 정규식 필터) 그대로 적용
10. 폴백 흐름 검증 (ISBN 없을 때 → 알라딘 검색 → ISBN 확보 → YES24, 실패 → Claude 추정)

### Phase 3 — 챌린지화 (3~4일)
11. 챌린지 보드 (리더보드 + 진행률 카드)
12. 좋아요/댓글
13. 활동 피드 연동
14. 알림 (좋아요/댓글)

### Phase 4 — 글쓰기 MVP (4~5일)
15. `writings` + `writing_templates` 스키마
16. 시스템 템플릿 10종 시드
17. 작성 플로우 (방식 선택 → 템플릿 → 에디터)
18. 리스트 뷰 + 상세 뷰

### Phase 5 — 캘린더/챌린지 (3~4일)
19. 캘린더 뷰 + 멤버별 도트
20. 챌린지 뷰 (통계 + 스트릭)
21. 댓글/좋아요 (독서와 공통 컴포넌트화)

### Phase 6 — 블로그 불러오기 (2~3일)
22. `fetch-blog-og` Edge Function 또는 server.js 프록시
23. `BlogImportPanel` 공용 컴포넌트
24. 독서 노트 + 글쓰기 양쪽에 통합

### Phase 7 — 부가 (선택)
25. 강의 OG 스크래핑 (`fetch-lecture-og`)
26. 워크스페이스 커스텀 템플릿 관리 UI
27. 챌린지 그룹(`challenges` 테이블) 기능

---

## C.6 시작 체크리스트 (Claude Code에게)

1. ☐ `readings`, `reading_notes` 마이그레이션 + RLS
   - readings.chapters는 `text[]` 또는 `jsonb` (별도 `reading_toc` 테이블 만들지 말 것)
   - reading_notes.chapter도 `text[]` (복수 챕터 선택 가능)
2. ☐ `writings`, `writing_templates`, 댓글/좋아요 마이그레이션 + RLS
3. ☐ Sol AI Office에서 `aladinApi.ts` 복사 (응답 정제 정규식 4가지 그대로 유지)
4. ☐ Sol AI Office에서 YES24 크롤링 + AI 목차 정리 로직 → `tocCrawler.ts`로 분리해 이식
   - `infoset_toc` 인덱스 + 10000자 슬라이스 + `txtContentText` textarea 매칭 로직 유지
   - Claude 프롬프트 원문 그대로 (변경 시 결과 깨짐)
   - 결과 후처리 정규식 `/^\d+-\d+\s/` 유지
   - 모델 `claude-sonnet-4-20250514`, max_tokens 8192
5. ☐ `server.js`의 `/api/aladin`(수동 fetch + redirect:follow), `/api/yes24`(proxyMiddleware + 헤더 조작) 블록 이식
6. ☐ `vite.config.ts` dev 프록시 동일 적용 (YES24의 헤더 제거 + UA 정상화 핵심)
7. ☐ `fetch-blog-og` Edge Function 또는 server.js 라우트 작성
8. ☐ Mock 모드: types + services + mockSupabase 3곳 매핑
9. ☐ 시스템 템플릿 10종 시드 SQL
10. ☐ 공통 컴포넌트: `BlogImportPanel`, `ExternalContentCard`, `TiptapEditor` 베이스
11. ☐ 독서: 메인/상세/등록/노트작성 4개 페이지
    - 진행률 자동 계산 로직 (페이지 우선 → 챕터 비율 폴백, 역주행 방지) 그대로 이식
    - 챕터 UI는 체크박스 아닌 "노트가 다룬 챕터" 자동 판정
    - [AI 목차 생성] 버튼은 명시적 사용자 클릭 (자동 백그라운드 X)
12. ☐ 글쓰기: 메인(3뷰)/작성(3단계)/상세 페이지
13. ☐ 활동 피드 + 알림 연동

---

## C.7 Sol AI Office와의 차이 — 한눈 요약

| 항목 | Sol AI Office | 밋업 (수정 후) |
|------|--------------|--------------|
| 데이터 스코프 | `user_id`만 | `workspace_id + user_id` |
| `chapters` 컬럼 | `text[]` 단일 | **동일** (별도 toc 테이블 아님) |
| 노트 chapter | `text[]` 복수 선택 | **동일** |
| 진행률 계산 | 페이지 우선 → 챕터 비율 | **동일 로직 + 챌린지 보드용 멤버 집계 추가** |
| [AI 목차 생성] | 명시적 버튼 클릭 | **동일** |
| 목차 출처 표시 | 없음 (YES24/AI 구분 안 함) | **동일** — 추가하지 않음 |
| 외부 블로그 노트 | 없음 | **신규**: `reading_notes.source_type='external_blog'` |
| 공유 토글 | 없음 (1인용) | **신규**: `is_shared` |
| 댓글/좋아요 | 없음 | **신규**: `reading_note_*_likes/comments` |

---

*본 문서는 meetup-spec.md를 보완하며, 두 메뉴를 함께 개발할 때 한 단위로 참고할 수 있도록 작성됨.*
*모든 UI 텍스트는 한글, 컴포넌트/변수명은 영어. 모바일 우선.*
