export function summarizeWeight(p, weightMode, payload = p.payloadKg) {
  if (!Number.isInteger(p.rotors) || p.rotors <= 0) return null;
  let rows = [];
  let totalKg = p.totalKg;
  if (weightMode === 'parts') {
    const parts = [
      ['airframe', p.airframeKg, 1], ['battery', p.batteryKg, 1],
      ['motor', p.motorKg, p.rotors], ['prop', p.propKg, p.rotors],
      ['esc', p.escKg, p.rotors], ['payload', payload, 1],
    ];
    if (parts.some(([, kg]) => !Number.isFinite(kg) || kg < 0)) return null;
    rows = parts.map(([id, kg, count]) => ({ id, count, kg: kg * count }));
    // Preserve the calculator's accumulation order at rounding boundaries.
    totalKg = p.airframeKg + p.rotors * (p.motorKg + p.propKg + p.escKg) + p.batteryKg + payload;
  } else if (weightMode !== 'total') return null;
  if (!Number.isFinite(totalKg) || totalKg <= 0) return null;
  return {
    totalKg, rotors: p.rotors,
    rows: rows.map(row => ({ ...row, percent: row.kg / totalKg * 100 })),
    loadPerMotorKg: totalKg / p.rotors,
    thrustPerMotorN: totalKg * 9.81 / p.rotors,
  };
}
