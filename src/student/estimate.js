import { calcFixedWingAero } from '../fixedwing/aero.js';
import { interpolateCatalogByThrust } from './catalog.js';
import { summarizeWeight } from './weight.js';

export const INITIAL = { aircraft: 'x500', airframeKg: .96, rotors: 4, motorKg: .064, propKg: .0125, escKg: .021,
  motorMethod: 'catalog', directCells: 4, escId: '', escMin: 3, escMax: 4, escPeakA: 30,
  escA: 20, propInch: 10, fm: .45, avionicsW: 10, cells: 4, mah: 5000, batteryKg: .5,
  cRate: 20, reserve: 10, payloadKg: 0, payloadW: 0, totalKg: 1.852,
  comboId: 'holybro-air2216ii-kv920-4s-t1045ii', thrust50: 5, power50: 70,
  spanMm: 1620, wingArea: .36, cd0: .04, oswald: .75, propEff: .55, clMax: 1.2,
  hoverMin: 2, transitionSec: 40, missionKm: 10 };

// Multicopter equations mirror App.jsx; fixed-wing uses the shared calculator.
export function estimate(mode, p, combos, weightMode, payload = p.payloadKg) {
  const required = [p.cells, p.mah, p.reserve, p.payloadW,
    p.rotors, p.propInch, p.fm, p.avionicsW, p.cRate, p.escA, p.escMin, p.escMax,
    ...(weightMode === 'total' ? [p.totalKg] : [p.airframeKg, p.motorKg, p.propKg, p.escKg, p.batteryKg, payload])];
  if (p.motorMethod === 'direct') required.push(p.thrust50, p.power50, p.directCells);
  if (mode !== 'multicopter') required.push(p.spanMm, p.wingArea, p.cd0, p.oswald, p.propEff, p.clMax);
  if (mode === 'vtol') required.push(p.hoverMin, p.transitionSec, p.missionKm);
  if (required.some(v => v === '' || !Number.isFinite(v) || v < 0) || p.cells < 1 || p.mah <= 0 || p.reserve > 60 || p.cRate <= 0) return null;
  if (p.escMin > p.escMax || p.rotors % 1 || p.cells % 1 || p.escA <= 0) return null;
  const weightSummary = summarizeWeight(p, weightMode, payload);
  if (!weightSummary) return null;
  const weight = weightSummary.totalKg;
  const voltage = p.cells * 3.7;
  const wh = voltage * p.mah / 1000;
  const usable = wh * (1 - p.reserve / 100);
  const combo = p.motorMethod === 'catalog' ? combos.find(c => c.id === p.comboId) : null;
  if (p.motorMethod === 'catalog' && !combo) return null;
  const area = p.rotors * Math.PI * (p.propInch * .0254 / 2) ** 2;
  if (!(area > 0) || !(p.fm > 0) || !(p.rotors > 0)) return null;
  let hover = combo ? interpolateCatalogByThrust(combo, weight * 1000 / p.rotors) : null;
  if (p.motorMethod === 'direct') {
    if (p.thrust50 <= 0 || p.power50 <= 0 || p.directCells < 1 || p.directCells % 1) return null;
    const ratio = weight * 9.81 / p.rotors / p.thrust50;
    const powerW = p.power50 * ratio ** 1.5;
    hover = { powerW, currentA: powerW / voltage, throttle: 50 * Math.sqrt(ratio), limited: ratio > 4 ? 'high' : false };
  }
  const powerHover = hover ? hover.powerW * p.rotors + p.avionicsW + p.payloadW
    : (weight * 9.81 * Math.sqrt(weight * 9.81 / (2 * 1.225 * area))) / p.fm + p.avionicsW + p.payloadW;
  const base = { weight, wh, usable, voltage, hover, power: powerHover,
    source: combo ? 'csv' : hover ? 'direct50' : 'physics', minutes: usable / powerHover * 60,
    sourceLabel: combo ? '제조사 추력표' : hover ? '50% 스펙 추정' : '물리 모델',
    mismatch: combo ? combo.cells !== p.cells : p.motorMethod === 'direct' && p.directCells !== p.cells,
    batteryA: powerHover / voltage, motorA: hover?.currentA ?? (powerHover - p.avionicsW - p.payloadW) / p.rotors / voltage, throttle: hover?.throttle,
    supported: hover?.limited !== 'high', thrustSupported: hover?.limited !== 'high',
    batteryLoad: powerHover / voltage / (p.mah / 1000 * p.cRate) * 100 };
  base.supported = base.supported && !base.mismatch && p.cells >= p.escMin && p.cells <= p.escMax;
  if (mode === 'multicopter') return base;
  const fw = calcFixedWingAero({ wingspanM: p.spanMm / 1000, wingAreaM2: p.wingArea,
    towKg: weight, cd0: p.cd0, oswald: p.oswald, propEff: p.propEff, clMax: p.clMax,
    avionicsW: p.avionicsW + p.payloadW, reservePct: p.reserve,
    batteryCells: p.cells, batteryMah: p.mah, batteryCRate: p.cRate });
  if (!fw) return null;
  const cruise = { ...base, power: fw.endurance.powerW, minutes: fw.endurance.minutes,
    batteryA: fw.cruiseCurrentA, batteryLoad: fw.batteryLoadPct, sourceLabel: '공력 가정값',
    source: 'aero', mismatch: false, supported: true, fw };
  if (mode === 'fixedwing') return cruise;
  const hoverWh = powerHover * (p.hoverMin / 60 + p.transitionSec / 3600);
  const cruiseWh = Math.max(usable - hoverWh, 0);
  return { ...cruise, minutes: p.hoverMin + p.transitionSec / 60 + cruiseWh / cruise.power * 60,
    supported: base.supported && usable > hoverWh, hoverEnergyEnough: usable > hoverWh, hoverWh, sourceLabel: '호버·순항 결합',
    missionWh: hoverWh + cruise.power * (p.missionKm / fw.endurance.speedKmh) };
}
