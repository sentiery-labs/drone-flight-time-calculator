import React, { useEffect, useId, useMemo, useState } from 'react';
import { Activity, ArrowDownToLine, ArrowRight, Battery, Camera, Check, ChevronDown,
  CircleHelp, Cpu, ExternalLink, FileUp, Info, Plane, Plus, RotateCcw, Save, Scale, Settings2,
  SlidersHorizontal, Trash2, TriangleAlert, X, Zap } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { analyzeFlightLog } from '../fixedwing/flightlog.js';
import PhotoWingMeasure from '../fixedwing/PhotoWingMeasure.jsx';
import catalog from './parts-catalog.json';
import { buildMotorCatalog, comboSettings, compatibleCombos, escSettings, loadCatalogCombos, motorKey, propKey, unique } from './catalog.js';
import { estimate, INITIAL } from './estimate.js';
import logo from '../../sentiery-logo-en.png';
import './student.css';

const ASSET_BASE = import.meta.env.BASE_URL;
const AIRCRAFT = { multicopter: [['x500', 'Holybro X500 V2'], ['quad450', '450급 교육용 쿼드'], ['tarot680', 'Tarot 680 Pro'], ['custom', '직접 입력']],
  fixedwing: [['stork', 'Flightory Stork'], ['stallion', 'Flightory Stallion'], ['custom', '직접 입력']],
  vtol: [['custom', '직접 입력']] };
const MODES = [['multicopter', '멀티콥터', Activity], ['fixedwing', '고정익', Plane], ['vtol', 'VTOL', Zap]];
const WORK = [['calculate', '계산'], ['compare', '조건 비교'], ['validate', '비행 검증']];
const fmt = (value, digits = 1) => Number.isFinite(value) ? value.toFixed(digits) : '--';

function NumberField({ label, unit, value, onChange, min = 0, max = 100000, step = .01, note }) {
  const id = useId();
  const invalid = value === '' || value < min || value > max;
  return <div className="number-field"><label htmlFor={id}>{label}</label>
    <div className={`number-control${invalid ? ' invalid' : ''}`}>
      <input id={id} type="number" inputMode="decimal" min={min} max={max} step={step} value={value}
        aria-invalid={invalid} aria-describedby={invalid || note ? `${id}-note` : undefined}
        onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))} />
      <span>{unit}</span>
    </div>{(invalid || note) && <small id={`${id}-note`} className={invalid ? 'field-error' : ''}>{invalid ? `${min}~${max} 범위의 값 필요` : note}</small>}
  </div>;
}
function SelectField({ label, value, onChange, children, disabled = false }) {
  const id = useId();
  return <div className="select-field"><label htmlFor={id}>{label}</label><div className="select-wrap">
    <select id={id} value={value} disabled={disabled} onChange={e => onChange(e.target.value)}>{children}</select><ChevronDown size={16} aria-hidden="true" /></div></div>;
}
function IconButton({ label, children, ...props }) {
  return <button type="button" className="icon-button" aria-label={label} title={label} {...props}>{children}</button>;
}
function Section({ icon: Icon, title, step, children }) {
  return <section className="input-section"><div className="section-heading"><span className="step-number">{step}</span><h2>{title}</h2><Icon size={18} aria-hidden="true" /></div>{children}</section>;
}

function SourceLink({ url, label = '제조사 자료' }) {
  return url ? <a className="part-source" href={url} target="_blank" rel="noreferrer">{label}<ExternalLink size={13} /></a> : null;
}

function PropulsionFields({ p, setP, combos, field, detail, weightMode, mode }) {
  const models = useMemo(() => buildMotorCatalog(combos), [combos]);
  const combo = combos.find(item => item.id === p.comboId);
  const selectedMotor = models.find(model => model.id === (combo && motorKey(combo)));
  const motorCombos = selectedMotor?.combos || [];
  const propCombos = compatibleCombos(combos, combo, {});
  const makers = unique(models.map(model => model.maker));
  const propMakers = unique(motorCombos.map(item => item.propMaker));
  const props = [...new Map(motorCombos.filter(item => item.propMaker === combo?.propMaker).map(item => [propKey(item), item])).values()];
  const apply = choices => {
    const chosen = choices.find(item => item.cells === p.cells) || choices[0];
    if (chosen) setP(prev => ({ ...prev, ...comboSettings(chosen) }));
  };
  const fifty = combo?.test.find(row => row.throttle === 50);
  return <>
    <SelectField label="계산 자료" value={p.motorMethod} onChange={value => {
      const chosen = combo || combos.find(item => item.cells === p.cells) || combos[0];
      setP(prev => ({ ...prev, motorMethod: value, ...(value === 'catalog' && chosen && chosen.id !== prev.comboId ? comboSettings(chosen) : {}) }));
    }}>
      <option value="catalog">등록 부품 선택</option><option value="direct">50% 제조사 스펙 직접 입력</option><option value="physics">물리 모델 추정</option>
    </SelectField>
    {p.motorMethod === 'catalog' ? <>
      <div className="field-grid part-fields parts-selectors">
        <SelectField label="모터 제조사" value={combo?.maker || ''} disabled={!combos.length} onChange={maker => apply(combos.filter(item => item.maker === maker))}>
          {!combos.length && <option value="">자료 확인 중</option>}{makers.map(maker => <option key={maker} value={maker}>{models.find(item => item.maker === maker)?.makerLabel}</option>)}
        </SelectField>
        <SelectField label="모터 모델" value={selectedMotor?.id || ''} disabled={!combos.length} onChange={id => apply(models.find(model => model.id === id)?.combos || [])}>
          {!combos.length && <option value="">등록 모델 없음</option>}{models.filter(model => model.maker === combo?.maker).map(model => <option key={model.id} value={model.id}>{model.model} · {model.kv} KV</option>)}
        </SelectField>
        <SelectField label="프로펠러 제조사" value={combo?.propMaker || ''} disabled={!combos.length} onChange={maker => apply(motorCombos.filter(item => item.propMaker === maker))}>
          {!combos.length && <option value="">자료 확인 중</option>}{propMakers.map(maker => <option key={maker} value={maker}>{maker === 'Unverified' ? '제조사 미확인' : maker === 'Holybro' ? 'Holybro (키트)' : maker}</option>)}
        </SelectField>
        <SelectField label="프로펠러 모델" value={combo ? propKey(combo) : ''} disabled={!combos.length} onChange={id => apply(compatibleCombos(combos, combo, { propId: id }))}>
          {!combos.length && <option value="">등록 모델 없음</option>}{props.map(item => <option key={propKey(item)} value={propKey(item)}>{item.prop}</option>)}
        </SelectField>
      </div>
      <SelectField label="추력표 시험 조건" value={p.comboId} disabled={!combos.length} onChange={id => apply(combos.filter(item => item.id === id))}>
        {!combos.length && <option value={p.comboId}>자료 확인 중</option>}{propCombos.map(item => <option key={item.id} value={item.id}>{item.cells}S · 시험 {item.voltage} V</option>)}
      </SelectField>
      {combo && <div className="part-facts"><div><span>모터 무게</span><strong>{fmt(combo.motorWeightKg * 1000, 0)} g</strong></div>
        <div><span>{combo.throttleAvailable === false ? '추력표 측정 범위' : '50% 추력 / 전력'}</span><strong>{combo.throttleAvailable === false
          ? `${fmt(combo.test[0].thrustG / 1000 * 9.81, 2)}–${fmt(combo.test.at(-1).thrustG / 1000 * 9.81, 2)} N`
          : fifty ? `${fmt(fifty.thrustG / 1000 * 9.81, 2)} N / ${fmt(fifty.powerW, 0)} W` : '50% 행 미등록'}</strong></div>
        <SourceLink url={combo.sourceUrl} label="추력표 원본" /></div>}
      {combo?.throttleAvailable === false && <p className="part-note">스로틀 % 미제공 · 호버 전력은 추력–전력 표로 보간</p>}
      {combo?.currentLimitSeconds && <p className="part-note">모터 최대 전류 {combo.maxCurrentA} A / {combo.currentLimitSeconds}초 · 제조사 권장 ESC {combo.recommendedEscA} A</p>}
      {combo?.propWeightKg == null && weightMode === 'parts' && !detail && <div className="missing-spec">{field('프로펠러 개당 실측 무게', 'propKg', 'g', { scale: 1000, max: 500, step: .1, note: '제조사 무게 미등록' })}</div>}
    </> : p.motorMethod === 'direct' ? <div className="field-grid part-fields">
      {field('시험 셀 수', 'directCells', 'S', { min: 1, max: 14, step: 1 })}{field('프로펠러 직경', 'propInch', 'inch', { min: 3, max: 30, step: .1 })}
      {field('50% 모터 1개 추력', 'thrust50', 'N', { min: .01, max: 200, step: .1 })}{field('50% 모터 1개 전력', 'power50', 'W', { min: 1, max: 5000, step: 1 })}
    </div> : <div className="field-grid part-fields">{field('프로펠러 직경', 'propInch', 'inch', { min: 3, max: 30, step: .1 })}{field('호버 효율 FM', 'fm', '', { min: .1, max: .8, step: .01 })}</div>}
    {p.motorMethod === 'direct' && <p className="part-note">한 점 스펙 기반 추정 · 실제 추력표와 다를 수 있음</p>}
    {mode !== 'multicopter' && <p className="part-note">정지 추력표 기준 · 순항 전력은 공력·추진 효율 가정값</p>}
    {(detail || p.motorMethod !== 'catalog') && <div className="field-grid part-fields">
      {field('모터 수', 'rotors', '개', { min: 1, max: 12, step: 1 })}{field('모터 개당 무게', 'motorKg', 'g', { scale: 1000, min: 1, max: 2000, step: 1 })}
      {field('프로펠러 개당 무게', 'propKg', 'g', { scale: 1000, max: 500, step: .1 })}
    </div>}
  </>;
}

function EscFields({ p, setP, field, detail }) {
  const selected = catalog.escs.find(esc => esc.id === p.escId);
  const makers = unique(catalog.escs.map(esc => esc.maker));
  const apply = esc => setP(prev => ({ ...prev, ...escSettings(esc) }));
  return <>
    <div className="field-grid parts-selectors"><SelectField label="ESC 제조사" value={selected?.maker || ''} onChange={maker => {
      if (!maker) setP(prev => ({ ...prev, escId: '' })); else apply(catalog.escs.find(esc => esc.maker === maker));
    }}><option value="">직접 입력</option>{makers.map(maker => <option key={maker} value={maker}>{maker === 'Holybro' ? 'Holybro (키트)' : maker}</option>)}</SelectField>
      {selected && <SelectField label="ESC 모델" value={p.escId} onChange={id => apply(catalog.escs.find(esc => esc.id === id))}>
        {catalog.escs.filter(esc => esc.maker === selected.maker).map(esc => <option key={esc.id} value={esc.id}>{esc.model}</option>)}
      </SelectField>}
    </div>
    {selected && <div className="part-facts"><div><span>연속 / 순간 전류</span><strong>{p.escA} A / {p.escPeakA ?? '--'} A</strong></div>
      <div><span>지원 배터리</span><strong>{p.escMin === p.escMax ? p.escMin : `${p.escMin}–${p.escMax}`} S</strong></div>
      <SourceLink url={selected.sourceUrl} /></div>}
    <div className="field-grid part-fields">{field('ESC·배선 개당 무게', 'escKg', 'g', { scale: 1000, max: 1000, step: 1, note: selected?.weightG == null ? '실측값 입력' : '제조사 무게 적용 · 실측 수정 가능' })}
      {(!selected || detail) && field('ESC 연속 전류', 'escA', 'A', { min: 1, max: 300, step: 1 })}
    </div>
    {(!selected || detail) && <div className="field-grid part-fields">{field('최소 지원 셀', 'escMin', 'S', { min: 1, max: 14, step: 1 })}{field('최대 지원 셀', 'escMax', 'S', { min: 1, max: 14, step: 1 })}</div>}
    {selected && <p className="part-note">{selected.note}</p>}
  </>;
}
function Modal({ title, children, onClose }) {
  const ref = React.useRef(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return <dialog ref={ref} className="modal" aria-labelledby={titleId} onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="modal-head"><h2 id={titleId}>{title}</h2><IconButton label="닫기" onClick={onClose}><X size={20} /></IconButton></div>
    <div className="modal-content">{children}</div></dialog>;
}

export default function StudentCalculator() {
  const [mode, setMode] = useState('multicopter');
  const [work, setWork] = useState('calculate');
  const [p, setP] = useState(INITIAL);
  const [detail, setDetail] = useState(false);
  const [weightMode, setWeightMode] = useState('parts');
  const [combos, setCombos] = useState([]);
  const [catalogError, setCatalogError] = useState(false);
  const [baseline, setBaseline] = useState(null);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState('');
  const [log, setLog] = useState(null);
  const [logError, setLogError] = useState('');
  const [source, setSource] = useState('preset');
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (key, value) => setP(prev => ({ ...prev, [key]: value }));
  const field = (label, key, unit, { scale = 1, ...options } = {}) => <NumberField label={label} unit={unit}
    value={p[key] === '' ? '' : p[key] * scale} onChange={v => set(key, v === '' ? '' : v / scale)} {...options} />;
  useEffect(() => {
    let active = true;
    loadCatalogCombos(catalog, ASSET_BASE)
      .then(loaded => { if (active) setCombos(loaded); })
      .catch(() => { if (active) { setCombos([]); setCatalogError(true); } });
    return () => { active = false; };
  }, []);
  useEffect(() => { if (!toast) return; const timeout = setTimeout(() => setToast(''), 2500); return () => clearTimeout(timeout); }, [toast]);
  const result = useMemo(() => estimate(mode, p, combos, weightMode), [mode, p, combos, weightMode]);
  const comparisonResult = result?.supported ? result : null;
  const batteryWh = Number.isFinite(p.cells) && p.cells >= 1 && Number.isFinite(p.mah) && p.mah > 0 ? p.cells * 3.7 * p.mah / 1000 : NaN;
  const combo = p.motorMethod === 'catalog' ? combos.find(c => c.id === p.comboId) : null;
  const aircraftName = AIRCRAFT[mode].find(a => a[0] === p.aircraft)?.[1] || '직접 입력';
  const issues = [];
  if (catalogError && p.motorMethod === 'catalog') issues.push(['warning', '등록 자료를 불러오지 못했어요', '직접 입력 또는 물리 모델 선택 가능', 'motor']);
  if (weightMode === 'parts' && p.propKg === '') issues.push(['warning', '프로펠러 무게 입력이 필요해요', '제조사 미등록 · 개당 실측 무게', 'motor']);
  if (weightMode === 'parts' && p.escKg === '') issues.push(['warning', 'ESC 무게 입력이 필요해요', '제조사 미등록 · 배선 포함 개당 실측 무게', 'esc']);
  if (!result && !issues.length) issues.push(['warning', '입력값을 확인해 주세요', '기체·배터리 입력', 'input']);
  if (result?.mismatch) issues.push(['warning', '배터리와 모터 시험 전압이 달라요', `시험 ${combo?.cells ?? p.directCells}S · 배터리 ${p.cells}S`, 'battery']);
  if (p.cells < p.escMin || p.cells > p.escMax) issues.push(['danger', '배터리 전압이 ESC 지원 범위를 벗어나요', `배터리 ${p.cells}S · ESC ${p.escMin}–${p.escMax}S`, 'esc']);
  if (result && (mode === 'multicopter' ? !result.thrustSupported : mode === 'vtol' && !result.hoverEnergyEnough)) issues.push(['danger', '추정 가능한 범위를 넘었어요', mode === 'multicopter' ? '필요 추력이 시험표 최대값 초과' : '호버·전환 에너지 부족', 'aircraft']);
  if (result?.motorA > p.escA) issues.push(['danger', 'ESC 연속 전류 확인이 필요해요', `${fmt(result.motorA)} A / 정격 ${p.escA} A`, 'esc']);
  if (result?.batteryLoad > 100) issues.push(['danger', '배터리 방전 정격을 넘었어요', `예상 방전부하 ${fmt(result.batteryLoad, 0)}%`, 'battery']);
  if (combo && Math.max(...combo.test.map(row => row.currentA)) > p.escA) issues.push(['warning', '최대 시험 전류가 ESC 연속 정격보다 높아요', `시험 최대 ${fmt(Math.max(...combo.test.map(row => row.currentA)))} A · ESC ${p.escA} A`, 'esc']);
  if (mode === 'multicopter' && result?.hover?.limited === 'low') issues.push(['warning', '필요 추력이 시험표 최저점보다 작아요', '최저 시험 전력을 사용한 근사값', 'motor']);
  if (mode === 'multicopter' && result?.throttle > 60) issues.push(['warning', '호버링에 필요한 출력이 높아요', `예상 스로틀 ${fmt(result.throttle)}%`, 'motor']);
  if (result?.fw?.stallMarginPct < 12) issues.push(['warning', '최장 체공속도의 실속 여유가 작아요', `실속 대비 +${fmt(result.fw.stallMarginPct, 0)}% · 운용속도 별도 확인`, 'aircraft']);
  if (mode !== 'fixedwing' && result && combo?.throttleAvailable === false) issues.push(['warning', '호버 스로틀 여유는 판정할 수 없어요', '제조사 스로틀 % 미제공 · 시간은 추력–전력 표로 추정', 'motor']);
  const issue = issues[0];
  const title = mode === 'multicopter' ? '예상 호버링 시간' : mode === 'fixedwing' ? '예상 순항 체공시간' : '예상 임무 체공시간';
  const curve = useMemo(() => {
    if (!result) return [];
    if (mode !== 'multicopter') return result.fw.curve.filter((_, i) => i % 5 === 0).map(row => ({ x: row.kmh, time: row.enduranceMin }));
    return Array.from({ length: 41 }, (_, i) => {
      const added = i * .05;
      const next = estimate(mode, { ...p, totalKg: p.totalKg + added }, combos, weightMode, p.payloadKg + added);
      return { x: +added.toFixed(2), time: next?.supported ? +next.minutes.toFixed(1) : null };
    });
  }, [result, mode, p, combos, weightMode]);
  const changeAircraft = id => {
    const extra = mode === 'multicopter' ? id === 'quad450'
      ? { airframeKg: .782, rotors: 4, motorKg: .07, propKg: .0125, escId: '', escKg: .037, escA: 35, escMin: 2, escMax: 6, propInch: 9.4, cells: 4, mah: 10000, batteryKg: .8, comboId: '', motorMethod: 'physics' }
      : id === 'tarot680' ? { airframeKg: 1.18, rotors: 6, motorKg: .12, propKg: .0125, escId: '', escKg: .045, escA: 40, escMin: 3, escMax: 6, propInch: 13, cells: 6, mah: 10000, batteryKg: 1.25, comboId: '', motorMethod: 'physics' }
      : id === 'x500' ? { ...INITIAL } : {}
      : id === 'stallion' ? { spanMm: 1800, airframeKg: 1.35, wingArea: .42, batteryKg: 1.08, mah: 21000, totalKg: 3.5 }
      : { spanMm: 1620, airframeKg: 1.12, wingArea: .36, batteryKg: .68, mah: 10000, totalKg: 2.2 };
    setP(prev => ({ ...prev, ...extra, aircraft: id }));
  };
  const changeMode = value => {
    setMode(value); setSource('preset');
    setP(prev => ({ ...prev, aircraft: value === 'multicopter' ? 'x500' : value === 'fixedwing' ? 'stork' : 'custom' }));
    if (value !== 'multicopter') { setWeightMode('total'); setP(prev => ({ ...prev, totalKg: 2.2 })); }
  };
  const saveBaseline = () => { if (!result?.supported) return; setBaseline({ ...result, mode, aircraftName }); setToast('비교 기준으로 저장했어요'); };
  const exportSettings = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ mode, settings: p, weightMode }, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'sentiery-calculator-settings.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const focusInput = id => {
    setWork('calculate'); if (id === 'advanced') setDetail(true);
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  const readLog = async e => {
    const file = e.target.files?.[0]; if (!file) return;
    setBusy(true); setLogError('');
    try { setLog({ name: file.name, ...analyzeFlightLog(await file.arrayBuffer()) }); }
    catch (error) { setLogError(error.message); }
    finally { setBusy(false); e.target.value = ''; }
  };

  return <div className="student-calculator">
    <nav className="calculator-navigation" aria-label="계산기 화면"><span>학생용 계산기</span><a href="./advanced.html">상세 계산기 <ArrowRight size={13} /></a></nav>
    <header className="app-header"><div className="header-inner"><div className="brand"><img src={logo} alt="Sentiery" /><span className="brand-divider" /><h1>비행시간 계산기</h1></div>
      <div className="header-tools"><IconButton label="비교 기준으로 저장" onClick={saveBaseline} disabled={!result?.supported}><Save size={19} /></IconButton>
        <IconButton label="설정 내보내기" onClick={exportSettings}><ArrowDownToLine size={19} /></IconButton>
        <IconButton label="현재 입력 초기화" onClick={() => { setP(INITIAL); setMode('multicopter'); setWeightMode('parts'); setSource('preset'); setPhoto(null); setToast('기본 기체로 초기화했어요'); }}><RotateCcw size={19} /></IconButton>
        <IconButton label="계산 용어" onClick={() => setModal('help')}><CircleHelp size={19} /></IconButton></div></div></header>
    <nav className="aircraft-nav" aria-label="기체 유형"><div className="nav-inner" role="tablist">{MODES.map(([key, label, Icon]) => <button key={key} role="tab" aria-selected={mode === key} className={mode === key ? 'active' : ''} onClick={() => changeMode(key)}><Icon size={18} /><span>{label}</span>{key === 'vtol' && <small>베타</small>}</button>)}</div></nav>
    <main className="workspace"><div className="workspace-heading"><div><div className="eyebrow">{MODES.find(m => m[0] === mode)?.[1]}</div><h2>{aircraftName}</h2></div>
      <nav className="work-tabs" aria-label="작업" role="tablist">{WORK.map(([key, label]) => <button key={key} role="tab" aria-selected={work === key} className={work === key ? 'active' : ''} onClick={() => setWork(key)}>{label}</button>)}</nav></div>
      {work === 'calculate' ? <div className="calculator-layout"><aside className="input-panel" id="input"><div className="input-top"><h2>입력 조건</h2><div className="segmented" aria-label="입력 상세 수준">{[[false, '기본'], [true, '상세']].map(([value, label]) => <button key={label} aria-pressed={detail === value} className={detail === value ? 'active' : ''} onClick={() => setDetail(value)}>{label}</button>)}</div></div>
        <div id="aircraft"><Section title="기체" icon={Scale} step="1"><SelectField label="기체 선택" value={p.aircraft} onChange={changeAircraft}>{AIRCRAFT[mode].map(([id, name]) => <option key={id} value={id}>{name}</option>)}</SelectField>
          {mode !== 'multicopter' && <>{mode === 'fixedwing' && ['stork', 'stallion'].includes(p.aircraft) && <div className="aircraft-photo"><img src={`${ASSET_BASE}aircraft/${p.aircraft}.jpg`} alt={aircraftName} /><span>{aircraftName}</span></div>}
            <SelectField label="날개 정보" value={source} onChange={value => { setSource(value); if (value === 'photo') setModal('photo'); }}><option value="preset">제원 직접 확인</option><option value="photo">사진으로 면적 측정</option></SelectField>
            {source === 'photo' && <button className="text-action" onClick={() => setModal('photo')}><Camera size={16} />{photo ? `${fmt(photo.areaM2, 3)} m² · 측정 사진` : '사진 측정 열기'}</button>}
            <div className="field-grid">{field('날개 폭', 'spanMm', 'mm', { min: 200, max: 6000, step: 10 })}{field('주익 면적', 'wingArea', 'm²', { min: .01, max: 5, step: .005 })}</div></>}
          <div className="weight-selector"><span>무게 기준</span><div className="segmented">{[['parts', '부품 합산'], ['total', '전체 무게']].map(([key, label]) => <button key={key} className={weightMode === key ? 'active' : ''} aria-pressed={weightMode === key} onClick={() => setWeightMode(key)}>{label}</button>)}</div></div>
          {weightMode === 'parts' ? field('기체·전자부품 무게', 'airframeKg', 'kg', { min: .01, max: 30, note: '배터리·모터·ESC·추가 탑재물 제외' }) : field('전체 이륙중량', 'totalKg', 'kg', { min: .1, max: 30, note: '배터리·탑재물 포함 실측값' })}
        </Section></div>
        <div id="motor"><Section title="모터·프로펠러" icon={Zap} step="2">
          <PropulsionFields p={p} setP={setP} combos={combos} field={field} detail={detail} weightMode={weightMode} mode={mode} />
        </Section></div>
        <div id="esc"><Section title="ESC" icon={Cpu} step="3"><EscFields p={p} setP={setP} field={field} detail={detail} /></Section></div>
        <div id="battery"><Section title="배터리" icon={Battery} step="4"><div className="field-grid">{field('셀 수', 'cells', 'S', { min: 1, max: 14, step: 1 })}{field('용량', 'mah', 'mAh', { min: 100, max: 100000, step: 100 })}{field('배터리 무게', 'batteryKg', 'kg', { max: 10 })}{field('남겨둘 잔량', 'reserve', '%', { max: 60, step: 1 })}</div>
          <div className="energy-line"><span>배터리 에너지</span><strong>{fmt(batteryWh)} <small>Wh</small></strong></div>
        </Section></div>
        <Section title="추가 탑재물" icon={Plus} step="5"><div className="field-grid">{field('추가 무게', 'payloadKg', 'kg', { max: 10 })}{field('장비 소비전력', 'payloadW', 'W', { max: 500, step: 1 })}</div></Section>
        {mode === 'vtol' && <Section title="임무 구간" icon={Plane} step="6"><div className="field-grid">{field('이착륙 호버 합계', 'hoverMin', '분', { max: 20, step: .1 })}{field('전환 시간 합계', 'transitionSec', '초', { max: 300, step: 1 })}{field('순항 거리', 'missionKm', 'km', { max: 500, step: 1 })}</div></Section>}
        {detail && <div id="advanced"><Section title="상세 설정" icon={Settings2} step="+"><div className="field-grid">{field('배터리 방전률', 'cRate', 'C', { min: 1, max: 200, step: 1 })}{field('전자장비 전력', 'avionicsW', 'W', { max: 200, step: 1 })}{mode === 'multicopter' && p.motorMethod !== 'physics' ? field('호버 효율 FM', 'fm', '', { min: .1, max: .8, step: .01 }) : mode !== 'multicopter' && <>{field('유해항력 CD₀', 'cd0', '', { min: .01, max: .12, step: .005 })}{field('추진 효율', 'propEff', '', { min: .2, max: .85, step: .05 })}{field('최대양력 CLmax', 'clMax', '', { min: .8, max: 1.8, step: .05 })}</>}</div></Section></div>}
      </aside><section className="result-panel" id="results"><div className="result-top"><span className="section-label">계산 결과</span><span className="source-label"><span className="source-dot" />{result?.sourceLabel || '입력 확인 필요'}</span></div>
        <div className="primary-result"><div className="result-title"><span>{title}</span><button className="help-icon" aria-label="시간 계산 기준" title="시간 계산 기준" onClick={() => setModal('time')}><Info size={16} /></button></div>
          <div className="time-value"><strong>{result?.supported ? fmt(result.minutes) : '--'}</strong><span>분</span></div>
          <div className="result-assumptions"><Battery size={15} /><span>배터리 잔량 {p.reserve || 0}% 제외</span><span className="dot-separator">·</span><span>{mode === 'multicopter' ? '호버링 기준' : '수평 순항 가정'}</span></div></div>
        <div className="secondary-results"><div><span><Scale size={16} />전체 무게</span><strong>{fmt(result?.weight, 2)}<small>kg</small></strong></div><div><span><Zap size={16} />소비전력</span><strong>{fmt(result?.power, 0)}<small>W</small></strong></div><div><span>{mode === 'multicopter' ? <SlidersHorizontal size={16} /> : <Plane size={16} />}{mode === 'multicopter' ? '호버 스로틀' : '계산 대기속도'}</span><strong>{mode === 'multicopter' ? fmt(result?.throttle, 0) : fmt(result?.fw?.endurance.speedKmh, 0)}<small>{mode === 'multicopter' ? (combo?.throttleAvailable === false ? '자료 없음' : '%') : 'km/h'}</small></strong></div></div>
        <div className={`configuration-status ${issue ? issue[0] : 'neutral'}`}>{issue ? <TriangleAlert size={20} /> : <Check size={20} />}<div><strong>{issue?.[1] || '검토 항목에서 충돌이 발견되지 않았어요'}</strong><span>{issue?.[2] || '실제 비행 검증 전 추정값'}</span></div>{issue && <IconButton label="관련 입력으로 이동" onClick={() => focusInput(issue[3])}><ArrowRight size={18} /></IconButton>}</div>
        <section className="chart-section"><div className="chart-heading"><div><h3>{mode === 'multicopter' ? '탑재물과 비행시간' : '대기속도와 체공시간'}</h3><span>{mode === 'multicopter' ? '현재 구성에 무게만 추가' : '동일한 기체·배터리 조건'}</span></div><div className="chart-legend"><span />예상 시간</div></div><div className="chart-box">{curve.length > 0 && <ResponsiveContainer width="100%" height="100%"><AreaChart data={curve} margin={{ top: 16, right: 14, bottom: 10, left: 0 }}><CartesianGrid vertical={false} stroke="#e9edf1" strokeDasharray="3 4" /><XAxis dataKey="x" type="number" tick={{ fill: '#56616e', fontSize: 13 }} axisLine={false} tickLine={false} minTickGap={30} /><YAxis tick={{ fill: '#56616e', fontSize: 13 }} axisLine={false} tickLine={false} width={38} /><Tooltip formatter={value => [`${fmt(value)} 분`, '예상 시간']} labelFormatter={value => `${fmt(Number(value))} ${mode === 'multicopter' ? 'kg 추가' : 'km/h'}`} contentStyle={{ borderRadius: 6, borderColor: '#dde2e7', fontSize: 14 }} /><Area dataKey="time" type="monotone" stroke="#356ae6" fill="#eef3fe" strokeWidth={2.5} isAnimationActive={false} connectNulls={false} />{mode === 'multicopter' && result?.supported && <ReferenceDot x={0} y={result.minutes} r={4} fill="#356ae6" stroke="white" strokeWidth={2} />}</AreaChart></ResponsiveContainer>}</div><div className="chart-axis-labels"><span>시간 (분)</span><span>{mode === 'multicopter' ? '추가 탑재물 무게 (kg)' : '대기속도 (km/h)'}</span></div></section>
        <details className="calculation-details"><summary><Info size={17} /><span>계산 근거와 상세 결과</span><ChevronDown size={17} /></summary><div className="details-content"><dl><div><dt>배터리 전압</dt><dd>{fmt(result?.voltage)} V</dd></div><div><dt>사용 에너지</dt><dd>{fmt(result?.usable)} Wh</dd></div><div><dt>배터리 전류</dt><dd>{fmt(result?.batteryA)} A</dd></div><div><dt>배터리 방전부하</dt><dd>{fmt(result?.batteryLoad, 0)}%</dd></div></dl><p>예상 시간 = 사용 에너지 ÷ 소비전력 × 60</p>{result?.fw && <p>공력 가정: CD₀ {p.cd0}, e {p.oswald}, 추진 효율 {p.propEff} · 주익 {p.wingArea} m²</p>}</div></details>
        <div className="compare-shortcut"><span>현재 구성</span><button className="text-action" disabled={!result?.supported} onClick={() => { saveBaseline(); setWork('compare'); }}><Save size={16} />비교 기준으로 저장<ArrowRight size={16} /></button></div>
      </section></div> : work === 'compare' ? <section className="wide-view"><div className="view-title"><div><span className="eyebrow">조건 비교</span><h2>변경 전후 한눈에 보기</h2></div><button className="outline-button" onClick={saveBaseline} disabled={!result?.supported}><Save size={17} />기준안 저장</button></div>{baseline && baseline.mode === mode ? <>
        {!comparisonResult && <p className="field-error">현재 구성의 입력값·시험 조건 확인 필요</p>}
        <div className="comparison-table"><div className="comparison-row comparison-head"><span>항목</span><span>기준안</span><span>현재 구성</span><span>변화</span></div>
          {[['예상 시간', 'minutes', '분', 1], ['전체 무게', 'weight', 'kg', 2], ['소비전력', 'power', 'W', 0]].map(([name, key, unit, digits]) => <div className="comparison-row" key={key}>
            <strong>{name}</strong><span>{fmt(baseline[key], digits)} {unit}</span><span>{fmt(comparisonResult?.[key], digits)} {unit}</span>
            <span className={key === 'minutes' && comparisonResult?.[key] >= baseline[key] ? 'positive' : ''}>{comparisonResult ? `${comparisonResult[key] >= baseline[key] ? '+' : ''}${fmt(comparisonResult[key] - baseline[key], digits)} ${unit}` : '--'}</span>
          </div>)}
        </div><div className="comparison-battery"><h3>배터리 조건</h3><div className="field-grid">{field('용량', 'mah', 'mAh', { min: 100, max: 100000, step: 100 })}{weightMode === 'parts' ? <>{field('배터리 무게', 'batteryKg', 'kg', { max: 10 })}{field('추가 탑재물', 'payloadKg', 'kg', { max: 10 })}</> : field('전체 이륙중량', 'totalKg', 'kg', { min: .1, max: 30, note: '배터리·탑재물 포함 실측값' })}</div></div>
      </> : <div className="empty-state"><Scale size={36} /><h3>저장된 비교 기준이 없어요</h3><button className="primary-button" onClick={saveBaseline} disabled={!result?.supported}><Save size={17} />현재 구성 저장</button></div>}</section>
        : <section className="wide-view"><div className="view-title"><div><span className="eyebrow">비행 검증</span><h2>실측 기록</h2></div><span className="source-label"><Info size={15} />{log ? '분석 완료 · 보정 전' : '실비행 검증 전'}</span></div><div className="validation-layout"><div><label className="log-upload"><FileUp size={25} /><strong>{busy ? '로그 분석 중' : '비행 로그 추가'}</strong><span>PX4 .ulg / ArduPilot .bin</span><input type="file" accept=".ulg,.bin" onChange={readLog} disabled={busy} /></label>{logError && <p className="field-error" role="alert">{logError}</p>}{log && <><div className="log-file"><span>{log.name}</span><IconButton label="로그 삭제" onClick={() => setLog(null)}><Trash2 size={17} /></IconButton></div><dl className="log-results"><div><dt>기록된 비행시간</dt><dd>{fmt(log.flightMin)} 분</dd></div><div><dt>소모 에너지</dt><dd>{fmt(log.usedWh)} Wh</dd></div><div><dt>순항 평균 전력</dt><dd>{fmt(log.cruise?.powerW, 0)} W</dd></div><div><dt>순항 지상속도</dt><dd>{fmt(log.cruise?.speedKmh, 0)} km/h</dd></div></dl></>}</div><div className="validation-summary"><h3>검증 상태</h3><ol><li><span className={log ? 'done' : ''}>{log ? <Check size={15} /> : '1'}</span><div><strong>실측 기록</strong><small>{log ? '로그 분석 완료' : '미등록'}</small></div></li><li><span>2</span><div><strong>모델 보정</strong><small>직선·선회 구간과 대기속도 확인 필요</small></div></li><li><span>3</span><div><strong>다음 비행 검증</strong><small>미검증</small></div></li></ol></div></div></section>}
    </main><footer><span>© 2026 Sentiery</span><span>UAV Flight Time Calculator</span></footer>
    {work === 'calculate' && <div className="mobile-result"><div><span>{title}</span><strong>{result?.supported ? fmt(result.minutes) : '--'} <small>분</small></strong></div><button aria-label="결과로 이동" onClick={() => document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' })}>결과<ArrowRight size={17} /></button></div>}
    {toast && <div className="toast" role="status"><Check size={17} />{toast}</div>}
    {modal && <Modal title={modal === 'photo' ? '사진으로 날개 면적 측정' : modal === 'time' ? '시간 계산 기준' : '계산 용어'} onClose={() => setModal(null)}>{modal === 'photo' ? <><div className="modal-measure-input">{field('실측 날개 폭', 'spanMm', 'mm', { min: 200, max: 6000, step: 10 })}</div><PhotoWingMeasure wingspanMm={p.spanMm} onApply={data => { setPhoto(data); set('wingArea', data.areaM2); setModal(null); }} /></> : modal === 'time' ? <><p>배터리 에너지에서 남겨둘 잔량을 제외하고, 현재 구성의 예상 소비전력으로 나눈 시간입니다.</p><div className="formula">시간 (분) = 사용 에너지 (Wh) ÷ 전력 (W) × 60</div><p>현재 제외 잔량: {p.reserve}% · 기준: {result?.sourceLabel}</p></> : <dl className="help-definitions"><div><dt>전체 무게</dt><dd>배터리와 탑재물을 포함한 이륙중량입니다.</dd></div><div><dt>소비전력 (W)</dt><dd>기체가 비행하는 동안 배터리에서 사용하는 전력입니다.</dd></div><div><dt>배터리 에너지 (Wh)</dt><dd>전압 (V) × 용량 (Ah)으로 계산합니다.</dd></div><div><dt>호버 스로틀</dt><dd>제자리 비행을 유지하는 데 필요한 추정 모터 출력 명령입니다.</dd></div></dl>}</Modal>}
  </div>;
}
