import { useMemo } from "react";
import { Info, Plane, Route, Target, Zap } from "lucide-react";
import { BigNum, InputRow, LEVEL_META, Sec, SmallCard } from "../components/ui";
import { calcFixedWingAero, FIXED_WING_BATTERY_PRESETS } from "../fixedwing/aero";

// 미션: 이륙호버 → 전환 → 순항 → 전환 → 착륙호버
// E_hover는 멀티콥터 탭 구성에서, 순항 모델은 고정익 탭(사진측정/커스텀) 구성에서 가져온다.

const SPEED_MODES = [
  { id: "range", label: "최대항속 속도 (멀리)" },
  { id: "endurance", label: "최대체공 속도 (오래)" },
  { id: "custom", label: "직접 입력" }
];

export default function VtolPanel({ mode, aero, logCal, hoverPowerW, hoverSourceLabel, config, onConfigChange }) {
  const ModeIcon = mode.Icon || Zap;

  const battery = useMemo(() => {
    if (aero.batteryId === "custom") return { ...aero.customBattery, label: "직접 입력" };
    return FIXED_WING_BATTERY_PRESETS.find(item => item.id === aero.batteryId) || FIXED_WING_BATTERY_PRESETS[0];
  }, [aero.batteryId, aero.customBattery]);

  const fwCalc = useMemo(() => calcFixedWingAero({
    wingspanM: aero.wingspanMm / 1000,
    wingAreaM2: aero.wingAreaM2,
    towKg: aero.towKg,
    cd0: aero.cd0,
    oswald: aero.oswald,
    propEff: aero.propEff,
    clMax: aero.clMax,
    avionicsW: aero.avionicsW,
    reservePct: aero.reservePct,
    batteryCells: battery.cells,
    batteryMah: battery.mah,
    batteryCRate: battery.cRate,
    cal: logCal?.enabled ? { speedKmh: logCal.cruiseSpeedKmh, powerW: logCal.cruisePowerW } : null
  }), [aero, battery, logCal]);

  const hoverW = config.hoverOverrideW > 0 ? config.hoverOverrideW : hoverPowerW;

  const mission = useMemo(() => {
    if (!fwCalc || !(hoverW > 0)) return null;
    const cruisePoint = config.speedMode === "endurance"
      ? { speedMs: fwCalc.endurance.speedMs, powerW: fwCalc.endurance.powerW }
      : config.speedMode === "custom"
        ? (() => {
          const pt = fwCalc.curve.reduce((best, p) =>
            Math.abs(p.ms - config.customSpeedMs) < Math.abs(best.ms - config.customSpeedMs) ? p : best, fwCalc.curve[0]);
          return { speedMs: pt.ms, powerW: pt.powerW, offCurve: Math.abs(pt.ms - config.customSpeedMs) > 0.2 };
        })()
        : { speedMs: fwCalc.range.speedMs, powerW: fwCalc.range.powerW };

    const eHover = hoverW * (config.hoverMin / 60);
    const eTrans = hoverW * (config.transitionSec / 3600);
    const eCruiseAvail = fwCalc.usableWh - eHover - eTrans;
    const feasibleBase = eCruiseAvail > 0;
    const maxCruiseMin = feasibleBase ? (eCruiseAvail / cruisePoint.powerW) * 60 : 0;
    const maxRangeKm = cruisePoint.speedMs * 3.6 * (maxCruiseMin / 60);
    const missionCruiseMin = cruisePoint.speedMs > 0 ? (config.missionKm / (cruisePoint.speedMs * 3.6)) * 60 : 0;
    const eMission = eHover + eTrans + cruisePoint.powerW * (missionCruiseMin / 60);
    const marginPct = config.missionKm > 0 ? ((maxRangeKm - config.missionKm) / config.missionKm) * 100 : 0;
    const missionFeasible = feasibleBase && maxRangeKm >= config.missionKm;
    const totalMissionMin = config.hoverMin + config.transitionSec / 60 + missionCruiseMin;

    // 같은 배터리 비교: 멀티콥터로 호버만 했을 때
    const mcOnlyMin = (fwCalc.usableWh / hoverW) * 60;
    const vtolAirborneMin = config.hoverMin + config.transitionSec / 60 + maxCruiseMin;

    return {
      cruisePoint, eHover, eTrans, eCruiseAvail, feasibleBase,
      maxCruiseMin, maxRangeKm, missionCruiseMin, eMission, marginPct,
      missionFeasible, totalMissionMin, mcOnlyMin, vtolAirborneMin,
      eReserve: fwCalc.batteryWh - fwCalc.usableWh,
      eCruiseMission: cruisePoint.powerW * (missionCruiseMin / 60)
    };
  }, [fwCalc, hoverW, config]);

  const statusItems = useMemo(() => {
    if (!mission) return [];
    const items = [];
    items.push(mission.missionFeasible
      ? ["ok", "미션 판정", `${config.missionKm.toFixed(0)}km 순항 가능 · 거리 여유 +${mission.marginPct.toFixed(0)}%`]
      : mission.feasibleBase
        ? ["danger", "미션 판정", `최대 ${mission.maxRangeKm.toFixed(1)}km — 요청 거리 부족`]
        : ["danger", "미션 판정", "호버·전환만으로 가용 에너지 초과"]);
    if (config.speedMode === "custom" && mission.cruisePoint.offCurve) {
      items.push(["warning", "순항속도", "입력 속도가 비행 가능 범위 밖 — 가장 가까운 값 사용"]);
    }
    items.push(hoverW === hoverPowerW
      ? ["info", "호버 전력", `${hoverSourceLabel} ${hoverPowerW.toFixed(0)}W 사용 중`]
      : ["info", "호버 전력", `직접 입력 ${hoverW.toFixed(0)}W 사용 중`]);
    items.push(logCal?.enabled
      ? ["ok", "순항 모델", "고정익 로그 보정 반영됨"]
      : ["warning", "순항 모델", "로그 보정 전 추정 (고정익 탭에서 보정 가능)"]);
    return items;
  }, [mission, config, hoverW, hoverPowerW, hoverSourceLabel, logCal]);

  const energyBars = mission && fwCalc ? [
    ["호버", mission.eHover, "#f59e0b"],
    ["전환", mission.eTrans, "#fb923c"],
    ["순항(미션)", Math.min(mission.eCruiseMission, Math.max(mission.eCruiseAvail, 0)), "#0f766e"],
    ["잔여", Math.max(fwCalc.usableWh - mission.eHover - mission.eTrans - mission.eCruiseMission, 0), "#cbd5e1"],
    ["예비", mission.eReserve, "#e2e8f0"]
  ] : [];

  return (
    <div className="fixedwing-shell">
      <section className="coming-soon-hero fixedwing-hero">
        <div className="coming-soon-icon">
          <ModeIcon size={24} strokeWidth={2.3} />
        </div>
        <div>
          <div className="coming-soon-kicker">베타 계산</div>
          <h2>{mode.title}</h2>
          <p>호버 전력은 멀티콥터 탭, 순항 모델은 고정익 탭(사진측정/커스텀) 구성을 그대로 사용해 임무를 계산합니다.</p>
        </div>
      </section>

      <div className="app-layout fixedwing-layout">
        <div className="inputs-panel fixedwing-inputs-panel" style={{ width: 280, flexShrink: 0 }}>
          <Sec title="호버 전력 (멀티콥터 탭 연동)" icon={Zap}>
            <div className="fixedwing-selected-note">
              <span>{hoverSourceLabel}</span>
              <span>{hoverPowerW.toFixed(0)}W</span>
            </div>
            <InputRow label="직접 입력 (0=연동값)" unit="W" value={config.hoverOverrideW} onChange={v => onConfigChange("hoverOverrideW", v)} min={0} max={10000} step={10} />
            <div className="fixedwing-model-note">
              <span>VTOL 호버 전력을 알면 직접 입력하고, 모르면 멀티콥터 탭에서 로터/무게를 맞춰 추정하세요.</span>
            </div>
          </Sec>

          <Sec title="미션 프로파일" icon={Route}>
            <InputRow label="호버 (이륙+착륙)" unit="분" value={config.hoverMin} onChange={v => onConfigChange("hoverMin", v)} min={0} max={60} step={0.5} />
            <InputRow label="전환 (왕복 합계)" unit="초" value={config.transitionSec} onChange={v => onConfigChange("transitionSec", v)} min={0} max={600} step={5} />
            <InputRow label="순항 거리" unit="km" value={config.missionKm} onChange={v => onConfigChange("missionKm", v)} min={0} max={500} step={1} />
            <div style={{ margin: "6px 0" }}>
              <span style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 4 }}>순항 속도</span>
              <select value={config.speedMode} onChange={e => onConfigChange("speedMode", e.target.value)}
                style={{ width: "100%", border: "1px solid #cbd5e1", borderRadius: 6, padding: "5px 6px",
                  fontSize: 12, color: "#1e293b", background: "#f8fafc", outline: "none" }}>
                {SPEED_MODES.map(item => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
            </div>
            {config.speedMode === "custom" && (
              <InputRow label="순항속도" unit="m/s" value={config.customSpeedMs} onChange={v => onConfigChange("customSpeedMs", v)} min={1} max={80} step={0.5} />
            )}
          </Sec>

          <Sec title="순항 기체 · 배터리 (고정익 탭 연동)" icon={Plane}>
            <div className="fixedwing-selected-note">
              <span>윙스팬 {aero.wingspanMm.toFixed(0)}mm</span>
              <span>주익 {aero.wingAreaM2.toFixed(3)}m²</span>
              <span>AUW {aero.towKg.toFixed(2)}kg</span>
            </div>
            <div className="fixedwing-selected-note">
              <span>{battery.cells}S {battery.mah.toLocaleString()}mAh</span>
              {fwCalc && <span>가용 {fwCalc.usableWh.toFixed(1)}Wh (예비 {aero.reservePct.toFixed(0)}%)</span>}
            </div>
            <div className="fixedwing-model-note">
              <span>기체·배터리 수정은 고정익 탭의 사진측정/커스텀 모드에서 하세요. 여기 값은 자동 반영됩니다.</span>
            </div>
          </Sec>
        </div>

        <div className="results-panel fixedwing-results-panel">
          {!mission ? (
            <div className="result-overview fixedwing-result-panel" style={{ padding: "18px 16px" }}>
              <div className="fixedwing-card-title">
                <span>결과</span>
                <strong>입력값을 확인해주세요</strong>
              </div>
              <p style={{ fontSize: 12, color: "#64748b", margin: "8px 0 0" }}>
                고정익 탭의 기체 제원과 호버 전력이 유효해야 계산할 수 있습니다.
              </p>
            </div>
          ) : (
            <>
              <div className="result-overview fixedwing-result-panel" style={{ padding: "12px 14px" }}>
                <div className="fixedwing-card-title">
                  <span>결과</span>
                  <strong>VTOL 임무 추정</strong>
                </div>
                <div className="fixedwing-hero-metrics">
                  <BigNum label="최대 순항 거리" value={mission.maxRangeKm.toFixed(1)} unit="km" color="#0f766e" border featured
                    sub={`순항 ${mission.cruisePoint.speedMs.toFixed(1)} m/s · ${mission.cruisePoint.powerW.toFixed(0)}W 기준`} />
                  <BigNum label={mission.missionFeasible ? "총 임무시간" : "최대 체공시간"}
                    value={(mission.missionFeasible ? mission.totalMissionMin : mission.vtolAirborneMin).toFixed(0)} unit="분"
                    color="#2563eb" border featured
                    sub={mission.missionFeasible
                      ? `호버 ${config.hoverMin.toFixed(1)}분 + 전환 + 순항 ${mission.missionCruiseMin.toFixed(0)}분`
                      : `호버 ${config.hoverMin.toFixed(1)}분 + 최대 순항 ${mission.maxCruiseMin.toFixed(0)}분`} />
                </div>

                <div className="fixedwing-result-grid">
                  <SmallCard label="호버 소모" value={mission.eHover} unit="Wh" />
                  <SmallCard label="전환 소모" value={mission.eTrans} unit="Wh" />
                  <SmallCard label="미션 순항 소모" value={mission.eCruiseMission} unit="Wh" />
                  <SmallCard label="미션 후 잔여" value={Math.max(fwCalc.usableWh - mission.eMission, 0)} unit="Wh" />
                </div>

                <div className="energy-bar" role="img" aria-label="배터리 에너지 배분">
                  {energyBars.map(([label, wh, color]) => (
                    fwCalc.batteryWh > 0 && wh > 0.01 ? (
                      <div key={label} style={{ width: `${(wh / fwCalc.batteryWh) * 100}%`, background: color }}
                        title={`${label} ${wh.toFixed(1)}Wh`} />
                    ) : null
                  ))}
                </div>
                <div className="chart-legend">
                  {energyBars.filter(([, wh]) => wh > 0.01).map(([label, wh, color]) => (
                    <span key={label}><i style={{ background: color }} />{label} {wh.toFixed(1)}Wh</span>
                  ))}
                </div>

                <div className="fixedwing-status-grid">
                  {statusItems.map(([level, title, detail]) => {
                    const meta = LEVEL_META[level] || LEVEL_META.info;
                    const Icon = meta.Icon || Info;
                    return (
                      <div key={title} style={{ background: meta.bg, borderColor: meta.soft }}>
                        <Icon size={14} strokeWidth={2.7} style={{ color: meta.color }} />
                        <span>
                          <strong>{title}</strong>
                          <small>{detail}</small>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="result-overview fixedwing-result-panel" style={{ padding: "12px 14px" }}>
                <div className="fixedwing-card-title">
                  <span>같은 배터리 비교</span>
                  <strong>멀티콥터 호버 vs VTOL 임무</strong>
                </div>
                <div className="vtol-compare-grid">
                  <div>
                    <span>멀티콥터로 호버만</span>
                    <strong>{mission.mcOnlyMin.toFixed(0)}분</strong>
                    <small>이동 커버리지 ≈ 0 km</small>
                  </div>
                  <div className="vtol-compare-win">
                    <span>VTOL 운용</span>
                    <strong>{mission.vtolAirborneMin.toFixed(0)}분</strong>
                    <small>순항 최대 {mission.maxRangeKm.toFixed(1)} km 커버</small>
                  </div>
                </div>
                <div className="fixedwing-formula-strip">
                  <span>같은 {battery.cells}S {battery.mah.toLocaleString()}mAh · 가용 {fwCalc.usableWh.toFixed(1)}Wh 기준</span>
                  <span>고정익 순항이 호버 대비 전력이 {(hoverW / mission.cruisePoint.powerW).toFixed(1)}배 낮음</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
