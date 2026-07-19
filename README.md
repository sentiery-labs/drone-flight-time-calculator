# Sentiery UAV Flight Time Calculator

멀티콥터·고정익·VTOL 기체의 비행시간을 추정하는 React 웹앱입니다.
기체 제원과 배터리 구성으로 1차 추정하고, 실측 비행 로그(PX4 .ulg / ArduPilot .bin)로 보정합니다.

> **배포 주소**: `main` 브랜치에 push하면 GitHub Actions가 GitHub Pages로 자동 배포합니다.
> 현재 주소는 저장소 상단 About 링크 또는 Settings > Pages에서 확인하세요.
> (저장소 조직 이전 시 주소가 바뀌므로 이 문서에는 고정 URL을 적지 않습니다.)

## 주요 기능

### 멀티콥터
- 기체 중량, 로터 수, 배터리 용량, 페이로드 기반 비행시간 추정
- CSV 기반 모터/프로펠러 추력표 프리셋
- 제조사 추력표 기반 throttle, current, power 선형 보간
- 제조사 스펙시트의 50% throttle 추력/전력 직접 입력
- ESC 무게 및 전류 여유율 계산
- 추력 여유, 호버 스로틀, 배터리 방전부하 조합 판정
- 태양전지 발전 옵션 반영
- 임무장비별 무게/소비전력 추가 및 누적 비교
- 실측 비행 로그 기반 보정계수 적용
- 페이로드 증가에 따른 비행시간 곡선 시각화

### 고정익 (프리셋 · 사진 측정 · 커스텀)
- 제조사 프리셋(Flightory Stork/Stallion) 기반 1차 추정
- Top view 사진 + 실측 윙스팬으로 주익 면적/AR 측정 (캔버스 트레이싱)
- 항력 모델(CD = CD0 + CL²/π·e·AR) 기반 속도별 필요전력·항속시간 계산
- 기체 형상/프로펠러 스타일 선택으로 공력 계수 자동 매핑 (전문가 직접 입력도 지원)
- PX4 .ulg / ArduPilot .bin 로그 업로드 → 순항 구간 자동 검출 → 모델 보정
- opt-in 익명 비행 요약 공유 (로그 원본·GPS·비행 시각은 전송하지 않음, [docs/BACKEND_SETUP.md](docs/BACKEND_SETUP.md))

## 계산 방식

이 앱은 두 가지 관점의 추정값을 함께 제공합니다.

1. **운동량 이론 기반 추정**
   - 총 이륙중량, 로터 면적, 공기 밀도, Figure of Merit를 이용해 호버 전력을 계산합니다.

2. **제조사 추력표 기반 추정**
   - 선택한 모터/프로펠러/전압 조합의 추력표에서 요구 로터당 추력에 해당하는 전류와 전력을 선형 보간합니다.
   - 실제 부품 선정 검토에는 이 값이 더 유용합니다.

3. **제조사 50% 스펙 직접 입력**
   - 모터 스펙시트의 프로펠러/전압 조합에서 50% throttle 행의 추력(N)과 전력(W)을 직접 입력할 수 있습니다.
   - 입력값을 기준으로 예상 호버 스로틀, 로터당 전력, 배터리 전류, ESC 여유를 추정합니다.

## 로컬 실행

Node.js LTS 설치 후 프로젝트 폴더에서 실행합니다.

```powershell
npm install
npm run dev
```

실행 후 터미널에 표시되는 개발 서버 주소를 브라우저에서 열어 확인합니다.

## 빌드

```powershell
npm run build
```

빌드 결과는 `dist/` 폴더에 생성됩니다.

## 배포

`main` 브랜치에 push하면 GitHub Actions가 자동으로 빌드하고 GitHub Pages에 배포합니다.

```powershell
git add .
git commit -m "Update flight calculator"
git push
```

## 데이터

모터/프로펠러 프리셋 데이터는 CSV 파일에서 관리합니다.

```text
public/data/motor-presets.csv
```

CSV 작성 템플릿:

```text
public/data/custom-motor-template.csv
```

CSV 작성 가이드:

```text
docs/motor-csv-guide.md
```

현재는 Holybro 및 T-MOTOR 테스트 데이터를 기반으로 일부 조합만 포함되어 있습니다. CSV에 행을 추가하면 코드 수정 없이 SunnySky, KDE, DJI 등 다른 제조사 데이터도 확장할 수 있습니다.

## 브랜딩

이 도구는 Sentiery 브랜딩을 적용한 UAV 교육 및 임무 설계용 비행시간 추정 도구입니다.

## 라이선스

[Apache License 2.0](LICENSE) — Copyright 2026 Sentiery

단, Sentiery 명칭과 로고 이미지는 상표로서 라이선스 대상에서 제외됩니다.
자세한 내용은 [NOTICE](NOTICE)를 참고하세요.
