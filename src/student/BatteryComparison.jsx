import React, { useMemo } from 'react';
import { ArrowRight, Battery, Check, Info, Plus, Trash2, TriangleAlert } from 'lucide-react';
import { compareBatteries, initialBatteryCandidates, MAX_BATTERY_CANDIDATES } from './batteryComparison.js';

const fmt = (value, digits = 1) => Number.isFinite(value) ? value.toFixed(digits) : '--';

export default function BatteryComparison({ settings: p, combos, weightMode, candidates, setCandidates, onApply, field, NumberField, IconButton }) {
  const list = useMemo(() => candidates ?? initialBatteryCandidates(p), [candidates, p]);
  const comparison = useMemo(() => compareBatteries(p, list, combos, weightMode), [p, list, combos, weightMode]);
  const maxMinutes = Math.max(1, ...comparison.rows.map(row => row.minutes ?? 0));
  const winners = comparison.rows.filter(row => row.best);
  const update = (id, key, value) => setCandidates(list.map(item => item.id === id ? { ...item, [key]: value } : item));
  const add = current => setCandidates([...list, { id: crypto.randomUUID(), name: `후보 ${list.length + 1}`,
    cells: p.cells, mah: current ? p.mah : '', batteryKg: current ? p.batteryKg : '', cRate: p.cRate }]);
  return <section className="battery-comparison" aria-label="배터리 후보 비교">
    <div className="battery-comparison-heading"><div><h2><Battery size={21} aria-hidden="true" />배터리 후보 비교</h2>
      <p>같은 기체·모터·프로펠러·탑재물 · 배터리 잔량 {p.reserve || 0}% 제외</p></div>
      <div className="battery-comparison-tools"><button className="text-action" disabled={list.length >= MAX_BATTERY_CANDIDATES} onClick={() => add(true)}><Battery size={16} />현재 배터리 추가</button>
        <IconButton label="빈 배터리 후보 추가" disabled={list.length >= MAX_BATTERY_CANDIDATES} onClick={() => add(false)}><Plus size={19} /></IconButton></div>
    </div>
    <div className="battery-base"><span>배터리 제외 무게 <strong>{fmt(comparison.baseKg, 2)} kg</strong></span><span>{p.motorMethod === 'catalog' ? '제조사 추력표' : p.motorMethod === 'direct' ? '50% 스펙 추정' : '물리 모델'}</span></div>
    {weightMode === 'total' && <div className="battery-swap-basis">{field('현재 배터리 무게 (교체 기준)', 'batteryKg', 'kg', { min: .001, max: 10, step: .001 })}
      <p>후보 이륙중량 = 현재 전체 무게 − 현재 배터리 무게 + 후보 배터리 무게</p></div>}
    {winners.length > 0 && <div className="battery-winner"><span>후보 중 최장 추정</span><strong>{winners.map(row => row.candidate.name || '이름 없는 후보').join(' · ')} · {fmt(winners[0].minutes)} 분</strong></div>}
    <div className="battery-candidate-head" aria-hidden="true"><span>후보</span><span>배터리 제원</span><span>예상 호버링</span><span>적용·삭제</span></div>
    <div className="battery-candidate-list">{comparison.rows.map((row, index) => {
      const { candidate } = row;
      const name = candidate.name || `후보 ${index + 1}`;
      return <div className={`battery-candidate${row.best ? ' is-best' : ''}`} key={candidate.id} role="group" aria-label={`배터리 후보 ${index + 1}`}>
        <div className="battery-candidate-identity"><input className="battery-name" aria-label={`후보 ${index + 1} 이름`} value={candidate.name} maxLength={40} onChange={e => update(candidate.id, 'name', e.target.value)} />
          <div className="battery-candidate-tags">{row.isCurrent && <span>현재 설정</span>}{row.best && <strong>최장 추정</strong>}</div></div>
        <div className="battery-candidate-specs"><NumberField label="셀 수" unit="S" value={candidate.cells} min={1} max={14} step={1} onChange={value => update(candidate.id, 'cells', value)} />
          <NumberField label="용량" unit="mAh" value={candidate.mah} min={100} max={100000} step={100} onChange={value => update(candidate.id, 'mah', value)} />
          <NumberField label="실측 무게" unit="g" value={candidate.batteryKg === '' ? '' : candidate.batteryKg * 1000} min={1} max={10000} step={1} onChange={value => update(candidate.id, 'batteryKg', value === '' ? '' : value / 1000)} />
          <NumberField label="방전률" unit="C" value={candidate.cRate} min={1} max={200} step={1} onChange={value => update(candidate.id, 'cRate', value)} />
        </div>
        <div className="battery-candidate-result"><div className="battery-candidate-time"><strong>{fmt(row.minutes)}</strong><span>분</span>{row.deltaMinutes != null && Math.abs(row.deltaMinutes) >= .05 && <small>현재 대비 {row.deltaMinutes > 0 ? '+' : ''}{fmt(row.deltaMinutes)}분</small>}</div>
          {row.minutes != null && <><div className="battery-time-bar" aria-hidden="true"><span style={{ width: `${row.minutes / maxMinutes * 100}%` }} /></div>
            <p>{fmt(row.result.weight, 2)} kg · {fmt(row.result.power, 0)} W · {fmt(row.result.wh)} Wh</p></>}
          {row.issues.length > 0 && <ul className="battery-candidate-issues">{row.issues.map(issue => <li key={issue.code} className={issue.level}><TriangleAlert size={13} aria-hidden="true" /><span>{issue.text}</span></li>)}</ul>}
        </div>
        <div className="battery-candidate-actions"><IconButton label={`${name} 적용`} disabled={!row.canApply || row.isCurrent} onClick={() => onApply(row)}>{row.isCurrent ? <Check size={18} /> : <ArrowRight size={18} />}</IconButton>
          <IconButton label={`${name} 삭제`} onClick={() => setCandidates(list.filter(item => item.id !== candidate.id))}><Trash2 size={17} /></IconButton></div>
      </div>;
    })}</div>
    {!list.length && <p className="battery-candidates-empty">비교 후보 없음</p>}
    <p className="battery-comparison-note"><Info size={15} aria-hidden="true" /><span>정지 호버링 추정 · 출력 여유 경고 후보는 최장 추정 선정에서 제외 · 장착·온도·전압강하·열화 미반영</span></p>
  </section>;
}
