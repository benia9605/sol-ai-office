# DB 테이블 추가 - user_profiles

## SQL 명령어 (Supabase SQL Editor에서 실행)

```sql
-- 유저 프로필 테이블
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,  -- 나중에 auth.users 연결 (지금은 null 허용)
  name TEXT NOT NULL,
  bio TEXT,
  tone TEXT DEFAULT 'friendly',           -- friendly / polite / formal
  response_length TEXT DEFAULT 'short',   -- short / medium / detailed
  emoji_usage TEXT DEFAULT 'moderate',    -- many / moderate / few
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 끄기 (개발 중)
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;

-- 기본 프로필 1개 생성 (Sol님용)
INSERT INTO user_profiles (name, bio, tone, response_length, emoji_usage)
VALUES (
  'Sol',
  '1인 사업가, 3개 프로젝트 운영 중. 남편 민석이랑 같이 일함. 한 번에 하나씩 집중하는 스타일.',
  'polite',
  'short',
  'moderate'
);
```

---

## 테이블 구조

| 컬럼 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| id | UUID | auto | PK |
| user_id | UUID | null | 나중에 로그인 연결용 |
| name | TEXT | - | 이름 (필수) |
| bio | TEXT | null | 나에 대해 |
| tone | TEXT | 'friendly' | 톤 (friendly/polite/formal) |
| response_length | TEXT | 'short' | 답변 길이 (short/medium/detailed) |
| emoji_usage | TEXT | 'moderate' | 이모지 (many/moderate/few) |
| created_at | TIMESTAMP | now() | 생성일 |
| updated_at | TIMESTAMP | now() | 수정일 |

---

## 옵션 값

### tone (톤)
- `friendly`: 친근하게 (반말 OK)
- `polite`: 친근한 존댓말
- `formal`: 격식있게

### response_length (답변 길이)
- `short`: 짧고 핵심만
- `medium`: 적당히
- `detailed`: 자세하게 설명

### emoji_usage (이모지 사용)
- `many`: 많이
- `moderate`: 적당히
- `few`: 거의 안 씀
