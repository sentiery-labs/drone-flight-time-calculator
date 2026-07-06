import { useState } from "react";
import { Check, ChevronDown, CircleAlert, Info, TriangleAlert } from "lucide-react";

export const STATUS = {
  danger: { color: "#dc2626", bg: "#fef2f2", soft: "#fee2e2", Icon: TriangleAlert },
  warning: { color: "#b45309", bg: "#fffbeb", soft: "#fef3c7", Icon: CircleAlert },
  ok: { color: "#047857", bg: "#ecfdf5", soft: "#d1fae5", Icon: Check },
  info: { color: "#2563eb", bg: "#eff6ff", soft: "#dbeafe", Icon: Info }
};

export const LEVEL_META = {
  danger: STATUS.danger,
  warning: STATUS.warning,
  ok: STATUS.ok,
  info: STATUS.info
};

export const InputRow = ({ label, unit, value, onChange, min = 0, max = 99999, step = 0.01, width }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
    <span style={{ fontSize: 12, color: "#475569", width: width || 110, flexShrink: 0 }}>{label}</span>
    <input type="number" value={value} min={min} max={max} step={step}
      onChange={e => onChange(+e.target.value)}
      style={{ width: 72, padding: "4px 6px", border: "1px solid #cbd5e1", borderRadius: 6,
        fontSize: 13, textAlign: "right", outline: "none", background: "#f8fafc" }} />
    {unit && <span style={{ fontSize: 11, color: "#94a3b8", width: 40 }}>{unit}</span>}
  </div>
);

export const Sec = ({ title, icon: Icon, children, open: initOpen = true }) => {
  const [open, setOpen] = useState(initOpen);
  return (
    <div className="section-card" style={{ marginBottom: 6, background: "white", borderRadius: 10, border: "1px solid #e2e8f0", overflow: "hidden" }}>
      <button onClick={() => setOpen(!open)}
        style={{ width: "100%", padding: "7px 12px", display: "flex", alignItems: "center", gap: 6,
          background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#1e293b" }}>
        {Icon && <Icon size={15} strokeWidth={2.2} color="#2563eb" style={{ flexShrink: 0 }} />}
        <span style={{ flex: 1, textAlign: "left" }}>{title}</span>
        <ChevronDown size={14} color="#94a3b8" style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "0.2s" }} />
      </button>
      {open && <div style={{ padding: "2px 12px 10px" }}>{children}</div>}
    </div>
  );
};

export const BigNum = ({ label, value, unit, sub, color, border, featured = false }) => (
  <div className={`big-num${featured ? " big-num-featured" : ""}`}
    style={{ background: border ? `linear-gradient(135deg,${color}14,${color}06)` : "white",
    borderRadius: 12, padding: featured ? "16px 18px" : "12px 16px", border: border ? `2px solid ${color}35` : "1px solid #e2e8f0",
    boxShadow: featured ? `0 14px 30px ${color}18` : undefined,
    flex: featured ? 1.25 : 1, minWidth: 0, textAlign: "center" }}>
    <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>{label}</div>
    <div style={{ fontSize: featured ? 44 : 36, fontWeight: 800, color: color || "#0f172a", lineHeight: 1.1,
      fontVariantNumeric: "tabular-nums" }}>{value}</div>
    <div style={{ fontSize: 13, color: color || "#64748b", fontWeight: 500 }}>{unit}</div>
    {sub && <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 3 }}>{sub}</div>}
  </div>
);

export const SmallCard = ({ label, value, unit, className = "" }) => (
  <div className={`small-card${className ? ` ${className}` : ""}`}
    style={{ background: "white", borderRadius: 8, padding: "8px 12px", border: "1px solid #e2e8f0", flex: 1, minWidth: 0 }}>
    <div style={{ fontSize: 10, color: "#94a3b8" }}>{label}</div>
    <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", fontVariantNumeric: "tabular-nums" }}>
      {typeof value === "number" ? value.toFixed(1) : value}<span style={{ fontSize: 11, color: "#94a3b8", marginLeft: 3 }}>{unit}</span>
    </div>
  </div>
);
