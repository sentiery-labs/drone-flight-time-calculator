import React from 'react';
import { ArrowUp, Scale } from 'lucide-react';
import { summarizeWeight } from './weight.js';

const LABELS = { airframe: '기체·전자부품', battery: '배터리', motor: '모터', prop: '프로펠러', esc: 'ESC·배선', payload: '추가 탑재물' };

export default function WeightOverview({ settings, weightMode }) {
  const weight = summarizeWeight(settings, weightMode);
  const parts = weightMode === 'parts';
  return <section className="weight-overview" aria-label="무게 구성과 필요한 추력">
    <div className="weight-heading"><h3><Scale size={17} aria-hidden="true" />무게와 필요한 추력</h3><span>{parts ? '부품 합산' : '전체 무게 입력'}</span></div>
    {weight ? <div className="weight-layout">
      <div className="weight-breakdown">
        <div className="weight-total"><span>{parts ? '무게 구성' : '전체 이륙중량'}</span><strong>{weight.totalKg.toFixed(2)} <small>kg</small></strong></div>
        {parts ? <>
          <div className="weight-bar" role="img" aria-label={weight.rows.map(row => `${LABELS[row.id]} ${row.percent.toFixed(1)}%`).join(', ')}>
            {weight.rows.filter(row => row.kg > 0).map(row => <span key={row.id} className={`weight-color-${row.id}`} style={{ width: `${row.percent}%` }} />)}
          </div>
          <dl className="weight-rows">{weight.rows.map(row => <div key={row.id}>
            <dt><span className={`weight-swatch weight-color-${row.id}`} aria-hidden="true" /><span>{LABELS[row.id]}{['motor', 'prop', 'esc'].includes(row.id) && <small> × {row.count}</small>}</span></dt>
            <dd>{(row.kg * 1000).toFixed(0)} <small>g</small></dd><dd className="weight-percent">{row.percent.toFixed(1)}%</dd>
          </div>)}</dl>
        </> : <p className="weight-total-note">배터리·탑재물 포함 전체 무게<br />부품별 비중은 계산하지 않음</p>}
      </div>
      <div className="weight-thrust">
        <div className="weight-thrust-label"><ArrowUp size={17} aria-hidden="true" /><span>모터 1개당 필요한 추력</span></div>
        <div className="weight-thrust-value"><strong>{weight.thrustPerMotorN.toFixed(2)}</strong><span>N</span></div>
        <p className="weight-load">약 <strong>{(weight.loadPerMotorKg * 1000).toFixed(0)} g</strong>의 무게를 지탱</p>
        <div className="weight-equation">{weight.totalKg.toFixed(2)} kg ÷ {weight.rotors}개<br /><strong>= {weight.loadPerMotorKg.toFixed(3)} kg/개</strong></div>
        <p className="weight-assumption">수평 호버링 · 모든 모터가 고르게 분담</p>
      </div>
    </div> : <p className="weight-incomplete">{parts ? '부품 무게와 모터 수 입력이 필요해요.' : '전체 무게와 모터 수 입력이 필요해요.'}</p>}
  </section>;
}
