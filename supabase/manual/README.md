# supabase/manual - 대표가 SQL Editor 에서 한 번 손으로 돌리는 SQL

마이그레이션이 아니다 (이 오피스 운영 DB 에만 해당하는 설정 · 확인). 돌린 기록으로 남겨 둔다.

| 파일 | 언제 | 무엇 |
|---|---|---|
| hq-precheck.sql | 065 전 (2026-10-27 실행) | 060 · 062 가 들어가 있는지 읽기만 |
| hq-connect-once.sql | 065 뒤 (2026-10-27 실행) | 세 워크스페이스 본부 키 · 브랜드 기본값 · 본부 토큰 **해시** 등록 |

## 새 SQL 을 만들 때 (본부 · sol-hq Claude)
1. `supabase/pending/<다음번호>_<이름>.sql` 로 만든다 - 대표에게 보여 준다
2. 대표가 Supabase SQL Editor 에서 돌린다
3. 마이그레이션이면 `supabase/migrations/` 로 옮기고, 한 번짜리 설정이면 여기(manual)로 옮긴다
