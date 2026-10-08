# 프로젝트 현황 & 로드맵

> 마지막 업데이트: 2026-10-08. 이 문서는 AI 세션 인수인계용으로, 완료된 것·결정된 것·다음 할 일을 상세히 기록한다.
> 작업을 이어받으면 "다음 단계" 섹션부터 보고, 변경 후 이 문서를 갱신할 것.

## 최근 작업 (2026-10-08)

- 로컬 학생용 시안을 `src/student/StudentCalculator.jsx`로 통합했다. `index.html`이 기본 학생용 화면이며 `advanced.html`에서 기존 `App.jsx`를 계속 제공한다. 두 HTML은 Vite 다중 엔트리로 빌드하며 스타일 파일을 서로 분리한다.
- 제조사/모델/KV → 프로펠러 제조사/모델 → 실제 시험 셀·전압으로 선택한다. CSV 파일 목록과 부품 메타데이터는 `src/student/parts-catalog.json`에 기록한다.
- SunnySky V2806 400/650 KV, V3508 580/700 KV와 EOLO CN11x4.5/CN12x5 조합 8개를 `public/data/sunnysky-motors.csv`에 추가했다. 스로틀 %는 미제공으로 `null`을 유지하며 호버 스로틀 여유를 판정하지 않는다. 프로펠러 미등록 무게는 실측 입력이 필요하다.
- 기체·모터·프로펠러·ESC·배터리를 부품별로 합산하거나 전체 이륙중량을 직접 입력한다. 중복 합산하지 않는다. 태양광 옵션은 학생용 기본 화면에서 제외했다.
- 비교 저장은 결과 기준안 하나를 메모리에 보관한다. 새로고침/페이지 이동 시 사라지며 서버에 전송하지 않는다. 전체 무게 방식의 비교에는 부품 무게 대신 전체 이륙중량 입력을 제공한다.
- CSV와 기체 사진은 Vite BASE_URL을 사용한다. 저장소 이름에 따른 Pages 하위 경로에서도 루트 절대 경로를 요청하지 않는다.
- `npm test`로 데이터 및 계산 회귀 테스트 16개를 실행한다. GitHub Actions 배포에도 테스트 단계를 추가했다.
- `docs/UI_UX_UPGRADE_PLAN.md`는 설계 제안이며 완료 체크리스트나 현재 버전 번호를 뜻하지 않는다. 데이터 관리 방법은 `docs/parts-catalog-guide.md`를 참고한다.

### 후속 작업과 제한

- 학생용 설정 내보내기는 JSON 다운로드만 제공한다. 설정 불러오기, 비교 기준 영구 저장, 두 계산기 화면 간 입력 자동 이관은 아직 구현하지 않았다.
- 학생용 고정익은 공력·추진 효율 가정값 기준이다. 정지 추력표로 실제 순항 추진계 성능을 보증하지 않는다. 사진 면적 측정과 로그 요약은 가능하지만 기존 로그 보정·익명 공유는 상세 계산기에서 수행한다.
- 학생용 VTOL은 호버/전환/순항 에너지 근사이며 독립 추진계 분리는 후속 작업이다. 기존 상세 VTOL 임무 빌더를 삭제하지 않았다.
- SunnySky CSV는 학생용 변환 계층과 함께 사용한다. 기존 상세 계산기용 `motor-presets.csv`에 빈 스로틀 행을 그대로 합치지 않는다.
- 아래 2026-07-07 항목은 기존 상세 계산기 기능과 개발 이력을 기록한다.

## 1. 완료된 기능

### 멀티콥터 (원래 있던 기능, 대학원 계산식 기반)
- 호버링 비행시간 (모멘텀 이론 + FM), 모터 추력표 보간, 임무장비 영향, 실측 로그 수동 보정
- 이 부분은 이번 작업에서 거의 안 건드림 (ui.jsx 분리만)

### 고정익 3모드 (src/fixedwing/)
- **프리셋**: Stork/Stallion 제조사 제원 스케일링 (App.jsx 내 calcFixedWing, 기존 코드)
- **사진 측정**: 실측 윙스팬 입력 → Top view 사진 업로드 → 캔버스에서 윙팁 2점 클릭(픽셀↔미터 스케일) → 날개 외곽선 클릭(shoelace 면적) → S/AR/평균시위 자동 계산 → "계산에 적용". 반쪽 트레이스 ×2 옵션 있음
- **커스텀**: 윙스팬·면적·무게 직접 입력
- 사진/커스텀 공용 물리 모델 (aero.js `calcFixedWingAero`):
  - 속도 sweep (1.05×Vstall ~ 3.2×Vstall), CD = CD0 + CL²/(π·e·AR), P_elec = D·V/η + 전자장비
  - 출력: 최대체공(최소전력점), 최대항속(Wh/km 최소점), 실속속도, L/D, 전력곡선
  - 검산 예: 1.62m/0.36m²/2.2kg/4S10Ah 기본값 → 체공 ~167분, 실속 9.0m/s
- 공력 계수는 기체 형상 3종(glider/sport/boxy → CD0·e) × 프로펠러 3종(folding/fixed/small-fast → η) 선택으로 자동 설정. 숫자 입력은 "전문가 설정" 접힘 섹션

### 비행 로그 보정 (PX4 + ArduPilot)
- 파일 업로드 → 매직 바이트로 포맷 자동 감지 (flightlog.js `detectLogFormat`)
- ULog: battery_status + vehicle_local_position (폴백: vehicle_gps_position, sensor_gps)
- DataFlash: BAT + GPS (인스턴스 0만). **주의: 모든 FMT의 길이를 저장해야 비대상 메시지를 빠르게 스킵함** (dataflash.js에 구현됨, 지우지 말 것)
- 순항 구간 자동 검출 → 평균 순항전력/속도 → 모델의 같은 속도 예측과 비교 → 보정계수 (0.3~3 클램프) → 전력곡선 전체에 적용
- localStorage 저장 (`fw-log-cal-v1`), 새로고침 유지
- 상태 카드: 보정 전 "±20-30% 오차 가능" → 보정 후 "추진전력 ×0.85" 식으로 전환

### 익명 데이터 수집 (opt-in)
- telemetry.js: 27개 필드 요약(기체 제원+배터리+순항 실측+예측치+보정계수)만 전송. **GPS·비행시각·로그원본 필드는 존재 자체가 없음** — 이 원칙 유지할 것
- Supabase REST 직접 INSERT (anon 키). RLS로 쓰기 전용. env 미설정 시 UI에 "미설정" 표시
- 중복 방지: 요약 시그니처를 localStorage(`fw-shared-summaries-v1`)에 저장
- 백엔드 활성화 절차: docs/BACKEND_SETUP.md (Supabase 프로젝트 생성 → schema.sql 실행 → VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY 설정)

### UI 개선
- CG 세팅 TIP 모달의 비행기 그림 3종 + 배터리 위치 개념도를 제대로 된 측면도 SVG로 재작성 (App.jsx 내 인라인 SVG)
- 전력곡선 차트: 라벨을 차트 밖 범례(색점+수치)로, 운용점은 곡선 위 ReferenceDot, 실속선이 X축 범위에 들어오게 domain 조정
- 속도 단위 m/s 기본 (km/h 병기)

## 2. 검증 방법 (중요 — 실로그 없이 테스트하는 법)

브라우저 콘솔/eval에서 합성 로그를 만들어 file input에 주입한다. 요지:

**합성 ULog** (기대값: 19.0분, 15.9Wh, 1022mAh, 순항 50W @ 12.5m/s, 보정 ×0.85):
```js
// 헤더: [0x55,0x4c,0x6f,0x67,0x01,0x12,0x35, ver1, u64 타임스탬프]
// 'B' 플래그(40바이트 0) → 'F' 포맷 정의 → 'A' 구독(multi0, msgId) → 'D' 데이터
// battery_status: "battery_status:uint64_t timestamp;float voltage_v;float voltage_filtered_v;float current_a;float current_filtered_a;float discharged_mah;"
// vehicle_local_position: "vehicle_local_position:uint64_t timestamp;float vx;float vy;float vz;"
// 1200초, 1Hz, 30~1170초 구간 12.5m/s·3.2A, 나머지 0.5A
// 메시지 = [size u16 LE][type 1B][payload]
```

**합성 DataFlash** (기대값: 18.7분, 29.7Wh, 순항 94W @ 16m/s, 보정 ×1.08):
```js
// FMT(0x80, 총 89바이트): [0xA3,0x95,0x80, type, length, name[4], format[16], columns[64]]
// BAT id100 len28 "QBffff" "TimeUS,Inst,Volt,VoltR,Curr,CurrTot"
// GPS id101 len20 "QBff"   "TimeUS,I,Spd,VZ"
// 스킵 검증용 ATT id102 len19 "Qff" "TimeUS,Roll,Pitch" 를 섞을 것
// 데이터 = [0xA3,0x95,id][필드들 LE]
```

주입: `new File([bytes], "x.ulg")` → `DataTransfer`로 input.files 설정 → `dispatchEvent(new Event('change',{bubbles:true}))`

공유 페이로드 검증: `window.fetch`를 몽키패치해서 body 캡처 (실서버 불필요). 더미 env는 `.env.local`(gitignore됨)에 넣고 테스트 후 삭제.

사진 측정 검증: 캔버스에 800×500 합성 이미지(날개 사각형) 그려서 File 주입, 클릭은 MouseEvent(clientX/Y)를 canvas rect 비율로 계산. **연속 클릭 시 setTimeout으로 리렌더 대기 필요** (스케일 2점 완료 시 자동 단계전환이 상태 업데이트라서).

## 3. 결정/미결정 사항

**결정됨 (2026-07-07)**:
- 라이선스: **Apache-2.0, 저작권자 Sentiery** (LICENSE + NOTICE에 로고 상표 제외 명시)
- 배포: GitHub Pages (.github/workflows/deploy.yml, push 시 자동. Supabase secrets는 저장소 Secrets에 설정 시 활성화)
- 저장소는 **sentiery-labs 조직으로 이전 예정** (사용자가 GitHub에서 수동으로). README에서 고정 URL 제거 완료. vite base "./"라 이전 후에도 동작

**미결정**:
1. **프리셋 모드 속도 단위**: 현재 km/h(제조사 스펙 기준) 유지 중. m/s 통일 여부 물어볼 것

## 4. 다음 단계 (우선순위순, 구현 힌트 포함)

### A. ~~커밋 정리 + 배포~~ (완료 — GitHub Pages 자동 배포 중)

### A2. 완료된 추가 기능 (2026-07-07)
- 고정익 속도-항속시간 곡선 차트 + (L/D)max 지점 표시 (aero.js curve에 enduranceMin/maxLdSpeedMs 추가)
- VTOL 미션 빌더 (src/vtol/VtolPanel.jsx): 호버(멀티콥터 탭 연동)+전환+순항(고정익 탭 연동) 프로파일,
  에너지 배분 바, 동일 배터리 멀티콥터 vs VTOL 비교 카드. 검산: 호버 252W·2분=8.4Wh, 순항 51W → 최대 91.5km

### B. 드래그 폴라 피팅 (로그 보정 고도화)
- 현재: 순항점 1개로 스칼라 보정계수. 다음: 서로 다른 속도의 정상비행 구간들에서 (V, P) 점들을 모아 `P(V) = a·V³ + b/V` 최소자승 피팅 → a에서 CD0·S/η, b에서 k·W²/(S·η) 역산
- flightlog.js summarizeFlight에서 순항 구간을 하나로 뭉치지 말고 속도 버킷별(예: 1m/s 단위)로 (평균V, 평균P, 지속시간) 배열 반환하도록 확장
- 점이 3버킷 이상일 때만 피팅, 아니면 기존 스칼라 보정 폴백
- 피팅 결과를 전문가 설정에 "역산된 CD0/η" 로 표시하면 educational value 큼

### C. VTOL 고도화 (기본 빌더는 완료)
- 전환 구간을 시간×호버전력이 아닌 별도 전력 프로파일로
- 왕복 미션 (편도 거리 ×2 + 현장 호버 시간)
- VTOL 전용 기체 무게 입력 (현재는 고정익 탭 AUW 공유 — 호버 전력과 무게가 다른 탭 기준일 수 있는 비일관성 있음, 상태카드로 안내 중)

### D. 실로그 검증 (사용자 협조 필요)
- 사용자가 PX4 실로그(.ulg) 보유. ArduPilot .bin은 주변인에게 요청 예정
- 확인 포인트: ArduPilot CurrTot 단위가 정말 mAh인지 (dataflash.js 주석 참조), 대용량(수십MB) 파싱 속도 — 느리면 Web Worker로 이동
- ULog appended-data 플래그(incompat bit0)는 계속 파싱하는 걸로 처리했음 — 실로그에서 문제 시 ulog.js 'B' 메시지 처리 확인

### E. 사진 측정 고도화 (낮은 우선순위)
- 외곽선 자동 검출(배경 대비 threshold) — 수동 클릭은 유지하고 보조로만
- 상반각/원근 보정은 오차 1~2%라 불필요하다고 결론냄

### F. CG 계산기 (모달에 "나중에 넣을 CG 계산식" 자리 있음)
- Σ(부품무게×거리)/Σ(무게), 프리셋 기체의 권장 CG와 비교해 배터리 이동량 추천

### G. 데이터 수집 강화 (트래픽 생기면)
- Cloudflare Turnstile + Supabase Edge Function 경유 (BACKEND_SETUP.md에 방향 있음)
- 수집 데이터로 기체 스타일별 계수 분포 업데이트 → AIRFRAME_STYLES 기본값 개선

## 5. 알려진 이슈 / 주의점

- **App.jsx ~2,100줄** — 멀티콥터 부분도 언젠가 분리 필요. 단, 사용자가 요청할 때만
- 빌드 시 청크 700KB 경고 (recharts 포함) — 동작엔 문제없음, code-split은 나중에
- 사진 측정 상태는 localStorage 저장 안 됨 (세션 한정) — 의도된 동작
- 고정익 프리셋 모드의 "사전 세팅 TIP" 버튼은 프리셋 모드에서만 접근 가능
- preview 테스트 시 로그 보정 상태가 localStorage에 남아있을 수 있음 — 테스트 전 `fw-log-cal-v1` 키 확인
- Supabase anon INSERT는 스팸 가능성 있음 (CHECK 제약이 1차 방어) — G 항목 참조

## 6. 사용자 컨텍스트

- GNC 엔지니어 (Sentiery), 대학원 때 멀티콥터 계산식 본인이 유도. PX4 사용, 주변은 ArduPilot
- 취미 유저도 쓸 수 있는 UX를 중시 ("Oswald 효율 적으라고 하면 의미 없다")
- 정확도에 정직한 표시 선호 (±오차 명시, 보정 전/후 구분)
- 무료 공개 + 데이터 수집으로 기체 성능 DB 구축이 회사 전략
