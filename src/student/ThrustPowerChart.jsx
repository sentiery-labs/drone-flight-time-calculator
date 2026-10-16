import React, { useMemo } from 'react';
import { Activity, Info, TriangleAlert } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { buildThrustCurve } from './thrustCurve.js';

const fmt = (value, digits = 1) => Number.isFinite(value) ? value.toFixed(digits) : '--';
const WARNINGS = {
  missing: '선택한 모터의 추력표를 확인해 주세요.',
  invalid: '입력값 확인 필요 · 호버링 지점 계산 대기',
  mismatch: '시험 전압과 배터리 셀 수가 달라 호버링 지점을 표시하지 않음',
  escVoltage: '배터리가 ESC 지원 전압 범위를 벗어나 호버링 지점을 표시하지 않음',
  below: '필요 추력이 시험표 최저점보다 작음 · 시간 계산은 최저 시험 전력으로 근사',
  above: '필요 추력이 계산 범위를 초과함 · 범위 밖 전력은 표시하지 않음',
};

function ThrustTooltip({ active, payload, measured }) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return <div className="thrust-tooltip"><strong>{measured ? '제조사 시험점' : '모델 추정값'}</strong>
    <span>추력 {fmt(row.thrustN, 2)} N</span><span>전력 {fmt(row.powerW)} W</span>
    {Number.isFinite(row.throttle) && <span>시험 스로틀 {fmt(row.throttle, 0)}%</span>}
  </div>;
}

export default function ThrustPowerChart({ settings: p, combos, weightMode, result }) {
  const chart = useMemo(() => buildThrustCurve(p, combos, weightMode, result), [p, combos, weightMode, result]);
  const source = p.motorMethod === 'catalog' ? '제조사 시험표' : p.motorMethod === 'direct' ? '50% 한 점 기반 추정' : '물리 모델 추정';
  const caption = chart.combo
    ? `${chart.combo.makerLabel || chart.combo.maker} ${chart.combo.motor} · ${chart.combo.kv} KV · ${chart.combo.prop} · ${chart.combo.cells}S / ${chart.combo.voltage} V`
    : p.motorMethod === 'catalog' ? '선택한 모터·프로펠러 시험 조건'
      : p.motorMethod === 'direct' ? `시험 ${p.directCells || '--'}S · 프로펠러 ${p.propInch || '--'} inch`
      : `프로펠러 ${p.propInch || '--'} inch · 호버 효율 FM ${p.fm || '--'}`;
  return <section className="thrust-section" aria-label="추력과 소비전력">
    <div className="thrust-heading"><h3><Activity size={17} aria-hidden="true" />추력과 소비전력</h3><span className="source-label">{source}</span></div>
    <p className="thrust-caption">{caption}</p>
    <dl className="thrust-readout"><div><dt>필요 추력 / 모터 1개</dt><dd>{fmt(chart.requiredN, 2)} <small>N</small></dd></div>
      <div><dt>호버 전력 / 모터 1개</dt><dd>{fmt(chart.point?.powerW)} <small>W</small></dd></div>
      <div><dt>전체 소비전력</dt><dd>{fmt(chart.point ? result?.power : null, 0)} <small>W</small></dd></div>
    </dl>
    {chart.rows.length > 0 && <div className="thrust-legend"><span><i className={chart.measured ? 'measured-line' : 'model-line'} />{chart.measured ? '제조사 시험값' : '근사 곡선'}</span>
      <span><i className="hover-dot" />현재 호버링{!chart.point && ' · 계산 대기'}</span>{chart.reference && <span><i className="spec-dot" />50% 입력 스펙</span>}
    </div>}
    {chart.rows.length ? <>
      <div className="thrust-axis-top">모터 1개 전력 (W)</div>
      <div className="thrust-chart-box" role="img" aria-label={`${source}. ${chart.point ? `현재 호버링 추력 ${fmt(chart.point.thrustN, 2)} N, 모터 1개 전력 ${fmt(chart.point.powerW)} W.` : WARNINGS[chart.state]}`}>
        <ResponsiveContainer width="100%" height="100%"><LineChart data={chart.rows} margin={{ top: 14, right: 20, bottom: 12, left: 0 }} accessibilityLayer>
          <CartesianGrid vertical={false} stroke="#e9edf1" strokeDasharray="3 4" />
          <XAxis dataKey="thrustN" type="number" domain={[0, chart.xMax]} tickFormatter={value => fmt(value)} tick={{ fill: '#56616e', fontSize: 12 }} axisLine={false} tickLine={false} minTickGap={28} />
          <YAxis domain={[0, chart.yMax]} tickFormatter={value => fmt(value, 0)} tick={{ fill: '#56616e', fontSize: 12 }} axisLine={false} tickLine={false} width={42} />
          <Tooltip content={<ThrustTooltip measured={chart.measured} />} />
          <Line dataKey="powerW" type="linear" stroke="#356ae6" strokeWidth={2.5} strokeDasharray={chart.measured ? undefined : '5 4'} dot={chart.measured ? { r: 3, strokeWidth: 1.5, fill: '#fff' } : false} activeDot={{ r: 5 }} isAnimationActive={false} connectNulls={false} />
          {chart.requiredN != null && <ReferenceLine x={chart.requiredN} stroke={chart.point ? '#087f75' : '#a3650b'} strokeDasharray="4 4" />}
          {chart.point && <ReferenceLine y={chart.point.powerW} stroke="#087f75" strokeDasharray="4 4" />}
          {chart.reference && <ReferenceDot x={chart.reference.thrustN} y={chart.reference.powerW} r={5} fill="#a3650b" stroke="white" strokeWidth={2} />}
          {chart.point && <ReferenceDot className="current-hover-point" x={chart.point.thrustN} y={chart.point.powerW} r={7} fill="#087f75" stroke="white" strokeWidth={2.5} />}
        </LineChart></ResponsiveContainer>
      </div><div className="thrust-axis-bottom">모터 1개 추력 (N)</div>
    </> : <div className="thrust-empty">{WARNINGS[chart.state] || '그래프를 계산할 수 있는 입력값이 필요해요.'}</div>}
    {WARNINGS[chart.state] && chart.rows.length > 0 && <p className="thrust-warning"><TriangleAlert size={15} aria-hidden="true" /><span>{WARNINGS[chart.state]}</span></p>}
    {chart.rows.length > 0 && <p className="thrust-note"><Info size={14} aria-hidden="true" /><span>{chart.measured
      ? '정지 추력 시험 기준 · 곡선은 시험점 사이 선형 보간 · 실제 비행 검증 전'
      : p.motorMethod === 'direct' ? '단일 스펙으로 계산한 근사 곡선 · 최대 추력 검증 자료 아님' : 'FM 기반 호버링 전력 추정 · 제조사 실측 곡선 아님'}</span></p>}
    {chart.point && <p className="thrust-power-sum">모터 {p.rotors}개 {fmt(chart.point.powerW * p.rotors, 0)} W + 전자장비·탑재물 {fmt(p.avionicsW + p.payloadW, 0)} W</p>}
  </section>;
}
