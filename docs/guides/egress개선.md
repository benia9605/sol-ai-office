[목표] Supabase egress 폭증 해결. 폴링/실시간은 0건 확인됨. 원인은 반복 풀조회(select '*') + limit 없음 + 워크스페이스 이미지 base64. AI 호출은 egress 원인 아님. 데이터 안전, 전송량만 줄이는 변경. egress throttle 중이라 코드 수정·타입체크는 지금, DB 실행(마이그레이션)은 스크립트만 작성 후 복구 후 실행.

[🔴 1순위 — dailyReports.service.ts fetchReportsByStaff]
1) select('*') → 목록용 경량 컬럼만(id, date, title, summary, status, output_kind, created_at). content_json·body·input 등 큰 컬럼 제외.
2) .limit() 추가 (직원 상세에서 그 직원 전체 리포트 무한 조회 방지).
3) 본문(content_json/body/input)은 단건 상세 열 때만 조회.

[🔴 2순위 — dailyReports.service.ts fetchReportsByWorkspace]
4) select('*') → id, date, title, summary, status, output_kind, created_at 만.
5) 대시보드(6)/브리핑(30)/활동(60) 모두 큰 JSON 제외, 필요 시 단건 조회.

[🟠 3순위 — workspaces.service.ts fetchMyWorkspaces + 워크스페이스 모달]
6) 이미지가 base64로 image_url에 저장돼 있음 → Storage 전환:
   - 업로드 로직을 supabase.storage.upload() 후 URL만 저장하도록 변경.
   - 기존 base64 → Storage 마이그레이션 스크립트 작성(실행은 복구 후).
   - 앱 열 때·전환마다 무거운 base64 전송되던 것 제거.

[🟠 4순위 — 거의 모든 서비스 (insights/tasks/schedules/records/staff/youtube…)]
7) 목록 조회의 select('*') → 큰 컬럼 제외한 경량 select로 통일.
8) 화면 진입/네비마다 무조건 재조회 → 간단한 캐시 또는 조건부 조회로 정리(특히 개발 중 잦은 새로고침 누적분).

[🟡 5순위 — auth.ts getCurrentUserId]
9) 서비스 호출마다 supabase.auth.getUser() 호출 → uid 메모리 캐시.

[작업 방식]
- 우선순위 🔴1·🔴2·🟠3가 효과 대부분 차지하니 여기부터.
- 각 수정 전후 "무엇을 가져왔고 → 무엇만 가져오게 바꿨는지" 한 줄 요약.
- 마이그레이션 스크립트는 별도 파일 + "복구 후 실행" 주석.
- 타입체크/빌드 통과 확인.