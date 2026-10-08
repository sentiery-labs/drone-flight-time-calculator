import { csvToMotorCombos, interpolateByThrust } from '../data/motorData.js';

export async function loadCatalogCombos(catalog, baseUrl, fetchFile = fetch) {
  const files = await Promise.all(catalog.motorFiles.map(async file => {
    const response = await fetchFile(`${baseUrl}data/${file}`);
    if (!response.ok) throw new Error(`Failed to load motor CSV: ${file} (${response.status})`);
    return csvToMotorCombos(await response.text());
  }));
  return decorateCombos(files.flat(), catalog.comboMetadata);
}

export const motorKey = combo => JSON.stringify([combo.maker, combo.motor, combo.kv]);
export const propKey = combo => JSON.stringify([combo.propMaker || '', combo.prop]);
export const unique = values => [...new Set(values)];

export function decorateCombos(combos, metadata = {}) {
  return combos.map(combo => ({
    ...combo,
    ...metadata[combo.id],
    propMaker: metadata[combo.id]?.propMaker || 'Unverified',
    // The existing CSV uses zero for unlisted propeller mass, not a massless prop.
    propWeightKg: combo.propWeightKg > 0 ? combo.propWeightKg : null,
    // The shared CSV parser turns blanks into zero; missing throttle is not 0%.
    test: combo.test.map(row => ({ ...row,
      throttle: metadata[combo.id]?.throttleAvailable === false ? null : row.throttle
    }))
  }));
}

export function interpolateCatalogByThrust(combo, thrustG) {
  if (!combo?.test.length || !Number.isFinite(thrustG)) return null;
  const result = interpolateByThrust(combo.test, thrustG);
  if (!result) return null;
  const min = Math.min(...combo.test.map(row => row.thrustG));
  const max = Math.max(...combo.test.map(row => row.thrustG));
  return { ...result,
    throttle: combo.throttleAvailable === false ? null : result.throttle,
    limited: thrustG < min ? 'low' : thrustG > max ? 'high' : false
  };
}

export function buildMotorCatalog(combos) {
  const groups = new Map();
  for (const combo of combos) {
    const id = motorKey(combo);
    if (!groups.has(id)) groups.set(id, {
      id, maker: combo.maker, makerLabel: combo.makerLabel || combo.maker,
      model: combo.motor, kv: combo.kv, combos: []
    });
    groups.get(id).combos.push(combo);
  }
  return [...groups.values()];
}

export function compatibleCombos(combos, selected, changes) {
  if (!selected) return [];
  const target = { motorId: motorKey(selected), propId: propKey(selected), ...changes };
  return combos.filter(combo => motorKey(combo) === target.motorId
    && (!target.propId || propKey(combo) === target.propId));
}

export function comboSettings(combo) {
  return {
    comboId: combo.id, motorMethod: 'catalog', motorKg: combo.motorWeightKg,
    propKg: combo.propWeightKg ?? '', propInch: combo.propInch
  };
}

export function escSettings(esc) {
  return {
    escId: esc.id, escKg: esc.weightG == null ? '' : esc.weightG / 1000,
    escA: esc.continuousA, escPeakA: esc.peakA,
    escMin: esc.cellMin, escMax: esc.cellMax
  };
}
