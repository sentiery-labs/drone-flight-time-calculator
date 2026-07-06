import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Check, CornerUpLeft, Eraser, RotateCcw, Ruler, Shapes } from "lucide-react";
import { distancePx, polygonAreaPx } from "./aero";

const MAX_CANVAS_W = 1600;

export default function PhotoWingMeasure({ wingspanMm, onApply }) {
  const canvasRef = useRef(null);
  const [image, setImage] = useState(null);
  const [fileName, setFileName] = useState("");
  const [stage, setStage] = useState("scale");
  const [scalePts, setScalePts] = useState([]);
  const [tracePts, setTracePts] = useState([]);
  const [halfTrace, setHalfTrace] = useState(false);
  const [applied, setApplied] = useState(false);

  const handleFile = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => setImage(img);
    img.src = url;
    setFileName(file.name);
    setScalePts([]);
    setTracePts([]);
    setStage("scale");
    setApplied(false);
    e.target.value = "";
  };

  const measured = useMemo(() => {
    if (scalePts.length < 2 || tracePts.length < 3 || !(wingspanMm > 0)) return null;
    const pxPerM = distancePx(scalePts[0], scalePts[1]) / (wingspanMm / 1000);
    if (!(pxPerM > 0)) return null;
    let areaM2 = polygonAreaPx(tracePts) / (pxPerM * pxPerM);
    if (halfTrace) areaM2 *= 2;
    if (!(areaM2 > 0)) return null;
    const wingspanM = wingspanMm / 1000;
    return {
      areaM2,
      meanChordMm: (areaM2 / wingspanM) * 1000,
      ar: (wingspanM * wingspanM) / areaM2
    };
  }, [scalePts, tracePts, wingspanMm, halfTrace]);

  // 캔버스에 사진 + 기준선 + 외곽선 오버레이
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const k = Math.min(1, MAX_CANVAS_W / image.naturalWidth);
    canvas.width = Math.round(image.naturalWidth * k);
    canvas.height = Math.round(image.naturalHeight * k);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const lw = Math.max(2, canvas.width / 420);
    const dot = lw * 2.4;

    if (tracePts.length) {
      ctx.beginPath();
      tracePts.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
      if (tracePts.length >= 3) ctx.closePath();
      ctx.fillStyle = "rgba(34, 211, 238, 0.28)";
      if (tracePts.length >= 3) ctx.fill();
      ctx.strokeStyle = "#06b6d4";
      ctx.lineWidth = lw;
      ctx.stroke();
      ctx.fillStyle = "#0e7490";
      tracePts.forEach(pt => {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, dot, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    if (scalePts.length) {
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = lw * 1.2;
      if (scalePts.length === 2) {
        ctx.beginPath();
        ctx.moveTo(scalePts[0].x, scalePts[0].y);
        ctx.lineTo(scalePts[1].x, scalePts[1].y);
        ctx.stroke();
        const midX = (scalePts[0].x + scalePts[1].x) / 2;
        const midY = (scalePts[0].y + scalePts[1].y) / 2;
        const label = `${(wingspanMm / 1000).toFixed(2)} m`;
        ctx.font = `700 ${Math.max(13, canvas.width / 42)}px Inter, sans-serif`;
        ctx.textAlign = "center";
        ctx.lineWidth = lw * 1.6;
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.strokeText(label, midX, midY - dot * 2);
        ctx.fillStyle = "#b45309";
        ctx.fillText(label, midX, midY - dot * 2);
      }
      ctx.fillStyle = "#d97706";
      scalePts.forEach(pt => {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, dot * 1.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = lw * 0.7;
        ctx.stroke();
      });
    }
  }, [image, scalePts, tracePts, wingspanMm]);

  const onCanvasClick = e => {
    if (!image) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    setApplied(false);
    if (stage === "scale") {
      setScalePts(prev => {
        if (prev.length >= 2) return prev;
        const next = [...prev, { x, y }];
        if (next.length === 2) setStage("trace");
        return next;
      });
    } else {
      setTracePts(prev => [...prev, { x, y }]);
    }
  };

  const undo = () => {
    setApplied(false);
    if (stage === "scale") setScalePts(prev => prev.slice(0, -1));
    else if (tracePts.length) setTracePts(prev => prev.slice(0, -1));
    else {
      setStage("scale");
      setScalePts(prev => prev.slice(0, -1));
    }
  };

  const clearStage = () => {
    setApplied(false);
    if (stage === "scale") setScalePts([]);
    else setTracePts([]);
  };

  const resetAll = () => {
    setScalePts([]);
    setTracePts([]);
    setStage("scale");
    setApplied(false);
  };

  const apply = () => {
    if (!measured) return;
    onApply({ areaM2: measured.areaM2, fileName });
    setApplied(true);
  };

  const hint = !image
    ? "기체를 바로 위에서 찍은 Top view 사진을 올려주세요."
    : stage === "scale"
      ? `사진에서 양쪽 윙팁을 순서대로 클릭하세요. 이 선이 윙스팬 ${(wingspanMm / 1000).toFixed(2)}m 기준이 됩니다. (${scalePts.length}/2)`
      : `주익 외곽선을 따라 클릭하세요. 점 3개부터 면적이 계산됩니다. (${tracePts.length}점)`;

  return (
    <div className="photo-measure">
      {!image ? (
        <label className="photo-upload-box">
          <Camera size={22} strokeWidth={2} />
          <strong>Top view 사진 업로드</strong>
          <span>드론을 수평으로 놓고 정확히 위에서 촬영할수록 정확합니다.</span>
          <input type="file" accept="image/*" onChange={handleFile} />
        </label>
      ) : (
        <>
          <div className="photo-stage-buttons">
            <button type="button" className={stage === "scale" ? "active" : ""} onClick={() => setStage("scale")}>
              <Ruler size={13} strokeWidth={2.4} />
              ① 윙팁 기준선
              {scalePts.length === 2 && <Check size={12} strokeWidth={3} />}
            </button>
            <button type="button" className={stage === "trace" ? "active" : ""} onClick={() => setStage("trace")}
              disabled={scalePts.length < 2}>
              <Shapes size={13} strokeWidth={2.4} />
              ② 날개 외곽선
              {tracePts.length >= 3 && <Check size={12} strokeWidth={3} />}
            </button>
          </div>
          <div className="photo-canvas-wrap">
            <canvas ref={canvasRef} onClick={onCanvasClick} />
          </div>
          <p className="photo-hint">{hint}</p>
          <label className="photo-half-toggle">
            <input type="checkbox" checked={halfTrace} onChange={e => { setHalfTrace(e.target.checked); setApplied(false); }} />
            날개 반쪽만 그렸어요 (면적 ×2)
          </label>
          <div className="photo-toolbar">
            <button type="button" onClick={undo}><CornerUpLeft size={13} strokeWidth={2.4} /> 되돌리기</button>
            <button type="button" onClick={clearStage}><Eraser size={13} strokeWidth={2.4} /> 현재 단계 지우기</button>
            <button type="button" onClick={resetAll}><RotateCcw size={13} strokeWidth={2.4} /> 처음부터</button>
            <label className="photo-refile">
              사진 교체
              <input type="file" accept="image/*" onChange={handleFile} />
            </label>
          </div>
          {measured && (
            <div className="photo-readout">
              <div>
                <span>주익 면적</span>
                <strong>{measured.areaM2.toFixed(3)} m²</strong>
              </div>
              <div>
                <span>평균 시위</span>
                <strong>{measured.meanChordMm.toFixed(0)} mm</strong>
              </div>
              <div>
                <span>가로세로비</span>
                <strong>{measured.ar.toFixed(1)}</strong>
              </div>
              <button type="button" className={`photo-apply${applied ? " done" : ""}`} onClick={apply}>
                <Check size={14} strokeWidth={2.8} />
                {applied ? "적용됨" : "계산에 적용"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
