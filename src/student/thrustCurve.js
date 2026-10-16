import { estimate } from './estimate.js';
import { summarizeWeight } from './weight.js';

export function buildThrustCurve(p, combos, weightMode, result) {
  const combo = p.motorMethod === 'catalog' ? combos.find(item => item.id === p.comboId) : null;
  const weight = summarizeWeight(p, weightMode);
  const requiredN = weight?.thrustPerMotorN ?? null;
  let state = 'ready';
  if (p.motorMethod === 'catalog' && !combo) state = 'missing';
  else if (!weight || !result) state = 'invalid';
  else if (result.mismatch) state = 'mismatch';
  else if (p.cells < p.escMin || p.cells > p.escMax) state = 'escVoltage';
  else if (result.hover?.limited === 'low') state = 'below';
  else if (result.hover?.limited === 'high') state = 'above';

  const motorPowerW = result?.hover?.powerW ?? (result?.power - p.avionicsW - p.payloadW) / p.rotors;
  const point = state === 'ready' && result?.supported && Number.isFinite(motorPowerW) && motorPowerW > 0
    ? { thrustN: requiredN, powerW: motorPowerW, throttle: result.throttle } : null;
  let rows = [];
  if (combo) {
    rows = combo.test.map(row => ({ thrustN: row.thrustG / 1000 * 9.81, powerW: row.powerW, throttle: row.throttle }));
  } else if (result && p.motorMethod !== 'catalog') {
    const max = p.motorMethod === 'direct' ? p.thrust50 * 4 : requiredN * 2;
    if (Number.isFinite(max) && max > 0) {
      // Sample the same model used by the time estimate; no separate power equation.
      const thrusts = Array.from({ length: 32 }, (_, i) => max * (i + 1) / 32);
      if (point) thrusts.push(point.thrustN);
      rows = [{ thrustN: 0, powerW: 0 }, ...[...new Set(thrusts)].sort((a, b) => a - b).map(thrustN => {
        const sample = estimate('multicopter', { ...p, totalKg: thrustN / 9.81 * p.rotors }, combos, 'total');
        return { thrustN, powerW: sample ? (sample.power - p.avionicsW - p.payloadW) / p.rotors : null };
      })];
    }
  }
  const maxThrustN = Math.max(0, ...rows.map(row => row.thrustN));
  const maxPowerW = Math.max(0, ...rows.map(row => row.powerW ?? 0));
  const reference = p.motorMethod === 'direct' && rows.length ? { thrustN: p.thrust50, powerW: p.power50 } : null;
  return { combo, rows, point, reference, requiredN, state,
    measured: !!combo,
    xMax: Math.max(maxThrustN, requiredN ?? 0, 1) * 1.08,
    yMax: Math.max(maxPowerW, point?.powerW ?? 0, 1) * 1.12,
  };
}
