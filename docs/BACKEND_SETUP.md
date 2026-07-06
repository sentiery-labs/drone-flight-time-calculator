# 비행 요약 수집 백엔드 설정 (Supabase)

익명 비행 요약 공유 기능을 활성화하는 절차입니다. 약 10분 걸립니다.
설정하지 않으면 공유 UI에 "공유 서버 미설정"이 표시되고 나머지 기능은 전부 정상 동작합니다.

## 무엇이 수집되나

클라이언트(브라우저)에서 로그를 파싱한 뒤 **요약 수치만** 전송합니다 (수 KB).

| 전송함 | 전송 안 함 |
|---|---|
| 기체 제원 (윙스팬, 주익 면적, 무게) | 로그 파일 원본 |
| 배터리 구성 (셀 수, 용량, 무게) | GPS 좌표·비행 경로 |
| 순항 요약 (평균 전력, 속도, 소모 Wh/mAh) | 비행 날짜·시각 (서버 수신 시각만 기록됨) |
| 예측치와 보정계수 | 기기·계정 정보 |

사용자가 체크박스로 동의하고 버튼을 눌러야만 전송됩니다 (opt-in).

## 설정 절차

1. **Supabase 프로젝트 생성** — <https://supabase.com> 가입 후 New Project (무료 티어면 충분).
2. **테이블 생성** — 대시보드 > SQL Editor에 [`supabase/schema.sql`](../supabase/schema.sql) 전체를 붙여넣고 Run.
   - anon 키로는 INSERT만 가능하고 조회는 불가능하게 RLS가 설정됩니다 (쓰기 전용 우편함).
   - 값 범위 CHECK 제약이 스팸/이상값을 DB 레벨에서 거부합니다.
3. **키 확인** — 대시보드 > Settings > API에서 두 값을 복사:
   - Project URL (예: `https://abcd1234.supabase.co`)
   - `anon` `public` 키 (anon 키는 공개되어도 되는 키입니다. `service_role` 키는 절대 클라이언트에 넣지 마세요.)
4. **환경변수 설정** — 로컬 개발은 프로젝트 루트에 `.env.local` 생성 (`.gitignore`에 이미 포함됨):

   ```
   VITE_SUPABASE_URL=https://abcd1234.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
   ```

   배포(Cloudflare Pages / Vercel / GitHub Actions)에서는 빌드 환경변수로 같은 두 값을 설정합니다.
5. **빌드/재시작** — `npm run dev` 재시작 또는 재배포하면 공유 버튼이 활성화됩니다.

## 데이터 확인

수집된 데이터는 대시보드 > Table Editor > `flight_summaries`에서 보거나,
SQL Editor에서 분석 쿼리를 돌리면 됩니다. 예시:

```sql
-- 기체 스타일별 실측 순항효율(W/kg) 중앙값
select airframe_style, count(*) as flights,
       percentile_cont(0.5) within group (order by cruise_power_w / nullif(tow_kg, 0)) as median_w_per_kg
from flight_summaries
group by 1;

-- 예측 대비 실측 보정계수 분포 (모델이 얼마나 정확한지)
select width_bucket(cal_factor, 0.5, 1.5, 10) as bucket, count(*)
from flight_summaries
group by 1 order by 1;
```

## 트래픽이 늘면 (추후 강화)

anon 키 INSERT는 원리상 스크립트 스팸이 가능합니다. 문제가 되기 시작하면:

1. **Cloudflare Turnstile** (무료 캡차) — 공유 버튼에 붙이고 Supabase Edge Function에서 토큰 검증 후 INSERT
2. **Edge Function 경유** — 클라이언트 직접 INSERT 대신 함수를 거치면 레이트리밋·중복 검사 가능
3. **수집 필드 확장 시 주의** — 시각·위치가 간접적으로라도 들어가지 않게 유지 (익명성의 핵심)

## 개인정보 고지

서비스에 공개할 때 한 줄 고지를 권장합니다:
"공유 기능은 선택 사항이며, 기체 제원과 비행 성능 요약만 익명으로 수집됩니다. 위치·시각·로그 원본은 수집하지 않습니다."
