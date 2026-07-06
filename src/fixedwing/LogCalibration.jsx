import { useState } from "react";
import { CircleAlert, FileUp, Trash2 } from "lucide-react";
import { analyzeFlightLog } from "./flightlog";

export default function LogCalibration({ cal, onCalChange }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleFile = async e => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const buffer = await file.arrayBuffer();
      const summary = analyzeFlightLog(buffer);
      if (!summary.cruise) {
        setError("순항 구간(수평속도 8m/s 이상 유지)을 찾지 못했습니다. 순항 비행이 포함된 로그를 사용해주세요.");
        onCalChange(null);
        return;
      }
      onCalChange({
        fileName: file.name,
        format: summary.format,
        flightMin: summary.flightMin,
        durationMin: summary.durationMin,
        usedWh: summary.usedWh,
        usedMah: summary.usedMah,
        cruisePowerW: summary.cruise.powerW,
        cruiseSpeedKmh: summary.cruise.speedKmh,
        cruiseSeconds: summary.cruise.seconds,
        enabled: true
      });
    } catch (err) {
      setError(err.message || "로그 파일을 읽지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="photo-measure">
      {!cal ? (
        <label className="photo-upload-box">
          <FileUp size={20} strokeWidth={2} />
          <strong>{busy ? "분석 중..." : "비행 로그 업로드 (.ulg / .bin)"}</strong>
          <span>PX4 ULog 또는 ArduPilot DataFlash 로그를 올리면 순항 전력을 분석해 모델을 보정합니다.</span>
          <input type="file" accept=".ulg,.bin" onChange={handleFile} disabled={busy} />
        </label>
      ) : (
        <>
          <div className="photo-readout">
            <div>
              <span>비행시간</span>
              <strong>{cal.flightMin.toFixed(1)} 분</strong>
            </div>
            <div>
              <span>소모 에너지</span>
              <strong>{cal.usedWh.toFixed(1)} Wh</strong>
            </div>
            <div>
              <span>소모 용량</span>
              <strong>{cal.usedMah != null ? `${cal.usedMah.toFixed(0)} mAh` : "-"}</strong>
            </div>
            <div>
              <span>순항 전력</span>
              <strong>{cal.cruisePowerW.toFixed(0)} W</strong>
            </div>
            <div>
              <span>순항 속도</span>
              <strong>{(cal.cruiseSpeedKmh / 3.6).toFixed(1)} m/s</strong>
            </div>
            <div>
              <span>순항 샘플</span>
              <strong>{(cal.cruiseSeconds / 60).toFixed(1)} 분</strong>
            </div>
          </div>
          <label className="photo-half-toggle">
            <input type="checkbox" checked={cal.enabled}
              onChange={e => onCalChange({ ...cal, enabled: e.target.checked })} />
            이 로그로 모델 보정 적용
          </label>
          <div className="photo-toolbar">
            <span className="logcal-file" title={cal.fileName}>
              {cal.format === "dataflash" ? "AP" : "PX4"} · {cal.fileName}
            </span>
            <label className="photo-refile">
              다른 로그
              <input type="file" accept=".ulg,.bin" onChange={handleFile} disabled={busy} />
            </label>
            <button type="button" onClick={() => onCalChange(null)}>
              <Trash2 size={13} strokeWidth={2.4} /> 삭제
            </button>
          </div>
        </>
      )}
      {error && (
        <p className="logcal-error">
          <CircleAlert size={13} strokeWidth={2.5} />
          {error}
        </p>
      )}
    </div>
  );
}
