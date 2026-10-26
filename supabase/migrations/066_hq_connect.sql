-- ────────────────────────────────────────────────────────
-- 본부 연결 (한 번만) · 065 다음에 실행
-- ────────────────────────────────────────────────────────
-- 마이그레이션이 아니라 이 오피스에만 해당하는 설정이다 (supabase/migrations 에 넣지 않는다).
--   ① 세 워크스페이스에 본부 키 · 브랜드 값
--   ② 본부 토큰 3개 등록 - 해시만. 평문은 대표 맥 sol-hq/.env 에만 있다
--   ③ 확인
-- 워크스페이스 이름이 다르면 ① 의 이름 조건만 고치고 다시 돌리면 된다 (여러 번 돌려도 안전).

-- ── ① 본부 키 · 브랜드 값 ──
update workspaces set hq_brand_key = 'simok',
  brand_logo = coalesce(brand_logo, 'SIMOK'), brand_sub = coalesce(brand_sub, 'THE PRIVATE OFFICE'),
  brand_motto = coalesce(brand_motto, '좋은 것은 시간을 담는다'),
  brand_paper = coalesce(brand_paper, '#f4f2eb'), brand_point = coalesce(brand_point, '#1f4035'),
  brand_hero_image = coalesce(brand_hero_image, '/simok/tea.png')
where type = 'office' and (office_shell = 'simok' or name ilike '%시목%') and hq_brand_key is null;

update workspaces set hq_brand_key = 'solningpoint',
  brand_logo = coalesce(brand_logo, 'SOLNING'), brand_sub = coalesce(brand_sub, 'PRODUCTIVITY OFFICE'),
  brand_motto = coalesce(brand_motto, '하루를 생산적이게'),
  brand_paper = coalesce(brand_paper, '#f6f5f0'), brand_point = coalesce(brand_point, '#00594D'),
  brand_hero_word = coalesce(brand_hero_word, 'OZ')
where type = 'office' and (name ilike '%쏠닝%' or name ilike '%solning%') and hq_brand_key is null;

update workspaces set hq_brand_key = 'unmyunglab',
  brand_logo = coalesce(brand_logo, '운명랩'), brand_sub = coalesce(brand_sub, 'UNMYUNG LAB OFFICE'),
  brand_motto = coalesce(brand_motto, '운명은 공식, 삶은 선택'),
  brand_paper = coalesce(brand_paper, '#FAF9F6'), brand_point = coalesce(brand_point, '#5B3A6B'),
  brand_hero_word = coalesce(brand_hero_word, '입동')
where type = 'office' and name ilike '%운명%' and hq_brand_key is null;

-- ── ② 본부 토큰 (해시) ──
insert into ingest_credentials (workspace_id, name, token_sha256, scopes, environment, usage)
select w.id, 'sol-hq', t.hash, array['hq:ingest'], 'production', 'operational'
from workspaces w
join (values
  ('simok', '382667dc5ebfc2e12a048c404a35e62a007e55c0472dec8512a9a0b22df55e82'),
  ('solningpoint', '6d13b7ce9214674c54e3a53bbe63ad42be9a216727909bb50076534b46f0c104'),
  ('unmyunglab', 'f7e796cba2cbbc11477b7d302c4b4e3f60ed156d3fa89cb77fb95f5cc75c351f')
) as t(brand, hash) on t.brand = w.hq_brand_key
on conflict (token_sha256) do nothing;

-- ── ③ 확인 - 아래 표에 세 줄 (simok · solningpoint · unmyunglab) 이 보이면 끝 ──
select w.name, w.hq_brand_key, w.brand_point, (c.id is not null) as hq_token
from workspaces w
left join ingest_credentials c on c.workspace_id = w.id and 'hq:ingest' = any(c.scopes) and c.is_active
where w.type = 'office'
order by w.hq_brand_key nulls last, w.name;
