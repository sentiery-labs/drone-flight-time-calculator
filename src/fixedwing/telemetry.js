// 익명 비행 요약 공유 (opt-in)
// 원칙: 로그 원본, GPS 좌표, 비행 시각, 기기 정보는 절대 전송하지 않는다.
// 전송 항목은 기체 제원 + 배터리 구성 + 순항 요약 + 예측치뿐이다.

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const SHARED_SIG_KEY = "fw-shared-summaries-v1";

export const telemetryEnabled = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const round = (v, digits = 3) => (Number.isFinite(v) ? +v.toFixed(digits) : null);

export function buildFlightSummary({ variant, aero, battery, photo, logCal, calc, calcBase }) {
  return {
    schema_version: 1,
    mode: variant,
    area_source: variant === "photo" && photo ? "photo" : "manual",
    wingspan_mm: round(aero.wingspanMm, 0),
    wing_area_m2: round(aero.wingAreaM2, 4),
    tow_kg: round(aero.towKg, 3),
    airframe_style: aero.airframeStyleId,
    prop_style: aero.propStyleId,
    cd0: round(aero.cd0, 4),
    oswald: round(aero.oswald, 3),
    prop_eff: round(aero.propEff, 3),
    cl_max: round(aero.clMax, 2),
    batt_cells: battery.cells,
    batt_mah: battery.mah,
    batt_kg: round(battery.kg, 3),
    log_format: logCal.format || "ulog",
    flight_min: round(logCal.flightMin, 1),
    used_wh: round(logCal.usedWh, 2),
    used_mah: round(logCal.usedMah, 0),
    cruise_power_w: round(logCal.cruisePowerW, 1),
    cruise_speed_ms: round(logCal.cruiseSpeedKmh / 3.6, 2),
    cruise_sec: round(logCal.cruiseSeconds, 0),
    pred_endurance_min: round(calcBase?.endurance.minutes, 1),
    pred_endurance_min_cal: round(calc?.endurance.minutes, 1),
    cal_factor: round(calc?.calFactor, 3),
    stall_ms: round(calc?.vStallMs, 2),
    best_endurance_speed_ms: round(calc?.endurance.speedMs, 2)
  };
}

// 같은 로그+제원 조합의 중복 업로드 방지용 시그니처
export function summarySignature(summary) {
  return [
    summary.wingspan_mm, summary.wing_area_m2, summary.tow_kg,
    summary.flight_min, summary.used_wh, summary.cruise_power_w, summary.cruise_speed_ms
  ].join("|");
}

export function wasShared(summary) {
  try {
    const sigs = JSON.parse(window.localStorage.getItem(SHARED_SIG_KEY) || "[]");
    return sigs.includes(summarySignature(summary));
  } catch {
    return false;
  }
}

function rememberShared(summary) {
  try {
    const sigs = JSON.parse(window.localStorage.getItem(SHARED_SIG_KEY) || "[]");
    sigs.unshift(summarySignature(summary));
    window.localStorage.setItem(SHARED_SIG_KEY, JSON.stringify(sigs.slice(0, 30)));
  } catch {
    // localStorage 실패는 무시 (공유 자체는 성공)
  }
}

export async function submitFlightSummary(summary) {
  if (!telemetryEnabled) throw new Error("공유 서버가 아직 설정되지 않았습니다.");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/flight_summaries`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Prefer: "return=minimal"
    },
    body: JSON.stringify(summary)
  });
  if (!res.ok) throw new Error(`전송에 실패했습니다 (HTTP ${res.status})`);
  rememberShared(summary);
}
