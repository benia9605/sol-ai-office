# 🗄️ DATA SCHEMA — Supabase 테이블/컬럼 백업

> **용도:** 앱이 기대하는 전체 DB 스키마의 단일 레퍼런스(백업).
> **갱신 규칙:** 테이블/컬럼을 추가·수정하면 **반드시 이 파일을 같이 갱신** (CLAUDE.md "DB 변경 규칙" 참조).
> **출처:** `supabase/migrations/*` + `src/services/*.service.ts`(Row 타입) + `src/services/mockSupabase.ts`(시드).
> **최종 갱신:** 2026-06-15
>
> ⚠️ 기본(base) 테이블들은 과거에 Supabase에 직접 생성됨(레포에 DDL 없음). 이 문서가 그 칼럼을 기록한 백업.
> 실제 DB와 차이가 의심되면 이 문서 기준으로 대조/보정할 것.

---

## 0. 공통 규칙
- 모든 테이블: `id UUID PK` + `user_id UUID`(작성자) + RLS(유저별 격리). (워크스페이스/멤버 등 일부 예외)
- 콘텐츠 테이블에는 `workspace_id`/`is_shared` 추가됨(공유 워크스페이스, 004). 일기(journals)만 `is_shared` 기본 false.
- snake_case(DB) ↔ camelCase(프론트) 변환은 각 service에서.

---

## 1. 워크스페이스 (004_workspaces)
| 테이블 | 컬럼 |
|---|---|
| `workspaces` | id, name, emoji, color, **image_url**, **biz_info**, type('personal'\|'office'), invite_code(unique), created_by, created_at, updated_at |
| `workspace_members` | workspace_id, user_id, role('owner'\|'member'), nickname, joined_at · PK(workspace_id,user_id) |
| `workspace_invites` | id, workspace_id, email, invited_by, status('pending'\|'accepted'\|'revoked'), created_at · UNIQUE(workspace_id,email) |
| `workspace_activities` | id, workspace_id, actor_id, action, resource_type, resource_id, metadata(jsonb), created_at |

**헬퍼 함수:** `my_workspace_ids()`, `is_workspace_member(uuid)`, `is_workspace_admin(uuid)` · **트리거:** `trg_auth_user_created_ws`(가입 시 개인 워크스페이스 자동 생성)

## 2. AI 직원 / 오피스 (005_office_staff, 006_daily_reports, 009_brand_contexts, 010~011 정밀로직)
| 테이블 | 컬럼 |
|---|---|
| `staff` | id, workspace_id, user_id, type_key, name, prompt, model('sonnet'\|'haiku'), state('working'\|'idle'), created_at |
| `staff_routines` | id, staff_id, workspace_id, label, schedule('realtime'\|'daily'\|'weekly'\|'monthly'), run_at, **day_of_week**(0~6), **day_of_month**(1~31), **last_run_at**, enabled, created_at |
| `daily_reports` | id, workspace_id, staff_id, user_id, date, title, summary, body, tokens_in, tokens_out, model, **trigger**('auto'\|'manual'), **output_kind**, **content_json**(jsonb), **input**(jsonb), **status**('done'\|'failed'), **error**, created_at · 실행 원장+산출물 통합(010) |
| `staff_output_actions` (액션 승인 큐) | id, workspace_id, staff_id, report_id, user_id, type('schedule'\|'task'\|'insight'), status('suggested'\|'approved'\|'dismissed'), payload(jsonb), promoted_id, approved_at, created_at · AI 액션 HITL 승인 큐(011) |
| `brand_contexts` (회사 브레인) | id, workspace_id(**unique**), user_id, identity, category, tone, target, usp, channels, price_position, ad_angle, compliance, main_products, price_range, competitors, story, raw, version, updated_at, created_at · 워크스페이스 1:1, AI 직원 프롬프트 ①계층 |

## 3. 프로젝트 / 목표 / KPI
| 테이블 | 컬럼 |
|---|---|
| `projects` | id, user_id, name, emoji, color, image, description, status, priority, start_date, end_date, **workspace_id**, created_at |
| `goals` | id, user_id, project_id, title, type('kpi'\|'task'\|'mixed'), status, progress, start_date, end_date, notes, created_at |
| `kpis` | id, user_id, goal_id, name, current_value, target_value, start_value, unit, created_at, updated_at |
| `kpi_logs` | id, user_id, kpi_id, value, date, note, created_at |

## 4. 할일 / 일정 / 인사이트 / 기록 (콘텐츠 — 004에서 공유 컬럼 추가)
| 테이블 | 컬럼 |
|---|---|
| `tasks` | id, user_id, title, type, project, goal_id, status('todo'\|'in_progress'\|'done'), priority, starred, due_date, category, notes, repeat, tags, estimated_time, actual_time, conversation_id, completed_at, **workspace_id**, **is_shared**, **assignee_id**, created_at |
| `schedules` | id, user_id, title, date, end_date, time, project, color, category, repeat, reminder, notes, tags, **workspace_id**, **is_shared**, **completed**, **completed_at**, **is_milestone**, **plan_id**, **phase**, **sort_order**, **generated_by**, created_at · 플랜 컬럼은 021에서 추가 |
| `schedule_plans` (플랜 — D-day 프로젝트) | id, user_id, **workspace_id**, name, emoji, goal, description, target_date, start_date, phases(jsonb 주차정의), categories(jsonb 카테고리정의), status('active'\|'done'\|'archived'), generated_by('manual'\|'ai'), created_at · 021에서 신설. 소속 일정은 `schedules.plan_id`로 연결 |
| `insights` | id, user_id, title, content, source, link, tags, project, priority, starred, time, **workspace_id**, **is_shared**, created_at |
| `readings` | id, user_id, title, author, category, total_pages, current_page, total_lessons, current_lesson, status, cover_emoji, cover_image, start_date, completed_date, rating, review, tags, link, price, toc, chapters, isbn13, **workspace_id**, **is_shared**, **recommended_by**, created_at |
| `reading_logs` (스터디/독서 노트) | id, user_id, reading_id, date, time, chapter, content(jsonb), raw_text, sections(jsonb), **action_items_json**(jsonb), **workspace_id**, **is_shared**, created_at, updated_at · ⚠️ 실제 테이블명은 `reading_logs`(코드/서비스 기준). 워크스페이스 컬럼은 007에서 추가 |
| `journals` (기록) | id, user_id, record_type('morning'\|'evening'\|'weekly'\|'memo'), date, time, title, mood, energy, tags, project, conversation_id, morning_data(jsonb), evening_data(jsonb), weekly_data(jsonb), memo_body(jsonb), **workspace_id**, **is_shared**(기본 false), created_at |

## 5. 대화 / 요약 / 브리핑
| 테이블 | 컬럼 |
|---|---|
| `conversations` | id, user_id, room_id, title, created_at |
| `messages` | id, user_id, conversation_id, role, content, ai_name, created_at |
| `conversation_summaries` | id, user_id, room_id, date, summary |
| `daily_briefings` | id, user_id, date, ai_comment |

## 6. 콘텐츠(유튜브) (003_youtube_content)
| 테이블 | 컬럼 |
|---|---|
| `youtube_channels` | id, user_id, channel_id, title, thumbnail, subscriber_count, video_count, connected_at |
| `youtube_videos` | id, user_id, channel_id, video_id, title, thumbnail, published_at, view_count, like_count, comment_count, script |
| `youtube_comments` | id, user_id, comment_id, video_id, channel_id, author, author_thumbnail, text, published_at, like_count, reply_status('none'\|'draft'\|'published'), reply_draft, replied_at |

## 7. 유저 / 알림 / 기타
| 테이블 | 컬럼 |
|---|---|
| `user_profiles` | id, user_id, name, bio, tone, response_length, emoji_usage, active_theme('modi'\|'modern'), email, created_at |
| `push_subscriptions` | id, user_id, endpoint, p256dh, auth, device_label, created_at |
| `notification_preferences` | id, user_id, task_deadline, task_overdue, morning_routine, schedule_reminder, morning_briefing, pomodoro_done, morning_journal, evening_journal, created_at, updated_at |
| `notification_log` | id, user_id, type, ref_key, created_at |
| `daily_completions` | id, user_id, date, count |
| `custom_options` | id, user_id, option_type, value |
| `active_theme` 컬럼 | user_profiles에 추가됨 (001) |
| `insights.starred` | 즐겨찾기 (002) |

---

## 8. 마이그레이션 매핑
| 파일 | 내용 |
|---|---|
| `001_add_active_theme.sql` | user_profiles.active_theme |
| `002_add_insight_starred.sql` | insights.starred |
| `003_youtube_content.sql` | youtube_channels/videos/comments |
| `004_workspaces.sql` | 워크스페이스 4테이블 + RLS헬퍼 + 트리거 + 콘텐츠 테이블에 workspace_id/is_shared(존재하는 것만) |
| `005_office_staff.sql` | staff, staff_routines |
| `006_daily_reports.sql` | daily_reports |
| `007_reading_logs_workspace.sql` | reading_logs(스터디/독서 노트)에 workspace_id/is_shared 추가 — 004가 잘못된 이름(study_notes)을 써서 누락된 것 보정 |
| `008_routine_schedule.sql` | staff_routines에 day_of_week·day_of_month·last_run_at + schedule 'monthly' 허용 (cron 자동실행용) |
| `009_brand_contexts.sql` | 회사 브레인 테이블(워크스페이스 1:1) — AI 직원 프롬프트 ①계층 |
| `010_daily_reports_extend.sql` | daily_reports에 trigger·output_kind·content_json·input·status·error 추가 (실행 원장+산출물 통합) |
| `011_staff_output_actions.sql` | AI 액션 승인 큐(suggested→approved→dismissed) — HITL |
| `012_report_comments.sql` | daily_reports에 comments(JSONB) — 리포트별 내 의견 |
| `013_workspace_credits.sql` | 코인제 — workspaces.credits(잔액) + staff_usage(실행별 토큰·코인 로그) + deduct_credits() 함수 |
| `014_office_data_workspace.sql` | 오피스/개인 분리 — insights·journals·youtube_channels/videos/comments에 workspace_id (NULL=개인, 값=오피스) |
| `015_fix_workspace_create.sql` | 워크스페이스 생성 실패 수정(SELECT 정책에 created_by 추가) + office 삭제 허용 |
| `016_staff_saved_items.sql` | 직원 보관함 — ⭐로 저장한 산출물(output_kind별, payload JSONB) |
| `017_brand_cs_policy.sql` | 회사 브레인에 cs_policies·cs_tone (CS 직원 정책·톤) |

> ⚠️ **base 테이블(tasks·schedules·insights·journals·readings·projects·conversations·messages·goals·kpis·user_profiles 등)은 레포에 DDL이 없음** — 과거 Supabase에 직접 생성. 새로 환경을 만들 땐 이 문서를 기준으로 재생성 필요. (TODO: base 스키마 덤프를 `000_base_schema.sql`로 박제하면 완전 재현 가능)
