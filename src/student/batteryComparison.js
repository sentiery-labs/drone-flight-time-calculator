import { estimate } from './estimate.js';
import { summarizeWeight } from './weight.js';

export const MAX_BATTERY_CANDIDATES = 8;

export function initialBatteryCandidates(p) {
  return [
    { id: 'battery-1', name: '후보 1', cells: p.cells, mah: p.mah, batteryKg: p.batteryKg, cRate: p.cRate },
    { id: 'battery-2', name: '후보 2', cells: p.cells, mah: 6000, batteryKg: '', cRate: p.cRate },
    { id: 'battery-3', name: '후보 3', cells: p.cells, mah: 8000, batteryKg: '', cRate: p.cRate },
  ];
}

export function batteryBaseWeight(p, weightMode) {
  if (weightMode === 'parts') return summarizeWeight({ ...p, batteryKg: 0 }, 'parts')?.totalKg ?? null;
  if (weightMode !== 'total' || !Number.isFinite(p.totalKg) || !Number.isFinite(p.batteryKg)
    || p.batteryKg <= 0 || p.totalKg <= p.batteryKg) return null;
  return p.totalKg - p.batteryKg;
}

export function compareBatteries(p, candidates, combos, weightMode) {
  const baseKg = batteryBaseWeight(p, weightMode);
  const current = estimate('multicopter', p, combos, weightMode);
  const rows = candidates.map(candidate => {
    const issues = [];
    const error = (code, text) => issues.push({ code, text, level: 'error' });
    const warning = (code, text) => issues.push({ code, text, level: 'warning' });
    if (!Number.isInteger(candidate.cells) || candidate.cells < 1 || candidate.cells > 14) error('cells', '셀 수 입력 확인');
    if (!Number.isFinite(candidate.mah) || candidate.mah < 100 || candidate.mah > 100000) error('mah', '용량 입력 확인');
    if (!Number.isFinite(candidate.batteryKg) || candidate.batteryKg < .001 || candidate.batteryKg > 10) error('mass', '배터리 실측 무게 필요');
    if (!Number.isFinite(candidate.cRate) || candidate.cRate < 1 || candidate.cRate > 200) error('cRate', '방전률 입력 확인');
    if (baseKg == null) error('baseMass', weightMode === 'total' ? '전체 무게·현재 배터리 무게 확인' : '기체 부품 무게 확인');
    const settings = issues.length ? null : { ...p, cells: candidate.cells, mah: candidate.mah,
      batteryKg: candidate.batteryKg, cRate: candidate.cRate,
      ...(weightMode === 'total' ? { totalKg: Number((baseKg + candidate.batteryKg).toFixed(9)) } : {}) };
    const result = settings ? estimate('multicopter', settings, combos, weightMode) : null;
    if (settings && !result) error('inputs', '기체·모터 입력 확인');
    if (result) {
      if (result.mismatch) error('testVoltage', '모터 시험 전압과 불일치');
      if (settings.cells < p.escMin || settings.cells > p.escMax) error('escVoltage', 'ESC 지원 전압 범위 밖');
      if (!result.thrustSupported) error('thrust', '필요 추력이 추정 범위 초과');
      if (result.motorA > p.escA) error('escCurrent', 'ESC 연속 전류 정격 초과');
      if (result.batteryLoad > 100) error('discharge', '배터리 방전 정격 초과');
      if (p.motorMethod === 'physics' && candidate.cells !== p.cells) error('motorVoltage', '다른 셀 수의 모터 전압 호환성 미확인');
      if (result.hover?.limited === 'low') warning('below', '최저 시험 전력으로 근사');
      if (result.throttle > 60) warning('throttle', `호버 스로틀 ${result.throttle.toFixed(0)}% · 출력 여유 확인`);
      if (result.throttle == null && p.motorMethod === 'catalog') warning('unknownThrottle', '스로틀 자료 없음');
    }
    const canApply = !!result?.supported && !issues.some(issue => issue.level === 'error')
      && Number.isFinite(result.minutes) && result.minutes > 0;
    const rankable = canApply && !issues.some(issue => ['below', 'throttle'].includes(issue.code));
    return { candidate, settings, result, issues, canApply, rankable,
      minutes: canApply ? result.minutes : null,
      deltaMinutes: canApply && current?.supported ? result.minutes - current.minutes : null,
      isCurrent: canApply && candidate.cells === p.cells && candidate.mah === p.mah
        && Math.abs(candidate.batteryKg - p.batteryKg) < 1e-9 && candidate.cRate === p.cRate,
    };
  });
  const ranked = rows.filter(row => row.rankable);
  const best = ranked.length >= 2 ? Math.max(...ranked.map(row => row.minutes)) : null;
  return { baseKg, rows: rows.map(row => ({ ...row, best: best != null && row.rankable && Math.abs(row.minutes - best) < 1e-9 })) };
}
