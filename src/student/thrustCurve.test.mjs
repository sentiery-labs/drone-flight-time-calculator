import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { csvToMotorCombos } from '../data/motorData.js';
import { comboSettings, decorateCombos } from './catalog.js';
import { estimate, INITIAL } from './estimate.js';
import { buildThrustCurve } from './thrustCurve.js';

const catalog = JSON.parse(readFileSync(new URL('./parts-catalog.json', import.meta.url)));
const combos = decorateCombos(catalog.motorFiles.flatMap(file =>
  csvToMotorCombos(readFileSync(new URL(`../../public/data/${file}`, import.meta.url), 'utf8'))), catalog.comboMetadata);
const closeTo = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
const chartFor = (p = INITIAL, weightMode = 'parts') => buildThrustCurve(p, combos, weightMode, estimate('multicopter', p, combos, weightMode));

test('manufacturer curve retains every test point and hover lies on the linear interpolation', () => {
  const chart = chartFor();
  const result = estimate('multicopter', INITIAL, combos, 'parts');
  assert.equal(chart.measured, true);
  assert.equal(chart.state, 'ready');
  assert.equal(chart.rows.length, chart.combo.test.length);
  chart.rows.forEach((row, i) => {
    closeTo(row.thrustN, chart.combo.test[i].thrustG / 1000 * 9.81);
    assert.equal(row.powerW, chart.combo.test[i].powerW);
  });
  closeTo(chart.point.thrustN, result.weight * 9.81 / INITIAL.rotors);
  closeTo(chart.point.powerW * INITIAL.rotors + INITIAL.avionicsW + INITIAL.payloadW, result.power);
  const b = chart.rows.find(row => row.thrustN >= chart.point.thrustN);
  const a = chart.rows[chart.rows.indexOf(b) - 1];
  const fraction = (chart.point.thrustN - a.thrustN) / (b.thrustN - a.thrustN);
  closeTo(chart.point.powerW, a.powerW + (b.powerW - a.powerW) * fraction);
  assert.equal(chart.reference, null);
});

test('weight moves the operating point, while capacity alone does not move it or the test curve', () => {
  const initial = chartFor();
  const heavier = chartFor({ ...INITIAL, batteryKg: .7, payloadKg: .3 });
  assert.deepEqual(heavier.rows, initial.rows);
  assert.ok(heavier.point.thrustN > initial.point.thrustN);
  assert.ok(heavier.point.powerW > initial.point.powerW);
  assert.deepEqual(chartFor({ ...INITIAL, mah: 6000 }).point, initial.point);
});

test('SunnySky power is usable without inventing any throttle percentage', () => {
  const combo = combos.find(item => item.id === 'sunnysky-v2806-kv650-4s-cn11x45');
  const p = { ...INITIAL, ...comboSettings(combo), totalKg: 2 };
  const chart = chartFor(p, 'total');
  assert.equal(chart.state, 'ready');
  assert.equal(chart.point.throttle, null);
  assert.ok(chart.rows.every(row => row.throttle === null));
  closeTo(chart.point.powerW, 57);
  closeTo(chart.requiredN, 2 * 9.81 / 4);
});

test('test endpoints are accepted, but out-of-range power is never plotted or extrapolated', () => {
  const combo = combos.find(item => item.id === INITIAL.comboId);
  const atMax = { ...INITIAL, totalKg: combo.test.at(-1).thrustG / 1000 * INITIAL.rotors };
  const boundary = chartFor(atMax, 'total');
  assert.equal(boundary.state, 'ready');
  closeTo(boundary.point.powerW, combo.test.at(-1).powerW);
  const above = chartFor({ ...atMax, totalKg: atMax.totalKg + .01 }, 'total');
  assert.equal(above.state, 'above');
  assert.equal(above.point, null);
  assert.deepEqual(above.rows, boundary.rows);
  assert.ok(above.xMax > above.requiredN);
  const below = chartFor({ ...INITIAL, totalKg: combo.test[0].thrustG / 1000 * INITIAL.rotors / 2 }, 'total');
  assert.equal(below.state, 'below');
  assert.equal(below.point, null);
  assert.deepEqual(below.rows, boundary.rows);
  const atMin = chartFor({ ...INITIAL, totalKg: combo.test[0].thrustG / 1000 * INITIAL.rotors }, 'total');
  assert.equal(atMin.state, 'ready');
  closeTo(atMin.point.powerW, combo.test[0].powerW);
});

test('mismatched voltage and incomplete inputs retain the table but hide the operating point', () => {
  const mismatch = chartFor({ ...INITIAL, cells: 6 });
  assert.equal(mismatch.state, 'mismatch');
  assert.equal(mismatch.point, null);
  assert.ok(mismatch.rows.length > 0);
  const escVoltage = chartFor({ ...INITIAL, escMin: 5, escMax: 6 });
  assert.equal(escVoltage.state, 'escVoltage');
  assert.equal(escVoltage.point, null);
  const invalid = chartFor({ ...INITIAL, batteryKg: '' });
  assert.equal(invalid.state, 'invalid');
  assert.equal(invalid.requiredN, null);
  assert.equal(invalid.point, null);
  assert.deepEqual(invalid.rows, chartFor().rows);
  const missing = chartFor({ ...INITIAL, comboId: 'missing' });
  assert.equal(missing.state, 'missing');
  assert.deepEqual(missing.rows, []);
});

test('direct-50 and physics curves sample the same model used by the calculator', () => {
  for (const motorMethod of ['direct', 'physics']) {
    const p = { ...INITIAL, motorMethod };
    const chart = chartFor(p);
    assert.equal(chart.measured, false);
    assert.equal(chart.state, 'ready');
    assert.ok(chart.rows.length >= 33);
    assert.deepEqual(chart.rows[0], { thrustN: 0, powerW: 0 });
    for (const row of chart.rows.slice(1)) {
      const sample = estimate('multicopter', { ...p, totalKg: row.thrustN / 9.81 * p.rotors }, combos, 'total');
      closeTo(row.powerW * p.rotors + p.avionicsW + p.payloadW, sample.power);
    }
    const current = chart.rows.find(row => row.thrustN === chart.point.thrustN);
    closeTo(current.powerW, chart.point.powerW);
    assert.equal(chart.reference?.powerW ?? null, motorMethod === 'direct' ? INITIAL.power50 : null);
  }
});

test('direct-50 model cannot extend its curve or current point past the existing approximation limit', () => {
  const p = { ...INITIAL, motorMethod: 'direct', totalKg: INITIAL.thrust50 * 4 / 9.81 * INITIAL.rotors + .01 };
  const chart = chartFor(p, 'total');
  assert.equal(chart.state, 'above');
  assert.equal(chart.point, null);
  closeTo(chart.rows.at(-1).thrustN, p.thrust50 * 4);
});

test('adding avionics or payload power does not change the motor curve or operating point', () => {
  const initial = chartFor();
  const extra = chartFor({ ...INITIAL, avionicsW: 20, payloadW: 15 });
  assert.deepEqual(extra.rows, initial.rows);
  assert.deepEqual(extra.point, initial.point);
});

test('chart creation does not mutate settings, manufacturer data or results', () => {
  const result = estimate('multicopter', INITIAL, combos, 'parts');
  const snapshot = structuredClone({ settings: INITIAL, combos, result });
  buildThrustCurve(INITIAL, combos, 'parts', result);
  assert.deepEqual({ settings: INITIAL, combos, result }, snapshot);
});
