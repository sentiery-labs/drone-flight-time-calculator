import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { csvToMotorCombos } from '../data/motorData.js';
import { buildMotorCatalog, comboSettings, compatibleCombos, decorateCombos, escSettings, interpolateCatalogByThrust, loadCatalogCombos, motorKey, propKey } from './catalog.js';

const data = JSON.parse(readFileSync(new URL('./parts-catalog.json', import.meta.url)));
const combos = decorateCombos(csvToMotorCombos(readFileSync(new URL('../../public/data/motor-presets.csv', import.meta.url), 'utf8')), data.comboMetadata);
const sunnySkyCombos = decorateCombos(csvToMotorCombos(readFileSync(new URL('../../public/data/sunnysky-motors.csv', import.meta.url), 'utf8')), data.comboMetadata);

test('existing CSV builds four motor models and six distinct tested combinations', () => {
  assert.equal(combos.length, 6);
  assert.equal(buildMotorCatalog(combos).length, 4);
  assert.equal(new Set(combos.map(motorKey)).size, 4);
  const u3 = combos.find(combo => combo.motor === 'U3');
  const options = compatibleCombos(combos, u3, { propId: null });
  assert.equal(options.length, 2);
  assert.ok(options.every(combo => combo.motor === 'U3'));
  assert.equal(compatibleCombos(combos, u3, {}).length, 1);
  assert.deepEqual(compatibleCombos(combos, u3, { propId: 'unsupported' }), []);
});

test('unlisted propeller and ESC mass stay missing, never become zero', () => {
  const u5 = combos.find(combo => combo.motor === 'U5');
  assert.equal(u5.propWeightKg, null);
  assert.equal(comboSettings(u5).propKg, '');
  assert.equal(escSettings(data.escs.find(esc => esc.id === 'tmotor-air40a-2-6s')).escKg, '');
  assert.equal(escSettings(data.escs.find(esc => esc.id === 'tmotor-air20a-3-4s')).escKg, .021);
});

test('new motor and cross-brand propeller require data, not hard-coded UI entries', () => {
  const extra = decorateCombos([{ ...combos[0], id: 'new-sunnysky-apc', maker: 'SunnySky', motor: 'X2216', kv: 900, prop: '10x4.7', propWeightKg: .01 }], { 'new-sunnysky-apc': { propMaker: 'APC' } });
  const models = buildMotorCatalog([...combos, ...extra]);
  assert.ok(models.some(model => model.maker === 'SunnySky'));
  assert.equal(extra[0].propMaker, 'APC');
  assert.notEqual(propKey(extra[0]), propKey(combos[0]));
  assert.equal(compatibleCombos([...combos, ...extra], extra[0], {}).length, 1);
  assert.equal(decorateCombos([{ ...extra[0], id: 'unknown' }])[0].propMaker, 'Unverified');
});

test('SunnySky adds four KV variants and eight independently tested combinations', () => {
  assert.equal(sunnySkyCombos.length, 8);
  const models = buildMotorCatalog([...combos, ...sunnySkyCombos]);
  assert.equal(models.length, 8);
  assert.equal(models.filter(model => model.maker === 'SunnySky').length, 4);
  assert.equal(new Set([...combos, ...sunnySkyCombos].map(combo => combo.id)).size, 14);
  for (const combo of sunnySkyCombos) {
    assert.equal(combo.maker, 'SunnySky');
    assert.equal(combo.propMaker, 'EOLO');
    assert.ok(Math.abs(combo.voltage - combo.cells * 3.7) < 1e-9);
    assert.equal(combo.cells, combo.kv === 400 ? 6 : 4);
    assert.equal(combo.motorWeightKg, combo.motor === 'V2806' ? .047 : .097);
    assert.equal(compatibleCombos(sunnySkyCombos, combo, { propId: null }).length, 2);
    assert.equal(compatibleCombos(sunnySkyCombos, combo, {}).length, 1);
    assert.ok(combo.sourceUrl.startsWith('https://sunnyskyusa.com/products/'));
    assert.ok(combo.test.every(row => row.thrustG > 0 && row.currentA > 0 && row.powerW > 0 && row.rpm > 0));
    assert.ok(combo.test.every((row, i) => !i || row.thrustG > combo.test[i - 1].thrustG));
  }
});

test('500 gf source measurements retain reported watts and current duration', () => {
  const expected = [
    ['sunnysky-v2806-kv400-6s-cn11x45', 2.45, 54, 5159, 10, 180],
    ['sunnysky-v2806-kv400-6s-cn12x5', 2.4, 53, 4445, 10, 180],
    ['sunnysky-v2806-kv650-4s-cn11x45', 3.85, 57, 5126, 16, 180],
    ['sunnysky-v2806-kv650-4s-cn12x5', 3.7, 55, 4446, 16, 180],
    ['sunnysky-v3508-kv580-4s-cn11x45', 3.3, 49, 5039, 25, 30],
    ['sunnysky-v3508-kv580-4s-cn12x5', 3.4, 50, 3980, 25, 30],
    ['sunnysky-v3508-kv700-4s-cn11x45', 3.6, 53, 5055, 32, 30],
    ['sunnysky-v3508-kv700-4s-cn12x5', 3.4, 50, 4400, 32, 30]
  ];
  for (const [id, currentA, powerW, rpm, limitA, seconds] of expected) {
    const combo = sunnySkyCombos.find(item => item.id === id);
    assert.deepEqual(combo.test.find(row => row.thrustG === 500), { throttle: null, currentA, powerW, thrustG: 500, rpm });
    assert.equal(combo.maxCurrentA, limitA);
    assert.equal(combo.currentLimitSeconds, seconds);
  }
});

test('unpublished throttle and propeller mass never become 0 or a fabricated 50% row', () => {
  for (const combo of sunnySkyCombos) {
    assert.equal(combo.propWeightKg, null);
    assert.equal(comboSettings(combo).propKg, '');
    assert.equal(combo.throttleAvailable, false);
    assert.ok(combo.test.every(row => row.throttle === null));
    for (const thrust of [100, 450, combo.test.at(-1).thrustG + 1]) {
      assert.equal(interpolateCatalogByThrust(combo, thrust).throttle, null);
    }
  }
});

test('thrust interpolation uses measured power and includes exact test endpoints', () => {
  const combo = sunnySkyCombos.find(item => item.id === 'sunnysky-v3508-kv580-4s-cn12x5');
  const hover = interpolateCatalogByThrust(combo, 450);
  assert.equal(hover.powerW, 43.5);
  assert.equal(hover.currentA, 2.95);
  assert.equal(hover.limited, false);
  assert.equal(interpolateCatalogByThrust(combo, 200).limited, false);
  assert.equal(interpolateCatalogByThrust(combo, 1190).limited, false);
  assert.equal(interpolateCatalogByThrust(combo, 199).limited, 'low');
  assert.equal(interpolateCatalogByThrust(combo, 1191).limited, 'high');
  assert.equal(interpolateCatalogByThrust(combo, NaN), null);
  assert.equal(interpolateCatalogByThrust({ test: [] }, 450), null);
  const original = combos.find(item => item.test.some(row => row.throttle === 50));
  const fifty = original.test.find(row => row.throttle === 50);
  assert.equal(interpolateCatalogByThrust(original, fifty.thrustG).throttle, 50);
});

test('catalog manifest loads CSVs under the GitHub Pages project path', async () => {
  const requested = [];
  const loaded = await loadCatalogCombos(data, '/drone-flight-time-calculator/', async path => {
    requested.push(path);
    const file = path.split('/').at(-1);
    return { ok: true, text: async () => readFileSync(new URL(`../../public/data/${file}`, import.meta.url), 'utf8') };
  });
  assert.deepEqual(requested, [
    '/drone-flight-time-calculator/data/motor-presets.csv',
    '/drone-flight-time-calculator/data/sunnysky-motors.csv'
  ]);
  assert.equal(loaded.length, 14);
  assert.equal(loaded.find(combo => combo.maker === 'SunnySky').test[0].throttle, null);
  await assert.rejects(loadCatalogCombos(data, './', async () => ({ ok: false, status: 404 })), /Failed to load motor CSV/);
});
