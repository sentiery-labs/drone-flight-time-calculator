import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { csvToMotorCombos } from '../data/motorData.js';
import { comboSettings, decorateCombos } from './catalog.js';
import { estimate, INITIAL } from './estimate.js';
import { batteryBaseWeight, compareBatteries, initialBatteryCandidates } from './batteryComparison.js';

const catalog = JSON.parse(readFileSync(new URL('./parts-catalog.json', import.meta.url)));
const combos = decorateCombos(catalog.motorFiles.flatMap(file => csvToMotorCombos(readFileSync(new URL(`../../public/data/${file}`, import.meta.url), 'utf8'))), catalog.comboMetadata);
const candidate = changes => ({ id: 'test', name: 'Test', cells: 4, mah: 5000, batteryKg: .5, cRate: 20, ...changes });
const closeTo = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

test('new candidates never invent battery mass and a single complete candidate cannot win', () => {
  const list = initialBatteryCandidates(INITIAL);
  assert.equal(list[0].batteryKg, .5);
  assert.equal(list[1].batteryKg, '');
  assert.equal(list[2].batteryKg, '');
  const result = compareBatteries(INITIAL, list, combos, 'parts');
  assert.equal(result.rows[0].isCurrent, true);
  assert.equal(result.rows[0].minutes.toFixed(1), '15.9');
  assert.ok(result.rows.slice(1).every(row => row.minutes == null && !row.canApply));
  assert.ok(result.rows.every(row => !row.best));
});

test('candidate weight increases hover power instead of scaling endurance by capacity alone', () => {
  const { rows } = compareBatteries(INITIAL, [candidate(), candidate({ id: 'larger', mah: 10000, batteryKg: .8 })], combos, 'parts');
  assert.ok(rows[1].result.weight > rows[0].result.weight);
  assert.ok(rows[1].result.power > rows[0].result.power);
  assert.ok(rows[1].minutes > rows[0].minutes && rows[1].minutes < rows[0].minutes * 2);
  closeTo(rows[1].minutes, estimate('multicopter', rows[1].settings, combos, 'parts').minutes);
});

test('the longest comparable candidate wins, including exact ties, but errors never win', () => {
  const { rows } = compareBatteries(INITIAL, [candidate(), candidate({ id: 'b', mah: 6000, batteryKg: .6 }), candidate({ id: 'c', mah: 6000, batteryKg: .6 }), candidate({ id: 'bad', mah: 100000, cells: 6 })], combos, 'parts');
  assert.equal(rows[0].best, false);
  assert.equal(rows[1].best, true);
  assert.equal(rows[2].best, true);
  assert.equal(rows[3].best, false);
  assert.equal(rows[3].canApply, false);
});

test('total-weight mode replaces the installed pack and repeated application never double counts it', () => {
  const p = { ...INITIAL, totalKg: 2.4 };
  const first = compareBatteries(p, [candidate({ batteryKg: .7, mah: 6000 })], combos, 'total').rows[0];
  closeTo(first.settings.totalKg, 2.6);
  assert.equal(first.settings.totalKg, 2.6);
  closeTo(first.result.weight, 2.6);
  const second = compareBatteries(first.settings, [candidate({ batteryKg: .8, mah: 8000 })], combos, 'total').rows[0];
  closeTo(second.settings.totalKg, 2.7);
  assert.equal(second.settings.totalKg, 2.7);
  closeTo(batteryBaseWeight(p, 'total'), batteryBaseWeight(second.settings, 'total'));
});

test('total-weight comparison requires a known current pack mass; parts mode does not', () => {
  for (const batteryKg of ['', null, 0, -1, 2.4, 3]) {
    const p = { ...INITIAL, totalKg: 2.4, batteryKg };
    assert.equal(batteryBaseWeight(p, 'total'), null);
    const row = compareBatteries(p, [candidate()], combos, 'total').rows[0];
    assert.equal(row.canApply, false);
    assert.ok(row.issues.some(issue => issue.code === 'baseMass'));
  }
  assert.equal(compareBatteries({ ...INITIAL, batteryKg: '' }, [candidate()], combos, 'parts').rows[0].canApply, true);
});

test('missing, fractional cell and out-of-range candidate specs never produce usable times', () => {
  for (const changes of [{ cells: '' }, { cells: 4.5 }, { cells: 15 }, { mah: '' }, { mah: 0 }, { mah: 100001 }, { batteryKg: '' }, { batteryKg: 0 }, { batteryKg: 11 }, { cRate: '' }, { cRate: 0 }, { cRate: 201 }]) {
    const row = compareBatteries(INITIAL, [candidate(changes)], combos, 'parts').rows[0];
    assert.equal(row.minutes, null, JSON.stringify(changes));
    assert.equal(row.canApply, false);
    assert.equal(row.best, false);
  }
});

test('voltage mismatch, ESC limits and discharge overload block application and ranking', () => {
  const mismatch = compareBatteries(INITIAL, [candidate({ cells: 6 })], combos, 'parts').rows[0];
  assert.ok(mismatch.issues.some(issue => issue.code === 'testVoltage'));
  assert.ok(mismatch.issues.some(issue => issue.code === 'escVoltage'));
  const discharge = compareBatteries(INITIAL, [candidate({ mah: 100, cRate: 1 })], combos, 'parts').rows[0];
  assert.ok(discharge.issues.some(issue => issue.code === 'discharge'));
  const esc = compareBatteries({ ...INITIAL, escA: 1 }, [candidate()], combos, 'parts').rows[0];
  assert.ok(esc.issues.some(issue => issue.code === 'escCurrent'));
  for (const row of [mismatch, discharge, esc]) assert.equal(row.canApply || row.best, false);
});

test('thrust-table overflow is excluded; low-end approximations and high throttle cannot win', () => {
  const heavy = compareBatteries(INITIAL, [candidate({ batteryKg: 10, mah: 100000 })], combos, 'parts').rows[0];
  assert.ok(heavy.issues.some(issue => issue.code === 'thrust'));
  assert.equal(heavy.canApply, false);
  const p = { ...INITIAL, airframeKg: .01, motorKg: .001, propKg: 0, escKg: 0, payloadKg: 0 };
  const low = compareBatteries(p, [candidate({ batteryKg: .001 })], combos, 'parts').rows[0];
  assert.ok(low.issues.some(issue => issue.code === 'below'));
  assert.equal(low.rankable, false);
  const high = compareBatteries({ ...INITIAL, motorMethod: 'direct', thrust50: 1 }, [candidate()], combos, 'parts').rows[0];
  assert.ok(high.issues.some(issue => issue.code === 'throttle'));
  assert.equal(high.rankable, false);
});

test('SunnySky comparison preserves unknown throttle and can still compare measured power', () => {
  const combo = combos.find(item => item.id === 'sunnysky-v2806-kv650-4s-cn11x45');
  const p = { ...INITIAL, ...comboSettings(combo), totalKg: 2 };
  const row = compareBatteries(p, [candidate()], combos, 'total').rows[0];
  assert.equal(row.canApply, true);
  assert.equal(row.result.throttle, null);
  assert.ok(row.issues.some(issue => issue.code === 'unknownThrottle'));
});

test('physics mode does not recommend an unverified change of motor voltage', () => {
  const row = compareBatteries({ ...INITIAL, motorMethod: 'physics', escMax: 6 }, [candidate({ cells: 6 })], combos, 'parts').rows[0];
  assert.equal(row.canApply, false);
  assert.ok(row.issues.some(issue => issue.code === 'motorVoltage'));
});

test('comparisons never mutate current settings, candidates or manufacturer data', () => {
  const candidates = initialBatteryCandidates(INITIAL);
  const snapshot = structuredClone({ p: INITIAL, candidates, combos });
  compareBatteries(INITIAL, candidates, combos, 'parts');
  assert.deepEqual({ p: INITIAL, candidates, combos }, snapshot);
});
