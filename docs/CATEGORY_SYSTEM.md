# 카테고리 시스템 — 공통 가이드 (개인 + 오피스 통일)

**작성:** 2026-09-15 · **상태:** 설계(리뷰 대기) · **관련:** `docs/DATA_SCHEMA.md`, `docs/CONTENT_HUB_REDESIGN.md`

## 0. 목표
모든 메뉴(개인 공간 + 오피스)의 카테고리를 **동일한 방식**으로:
- 메뉴마다 **카테고리 관리**(추가·이름수정·**색상지정**·삭제·정렬)
- 리스트/상세에 **카테고리 배찌** 표시 (공용 `CategoryBadge`, 사각+점 모양 통일)
- 필터 드롭다운에 색상 점과 함께 노출
- 개인은 `user_id`, 오피스는 `workspace_id` 스코프로 각자 세트 관리

> 원칙: **통일되는 것은 "기능/모양/저장방식"**. 카테고리 값(항목)은 **메뉴마다 독립 세트**다. (할일 카테고리 ≠ 콘텐츠 카테고리)

## 1. 현황 (통일 전)
| 메뉴 | 저장 | 관리 UI | 배찌 |
|------|------|---------|------|
| 할일 | `custom_options`(option_type=`task_category`) `{id,label,color}` | ❌ | ✅ CategoryBadge |
| 일정 | `custom_options`(`schedule_category`) | ❌ | 일부 |
| 독서 | `custom_options`(`reading_category`) | ❌ | ✅ |
| 인사이트 | 할일 세트 재사용(tcat-*) | ❌ | ✅ |
| 기록 | `category` 문자열(자유) | ❌ | ❌ |
| 콘텐츠(오피스) | `content_type`(고정 4종) | ❌ | ❌ |
| 기억(오피스) | `kind`(고정 8종, 구조적 분류) | ❌ | — |

→ **저장 뼈대(custom_options + {id,label,color})는 이미 존재.** user_id 전용 + 관리 UI 부재 + 메뉴별 적용 불균일이 문제.

## 2. 통일 모델
### 2.1 카테고리 타입 (canonical)
```ts
interface Category { id: string; label: string; color: string; order?: number; }
// 기존 ScheduleCategory와 동일 → 공통 타입 Category로 승격(별칭 유지)
```

### 2.2 저장 — `custom_options` 확장 (신규 테이블 X)
- `option_type = '<scope>_category'` 로 메뉴 구분. **scope** = `task | schedule | reading | insight | record | content`.
- `value` = JSON `{id,label,color,order}`.
- **`workspace_id` 컬럼 추가**(nullable): `null`=개인, 값=오피스. → 개인/오피스가 같은 메커니즘으로 각자 세트 보유.
- 조회: `option_type=scope+'_category'` AND (`workspace_id=ws` 또는 개인이면 `is null`).

### 2.3 스코프 정리
| scope | 쓰는 메뉴 |
|-------|-----------|
| `task` | 할일 (개인+오피스 공용 개념이지만 세트는 스코프+워크스페이스로 분리) |
| `schedule` | 일정(개인) |
| `reading` | 독서(개인) |
| `insight` | 인사이트(개인+오피스 통합 메뉴) |
| `record` | 기록(개인) |
| `content` | 콘텐츠(오피스 허브) |
- `기억.kind`(8종)는 **구조적 분류**라 카테고리 시스템에서 제외(고정 유지). 필요 시 별도.

## 3. 공통 자산 (재사용)
| 자산 | 상태 | 역할 |
|------|------|------|
| `Category` 타입 | 승격 | `{id,label,color,order}` |
| `categories.service.ts` | **신규** | `fetch(scope,ws)` / `add` / `update` / `remove` / `reorder` (custom_options CRUD 래핑) |
| `useCategories(scope, workspaceId)` | **신규** | 로딩·캐시·낙관적 갱신 훅 |
| `CategoryBadge` | 존재 | 사각+점 배찌(색상=inline style → 오피스 모노 무력화에도 **색 유지**) |
| `CategoryFilter` | 존재(FilterDropdown) | 색 점 + '전체' + 카테고리 목록 |
| `CategorySelect` | **신규(공통)** | **디자인된 드롭다운**(네이티브 `<select>` 금지) — 옵션마다 **색상 점 + 라벨**, 선택 시 체크. 오른쪽 여백 있는 chevron. **오른쪽에 작은 "관리" 링크** → `CategoryManager` 팝업. **모든 카테고리 선택은 이 컴포넌트로 통일**(개인+오피스 전 메뉴) |
| `CategoryManager` | **신규** | 카테고리 목록(색점+이름+삭제) · **카테고리별 색상 변경**(색점 클릭 → 12색 스와치) · **새 카테고리**(이름+스와치+추가). `CategorySelect`의 "관리"에서 팝업으로 진입(등록 폼 위에 겹치는 2단 오버레이 → 폼 상태 보존, 변경 시 폼 드롭다운 즉시 갱신) |

### 3.0 CategorySelect 규격 (필수)
- **네이티브 `<select>` 사용 금지** — chevron이 테두리에 붙고 색상 표현 불가. 반드시 이 공통 컴포넌트.
- 버튼: `[색점] [선택 라벨] … [chevron(우측 여백 확보)]`.
- 팝업 리스트: 각 옵션 `[색점] 라벨` + 현재 선택 `✓`.
- 우측 "관리" 링크 → `CategoryManager`(2단 오버레이). 관리에서 추가/삭제/색변경 시 열려있는 select 목록 자동 갱신.
- props: `scope`, `workspaceId`, `value`, `onChange`. 내부에서 `useCategories(scope, ws)`로 목록 로드.

### 3.1 색상 스와치(고정 팔레트)
색은 자유 hex 대신 **12색 스와치**에서 고르게(일관성):
`#4ade80 #2dd4bf #60a5fa #818cf8 #c084fc #f472b6 #fb7185 #fb923c #fbbf24 #a3e635 #9ca3af #b08968`
- 배찌 색은 `CategoryBadge`가 hex를 **inline style**로 적용 → 오피스 모던테마(잡색 모노화)에서도 카테고리 점/틴트는 **의도색 유지**.

## 4. 메뉴 통합 체크리스트 (모든 "카테고리 쓰는" 메뉴 동일)
1. 아이템 타입에 `category`(= Category.id) 필드 (대부분 이미 있음).
2. 상단 필터에 `CategoryFilter`(전체 + 세트) — 색 점 포함.
3. 리스트 행/상세에 `CategoryBadge`.
4. 필터/추가 폼에서 **`CategoryManager`** 진입점(＋ 카테고리 추가·색상·삭제).
5. `useCategories(scope, ws)`로 세트 로드 (개인=ws null / 오피스=ws id).
6. 추가 폼의 카테고리 선택도 같은 세트 사용.

## 5. DB 마이그레이션
| # | 파일 | 내용 |
|---|------|------|
| 055 | `055_custom_options_workspace.sql` | `custom_options`에 `workspace_id`(nullable) + 인덱스(option_type, workspace_id). RLS: 개인(user_id) / 오피스(workspace 멤버) 모두 허용. 기존 행은 workspace_id=null(개인) 유지 |
| — | 시드 | 각 scope 기본 세트(없으면) 생성: task=개발/디자인/콘텐츠/미팅/행정, content=스타일링/교육/브랜딩/제품/기타 등 |

## 6. Mock 3곳 동기화
- `types.ts`: `Category`(=ScheduleCategory) 공통화, 각 아이템 `category` 확인.
- `services/categories.service.ts` Row(custom_options: option_type,value,workspace_id) + 변환.
- `mockSupabase.ts`: custom_options 시드에 `workspace_id` 추가, scope별 기본 세트(content 등) 추가, `_LS_KEY` bump.

## 7. 단계 (Phase 0 — 콘텐츠 허브보다 먼저 깔면 재사용됨)
1. 마이그 055 + `categories.service`/`useCategories` + `CategoryManager` 컴포넌트.
2. 기존 메뉴를 훅 기반으로 교체(할일·인사이트·독서 먼저 — 이미 배찌 있음).
3. 미적용 메뉴에 배찌+필터+관리 부착(기록·콘텐츠).
4. 오피스 워크스페이스 세트 검증(개인↔오피스 분리 확인).

## 8. 리스크
- **오피스 색 유지**: 카테고리 색은 반드시 inline style(hex)로. 탭 클래스(bg-*-500)로 주면 모노 무력화됨.
- **기존 tcat-* 호환**: 기존 아이템의 `category='tcat-content'` 값 보존(마이그레이션 없이 그대로 매칭).
- **스코프 혼선**: 할일 카테고리와 콘텐츠 카테고리는 다른 세트 — option_type로 확실히 분리.
