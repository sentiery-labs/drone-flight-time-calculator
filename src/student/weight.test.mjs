import assert from 'node:assert/strict';
import { test } from 'node:test';
import { estimate, INITIAL } from './estimate.js';
import { summarizeWeight } from './weight.js';

const closeTo = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

test('parts breakdown matches calculator mass and all shares sum to 100%', () => {
  const p = { ...INITIAL, motorMethod: 'physics' };
  const weight = summarizeWeight(p, 'parts');
  closeTo(weight.totalKg, 1.85);
  closeTo(weight.totalKg, estimate('multicopter', p, [], 'parts').weight);
  closeTo(weight.rows.reduce((sum, row) => sum + row.percent, 0), 100);
  closeTo(weight.rows.find(row => row.id === 'motor').kg, .064 * 4);
  closeTo(weight.rows.find(row => row.id === 'esc').kg, .021 * 4);
  closeTo(weight.thrustPerMotorN, 1.85 * 9.81 / 4);
  assert.equal(weight.rows.find(row => row.id === 'payload').percent, 0);
});

test('hexa scales motor, propeller and ESC mass and divides required thrust by six', () => {
  const p = { ...INITIAL, motorMethod: 'physics', rotors: 6, payloadKg: .3 };
  const weight = summarizeWeight(p, 'parts');
  for (const id of ['motor', 'prop', 'esc']) {
    const row = weight.rows.find(row => row.id === id);
    assert.equal(row.count, 6);
    closeTo(row.kg, p[`${id}Kg`] * 6);
  }
  closeTo(weight.totalKg, estimate('multicopter', p, [], 'parts').weight);
  closeTo(weight.loadPerMotorKg, weight.totalKg / 6);
  closeTo(weight.thrustPerMotorN * 6, weight.totalKg * 9.81);
});

test('original summation order is preserved at displayed rounding boundaries', () => {
  const p = { ...INITIAL, airframeKg: 1.18, rotors: 6, motorKg: .12, propKg: .0125, escKg: .045, batteryKg: 1.25 };
  const weight = summarizeWeight(p, 'parts');
  assert.equal(weight.totalKg, p.airframeKg + p.rotors * (p.motorKg + p.propKg + p.escKg) + p.batteryKg + p.payloadKg);
  assert.equal(weight.totalKg.toFixed(2), '3.50');
  assert.equal((weight.loadPerMotorKg * 1000).toFixed(0), '583');
});

test('total mode never invents a breakdown or adds individual masses', () => {
  const p = { ...INITIAL, totalKg: 2.4, batteryKg: 9, payloadKg: 5, propKg: '', escKg: '' };
  const weight = summarizeWeight(p, 'total');
  assert.deepEqual(weight.rows, []);
  assert.equal(weight.totalKg, 2.4);
  closeTo(weight.loadPerMotorKg, .6);
  closeTo(weight.thrustPerMotorN, .6 * 9.81);
});

test('missing or invalid masses never create plausible totals or shares', () => {
  for (const key of ['airframeKg', 'motorKg', 'propKg', 'escKg', 'batteryKg', 'payloadKg']) {
    for (const value of ['', null, NaN, Infinity, -.1]) {
      assert.equal(summarizeWeight({ ...INITIAL, [key]: value }, 'parts'), null);
    }
  }
  for (const rotors of ['', null, 0, -1, 4.5, Infinity]) {
    assert.equal(summarizeWeight({ ...INITIAL, rotors }, 'parts'), null);
    assert.equal(summarizeWeight({ ...INITIAL, rotors }, 'total'), null);
  }
  for (const totalKg of ['', null, 0, -1, Infinity]) {
    assert.equal(summarizeWeight({ ...INITIAL, totalKg }, 'total'), null);
  }
});

test('payload overrides and battery mass update totals without changing settings', () => {
  const snapshot = structuredClone(INITIAL);
  const initial = summarizeWeight(INITIAL, 'parts');
  const added = summarizeWeight(INITIAL, 'parts', .4);
  closeTo(added.totalKg - initial.totalKg, .4);
  closeTo(added.thrustPerMotorN - initial.thrustPerMotorN, .4 * 9.81 / 4);
  const heavier = summarizeWeight({ ...INITIAL, batteryKg: .7 }, 'parts');
  closeTo(heavier.totalKg - initial.totalKg, .2);
  assert.deepEqual(INITIAL, snapshot);
});
