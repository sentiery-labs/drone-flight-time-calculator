import { useMemo, useState } from "react";
import { Check, CircleAlert, Share2, ShieldCheck } from "lucide-react";
import { buildFlightSummary, submitFlightSummary, summarySignature, telemetryEnabled, wasShared } from "./telemetry";

export default function ShareSummary({ variant, aero, battery, photo, logCal, calc, calcBase }) {
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sharedSig, setSharedSig] = useState("");

  const summary = useMemo(
    () => buildFlightSummary({ variant, aero, battery, photo, logCal, calc, calcBase }),
    [variant, aero, battery, photo, logCal, calc, calcBase]
  );
  const alreadyShared = sharedSig === summarySignature(summary) || wasShared(summary);

  const share = async () => {
    setBusy(true);
    setError("");
    try {
      await submitFlightSummary(summary);
      setSharedSig(summarySignature(summary));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="share-box">
      <div className="share-box-head">
        <ShieldCheck size={14} strokeWidth={2.4} />
        <strong>익명 공유로 기체 DB에 기여</strong>
      </div>
      <p>
        전송 항목: 기체 제원(윙스팬·면적·무게), 배터리 구성, 순항 전력/속도 요약, 예측치.
        <b> 로그 원본 · GPS 좌표 · 비행 시각은 전송되지 않습니다.</b>
      </p>
      {!telemetryEnabled ? (
        <p className="share-disabled">공유 서버 미설정 — docs/BACKEND_SETUP.md 참고 (배포 시 활성화)</p>
      ) : alreadyShared ? (
        <p className="share-done">
          <Check size={13} strokeWidth={2.8} />
          이 비행 요약은 공유되었습니다. 기여 감사합니다!
        </p>
      ) : (
        <>
          <label className="photo-half-toggle">
            <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />
            위 항목을 익명으로 공유하는 데 동의합니다
          </label>
          <button type="button" className="share-button" disabled={!consent || busy} onClick={share}>
            <Share2 size={13} strokeWidth={2.5} />
            {busy ? "전송 중..." : "비행 요약 공유"}
          </button>
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
