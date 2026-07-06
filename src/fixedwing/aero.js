// 고정익 항력 모델 기반 순항 성능 계산
// L = W 가정, CD = CD0 + CL^2 / (pi * e * AR), P_elec = D*V / eta + avionics

const G = 9.81;
const RHO = 1.225;
const CELL_V = 3.7;

export const FIXED_WING_BATTERY_PRESETS = [
  { id: "3s-10000-liion", label: "3S 10000mAh Li-Ion", cells: 3, mah: 10000, kg: 0.52, cRate: 10 },
  { id: "4s-6000-lipo", label: "4S 6000mAh LiPo", cells: 4, mah: 6000, kg: 0.58, cRate: 25 },
  { id: "4s-10000-liion", label: "4S 10000mAh Li-Ion", cells: 4, mah: 10000, kg: 0.68, cRate: 10 },
  { id: "4s-21000-liion", label: "4S6P 21000mAh Li-Ion", cells: 4, mah: 21000, kg: 1.08, cRate: 8 },
  { id: "6s-8000-liion", label: "6S 8000mAh Li-Ion", cells: 6, mah: 8000, kg: 0.88, cRate: 10 },
  { id: "custom", label: "직접 입력", cells: 4, mah: 10000, kg: 0.7, cRate: 10 }
];

// 취미 유저용: 형상/프로펠러 선택 → 공력 계수 자동 매핑
export const AIRFRAME_STYLES = [
  {
    id: "glider",
    label: "글라이더형 — 가는 동체, 긴 날개",
    desc: "모터글라이더, 매끈한 표면, 접이식 랜딩기어",
    cd0: 0.03,
    oswald: 0.85
  },
  {
    id: "sport",
    label: "일반형 — 매핑기·FPV 순항기",
    desc: "Stork/Stallion 등 3D 프린트 기체, 일반적인 형상",
    cd0: 0.04,
    oswald: 0.75
  },
  {
    id: "boxy",
    label: "뭉툭한 형 — 화물·훈련기",
    desc: "굵은 동체, 고정 랜딩기어, 돌출 장비 많음",
    cd0: 0.055,
    oswald: 0.68
  }
];

export const PROP_STYLES = [
  {
    id: "folding",
    label: "폴딩 프롭 (순항 특화)",
    desc: "큰 지름 + 접이식, 효율 최상",
    propEff: 0.6
  },
  {
    id: "fixed",
    label: "일반 고정 프롭",
    desc: "9-11인치 고정 피치, 대부분의 기체",
    propEff: 0.55
  },
  {
    id: "small-fast",
    label: "소구경 고회전 (FPV)",
    desc: "7인치 이하 고KV 조합",
    propEff: 0.45
  }
];

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function distancePx(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// shoelace formula, 픽셀 좌표 다각형 넓이
export function polygonAreaPx(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

export function calcFixedWingAero(input) {
  const {
    wingspanM, wingAreaM2, towKg,
    cd0, oswald, propEff, clMax,
    avionicsW, reservePct,
    batteryCells, batteryMah, batteryCRate,
    cal = null // { speedKmh, powerW } 실측 순항점 → 추진전력 보정
  } = input;

  if (!(wingspanM > 0) || !(wingAreaM2 > 0) || !(towKg > 0)) return null;
  if (!(cd0 > 0) || !(oswald > 0) || !(propEff > 0) || !(clMax > 0)) return null;

  const ar = (wingspanM * wingspanM) / wingAreaM2;
  const meanChordM = wingAreaM2 / wingspanM;
  const weightN = towKg * G;
  const wingLoadingKgM2 = towKg / wingAreaM2;
  const k = 1 / (Math.PI * oswald * ar);

  const voltage = batteryCells * CELL_V;
  const batteryWh = voltage * batteryMah / 1000;
  const usableWh = batteryWh * (1 - clamp(reservePct, 0, 60) / 100);
  const batteryMaxCurrentA = (batteryMah / 1000) * batteryCRate;

  const vStall = Math.sqrt((2 * weightN) / (RHO * wingAreaM2 * clMax));
  const vMin = vStall * 1.05;
  const vMax = Math.max(vStall * 3.2, vStall + 20);

  // 실측 순항점이 있으면 같은 속도에서의 모델 추진전력과 비교해 보정계수 산출
  let calFactor = 1;
  let calApplied = false;
  if (cal && cal.powerW > 0 && cal.speedKmh > 0) {
    const vCal = cal.speedKmh / 3.6;
    if (vCal > vStall * 1.02) {
      const qCal = 0.5 * RHO * vCal * vCal * wingAreaM2;
      const clCal = weightN / qCal;
      const modelPropW = qCal * (cd0 + k * clCal * clCal) * vCal / propEff;
      const measuredPropW = Math.max(cal.powerW - avionicsW, 1);
      if (modelPropW > 0) {
        calFactor = clamp(measuredPropW / modelPropW, 0.3, 3);
        calApplied = true;
      }
    }
  }

  const curve = [];
  let bestEnd = null;
  let bestRange = null;
  let maxLd = 0;

  for (let v = vMin; v <= vMax; v += 0.1) {
    const q = 0.5 * RHO * v * v * wingAreaM2;
    const cl = weightN / q;
    const cd = cd0 + k * cl * cl;
    const dragN = q * cd;
    const elecW = ((dragN * v) / propEff) * calFactor + avionicsW;
    const ld = cl / cd;
    if (ld > maxLd) maxLd = ld;
    if (!bestEnd || elecW < bestEnd.powerW) bestEnd = { v, powerW: elecW, cl, ld };
    const whPerKm = elecW / (v * 3.6);
    if (!bestRange || whPerKm < bestRange.whPerKm) bestRange = { v, powerW: elecW, whPerKm, cl, ld };
    curve.push({ ms: +v.toFixed(2), kmh: +(v * 3.6).toFixed(1), powerW: +elecW.toFixed(1), ld: +ld.toFixed(2) });
  }

  if (!bestEnd || !bestRange) return null;

  const enduranceMin = bestEnd.powerW > 0 ? (usableWh / bestEnd.powerW) * 60 : 0;
  const enduranceFullMin = bestEnd.powerW > 0 ? (batteryWh / bestEnd.powerW) * 60 : 0;
  const rangeEnduranceMin = bestRange.powerW > 0 ? (usableWh / bestRange.powerW) * 60 : 0;
  const rangeKm = bestRange.v * 3.6 * (rangeEnduranceMin / 60);
  const cruiseCurrentA = voltage > 0 ? bestEnd.powerW / voltage : 0;
  const batteryLoadPct = batteryMaxCurrentA > 0 ? (cruiseCurrentA / batteryMaxCurrentA) * 100 : 0;
  const stallMarginPct = vStall > 0 ? ((bestEnd.v - vStall) / vStall) * 100 : 0;

  return {
    ar,
    meanChordM,
    wingLoadingKgM2,
    weightN,
    maxLd,
    voltage,
    batteryWh,
    usableWh,
    batteryMaxCurrentA,
    vStallMs: vStall,
    vStallKmh: vStall * 3.6,
    endurance: {
      minutes: enduranceMin,
      fullMinutes: enduranceFullMin,
      speedMs: bestEnd.v,
      speedKmh: bestEnd.v * 3.6,
      powerW: bestEnd.powerW,
      cl: bestEnd.cl,
      ld: bestEnd.ld
    },
    range: {
      km: rangeKm,
      minutes: rangeEnduranceMin,
      speedMs: bestRange.v,
      speedKmh: bestRange.v * 3.6,
      powerW: bestRange.powerW,
      ld: bestRange.ld
    },
    cruiseCurrentA,
    batteryLoadPct,
    stallMarginPct,
    calFactor,
    calApplied,
    curve
  };
}
