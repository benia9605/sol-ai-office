# 나만의 AI 오피스 — 프로젝트 전체 개요

## 프로젝트명
**AI Office for [운명랩 | 쏠닝포인트 | 시목]**

## 목표
판매 목적이 아닌, 3개 자체 브랜드(운명랩, 쏠닝포인트, 시목) 운영에 특화된
사내 전용 AI 직원 오피스 웹 애플리케이션을 Claude Code로 개발한다.
각 AI 직원은 브랜드 컨텍스트(톤앤매너, 상품 카테고리, 주요 채널)를
사전에 학습하여, 매번 설명 없이도 바로 실무 결과물을 출력한다.

## 브랜드 컨텍스트 정의

| 브랜드 | 카테고리 | 주 채널 | 톤앤매너 |
|--------|---------|---------|---------|
| 운명랩 | 라이프스타일 소품 (인생네컷 관련 등) | 스마트스토어, 인스타그램 | 감성적, 힐링, MZ |
| 쏠닝포인트 | 헬스/건강식품 (보충제 계열) | 스마트스토어, 쿠팡 | 신뢰감, 성분 중심, 전문적 |
| 시목 | 원목 가구/소품 브랜드 | 스마트스토어, 자사몰 | 따뜻함, 자연, 장인정신 |

## 기술 스택

### Frontend
- Framework: Next.js 14 (App Router)
- UI: Tailwind CSS + shadcn/ui
- State: Zustand
- 배포: Vercel

### Backend
- Runtime: Next.js API Routes (서버리스)
- AI: Anthropic Claude API (claude-sonnet-4-5 권장)
- DB: Supabase (PostgreSQL)
- 파일 저장: Supabase Storage
- 인증: Supabase Auth (이메일 로그인)

### 개발 도구
- Claude Code (주 개발 도구)
- TypeScript 필수
- ESLint + Prettier

## 폴더 구조
/app
/dashboard         ← 메인 AI 오피스 대시보드
/agents
/souring         ← 소싱 AI 직원
/detail-page     ← 상세페이지 AI 직원
/cs              ← CS AI 직원
/sns             ← SNS AI 직원
/ad              ← 광고 AI 직원
/monitor         ← 모니터링 AI 직원
/brand-settings    ← 브랜드 컨텍스트 설정 페이지
/history           ← 작업 히스토리
/components
/lib
/anthropic.ts      ← Claude API 클라이언트
/supabase.ts       ← Supabase 클라이언트
/prompts/          ← 각 AI 직원별 시스템 프롬프트
/types

## 공통 UI 패턴
- 브랜드 선택 토글 (운명랩 / 쏠닝포인트 / 시목) → 전역 상태로 관리
- 각 AI 직원 페이지: 인풋 폼 → 실행 버튼 → 스트리밍 결과 출력
- 결과물 복사/다운로드 버튼 항상 제공
- 작업 히스토리 자동 저장 (Supabase)

## 환경 변수 (.env.local)
ANTHROPIC_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

## 개발 우선순위
1. ✅ Phase 1 (핵심): 상세페이지 AI + CS AI + 소싱 AI
2. 🔄 Phase 2 (확장): SNS AI + 광고 AI
3. 📌 Phase 3 (고도화): 경쟁사 모니터링 + 대시보드