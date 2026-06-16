# 📄 03_AI_CS_AGENT.md

````markdown
# AI 직원 #3 — CS 자동화 담당

## 역할 정의
"고객 문의를 분류하고 답변 초안을 바로 만들어주는 직원"
고객이 보낸 문의를 붙여넣으면, 유형 분류 + 톤앤매너에 맞는 답변 초안을 즉시 생성.
매번 비슷한 문의에 매번 새로 쓰는 시간을 없앤다.

## 브랜드별 CS 특성

| 브랜드 | 주요 문의 유형 | CS 톤 |
|--------|--------------|-------|
| 운명랩 | 배송 일정, 사이즈/컬러 문의, 선물 포장 요청 | 친근, 따뜻, 이모지 O |
| 쏠닝포인트 | 성분 궁합, 복용법, 알레르기, 유통기한 | 전문적, 정확, 신중 |
| 시목 | 원목 AS, 사이즈 맞춤 여부, 배송 조립 | 정중, 상세, 신뢰 |

## 주요 기능

### 기능 1: 문의 자동 분류 + 답변 생성
- 인풋: 고객 문의 텍스트 (카카오채널/스마트스토어에서 복붙)
- 아웃풋:
  - 문의 유형 분류 (배송/교환환불/상품문의/기타)
  - 긴급도 (즉시대응/일반/낮음)
  - 브랜드 톤에 맞는 답변 초안
  - 추가 확인 필요 사항 (있을 경우)

### 기능 2: FAQ 자동 생성
- 인풋: 상품명 + 브랜드
- 아웃풋: 자주 묻는 질문 10개 + 답변 세트

### 기능 3: 부정 리뷰 대응 초안
- 인풋: 부정 리뷰 텍스트
- 아웃풋: 공감 + 해결 제시 + 브랜드 이미지 보호하는 댓글 초안

## API 설계

### POST /api/agents/cs

```typescript
{
  brandId: string,
  mode: 'reply' | 'faq' | 'review-response',
  input: {
    customerMessage: string,
    productName?: string,
    orderInfo?: string    // 주문번호 등 선택사항
  }
}
```

## 시스템 프롬프트 구조

```typescript
export const CS_SYSTEM_PROMPT = (brand: BrandConfig) => `
당신은 ${brand.name}의 고객서비스 전문 AI 직원입니다.

[브랜드 CS 가이드]
- 브랜드명: ${brand.name}
- CS 톤: ${brand.csTone}
- 금지 표현: ${brand.csProhibitedWords?.join(', ')}
- 필수 포함: 항상 먼저 불편에 공감하고, 해결책 제시 후 마무리

[국내 이커머스 CS 원칙]
1. 첫 문장은 항상 고객 불편 공감
2. 해결 불가능한 건은 명확히, 대안 제시
3. 환불/교환은 정책 내에서 최대한 수용적으로
4. 답변 길이: 3-5문장 (모바일 기준)

[출력 형식]
문의유형: [유형]
긴급도: [즉시/일반/낮음]
---
[답변 초안]
---
확인필요: [있으면 명시, 없으면 "없음"]
`
```

## UI 컴포넌트
<CSAgent>
  ├── <BrandSelector />
  ├── <ModeTab />               ← 문의답변 / FAQ생성 / 리뷰대응
  ├── <MessageInput>
  │     ├── <TextArea />        ← 고객 문의 붙여넣기
  │     └── <GenerateButton />
  ├── <ClassificationBadge />   ← 문의유형 + 긴급도 표시
  ├── <ReplyResult>
  │     ├── <EditableText />    ← 인라인 편집 가능
  │     ├── <CopyButton />
  │     └── <RegenerateButton />
  └── <QuickTemplates />        ← 자주 쓰는 답변 템플릿 저장/불러오기
````
개발 난이도: ⭐⭐ (쉬움)
Claude Code 구현 예상 시간: 2-3시간