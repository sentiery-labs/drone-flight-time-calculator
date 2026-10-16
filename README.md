# Sentiery UAV Flight Time Calculator

멀티콥터·고정익·VTOL 기체의 비행시간을 추정하는 React 웹앱입니다.
기체 제원과 배터리 구성으로 1차 추정하고, 실측 비행 로그(PX4 .ulg / ArduPilot .bin)로 보정합니다.

> **배포 주소**: GitHub Pages는 저장소 상단 About 링크 또는 Settings > Pages에서 확인하세요.
> Vercel 이용 시 연결된 프로젝트의 Production 배포 주소를 사용합니다. 로컬 변경만으로는 배포 페이지가 갱신되지 않습니다.
> (저장소 조직 이전 시 주소가 바뀌므로 이 문서에는 고정 URL을 적지 않습니다.)

## 주요 기능

### 학생용 화면
- 첫 화면은 큰 입력칸과 대표 결과를 중심으로 구성한 학생용 계산기입니다.
- 계산 / 조건 비교 / 비행 검증 탭과 기본 / 상세 입력을 제공합니다.
- 모터·프로펠러·ESC를 제조사와 모델별로 선택합니다. 미등록 부품은 직접 입력할 수 있습니다.
- 부품별 무게 합산과 전체 이륙중량 직접 입력을 구분합니다.
- 부품별 무게 비중과 모터 1개당 필요한 추력(N)을 함께 표시합니다.
- 제조사 추력–전력 곡선에 현재 호버링 지점을 표시합니다. 근사 모델은 점선으로 구분하고 시험 범위 밖 전력을 외삽하지 않습니다.
- **조건 비교 > 배터리 후보 비교**에서 최대 8개 후보의 셀 수·용량·실측 무게·방전률을 입력하고, 무게 증가를 반영한 호버링 시간을 비교합니다. 선택한 후보를 계산기에 적용할 수 있습니다.
- 전체 이륙중량 방식에서는 현재 배터리 무게를 빼고 후보 무게를 더합니다. 새 후보의 미입력 무게는 임의로 추정하지 않습니다.
- 비교 기준 저장은 현재 결과를 기준안 하나로 보관합니다. 배터리·탑재물 변경 후 시간·중량·전력 차이를 비교할 수 있습니다.
- 비교 기준과 배터리 후보는 브라우저 메모리에만 보관하므로 새로고침하면 사라집니다. 서버에 업로드하지 않습니다.
- 기존 고정익 로그 보정, 익명 공유, VTOL 임무 설계 등은 상단 **상세 계산기** 링크(`advanced.html`)에서 계속 제공합니다.

### 멀티콥터
- 기체 중량, 로터 수, 배터리 용량, 페이로드 기반 비행시간 추정
- CSV 기반 모터/프로펠러 추력표 프리셋
- 제조사 추력표 기반 throttle, current, power 선형 보간
- 제조사 스펙시트의 50% throttle 추력/전력 직접 입력
- ESC 무게 및 전류 여유율 계산
- 추력 여유, 호버 스로틀, 배터리 방전부하 조합 판정
- 태양전지 발전 옵션 반영 (기존 상세 계산기만 제공)
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

계산·부품 데이터 회귀 테스트:

```powershell
npm test
```

## 배포

`main` 브랜치에 push하면 GitHub Actions가 자동으로 빌드하고 GitHub Pages에 배포합니다.

Vercel을 사용하는 경우 같은 Git 저장소를 연결하고 Production Branch를 `main`으로 설정합니다. 이 프로젝트의 빌드 명령은 `npm run build`, 출력 폴더는 `dist`이며 프레임워크는 Vite입니다. 연결된 운영 브랜치에 push하면 Vercel이 새 배포를 생성합니다. GitHub push 완료와 실제 배포 성공은 별도로 확인해야 합니다. [Vercel Git 배포 안내](https://vercel.com/docs/git)

```powershell
git add .
git commit -m "Update flight calculator"
git push
```

## 데이터

모터/프로펠러 프리셋 데이터는 CSV 파일에서 관리합니다.

```text
public/data/motor-presets.csv
public/data/sunnysky-motors.csv
src/student/parts-catalog.json
```

CSV 작성 템플릿:

```text
public/data/custom-motor-template.csv
```

CSV 작성 가이드:

```text
docs/motor-csv-guide.md
```

Holybro·T-MOTOR와 SunnySky V2806(400/650 KV)·V3508(580/700 KV)의 일부 시험 조합을 제공합니다. SunnySky 스로틀 %는 공식 표에서 제공하지 않아 미확인으로 표시하며, 필요한 추력의 소비전력·전류만 보간합니다. 무게가 미등록된 프로펠러와 ESC는 실측 입력이 필요합니다.

추가 파일 목록은 `parts-catalog.json`의 `motorFiles`에서 관리합니다. 새 CSV를 이 목록에 등록하면 학생용 부품 선택에 자동 반영됩니다. 프로펠러 제조사, 미제공 스로틀, ESC 정보는 같은 JSON에 기록합니다.

확장 방법과 데이터 제약: [제조사별 부품 데이터 가이드](docs/parts-catalog-guide.md).

## 브랜딩

이 도구는 Sentiery 브랜딩을 적용한 UAV 교육 및 임무 설계용 비행시간 추정 도구입니다.

## 라이선스

[Apache License 2.0](LICENSE) — Copyright 2026 Sentiery

단, Sentiery 명칭과 로고 이미지는 상표로서 라이선스 대상에서 제외됩니다.
자세한 내용은 [NOTICE](NOTICE)를 참고하세요.
