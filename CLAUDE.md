# Drone Flight Time Calculator (Sentiery)

멀티콥터/고정익/VTOL 비행시간 계산기. React + Vite, 완전 클라이언트 사이드(서버 없음).
회사(Sentiery)가 무료 공개 예정이며, opt-in 익명 비행 데이터 수집으로 기체 성능 DB를 만드는 것이 장기 목표.

**상세 현황과 다음 단계는 반드시 [docs/ROADMAP.md](docs/ROADMAP.md)를 먼저 읽을 것.**

## 명령어

- `npm run dev` — 개발 서버 (포트 5173, `.claude/launch.json`에 preview 설정 있음)
- `npx vite build` — 빌드 검증 (체크 습관: 기능 변경 후 항상 실행)

## 아키텍처

- [src/App.jsx](src/App.jsx) (~2,100줄) — 메인. 멀티콥터 계산기 전체 + 고정익 프리셋 모드 + 모드 전환 + CG 세팅 TIP 모달(SVG 그림). 새 기능은 여기 넣지 말고 파일 분리할 것.
- [src/components/ui.jsx](src/components/ui.jsx) — 공용 컴포넌트 (Sec, InputRow, BigNum, SmallCard, STATUS/LEVEL_META)
- [src/fixedwing/](src/fixedwing/) — 고정익 사진측정/커스텀 모드 전체:
  - `aero.js` — 항력 모델 물리 계산 (CD = CD0 + CL²/(π·e·AR), P = D·V/η). 로그 보정계수(cal) 지원. AIRFRAME_STYLES/PROP_STYLES(취미유저용 계수 매핑), 배터리 프리셋
  - `PhotoWingMeasure.jsx` — 캔버스 사진 트레이싱 (윙팁 2점 스케일 → 외곽선 클릭 → 면적)
  - `ulog.js` — PX4 ULog 파서 (필드 이름 기반, 버전 독립)
  - `dataflash.js` — ArduPilot .bin 파서 (FMT 자기서술, 전체 메시지 길이 저장으로 빠른 스킵)
  - `flightlog.js` — 포맷 자동감지 + 공용 순항 분석 (순항 판정: 수평속도>8m/s, |vz|<1.2m/s)
  - `LogCalibration.jsx` — 로그 업로드/요약/보정 토글 UI
  - `telemetry.js` + `ShareSummary.jsx` — opt-in 익명 요약 공유 (Supabase, env 없으면 자동 비활성)
- [supabase/schema.sql](supabase/schema.sql) — 수집 테이블 (RLS: anon INSERT만, 쓰기 전용 우편함)
- [docs/BACKEND_SETUP.md](docs/BACKEND_SETUP.md) — Supabase 연동 절차

## 핵심 설계 결정 (바꾸기 전에 이유 확인)

1. **완전 클라이언트 사이드** — 로그 파싱을 브라우저에서 하고 요약만 업로드. GPS/원본이 서버에 안 가는 것이 개인정보 전략의 핵심
2. **속도 단위는 m/s 기본** (사진측정/커스텀 모드) — 사용자가 GNC 엔지니어, FC 파라미터/로그가 m/s. km/h는 보조 병기. 프리셋 모드만 제조사 스펙 따라 km/h (통일 여부 미결정)
3. **공력 계수 직접 입력은 "전문가 설정"에 숨김** — 취미 유저는 기체 형상/프로펠러 스타일 선택으로 계수 자동 매핑
4. **로그 파서는 필드/컬럼 이름 기반** — FC 버전별 메시지 구조 차이를 흡수
5. **차트 라벨은 차트 밖 범례로** — 차트 내 텍스트는 겹침 문제로 금지

## 컨벤션

- UI 텍스트 한국어, 코드 주석은 "왜"만 간결하게
- 스타일: 인라인 스타일(기존 코드) + [src/styles.css](src/styles.css) 클래스 혼용 — 새 컴포넌트는 CSS 클래스 선호
- 검증: preview 서버 + 합성 로그로 실동작 확인 (ROADMAP.md에 합성 로그 생성 스니펫 있음)
- 커밋 메시지 스타일: 기존 로그 참고 (영어 명령형 한 줄)
