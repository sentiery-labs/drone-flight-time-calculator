import { useMemo } from "react";
import {
  Area, AreaChart, CartesianGrid, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";
import { BatteryCharging, Camera, FileUp, Info, Ruler, Settings2, Target, Wind } from "lucide-react";
import { BigNum, InputRow, LEVEL_META, Sec, SmallCard } from "../components/ui";
import { AIRFRAME_STYLES, calcFixedWingAero, FIXED_WING_BATTERY_PRESETS, PROP_STYLES } from "./aero";
import PhotoWingMeasure from "./PhotoWingMeasure";
import LogCalibration from "./LogCalibration";
import ShareSummary from "./ShareSummary";

const EnduranceTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 8,
      padding: "8px 12px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", fontSize: 12 }}>
      <div style={{ fontWeight: 600 }}>속도 {label} m/s ({d?.kmh?.toFixed(0)} km/h)</div>
      <div style={{ color: "#2563eb" }}>항속시간 {d?.enduranceMin?.toFixed(0)} 분</div>
      <div style={{ color: "#64748b" }}>필요전력 {d?.powerW?.toFixed(0)} W · L/D {d?.ld?.toFixed(1)}</div>
    </div>
  );
};

const PowerTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 8,
      padding: "8px 12px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", fontSize: 12 }}>
      <div style={{ fontWeight: 600 }}>속도 {label} m/s ({d?.kmh?.toFixed(0)} km/h)</div>
      <div style={{ color: "#0f766e" }}>필요전력 {d?.powerW?.toFixed(0)} W</div>
      <div style={{ color: "#64748b" }}>L/D {d?.ld?.toFixed(1)}</div>
    </div>
  );
};

export default function FixedWingAeroPanel({ variant, aero, onAeroChange, onAeroBatteryChange, photo, onPhotoApply, logCal, onLogCalChange }) {
  const isPhoto = variant === "photo";

  const selectedAirframeStyle = AIRFRAME_STYLES.find(item => item.id === aero.airframeStyleId);
  const selectedPropStyle = PROP_STYLES.find(item => item.id === aero.propStyleId);
  const applyAirframeStyle = id => {
    const style = AIRFRAME_STYLES.find(item => item.id === id);
    if (!style) return;
    onAeroChange("airframeStyleId", id);
    onAeroChange("cd0", style.cd0);
    onAeroChange("oswald", style.oswald);
  };
  const applyPropStyle = id => {
    const style = PROP_STYLES.find(item => item.id === id);
    if (!style) return;
    onAeroChange("propStyleId", id);
    onAeroChange("propEff", style.propEff);
  };

  const battery = useMemo(() => {
    if (aero.batteryId === "custom") return { ...aero.customBattery, label: "직접 입력" };
    return FIXED_WING_BATTERY_PRESETS.find(item => item.id === aero.batteryId) || FIXED_WING_BATTERY_PRESETS[0];
  }, [aero.batteryId, aero.customBattery]);

  const aeroInput = useMemo(() => ({
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
    batteryCRate: battery.cRate
  }), [aero, battery]);

  const calcResult = useMemo(() => calcFixedWingAero({
    ...aeroInput,
    cal: logCal?.enabled ? { speedKmh: logCal.cruiseSpeedKmh, powerW: logCal.cruisePowerW } : null
  }), [aeroInput, logCal]);

  // 공유 페이로드용 보정 전 예측치
  const calcBaseResult = useMemo(
    () => (logCal ? calcFixedWingAero(aeroInput) : null),
    [aeroInput, logCal]
  );

  const statusItems = useMemo(() => {
    if (!calcResult) return [];
    const items = [];
    if (isPhoto) {
      items.push(photo
        ? ["info", "면적 출처", `사진 측정 (${photo.fileName || "업로드 이미지"})`]
        : ["warning", "면적 출처", "아직 사진 측정 전 · 기본값 사용 중"]);
    }
    if (calcResult.ar < 4 || calcResult.ar > 20) {
      items.push(["warning", "가로세로비", `AR ${calcResult.ar.toFixed(1)} · 일반 고정익 범위(4-20) 밖, 측정 확인`]);
    } else {
      items.push(["ok", "가로세로비", `AR ${calcResult.ar.toFixed(1)} · 정상 범위`]);
    }
    items.push(calcResult.stallMarginPct < 12
      ? ["warning", "실속 여유", `최적 체공속도가 실속 대비 +${calcResult.stallMarginPct.toFixed(0)}% · 바람에 취약`]
      : ["ok", "실속 여유", `실속 대비 +${calcResult.stallMarginPct.toFixed(0)}% 속도 여유`]);
    items.push(calcResult.batteryLoadPct >= 70
      ? ["warning", "배터리 부하", `정격의 ${calcResult.batteryLoadPct.toFixed(0)}% 사용`]
      : ["ok", "배터리 부하", `정격의 ${calcResult.batteryLoadPct.toFixed(0)}% 사용`]);
    items.push(calcResult.calApplied
      ? ["ok", "로그 보정", `실측 순항점 반영 · 추진전력 ×${calcResult.calFactor.toFixed(2)}`]
      : ["info", "정확도", "형상 선택 기반 1차 추정 · 실비행 로그 보정 전 ±20-30% 오차 가능"]);
    return items;
  }, [calcResult, isPhoto, photo]);

  return (
    <div className="app-layout fixedwing-layout">
      <div className="inputs-panel fixedwing-inputs-panel" style={{ width: 280, flexShrink: 0 }}>
        {isPhoto && (
          <Sec title="① 사진으로 날개 측정" icon={Camera}>
            <InputRow label="실측 윙스팬" unit="mm" value={aero.wingspanMm} onChange={v => onAeroChange("wingspanMm", v)} min={200} max={6000} step={10} />
            <PhotoWingMeasure wingspanMm={aero.wingspanMm} onApply={onPhotoApply} />
          </Sec>
        )}

        <Sec title={isPhoto ? "② 기체 제원" : "기체 제원"} icon={Ruler}>
          {!isPhoto && (
            <InputRow label="윙스팬" unit="mm" value={aero.wingspanMm} onChange={v => onAeroChange("wingspanMm", v)} min={200} max={6000} step={10} />
          )}
          <InputRow label="주익 면적" unit="m²" value={aero.wingAreaM2} onChange={v => onAeroChange("wingAreaM2", v)} min={0.01} max={5} step={0.005} />
          <InputRow label="이륙중량(AUW)" unit="kg" value={aero.towKg} onChange={v => onAeroChange("towKg", v)} min={0.1} max={30} step={0.05} />
          {calcResult && (
            <div className="fixedwing-selected-note">
              <span>AR {calcResult.ar.toFixed(1)}</span>
              <span>평균 시위 {(calcResult.meanChordM * 1000).toFixed(0)}mm</span>
              <span>익면하중 {calcResult.wingLoadingKgM2.toFixed(1)}kg/m²</span>
            </div>
          )}
          {isPhoto && photo && (
            <div className="photo-source-note">
              <Camera size={12} strokeWidth={2.4} />
              면적 {photo.areaM2.toFixed(3)}m² · 사진에서 적용됨
            </div>
          )}
        </Sec>

        <Sec title="기체 스타일" icon={Wind}>
          <div style={{ marginBottom: 8 }}>
            <span style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 4 }}>기체 형상</span>
            <select value={aero.airframeStyleId} onChange={e => applyAirframeStyle(e.target.value)}
              style={{ width: "100%", border: "1px solid #cbd5e1", borderRadius: 6, padding: "5px 6px",
                fontSize: 12, color: "#1e293b", background: "#f8fafc", outline: "none", marginBottom: 3 }}>
              {AIRFRAME_STYLES.map(item => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
            <span style={{ display: "block", fontSize: 10, color: "#94a3b8", lineHeight: 1.5, marginBottom: 7 }}>
              {selectedAirframeStyle?.desc}
            </span>
            <span style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 4 }}>프로펠러 / 추진</span>
            <select value={aero.propStyleId} onChange={e => applyPropStyle(e.target.value)}
              style={{ width: "100%", border: "1px solid #cbd5e1", borderRadius: 6, padding: "5px 6px",
                fontSize: 12, color: "#1e293b", background: "#f8fafc", outline: "none", marginBottom: 3 }}>
              {PROP_STYLES.map(item => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
            <span style={{ display: "block", fontSize: 10, color: "#94a3b8", lineHeight: 1.5 }}>
              {selectedPropStyle?.desc}
            </span>
          </div>
          <div className="fixedwing-model-note">
            <span>내 기체와 가장 비슷한 걸 고르면 공력 계수를 자동으로 넣어줍니다.</span>
            <span>정확한 값을 아는 경우에만 아래 전문가 설정에서 수정하세요.</span>
          </div>
        </Sec>

        <Sec title="전문가 설정 (선택)" icon={Settings2} open={false}>
          <InputRow label="유해항력 CD0" unit="" value={aero.cd0} onChange={v => onAeroChange("cd0", v)} min={0.01} max={0.12} step={0.005} />
          <InputRow label="Oswald 효율 e" unit="" value={aero.oswald} onChange={v => onAeroChange("oswald", v)} min={0.5} max={0.95} step={0.05} />
          <InputRow label="추진 효율 η" unit="" value={aero.propEff} onChange={v => onAeroChange("propEff", v)} min={0.2} max={0.85} step={0.05} />
          <InputRow label="최대양력 CLmax" unit="" value={aero.clMax} onChange={v => onAeroChange("clMax", v)} min={0.8} max={1.8} step={0.05} />
          <div className="fixedwing-model-note">
            <span>소형 UAV 통상값: CD0 0.03-0.05, e 0.7-0.85, η 0.45-0.6</span>
            <span>여기서 수정한 값이 위 스타일 선택보다 우선 적용됩니다.</span>
          </div>
        </Sec>

        <Sec title="배터리" icon={BatteryCharging}>
          <div style={{ marginBottom: 8 }}>
            <span style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 4 }}>배터리 프리셋</span>
            <select value={aero.batteryId} onChange={e => onAeroChange("batteryId", e.target.value)}
              style={{ width: "100%", border: "1px solid #cbd5e1", borderRadius: 6, padding: "5px 6px",
                fontSize: 12, color: "#1e293b", background: "#f8fafc", outline: "none" }}>
              {FIXED_WING_BATTERY_PRESETS.map(item => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </div>
          {aero.batteryId === "custom" && (
            <div className="fixedwing-custom-battery">
              <InputRow label="셀 수" unit="S" value={aero.customBattery.cells} onChange={v => onAeroBatteryChange("cells", Math.round(v))} min={1} max={12} step={1} />
              <InputRow label="용량" unit="mAh" value={aero.customBattery.mah} onChange={v => onAeroBatteryChange("mah", Math.round(v))} min={100} max={100000} step={100} />
              <InputRow label="무게" unit="kg" value={aero.customBattery.kg} onChange={v => onAeroBatteryChange("kg", v)} min={0} max={5} step={0.01} />
              <InputRow label="방전률" unit="C" value={aero.customBattery.cRate} onChange={v => onAeroBatteryChange("cRate", v)} min={1} max={100} step={1} />
            </div>
          )}
          {calcResult && (
            <div className="fixedwing-selected-note">
              <span>전압 {calcResult.voltage.toFixed(1)}V</span>
              <span>에너지 {calcResult.batteryWh.toFixed(1)}Wh</span>
              <span>사용 가능 {calcResult.usableWh.toFixed(1)}Wh</span>
            </div>
          )}
        </Sec>

        <Sec title="임무 조건" icon={Target}>
          <InputRow label="전자장비 전력" unit="W" value={aero.avionicsW} onChange={v => onAeroChange("avionicsW", v)} min={0} max={200} step={1} />
          <InputRow label="배터리 예비" unit="%" value={aero.reservePct} onChange={v => onAeroChange("reservePct", v)} min={0} max={60} step={1} />
        </Sec>

        <Sec title="실측 로그 보정 (PX4 · ArduPilot)" icon={FileUp}>
          <LogCalibration cal={logCal} onCalChange={onLogCalChange} />
          <div className="fixedwing-model-note" style={{ marginTop: 8 }}>
            <span>로그의 순항 평균 전력과 모델 예측을 비교해 CD0·효율 오차를 한 번에 흡수합니다.</span>
            <span>PX4 .ulg와 ArduPilot .bin(DataFlash)을 지원합니다.</span>
          </div>
          {logCal && calcResult && (
            <ShareSummary variant={variant} aero={aero} battery={battery} photo={photo}
              logCal={logCal} calc={calcResult} calcBase={calcBaseResult} />
          )}
        </Sec>
      </div>

      <div className="results-panel fixedwing-results-panel">
        {!calcResult ? (
          <div className="result-overview fixedwing-result-panel" style={{ padding: "18px 16px" }}>
            <div className="fixedwing-card-title">
              <span>결과</span>
              <strong>입력값을 확인해주세요</strong>
            </div>
            <p style={{ fontSize: 12, color: "#64748b", margin: "8px 0 0" }}>
              윙스팬, 주익 면적, 이륙중량이 모두 0보다 커야 계산할 수 있습니다.
            </p>
          </div>
        ) : (
          <>
            <div className="result-overview fixedwing-result-panel" style={{ padding: "12px 14px" }}>
              <div className="fixedwing-card-title">
                <span>결과</span>
                <strong>{isPhoto ? "사진 측정 기반" : "직접 입력 기반"} 항력 모델 추정</strong>
              </div>
              <div className="fixedwing-hero-metrics">
                <BigNum label="최대 체공시간" value={calcResult.endurance.minutes.toFixed(0)} unit="분" color="#2563eb" border featured
                  sub={`100% 사용 시 ${calcResult.endurance.fullMinutes.toFixed(0)}분 · 예비 ${aero.reservePct.toFixed(0)}%`} />
                <BigNum label="최적 체공속도" value={calcResult.endurance.speedMs.toFixed(1)} unit="m/s" color="#0f766e" border featured
                  sub={`= ${calcResult.endurance.speedKmh.toFixed(0)} km/h · 최대 항속거리 속도 ${calcResult.range.speedMs.toFixed(1)} m/s`} />
              </div>

              <div className="fixedwing-result-grid">
                <SmallCard label="최대 항속거리" value={calcResult.range.km} unit="km" />
                <SmallCard label="실속속도" value={calcResult.vStallMs} unit="m/s" />
                <SmallCard label="최대 L/D" value={calcResult.maxLd} unit="" />
                <SmallCard label="순항전력" value={calcResult.endurance.powerW} unit="W" />
              </div>
              <div className="fixedwing-result-grid">
                <SmallCard label="가로세로비" value={calcResult.ar} unit="" />
                <SmallCard label="익면하중" value={calcResult.wingLoadingKgM2} unit="kg/m²" />
                <SmallCard label="순항 CL" value={calcResult.endurance.cl} unit="" />
                <SmallCard label="배터리 전류" value={calcResult.cruiseCurrentA} unit="A" />
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

              <div className="fixedwing-formula-strip">
                <span>모델: CD = CD0 + CL²/(π·e·AR)</span>
                <span>P = D·V/η + 전자장비 {aero.avionicsW.toFixed(0)}W</span>
                <span>해수면 표준대기(ρ=1.225) 기준</span>
              </div>
            </div>

            <div className="result-overview fixedwing-result-panel" style={{ padding: "12px 14px" }}>
              <div className="fixedwing-card-title">
                <span>속도별 필요전력</span>
                <strong>전력 곡선과 운용 포인트</strong>
              </div>
              <div className="chart-legend">
                <span>
                  <i style={{ background: "#dc2626" }} />
                  실속 {calcResult.vStallMs.toFixed(1)} m/s
                </span>
                <span>
                  <i style={{ background: "#2563eb" }} />
                  최대체공 {calcResult.endurance.speedMs.toFixed(1)} m/s · {calcResult.endurance.powerW.toFixed(0)} W
                </span>
                <span>
                  <i style={{ background: "#0f766e" }} />
                  최대항속 {calcResult.range.speedMs.toFixed(1)} m/s · {calcResult.range.powerW.toFixed(0)} W
                </span>
              </div>
              <div style={{ width: "100%", height: 240 }}>
                <ResponsiveContainer>
                  <AreaChart data={calcResult.curve} margin={{ top: 12, right: 18, bottom: 4, left: 0 }}>
                    <defs>
                      <linearGradient id="powerFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0f766e" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="#0f766e" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="ms" tick={{ fontSize: 11 }} unit=" m/s" tickCount={8}
                      type="number" domain={[Math.floor(calcResult.vStallMs - 0.5), "dataMax"]} allowDataOverflow />
                    <YAxis tick={{ fontSize: 11 }} unit=" W" width={58} />
                    <Tooltip content={<PowerTooltip />} />
                    <ReferenceLine x={+calcResult.vStallMs.toFixed(2)} stroke="#dc2626" strokeDasharray="4 4" strokeWidth={1.6} />
                    <ReferenceLine x={+calcResult.endurance.speedMs.toFixed(2)} stroke="#2563eb" strokeDasharray="4 4" />
                    <ReferenceLine x={+calcResult.range.speedMs.toFixed(2)} stroke="#0f766e" strokeDasharray="4 4" />
                    <Area type="monotone" dataKey="powerW" stroke="#0f766e" strokeWidth={2.4} fill="url(#powerFill)" />
                    <ReferenceDot x={+calcResult.endurance.speedMs.toFixed(2)} y={+calcResult.endurance.powerW.toFixed(1)}
                      r={5} fill="#2563eb" stroke="#ffffff" strokeWidth={2} />
                    <ReferenceDot x={+calcResult.range.speedMs.toFixed(2)} y={+calcResult.range.powerW.toFixed(1)}
                      r={5} fill="#0f766e" stroke="#ffffff" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="fixedwing-formula-strip">
                <span>최대체공: 필요전력 최소 속도 (가장 오래 떠 있음)</span>
                <span>최대항속: km당 소모 최소 속도 (가장 멀리 감)</span>
                <span>빨간 실속선보다 왼쪽은 비행 불가</span>
              </div>
            </div>

            <div className="result-overview fixedwing-result-panel" style={{ padding: "12px 14px" }}>
              <div className="fixedwing-card-title">
                <span>속도별 항속시간</span>
                <strong>얼마나 빨리 날면 얼마나 오래 나는가</strong>
              </div>
              <div className="chart-legend">
                <span>
                  <i style={{ background: "#2563eb" }} />
                  최대 체공점 {calcResult.endurance.speedMs.toFixed(1)} m/s · {calcResult.endurance.minutes.toFixed(0)}분
                </span>
                <span>
                  <i style={{ background: "#7c3aed" }} />
                  (L/D)max {calcResult.maxLd.toFixed(1)} @ {calcResult.maxLdSpeedMs.toFixed(1)} m/s
                </span>
              </div>
              <div style={{ width: "100%", height: 220 }}>
                <ResponsiveContainer>
                  <AreaChart data={calcResult.curve} margin={{ top: 12, right: 18, bottom: 4, left: 0 }}>
                    <defs>
                      <linearGradient id="enduranceFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2563eb" stopOpacity={0.26} />
                        <stop offset="100%" stopColor="#2563eb" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="ms" tick={{ fontSize: 11 }} unit=" m/s" tickCount={8}
                      type="number" domain={[Math.floor(calcResult.vStallMs - 0.5), "dataMax"]} allowDataOverflow />
                    <YAxis tick={{ fontSize: 11 }} unit=" 분" width={58} />
                    <Tooltip content={<EnduranceTooltip />} />
                    <ReferenceLine x={+calcResult.vStallMs.toFixed(2)} stroke="#dc2626" strokeDasharray="4 4" strokeWidth={1.6} />
                    <Area type="monotone" dataKey="enduranceMin" stroke="#2563eb" strokeWidth={2.4} fill="url(#enduranceFill)" />
                    <ReferenceDot x={+calcResult.endurance.speedMs.toFixed(2)} y={+calcResult.endurance.minutes.toFixed(1)}
                      r={5} fill="#2563eb" stroke="#ffffff" strokeWidth={2} />
                    <ReferenceDot x={+calcResult.maxLdSpeedMs.toFixed(2)}
                      y={+(calcResult.curve.find(p => Math.abs(p.ms - calcResult.maxLdSpeedMs) < 0.06)?.enduranceMin ?? 0).toFixed(1)}
                      r={5} fill="#7c3aed" stroke="#ffffff" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="fixedwing-formula-strip">
                <span>예비 {aero.reservePct.toFixed(0)}% 제외한 가용 에너지 기준</span>
                <span>(L/D)max 속도는 활공비 최적 = 무동력 활공 시 가장 멀리 가는 속도</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
