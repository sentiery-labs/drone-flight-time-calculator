import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { csvToMotorCombos } from '../data/motorData.js';
import { comboSettings, decorateCombos } from './catalog.js';
import { estimate, INITIAL } from './estimate.js';

const catalog = JSON.parse(readFileSync(new URL('./parts-catalog.json', import.meta.url)));
const combos = decorateCombos(catalog.motorFiles.flatMap(file =>
  csvToMotorCombos(readFileSync(new URL(`../../public/data/${file}`, import.meta.url), 'utf8'))), catalog.comboMetadata);
const closeTo = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

test('default Holybro result uses one model for time, power and battery current', () => {
  const result = estimate('multicopter', INITIAL, combos, 'parts');
  assert.equal(result.supported, true);
  assert.equal(result.source, 'csv');
  closeTo(result.weight, 1.85);
  assert.equal(result.minutes.toFixed(1), '15.9');
  closeTo(result.minutes, result.usable / result.power * 60);
  closeTo(result.batteryA, result.power / result.voltage);
});

test('baseline results remain unchanged when battery and payload inputs change', () => {
  const baseline = estimate('multicopter', INITIAL, combos, 'parts');
  const snapshot = structuredClone(baseline);
  const larger = estimate('multicopter', { ...INITIAL, mah: 10000 }, combos, 'parts');
  closeTo(larger.minutes, baseline.minutes * 2);
  const heavier = estimate('multicopter', { ...INITIAL, payloadKg: .3, batteryKg: .6 }, combos, 'parts');
  assert.ok(heavier.weight > baseline.weight);
  assert.ok(heavier.power > baseline.power);
  assert.ok(heavier.minutes < baseline.minutes);
  assert.deepEqual(baseline, snapshot);
});

test('parts mode requires missing mass while total mode does not double-count parts', () => {
  const combo = combos.find(item => item.id === 'sunnysky-v2806-kv650-4s-cn11x45');
  const selected = { ...INITIAL, ...comboSettings(combo) };
  assert.equal(estimate('multicopter', selected, combos, 'parts'), null);
  const total = estimate('multicopter', { ...selected, totalKg: 2 }, combos, 'total');
  assert.equal(total.weight, 2);
  assert.equal(total.throttle, null);
  assert.equal(total.supported, true);
  closeTo(total.power, 57 * 4 + INITIAL.avionicsW);
  assert.equal(estimate('multicopter', { ...INITIAL, escKg: '' }, combos, 'parts'), null);
});

test('battery voltage and ESC voltage range block unsupported results', () => {
  const combo = combos.find(item => item.id === 'sunnysky-v2806-kv400-6s-cn11x45');
  const selected = { ...INITIAL, ...comboSettings(combo), totalKg: 2 };
  const mismatch = estimate('multicopter', selected, combos, 'total');
  assert.equal(mismatch.mismatch, true);
  assert.equal(mismatch.supported, false);
  assert.equal(estimate('multicopter', { ...selected, cells: 6 }, combos, 'total').supported, false);
  assert.equal(estimate('multicopter', { ...selected, cells: 6, escMax: 6 }, combos, 'total').supported, true);
});

test('exact maximum test thrust is valid, larger thrust cannot be extrapolated', () => {
  const combo = combos.find(item => item.id === 'sunnysky-v3508-kv580-4s-cn12x5');
  const selected = { ...INITIAL, ...comboSettings(combo), totalKg: combo.test.at(-1).thrustG / 1000 * INITIAL.rotors };
  assert.equal(estimate('multicopter', selected, combos, 'total').supported, true);
  assert.equal(estimate('multicopter', { ...selected, totalKg: selected.totalKg + .001 }, combos, 'total').supported, false);
});

test('direct 50% and physical models remain available without catalog data', () => {
  const direct = { ...INITIAL, motorMethod: 'direct', totalKg: INITIAL.thrust50 / 9.81 * INITIAL.rotors };
  const result = estimate('multicopter', direct, [], 'total');
  closeTo(result.throttle, 50);
  closeTo(result.power, INITIAL.power50 * INITIAL.rotors + INITIAL.avionicsW);
  assert.equal(result.source, 'direct50');
  const physics = estimate('multicopter', { ...INITIAL, motorMethod: 'physics' }, [], 'parts');
  assert.equal(physics.source, 'physics');
  assert.ok(Number.isFinite(physics.minutes) && physics.minutes > 0);
});

test('invalid input never creates a numeric flight-time result', () => {
  for (const changes of [{ mah: '' }, { cells: 4.5 }, { reserve: 61 }, { cRate: 0 }, { fm: 0 }, { rotors: 0 }, { escMin: 6, escMax: 4 }]) {
    assert.equal(estimate('multicopter', { ...INITIAL, ...changes }, combos, 'parts'), null);
  }
  assert.equal(estimate('multicopter', { ...INITIAL, comboId: 'missing' }, combos, 'parts'), null);
});

test('fixed-wing and VTOL use the shared aero model and reject missing mission input', () => {
  const p = { ...INITIAL, totalKg: 2.2 };
  const fixedWing = estimate('fixedwing', p, combos, 'total');
  assert.equal(fixedWing.source, 'aero');
  assert.ok(fixedWing.minutes > 0 && fixedWing.fw.endurance.speedKmh > 0);
  closeTo(fixedWing.minutes, fixedWing.usable / fixedWing.power * 60);
  const vtol = estimate('vtol', p, combos, 'total');
  assert.ok(vtol.minutes > 0 && vtol.hoverWh > 0 && vtol.missionWh > 0);
  for (const key of ['hoverMin', 'transitionSec', 'missionKm']) {
    assert.equal(estimate('vtol', { ...p, [key]: '' }, combos, 'total'), null);
  }
  assert.equal(estimate('vtol', { ...p, hoverMin: 120 }, combos, 'total').supported, false);
});
