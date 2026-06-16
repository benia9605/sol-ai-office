# AI 직원 #1 — 소싱 & 상품 기획 담당

## 역할 정의
"트렌드 보고 팔릴 근거부터 정리해주는 직원"
키워드, 카테고리 트렌드, 경쟁 강도를 분석해서
"지금 이 상품 소싱해야 해 / 말아야 해"를 근거와 함께 알려준다.

## 브랜드별 특화 동작

| 브랜드 | 특화 분석 |
|--------|---------|
| 운명랩 | 인생네컷/감성 소품 트렌드, 10-20대 여성 키워드, SNS 바이럴 아이템 |
| 쏠닝포인트 | 헬스 보충제 성분 트렌드, 계절별 수요, 경쟁사 리뷰 분석 |
| 시목 | 원목 인테리어 트렌드, 평수별 인기 아이템, 친환경/자연 소재 니즈 |

## 주요 기능

### 기능 1: 상품 소싱 가능성 분석
- 인풋: 상품명/카테고리 텍스트 입력
- 아웃풋:
  - 시장 트렌드 요약
  - 예상 경쟁 강도 (상/중/하)
  - 소싱 추천 여부 + 이유
  - 예상 타겟 고객 페르소나
  - 추천 판매 채널

### 기능 2: 키워드 기획안 생성
- 인풋: 상품명
- 아웃풋:
  - 메인 키워드 5개
  - 서브 키워드 10개
  - 스마트스토어 상품명 초안 3가지
  - 태그 20개

### 기능 3: 상품 기획서 초안
- 인풋: 상품 설명 + 참고 이미지(선택)
- 아웃풋: 구조화된 상품 기획서
  (타겟, USP, 가격 포지셔닝, 마진 계산 가이드, 차별화 포인트)

## API 설계

### POST /api/agents/souring

```typescript
// Request
{
  brandId: 'unmyeonglab' | 'ssoningpoint' | 'simok',
  mode: 'analysis' | 'keyword' | 'planning',
  input: {
    productName: string,
    category?: string,
    additionalInfo?: string
  }
}

// Response (Streaming)
// text/event-stream
```

## 시스템 프롬프트 구조
/lib/prompts/souring.ts
export const SOURING_SYSTEM_PROMPT = (brand: BrandConfig) => `
당신은 ${brand.name}의 소싱 및 상품 기획 전문 AI 직원입니다.
[브랜드 컨텍스트]

브랜드명: ${brand.name}
카테고리: ${brand.category}
주요 채널: ${brand.channels.join(', ')}
톤앤매너: ${brand.tone}
주요 타겟: ${brand.target}

[당신의 역할]
국내 이커머스(스마트스토어, 쿠팡) 환경에 최적화된 소싱 분석을 합니다.
느낌이 아닌 근거(트렌드 방향, 경쟁 강도, 타겟 명확성)로 판단합니다.
결과물은 바로 실행 가능한 형태로 제공합니다.
[출력 형식]
마크다운 형식으로 구조화하여 출력합니다.
`

## UI 컴포넌트 명세
<SouringAgent>
  ├── <BrandSelector />          ← 브랜드 선택 (전역 공유)
  ├── <ModeSelector />           ← 분석 모드 선택 탭
  ├── <InputForm>
  │     ├── <ProductNameInput /> ← 상품명/카테고리 텍스트
  │     └── <SubmitButton />
  ├── <ResultPanel>
  │     ├── <StreamingText />    ← 스트리밍 결과
  │     ├── <CopyButton />
  │     └── <SaveButton />       ← Supabase 저장
  └── <HistoryList />            ← 최근 분석 히스토리
````
DB 스키마 (Supabase)
sqlCREATE TABLE souring_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  input JSONB NOT NULL,
  output TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
개발 난이도: ⭐⭐ (쉬움)
Claude Code 구현 예상 시간: 2-3시간