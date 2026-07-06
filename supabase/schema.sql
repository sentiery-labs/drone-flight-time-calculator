-- Sentiery UAV Flight Time Calculator: 익명 비행 요약 수집 테이블
-- Supabase 대시보드 > SQL Editor에 전체를 붙여넣고 실행하세요.
--
-- 설계 원칙
--  1. 쓰기 전용 우편함: anon 키로는 INSERT만 가능, SELECT 불가 (RLS)
--  2. CHECK 제약으로 말도 안 되는 값(스팸/실수)을 DB 레벨에서 거부
--  3. GPS 좌표, 로그 원본, 비행 시각은 스키마에 아예 존재하지 않음

create table public.flight_summaries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  -- 클라이언트/스키마 버전
  schema_version int not null check (schema_version between 1 and 100),

  -- 입력 모드
  mode text not null check (mode in ('photo', 'custom')),
  area_source text check (area_source in ('photo', 'manual')),

  -- 기체 제원
  wingspan_mm numeric check (wingspan_mm between 200 and 6000),
  wing_area_m2 numeric check (wing_area_m2 between 0.01 and 5),
  tow_kg numeric check (tow_kg between 0.1 and 30),
  airframe_style text check (airframe_style in ('glider', 'sport', 'boxy')),
  prop_style text check (prop_style in ('folding', 'fixed', 'small-fast')),

  -- 사용한 공력 계수 (전문가 수정 포함)
  cd0 numeric check (cd0 between 0.005 and 0.2),
  oswald numeric check (oswald between 0.3 and 1.0),
  prop_eff numeric check (prop_eff between 0.1 and 0.95),
  cl_max numeric check (cl_max between 0.5 and 2.5),

  -- 배터리 구성
  batt_cells int check (batt_cells between 1 and 14),
  batt_mah int check (batt_mah between 100 and 100000),
  batt_kg numeric check (batt_kg between 0 and 10),

  -- 로그 요약 (실측)
  log_format text check (log_format in ('ulog', 'dataflash')),
  flight_min numeric check (flight_min between 0.5 and 600),
  used_wh numeric check (used_wh between 0 and 10000),
  used_mah numeric check (used_mah between 0 and 200000),
  cruise_power_w numeric check (cruise_power_w between 1 and 10000),
  cruise_speed_ms numeric check (cruise_speed_ms between 4 and 80),
  cruise_sec numeric check (cruise_sec between 20 and 36000),

  -- 예측치 (보정 전/후)와 보정계수
  pred_endurance_min numeric check (pred_endurance_min between 0 and 3000),
  pred_endurance_min_cal numeric check (pred_endurance_min_cal between 0 and 3000),
  cal_factor numeric check (cal_factor between 0.3 and 3),
  stall_ms numeric check (stall_ms between 2 and 60),
  best_endurance_speed_ms numeric check (best_endurance_speed_ms between 2 and 80)
);

-- RLS: anon은 INSERT만. 조회는 서비스 키(대시보드/백오피스)로만.
alter table public.flight_summaries enable row level security;

create policy "anon_insert_only"
  on public.flight_summaries
  for insert
  to anon
  with check (true);

-- (선택) 분석용 뷰 예시: 기체 스타일별 실측 효율 분포
-- create view public.style_efficiency as
--   select airframe_style, prop_style,
--          count(*) as flights,
--          percentile_cont(0.5) within group (order by cruise_power_w / nullif(tow_kg, 0)) as median_w_per_kg
--   from flight_summaries
--   group by 1, 2;
