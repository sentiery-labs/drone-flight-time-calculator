// 비행 로그 공용 분석기: 포맷(ULog/DataFlash)을 자동 감지해 파싱하고,
// 표준화된 배터리/속도 행에서 비행 요약과 순항 평균 전력을 뽑는다.

import { extractUlogRows } from "./ulog";
import { extractDataflashRows } from "./dataflash";

// batRows: {t(µs), volt, amp, mah} / speedRows: {t, speed(m/s), vz(m/s)}
export function summarizeFlight({ batRows, speedRows }) {
  if (!batRows || batRows.length < 2) throw new Error("로그에서 배터리 데이터를 찾지 못했습니다.");

  let usedWh = 0;
  let flightSec = 0;
  let cruiseWSum = 0;
  let cruiseKmhSum = 0;
  let cruiseSec = 0;
  let si = 0;

  for (let i = 1; i < batRows.length; i++) {
    const cur = batRows[i];
    const dt = (cur.t - batRows[i - 1].t) / 1e6;
    if (!(dt > 0 && dt < 10)) continue;
    if (!(cur.volt > 0)) continue;
    const watt = cur.volt * cur.amp;
    usedWh += (watt * dt) / 3600;

    while (si < speedRows.length - 1 && speedRows[si + 1].t <= cur.t) si++;
    const sp = speedRows[si];
    if (sp && Math.abs(sp.t - cur.t) < 2e6) {
      if (sp.speed > 3) flightSec += dt;
      // 순항 판정: 수평속도 8m/s 이상 + 상승/하강률 1.2m/s 미만
      if (sp.speed > 8 && Math.abs(sp.vz) < 1.2 && watt > 5) {
        cruiseWSum += watt * dt;
        cruiseKmhSum += sp.speed * 3.6 * dt;
        cruiseSec += dt;
      }
    } else if (cur.amp > 3) {
      flightSec += dt; // 속도 데이터가 없으면 전류로 비행 추정
    }
  }

  const first = batRows[0];
  const last = batRows[batRows.length - 1];
  const usedMah = Number.isFinite(last.mah) && last.mah > 0
    ? last.mah - (Number.isFinite(first.mah) ? first.mah : 0)
    : null;

  return {
    durationMin: (last.t - first.t) / 6e7,
    flightMin: flightSec / 60,
    usedWh,
    usedMah,
    cruise: cruiseSec >= 20
      ? { powerW: cruiseWSum / cruiseSec, speedKmh: cruiseKmhSum / cruiseSec, seconds: cruiseSec }
      : null
  };
}

export function detectLogFormat(buffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes.length >= 7 && bytes[0] === 0x55 && bytes[1] === 0x4c && bytes[2] === 0x6f && bytes[3] === 0x67) return "ulog";
  if (bytes.length >= 3 && bytes[0] === 0xa3 && bytes[1] === 0x95) return "dataflash";
  return null;
}

export function analyzeFlightLog(buffer) {
  const format = detectLogFormat(buffer);
  if (format === "ulog") return { format, ...summarizeFlight(extractUlogRows(buffer)) };
  if (format === "dataflash") return { format, ...summarizeFlight(extractDataflashRows(buffer)) };
  throw new Error("지원하지 않는 로그 형식입니다. PX4 .ulg 또는 ArduPilot .bin 파일을 올려주세요.");
}
