# 쏠닝포인트 2025 템플릿 구조 설명서 (운명랩 메뉴 및 그 내부 DB 제외)

> 목적: **쏠닝포인트 2025** 템플릿을 구성하는 “페이지”, “데이터베이스(=DB)”, “DB 속성(프로퍼티)”, “DB 간 연결(관계/Relation)”을 한 문서에서 빠르게 파악할 수 있도록 정리합니다.  
> 기준: 현재 확인 가능한 화면/DB 스키마 기준으로 작성되었습니다. (운명랩 전용 메뉴 및 그 내부 DB들은 요청대로 제외)

---

## 1) 최상위 허브 페이지

### 1.1. HOME 허브: `쏠닝포인트 2025`
- 페이지: **쏠닝포인트 2025**[^https://www.notion.so/1ec6b352178a8049abb0e5697e82012c]
- 역할:
	- 좌측: **MENU(갤러리)**로 섹션 이동
	- 중앙/우측: 비전/상위목표, 목표 현황, 고정 메모, 월별 한줄목표(싱크드 블록), 오늘/루틴/업무, 일정 캘린더 등 주요 위젯을 한 화면에 배치

- 이 페이지에서 직접 보이는 핵심 DB(인라인/링크드 형태 혼재):
	- MENU (Gallery) — 네비게이션용[^https://www.notion.so/1ec6b352178a8049abb0e5697e82012c][^https://www.notion.so/1ec6b352178a8171a108f4a7e3419cd2]
	- 목표 DB (올해의 목표 뷰) — 연간 목표 추적[^https://www.notion.so/1ec6b352178a8049abb0e5697e82012c][^https://www.notion.so/1ec6b352178a815d920ac759fe850692]
	- 기록 DB (고정 메모 뷰) — 중요한 메모 고정 노출[^https://www.notion.so/1ec6b352178a8049abb0e5697e82012c][^https://www.notion.so/1ec6b352178a814e8c30ff892b8983fd]
	- 일별 집계표 (오늘 뷰) — “오늘 페이지” 역할의 허브 데이터[^https://www.notion.so/1ec6b352178a8049abb0e5697e82012c][^https://www.notion.so/1ec6b352178a81e89afcc3edef0762dc]
	- 루틴 DB (오늘의 업무루틴 뷰) — 오늘 루틴 체크[^https://www.notion.so/1ec6b352178a8049abb0e5697e82012c][^https://www.notion.so/1ec6b352178a81f29eefe19586234f38]
	- 업무 DB (우선 처리 업무 등) — 미완료 업무 노출[^https://www.notion.so/1ec6b352178a8049abb0e5697e82012c][^https://www.notion.so/1ec6b352178a81968a5cce6316d20554]
	- 일정 DB + 업무 DB 캘린더 (캘린더 위젯) — 일정/강의일정 캘린더[^https://www.notion.so/1ec6b352178a8049abb0e5697e82012c][^https://www.notion.so/1ec6b352178a81cd9f40f129fe5bfb55]

---

## 2) “데이터베이스 관리” 페이지 (DB 목록 인덱스)

### 2.1. 페이지: `데이터베이스ㅇ`
- 페이지: **데이터베이스ㅇ**[^https://www.notion.so/1ec6b352178a81929950c68c4205ddd5]
- 역할:
	- 템플릿 내 주요 DB를 카테고리별로 “바로가기” 형태로 정리한 **DB 인덱스 페이지**
	- “날짜별 / 업무 / 고객·거래처·파트너 / 상품·판매·입고 / 수입·지출 / 기록·문서”로 구분

- 이 페이지에 나열된 DB(중요):
	- 날짜별: 일별/주별/월별/연도 집계표
	- 업무: 목표/프로젝트/업무/일정
	- 고객/거래처/파트너: 고객/거래처/집계/파트너
	- 상품/판매/입고: 제품/카테고리/수정/판매/구매/입출고/서비스
	- 수입/지출: 수입/지출/카테고리/고정지출/대출/입출금수단/판매채널
	- 기록/문서: 기록/다이어리/작업로그/글 집계/루틴/문서/견적서/영수증/세금신고  
  ※ 위 항목들 중 다수는 “목록만 확인” 상태이며, **각 DB의 상세 속성 스키마는 별도 View가 필요**합니다.[^https://www.notion.so/1ec6b352178a81929950c68c4205ddd5]

---

## 3) 핵심 DB 상세 (현재 스키마 확인된 DB 중심)

아래 DB들은 실제 스키마(속성/관계)가 확인된 항목들입니다.

---

### 3.1. MENU DB (네비게이션용)
- DB: **MENU**[^https://www.notion.so/1ec6b352178a8171a108f4a7e3419cd2]
- 데이터소스: `MENU`(data-source: collection://1ec6b352-178a-8156-8418-000b180a8da8)[^https://www.notion.so/1ec6b352178a8171a108f4a7e3419cd2]
- 목적:
	- 허브 페이지 좌측에서 “문서/차트/고객·거래처…” 등 섹션으로 이동하는 메뉴 카드

- 속성(프로퍼티)
	- `이름` (title) — 메뉴 항목 이름[^https://www.notion.so/1ec6b352178a8171a108f4a7e3419cd2]

- 관계(Relation)
	- 현재 확인된 스키마상 **관계 속성 없음**[^https://www.notion.so/1ec6b352178a8171a108f4a7e3419cd2]

---

### 3.2. 목표 DB (연간 목표 관리)
- DB: **목표 DBㅇ 보기**[^https://www.notion.so/1ec6b352178a815d920ac759fe850692]
- 데이터소스: `목표 DBㅇ`(data-source: collection://1ec6b352-178a-81fe-a8ee-000b458ab4fc)[^https://www.notion.so/1ec6b352178a815d920ac759fe850692]
- 목적:
	- 올해 목표(프로젝트형/수치형)를 등록하고 **달성률/현재수치/상태**로 추적

- 주요 속성
	- `목표` (title)[^https://www.notion.so/1ec6b352178a815d920ac759fe850692]
	- `상태` (status: 시작 전 / 진행 중 / 보류 / 완료 / 중단됨)[^https://www.notion.so/1ec6b352178a815d920ac759fe850692]
	- `목표유형` (select: 프로젝트형 / 수치형)[^https://www.notion.so/1ec6b352178a815d920ac759fe850692]
	- `카테고리` (select: 쏠닝포인트 / 정감메이트 / 가계 / 추천경로)[^https://www.notion.so/1ec6b352178a815d920ac759fe850692]
	- `목표수치` (number)[^https://www.notion.so/1ec6b352178a815d920ac759fe850692]
	- `현재수치` (number)[^https://www.notion.so/1ec6b352178a815d920ac759fe850692]
	- `달성률` (formula)[^https://www.notion.so/1ec6b352178a815d920ac759fe850692]
	- `이번년도 체크` (formula — 올해 필터링에 사용)[^https://www.notion.so/1ec6b352178a815d920ac759fe850692]

- 관계(Relation) 속성 (DB 연결)
	- `기록` → **기록 DB**(data-source: collection://1ec6b352-178a-81fe-a9f3-000b8200ed57)[^https://www.notion.so/1ec6b352178a815d920ac759fe850692]
	- `세부 프로젝트` → **프로젝트 DB**(data-source: collection://1ec6b352-178a-814a-a4c3-000bb5ecc134) ※ 프로젝트 DB 스키마는 본 문서에서 “목록만 확인” 상태[^https://www.notion.so/1ec6b352178a815d920ac759fe850692]
	- `목표연도`(limit 1) → **연도 집계표**(data-source: collection://1ec6b352-178a-81c4-9f9b-000b3a07e3a0) ※ 연도 집계표 스키마는 “목록만 확인” 상태[^https://www.notion.so/1ec6b352178a815d920ac759fe850692]

- 뷰(View) 구성 힌트
	- 뷰: `올해의 목표`(Gallery)  
	- 필터: `이번년도 체크 = true`[^https://www.notion.so/1ec6b352178a815d920ac759fe850692]

---

### 3.3. 기록 DB (메모/아이디어/원고 + 고정 메모)
- DB: **기록 DBㅇ 보기**[^https://www.notion.so/1ec6b352178a814e8c30ff892b8983fd]
- 데이터소스: `기록 DBㅇ`(data-source: collection://1ec6b352-178a-81fe-a9f3-000b8200ed57)[^https://www.notion.so/1ec6b352178a814e8c30ff892b8983fd]
- 목적:
	- 메모/아이디어/원고 등 “기록”을 모으고,
	- `고정` 체크된 항목만 허브에 노출

- 주요 속성
	- `이름` (title)[^https://www.notion.so/1ec6b352178a814e8c30ff892b8983fd]
	- `작성 일시` (date)[^https://www.notion.so/1ec6b352178a814e8c30ff892b8983fd]
	- `카테고리` (select: 아이디어 / 메모 / 원고)[^https://www.notion.so/1ec6b352178a814e8c30ff892b8983fd]
	- `URL` (url)[^https://www.notion.so/1ec6b352178a814e8c30ff892b8983fd]
	- `고정` (checkbox)[^https://www.notion.so/1ec6b352178a814e8c30ff892b8983fd]
	- `사업/가계` (select: 쏠닝포인트 / 정감메이트 / 가계)[^https://www.notion.so/1ec6b352178a814e8c30ff892b8983fd]

- 관계(Relation) 속성 (DB 연결)
	- `관련 목표` → **목표 DB**(data-source: collection://1ec6b352-178a-81fe-a8ee-000b458ab4fc)[^https://www.notion.so/1ec6b352178a814e8c30ff892b8983fd]
	- `연도 집계표` → **연도 집계표**(data-source: collection://1ec6b352-178a-81c4-9f9b-000b3a07e3a0) (목록만 확인)[^https://www.notion.so/1ec6b352178a814e8c30ff892b8983fd]
	- `일별 집계표` → **일별 집계표**(data-source: collection://1ec6b352-178a-819a-bf46-000b54f01518)[^https://www.notion.so/1ec6b352178a814e8c30ff892b8983fd]

- 뷰(View) 구성 힌트
	- “고정 메모” 리스트 뷰: `고정 = true`, `작성 일시 desc`[^https://www.notion.so/1ec6b352178a814e8c30ff892b8983fd]

---

### 3.4. 일별 집계표 DB (하루 단위 허브 데이터)
- DB: **일별 집계표ㅇ 보기**[^https://www.notion.so/1ec6b352178a81e89afcc3edef0762dc]
- 데이터소스: `일별 집계표ㅇ`(data-source: collection://1ec6b352-178a-819a-bf46-000b54f01518)[^https://www.notion.so/1ec6b352178a81e89afcc3edef0762dc]
- 목적:
	- “하루”를 중심으로 업무/일정/기록/수입·지출/판매·구매/세금 등의 데이터를 한 페이지에 모으는 **중앙 허브**
	- ‘오늘’ 뷰가 허브 페이지에서 “오늘 페이지”처럼 동작[^https://www.notion.so/1ec6b352178a8049abb0e5697e82012c][^https://www.notion.so/1ec6b352178a81e89afcc3edef0762dc]

- 대표 속성(구조)
	- `날짜` (title)[^https://www.notion.so/1ec6b352178a81e89afcc3edef0762dc]
	- `요일` (formula)[^https://www.notion.so/1ec6b352178a81e89afcc3edef0762dc]
	- `날짜 (캘린더용)` (formula: date)[^https://www.notion.so/1ec6b352178a81e89afcc3edef0762dc]
	- 매출/매입/수입/지출/마진 등 다수 (formula) — 예: `매출 (뷰)`, `매입 (뷰)`, `수입 (뷰)`, `지출 (뷰)`, `마진 (뷰)` 등[^https://www.notion.so/1ec6b352178a81e89afcc3edef0762dc]
	- (그 외) 사업/가계 매출/매입/마진 분해 formula 다수[^https://www.notion.so/1ec6b352178a81e89afcc3edef0762dc]

- 관계(Relation) 속성 (DB 연결: “일별 집계표”가 허브 역할을 하는 핵심)
	- `일정` → **일정 DB**(data-source: collection://1ec6b352-178a-818e-9d15-000b27c5ef67)[^https://www.notion.so/1ec6b352178a81e89afcc3edef0762dc]
	- `업무` → **업무 DB**(data-source: collection://1ec6b352-178a-81b2-9758-000b201cb7e7)[^https://www.notion.so/1ec6b352178a81e89afcc3edef0762dc]
	- `기록` → **기록 DB**(data-source: collection://1ec6b352-178a-81fe-a9f3-000b8200ed57)[^https://www.notion.so/1ec6b352178a81e89afcc3edef0762dc]
	- `루틴`(limit 1) → **루틴 DB**(data-source: collection://1ec6b352-178a-8158-adb5-000bf140daf6)[^https://www.notion.so/1ec6b352178a81e89afcc3edef0762dc]
	- `수입/지출` → **수입/지출 DB**(data-source: collection://1ec6b352-178a-81bf-8caf-000b38936b2e) (목록만 확인)[^https://www.notion.so/1ec6b352178a81e89afcc3edef0762dc]
	- `판매` → **판매 DB**(data-source: collection://1ec6b352-178a-8100-b0a0-000b7618416b) (목록만 확인)[^https://www.notion.so/1ec6b352178a81e89afcc3edef0762dc]
	- `구매` → **구매 DB**(data-source: collection://1ec6b352-178a-8105-b04d-000b459bcc3e) (목록만 확인)[^https://www.notion.so/1ec6b352178a81e89afcc3edef0762dc]
	- `세금신고` → **세금 신고 DB**(data-source: collection://1ec6b352-178a-8135-a68d-000b514c973d) (목록만 확인)[^https://www.notion.so/1ec6b352178a81e89afcc3edef0762dc]
	- `월별 집계표` → **월별 집계표**(data-source: collection://1ec6b352-178a-81f5-ba04-000b7a6c0279) (목록만 확인)[^https://www.notion.so/1ec6b352178a81e89afcc3edef0762dc]
	- `다이어리` → **다이어리 DB**(data-source: collection://1976b352-178a-8111-9729-000b2550b13b) (목록만 확인)[^https://www.notion.so/1ec6b352178a81e89afcc3edef0762dc]

- 뷰(View) 구성 힌트
	- 뷰: `오늘`(Gallery)  
	- 필터: `날짜 (캘린더용) = today`[^https://www.notion.so/1ec6b352178a81e89afcc3edef0762dc]

---

### 3.5. 루틴 DB (일일 루틴 체크리스트)
- DB: **루틴 DB 보기**[^https://www.notion.so/1ec6b352178a81f29eefe19586234f38]
- 데이터소스: `루틴 DB`(data-source: collection://1ec6b352-178a-8158-adb5-000bf140daf6)[^https://www.notion.so/1ec6b352178a81f29eefe19586234f38]
- 목적:
	- 하루 루틴을 체크하고 **달성률**을 계산
	- “오늘의 업무루틴” 뷰가 허브에 표시됨[^https://www.notion.so/1ec6b352178a8049abb0e5697e82012c][^https://www.notion.so/1ec6b352178a81f29eefe19586234f38]

- 주요 속성
	- `이름` (title)[^https://www.notion.so/1ec6b352178a81f29eefe19586234f38]
	- `날짜` (date)[^https://www.notion.so/1ec6b352178a81f29eefe19586234f38]
	- 체크박스 루틴 항목들 (checkbox)  
		- `📨 메일 체크`, `💵 장부 관리`, `🧺 하루 일정 기록하기`, `✍🏻 콘텐츠 제작하기`, `🌱 썸원끝`, `💬 아이엘츠 공부` 등[^https://www.notion.so/1ec6b352178a81f29eefe19586234f38]
	- `달성률` (formula)[^https://www.notion.so/1ec6b352178a81f29eefe19586234f38]
	- `🔄 요일`, `🔄 루틴 개수` 등 (formula)[^https://www.notion.so/1ec6b352178a81f29eefe19586234f38]
	- `❌루틴 리스트❌` (formula)[^https://www.notion.so/1ec6b352178a81f29eefe19586234f38]
	- `미설정 2~5` (text) — 템플릿 확장/메모용으로 보임[^https://www.notion.so/1ec6b352178a81f29eefe19586234f38]

- 관계(Relation) 속성
	- `일별 집계표` → **일별 집계표**(data-source: collection://1ec6b352-178a-819a-bf46-000b54f01518)[^https://www.notion.so/1ec6b352178a81f29eefe19586234f38]
	- `연도 집계표` → **연도 집계표**(data-source: collection://1ec6b352-178a-81c4-9f9b-000b3a07e3a0) (목록만 확인)[^https://www.notion.so/1ec6b352178a81f29eefe19586234f38]

- 뷰(View) 구성 힌트
	- 뷰: `오늘의 업무루틴`(Gallery)  
	- 필터: `날짜 = today`[^https://www.notion.so/1ec6b352178a81f29eefe19586234f38]

---

### 3.6. 업무 DB (태스크/우선순위/진행 버튼)
- DB: **업무 DBㅇ 보기**[^https://www.notion.so/1ec6b352178a81968a5cce6316d20554]
- 데이터소스: `업무 DBㅇ`(data-source: collection://1ec6b352-178a-81b2-9758-000b201cb7e7)[^https://www.notion.so/1ec6b352178a81968a5cce6316d20554]
- 목적:
	- 업무를 등록하고 “우선순위/날짜/완료여부/기한초과” 등을 기준으로 뷰에서 관리
	- 시작/일시정지/종료/보류 처리 등 버튼으로 운영 흐름을 만들려는 구조[^https://www.notion.so/1ec6b352178a81968a5cce6316d20554]

- 주요 속성
	- `리스트` (title) — 업무명[^https://www.notion.so/1ec6b352178a81968a5cce6316d20554]
	- `날짜` (date)[^https://www.notion.so/1ec6b352178a81968a5cce6316d20554]
	- `완료` (checkbox)[^https://www.notion.so/1ec6b352178a81968a5cce6316d20554]
	- `담당자` (person)[^https://www.notion.so/1ec6b352178a81968a5cce6316d20554]
	- `사업/가계` (select: 쏠닝포인트 / 정감메이트 / 가계 / 강의 / 운명랩 / 민석)  
		- ※ “운명랩” 값이 존재하지만, **DB 자체가 운명랩 전용이라고 단정할 수는 없고**, 공용 업무 DB로 보입니다.[^https://www.notion.so/1ec6b352178a81968a5cce6316d20554]
	- `업무 순위` (select: 🔥 최우선 / ⭐ 중요 / 📌 보통 / 🌱 후순위 / ⏸️ 보류 / 매일루틴)[^https://www.notion.so/1ec6b352178a81968a5cce6316d20554]
	- `비고` (text)[^https://www.notion.so/1ec6b352178a81968a5cce6316d20554]
	- 시간/기한 관련 formula: `time`, `기한`[^https://www.notion.so/1ec6b352178a81968a5cce6316d20554]
	- 버튼류: `시작`, `일시정지`, `종료`, `오늘로 변경`, `보류 처리`, `캘린더 생성` 등[^https://www.notion.so/1ec6b352178a81968a5cce6316d20554]
	- `시작종료일시`, `일시정지일시` (date) — 로그용[^https://www.notion.so/1ec6b352178a81968a5cce6316d20554]

- 관계(Relation) 속성
	- `일별 집계표` → **일별 집계표**(data-source: collection://1ec6b352-178a-819a-bf46-000b54f01518)[^https://www.notion.so/1ec6b352178a81968a5cce6316d20554]
	- `일정` → **일정 DB**(data-source: collection://1ec6b352-178a-818e-9d15-000b27c5ef67)[^https://www.notion.so/1ec6b352178a81968a5cce6316d20554]
	- `관련 프로젝트` → **프로젝트 DB**(data-source: collection://1ec6b352-178a-814a-a4c3-000bb5ecc134) (목록만 확인)[^https://www.notion.so/1ec6b352178a81968a5cce6316d20554]
	- `강의` → **강의 DB**(data-source: collection://26b6b352-178a-803d-b3e5-000bdbd84b7b) (목록만 확인)[^https://www.notion.so/1ec6b352178a81968a5cce6316d20554]
	- `관련 파트너` → **파트너 DB**(data-source: collection://1ec6b352-178a-8128-9441-000b87769824) (목록만 확인)[^https://www.notion.so/1ec6b352178a81968a5cce6316d20554]
	- `작업 로그` → **작업 로그 DB**(data-source: collection://1ec6b352-178a-8152-955f-000b758c407b) (목록만 확인)[^https://www.notion.so/1ec6b352178a81968a5cce6316d20554]
	- `연도 집계표` → **연도 집계표**(data-source: collection://1ec6b352-178a-81c4-9f9b-000b3a07e3a0) (목록만 확인)[^https://www.notion.so/1ec6b352178a81968a5cce6316d20554]

- 대표 뷰(View) 예시
	- `우선 처리 업무`(List): 미완료 + (오늘/우선순위/기한초과) 조건 조합[^https://www.notion.so/1ec6b352178a81968a5cce6316d20554]
	- `다음 예정 업무`(Gallery): 미완료 + 기한 문자열 조건[^https://www.notion.so/1ec6b352178a81968a5cce6316d20554]
	- `기한초과`(Gallery): 미완료 + 기한에 “초과” 포함[^https://www.notion.so/1ec6b352178a81968a5cce6316d20554]

---

### 3.7. 일정 DB (+ 강의 일정 캘린더)
- DB: **일정 DBㅇ 및 업무 DBㅇ 보기**[^https://www.notion.so/1ec6b352178a81cd9f40f129fe5bfb55]
- 포함 데이터소스:
	- `일정 DBㅇ`(data-source: collection://1ec6b352-178a-818e-9d15-000b27c5ef67)[^https://www.notion.so/1ec6b352178a81cd9f40f129fe5bfb55]
	- `업무 DBㅇ`(data-source: collection://1ec6b352-178a-81b2-9758-000b201cb7e7) — 같은 DB 안에서 함께 보여주는 구성[^https://www.notion.so/1ec6b352178a81cd9f40f129fe5bfb55]

- 일정 DB의 주요 속성
	- `내용` (title)[^https://www.notion.so/1ec6b352178a81cd9f40f129fe5bfb55]
	- `날짜` (date)[^https://www.notion.so/1ec6b352178a81cd9f40f129fe5bfb55]
	- `카테고리` (select: 마케팅 / 회의/미팅 / 프로젝트 / CS / 클레임 / 업무 / 개인 / 기타)[^https://www.notion.so/1ec6b352178a81cd9f40f129fe5bfb55]
	- `진행 상태` (status: 시작 전 / 진행 중 / 보류 / 완료 / 중단됨)[^https://www.notion.so/1ec6b352178a81cd9f40f129fe5bfb55]
	- `사업/가계` (select: 쏠닝포인트 / 정감메이트 / 가계)[^https://www.notion.so/1ec6b352178a81cd9f40f129fe5bfb55]
	- `비고` (text)[^https://www.notion.so/1ec6b352178a81cd9f40f129fe5bfb55]
	- `URL` (url)[^https://www.notion.so/1ec6b352178a81cd9f40f129fe5bfb55]
	- `파일` (file)[^https://www.notion.so/1ec6b352178a81cd9f40f129fe5bfb55]

- 관계(Relation) 속성 (일정이 “허브 연결점” 역할)
	- `일별 집계표` → **일별 집계표**(data-source: collection://1ec6b352-178a-819a-bf46-000b54f01518)[^https://www.notion.so/1ec6b352178a81cd9f40f129fe5bfb55]
	- `연도 집계표` → **연도 집계표**(data-source: collection://1ec6b352-178a-81c4-9f9b-000b3a07e3a0) (목록만 확인)[^https://www.notion.so/1ec6b352178a81cd9f40f129fe5bfb55]
	- `관련 업무` → **업무 DB**(data-source: collection://1ec6b352-178a-81b2-9758-000b201cb7e7)[^https://www.notion.so/1ec6b352178a81cd9f40f129fe5bfb55]
	- `관련 프로젝트` → **프로젝트 DB**(data-source: collection://1ec6b352-178a-814a-a4c3-000bb5ecc134) (목록만 확인)[^https://www.notion.so/1ec6b352178a81cd9f40f129fe5bfb55]
	- `관련 고객` → **고객 DB**(data-source: collection://1ec6b352-178a-810c-8f4f-000be63f5fa7) (목록만 확인)[^https://www.notion.so/1ec6b352178a81cd9f40f129fe5bfb55]
	- `관련 거래처` → **거래처 DB**(data-source: collection://1ec6b352-178a-8187-bb42-000b7748f64b) (목록만 확인)[^https://www.notion.so/1ec6b352178a81cd9f40f129fe5bfb55]
	- `관련 구매` → **구매 DB**(data-source: collection://1ec6b352-178a-8105-b04d-000b459bcc3e) (목록만 확인)[^https://www.notion.so/1ec6b352178a81cd9f40f129fe5bfb55]
	- `관련 판매` → **판매 DB**(data-source: collection://1ec6b352-178a-8100-b0a0-000b7618416b) (목록만 확인)[^https://www.notion.so/1ec6b352178a81cd9f40f129fe5bfb55]

- 대표 뷰(View)
	- `일정`(Calendar): `날짜` 기준[^https://www.notion.so/1ec6b352178a81cd9f40f129fe5bfb55]
	- `강의 일정`(Calendar): 업무 DB를 `날짜` 기준으로 보되, `사업/가계 = 강의` 필터 적용[^https://www.notion.so/1ec6b352178a81cd9f40f129fe5bfb55]

---

## 4) DB 간 연결 구조 (관계 중심 “큰 그림”)

아래는 현재 확인된 관계(Relation)만으로 재구성한 연결 지도입니다.

- **일별 집계표(하루 허브)** (collection://1ec6b352-178a-819a-bf46-000b54f01518)
	- ↔ 일정 DB(collection://1ec6b352-178a-818e-9d15-000b27c5ef67)
	- ↔ 업무 DB(collection://1ec6b352-178a-81b2-9758-000b201cb7e7)
	- ↔ 기록 DB(collection://1ec6b352-178a-81fe-a9f3-000b8200ed57)
	- ↔ 루틴 DB(collection://1ec6b352-178a-8158-adb5-000bf140daf6)
	- ↔ (목록 확인) 판매 DB(collection://1ec6b352-178a-8100-b0a0-000b7618416b), 구매 DB(collection://1ec6b352-178a-8105-b04d-000b459bcc3e), 수입/지출 DB(collection://1ec6b352-178a-81bf-8caf-000b38936b2e), 세금신고 DB(collection://1ec6b352-178a-8135-a68d-000b514c973d), 다이어리 DB(collection://1976b352-178a-8111-9729-000b2550b13b), 월별 집계표(collection://1ec6b352-178a-81f5-ba04-000b7a6c0279)

- **목표 DB(연간 목표)** (collection://1ec6b352-178a-81fe-a8ee-000b458ab4fc)
	- ↔ 기록 DB(collection://1ec6b352-178a-81fe-a9f3-000b8200ed57)
	- ↔ (목록 확인) 프로젝트 DB(collection://1ec6b352-178a-814a-a4c3-000bb5ecc134)
	- ↔ (목록 확인) 연도 집계표(collection://1ec6b352-178a-81c4-9f9b-000b3a07e3a0)

- **업무 DB(태스크)** (collection://1ec6b352-178a-81b2-9758-000b201cb7e7)
	- ↔ 일정 DB(collection://1ec6b352-178a-818e-9d15-000b27c5ef67)
	- ↔ 일별 집계표(collection://1ec6b352-178a-819a-bf46-000b54f01518)
	- ↔ (목록 확인) 프로젝트 DB(collection://1ec6b352-178a-814a-a4c3-000bb5ecc134), 파트너 DB(collection://1ec6b352-178a-8128-9441-000b87769824), 작업 로그 DB(collection://1ec6b352-178a-8152-955f-000b758c407b), 강의 DB(collection://26b6b352-178a-803d-b3e5-000bdbd84b7b), 연도 집계표(collection://1ec6b352-178a-81c4-9f9b-000b3a07e3a0)

- **일정 DB(캘린더 이벤트)** (collection://1ec6b352-178a-818e-9d15-000b27c5ef67)
	- ↔ 업무 DB(collection://1ec6b352-178a-81b2-9758-000b201cb7e7)
	- ↔ 일별 집계표(collection://1ec6b352-178a-819a-bf46-000b54f01518)
	- ↔ (목록 확인) 고객 DB(collection://1ec6b352-178a-810c-8f4f-000be63f5fa7), 거래처 DB(collection://1ec6b352-178a-8187-bb42-000b7748f64b), 구매 DB(collection://1ec6b352-178a-8105-b04d-000b459bcc3e), 판매 DB(collection://1ec6b352-178a-8100-b0a0-000b7618416b), 프로젝트 DB(collection://1ec6b352-178a-814a-a4c3-000bb5ecc134), 연도 집계표(collection://1ec6b352-178a-81c4-9f9b-000b3a07e3a0)

---

## 5) “목록만 확인된 DB” (추가 스키마 확인 필요)

`데이터베이스ㅇ` 페이지에는 다음 DB가 존재합니다. 다만, 본 문서 작성 시점에서는 **각 DB의 속성/관계 스키마를 개별로 열람(View)하지 않아** “DB 존재 및 데이터소스 URL”만 확인되었습니다.[^https://www.notion.so/1ec6b352178a81929950c68c4205ddd5]

- 날짜별
	- 주별 집계표 (data-source: collection://1ec6b352-178a-81fd-80fa-000b7789cafa)
	- 월별 집계표ㅇ (collection://1ec6b352-178a-81f5-ba04-000b7a6c0279)
	- 연도 집계표ㅇ (collection://1ec6b352-178a-81c4-9f9b-000b3a07e3a0)
- 업무
	- 프로젝트 DBㅇ (collection://1ec6b352-178a-814a-a4c3-000bb5ecc134)
- 고객/거래처/파트너
	- 고객 DBㅇ (collection://1ec6b352-178a-810c-8f4f-000be63f5fa7)
	- 거래처 DB (collection://1ec6b352-178a-8187-bb42-000b7748f64b)
	- 고객/거래처 집계 DB (collection://1ec6b352-178a-81a0-aa75-000b5b19147b)
	- 파트너 DBㅇ (collection://1ec6b352-178a-8128-9441-000b87769824)
- 상품/판매/입고
	- 제품 DB (collection://1ec6b352-178a-818e-b43a-000b3742eb3b)
	- 제품 카테고리 DB (collection://1ec6b352-178a-81e3-9a31-000bb98c69b1)
	- 제품 수정 DB (collection://1ec6b352-178a-810d-b29b-000b87043571)
	- 판매 DBㅇ (collection://1ec6b352-178a-8100-b0a0-000b7618416b)
	- 구매 DBㅇ (collection://1ec6b352-178a-8105-b04d-000b459bcc3e)
	- 제품 입출고 DBㅇ (collection://1ec6b352-178a-8121-8794-000b2d1da742)
	- 서비스 DB (collection://1ec6b352-178a-81df-98bf-000bf1072510)
- 수입/지출
	- 수입/지출 DBㅇ (collection://1ec6b352-178a-81bf-8caf-000b38936b2e)
	- 수입/지출 카테고리ㅇ (collection://1ec6b352-178a-816b-8a8f-000b33b80a75)
	- 고정지출 DBㅇ (collection://1ec6b352-178a-8196-9884-000bc829666d)
	- 대출 DBㅇ (collection://1ec6b352-178a-81d1-89d9-000b706ee146)
	- 입출금 수단ㅇ (collection://1ec6b352-178a-8175-a557-000bc9701018)
	- 판매채널 DB (collection://1ec6b352-178a-8165-92fc-000bcd41908a)
- 기록/문서
	- 다이어리 DB (collection://1976b352-178a-8111-9729-000b2550b13b)
	- 작업 로그 DB (collection://1ec6b352-178a-8152-955f-000b758c407b)
	- 글 집계 DB (collection://1ec6b352-178a-815d-b814-000bc52de383)
	- 문서 DBㅇ (collection://1ec6b352-178a-81dd-877a-000b68605216)
	- 견적서 DBㅇ (collection://1ec6b352-178a-813f-bbc1-000b8f8e4911)
	- 영수증 DB (collection://1ec6b352-178a-8121-b2c6-000bc55c80ab)
	- 세금 신고 DBㅇ (collection://1ec6b352-178a-8135-a68d-000b514c973d)
- 참고용 문서(쏠닝노트)
	- 콘텐츠 스크랩 (collection://1ba6b352-178a-8000-8e30-000b07b1d6b7)
	- 유튜브 구독 (collection://1c06b352-178a-8050-a3bb-000bd933b072)
	- Thread 콘텐츠 (collection://1c26b352-178a-80de-b74a-000bcfcbacc2)
	- 데이터모음 (collection://20c406d9-41c1-4531-921e-edd731eaa7b9)

---

## 6) 비고 (제외 범위 / 해석 주의)

- 본 문서는 요청대로 **“운명랩 메뉴 및 그 안에 있는 데이터베이스들”은 제외**를 전제로 작성했습니다.
- 단, 공용 DB(예: 업무 DB)의 속성 중 `사업/가계` 옵션에 “운명랩” 값이 포함되어 있는 것은 확인되며, 이는 “운명랩 전용 DB”라기보다는 **공용 DB 내 카테고리 값**으로 해석하는 편이 안전합니다.[^https://www.notion.so/1ec6b352178a81968a5cce6316d20554]

---
