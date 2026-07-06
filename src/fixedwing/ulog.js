// 최소 기능 PX4 ULog(.ulg) 파서
// 스펙: https://docs.px4.io/main/en/dev_log/ulog_file_format.html
// 필요한 토픽(배터리, 속도)만 필드 이름 기반으로 디코딩하므로 PX4 버전이 달라도 동작한다.

const ULOG_MAGIC = [0x55, 0x4c, 0x6f, 0x67, 0x01, 0x12, 0x35];

const BASIC_SIZES = {
  int8_t: 1, uint8_t: 1, bool: 1, char: 1,
  int16_t: 2, uint16_t: 2,
  int32_t: 4, uint32_t: 4,
  int64_t: 8, uint64_t: 8,
  float: 4, double: 8
};

// 토픽별로 실제로 읽을 필드만 지정 (성능 + 버전 차이 흡수)
const WANTED_TOPICS = {
  battery_status: ["timestamp", "voltage_v", "voltage_filtered_v", "current_a", "current_filtered_a", "discharged_mah"],
  vehicle_local_position: ["timestamp", "vx", "vy", "vz"],
  vehicle_gps_position: ["timestamp", "vel_n_m_s", "vel_e_m_s", "vel_d_m_s"],
  sensor_gps: ["timestamp", "vel_n_m_s", "vel_e_m_s", "vel_d_m_s"]
};

function parseFormatText(text) {
  const idx = text.indexOf(":");
  const name = text.slice(0, idx);
  const fields = text.slice(idx + 1).split(";").filter(Boolean).map(part => {
    const [typeStr, fieldName] = part.split(" ");
    const m = /^([a-zA-Z0-9_]+)(?:\[(\d+)\])?$/.exec(typeStr);
    return { type: m ? m[1] : typeStr, count: m && m[2] ? +m[2] : 1, name: fieldName };
  });
  return { name, fields };
}

// 중첩 타입까지 펼쳐서 {필드명 -> 바이트 오프셋/타입} 레이아웃 생성
function buildLayout(formats, name, cache) {
  if (cache[name]) return cache[name];
  const fields = formats[name];
  if (!fields) return null;
  const out = [];
  let offset = 0;
  for (const f of fields) {
    const basicSize = BASIC_SIZES[f.type];
    if (basicSize != null) {
      if (!f.name.startsWith("_padding") && f.type !== "char") {
        if (f.count === 1) out.push({ name: f.name, type: f.type, offset });
        else for (let i = 0; i < f.count; i++) out.push({ name: `${f.name}[${i}]`, type: f.type, offset: offset + i * basicSize });
      }
      offset += basicSize * f.count;
    } else {
      const sub = buildLayout(formats, f.type, cache);
      if (!sub) return null;
      for (let i = 0; i < f.count; i++) {
        const prefix = f.count === 1 ? `${f.name}.` : `${f.name}[${i}].`;
        for (const sf of sub.fields) out.push({ name: prefix + sf.name, type: sf.type, offset: offset + sf.offset });
        offset += sub.size;
      }
    }
  }
  const layout = { fields: out, size: offset };
  cache[name] = layout;
  return layout;
}

function readValue(view, base, field) {
  const o = base + field.offset;
  switch (field.type) {
    case "float": return view.getFloat32(o, true);
    case "double": return view.getFloat64(o, true);
    case "uint64_t": return Number(view.getBigUint64(o, true));
    case "int64_t": return Number(view.getBigInt64(o, true));
    case "uint32_t": return view.getUint32(o, true);
    case "int32_t": return view.getInt32(o, true);
    case "uint16_t": return view.getUint16(o, true);
    case "int16_t": return view.getInt16(o, true);
    case "int8_t": return view.getInt8(o);
    default: return view.getUint8(o);
  }
}

export function parseUlogTopics(buffer) {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 16 || ULOG_MAGIC.some((b, i) => bytes[i] !== b)) {
    throw new Error("ULog(.ulg) 파일이 아닙니다.");
  }

  const decoder = new TextDecoder();
  const formats = {};
  const layoutCache = {};
  const subs = new Map(); // msg_id -> { name, layout, picks }
  const topics = {};

  let offset = 16;
  const end = buffer.byteLength;

  while (offset + 3 <= end) {
    const size = view.getUint16(offset, true);
    const type = bytes[offset + 2];
    const p = offset + 3;
    if (p + size > end) break;

    if (type === 0x42) { // 'B' flag bits
      const incompat0 = bytes[p + 8];
      // bit0(데이터 이어붙임)은 일반 메시지로 계속 파싱 가능, 그 외 비트는 미지원
      if ((incompat0 & 0xfe) !== 0) throw new Error("지원하지 않는 ULog 형식 플래그입니다.");
    } else if (type === 0x46) { // 'F' format
      const fmt = parseFormatText(decoder.decode(bytes.subarray(p, p + size)));
      formats[fmt.name] = fmt.fields;
    } else if (type === 0x41) { // 'A' subscribe
      const multiId = bytes[p];
      const msgId = view.getUint16(p + 1, true);
      const name = decoder.decode(bytes.subarray(p + 3, p + size));
      const wanted = WANTED_TOPICS[name];
      if (wanted && multiId === 0) {
        const layout = buildLayout(formats, name, layoutCache);
        if (layout) {
          const picks = layout.fields.filter(f => wanted.includes(f.name));
          subs.set(msgId, { name, picks, maxOffset: Math.max(...picks.map(f => f.offset + BASIC_SIZES[f.type])) });
          if (!topics[name]) topics[name] = [];
        }
      }
    } else if (type === 0x44) { // 'D' data
      const msgId = view.getUint16(p, true);
      const sub = subs.get(msgId);
      if (sub && size - 2 >= sub.maxOffset) {
        const row = {};
        for (const f of sub.picks) row[f.name] = readValue(view, p + 2, f);
        topics[sub.name].push(row);
      }
    }
    // 그 외 메시지(I, M, P, Q, L, C, S, O)는 크기만큼 건너뜀
    offset = p + size;
  }

  return topics;
}

function pickFinite(row, ...keys) {
  for (const key of keys) {
    const v = row[key];
    if (Number.isFinite(v) && v > 0) return v;
  }
  return null;
}

// 공용 요약기(flightlog.js)가 쓰는 표준 행 형태로 변환
// batRows: {t(µs), volt(V), amp(A), mah(누적 소모)} / speedRows: {t, speed(m/s 수평), vz(m/s)}
export function extractUlogRows(buffer) {
  const topics = parseUlogTopics(buffer);
  const bat = topics.battery_status;
  if (!bat || bat.length < 2) throw new Error("로그에서 battery_status 데이터를 찾지 못했습니다.");

  const batRows = bat.map(r => ({
    t: r.timestamp,
    volt: pickFinite(r, "voltage_filtered_v", "voltage_v") ?? 0,
    amp: pickFinite(r, "current_filtered_a", "current_a") ?? 0,
    mah: r.discharged_mah
  }));

  let speedRows = [];
  const local = topics.vehicle_local_position;
  if (local?.length) {
    speedRows = local.map(r => ({
      t: r.timestamp,
      speed: Math.hypot(r.vx, r.vy),
      vz: r.vz
    })).filter(r => Number.isFinite(r.speed));
  } else {
    const gps = topics.vehicle_gps_position?.length ? topics.vehicle_gps_position : topics.sensor_gps;
    if (gps?.length) {
      speedRows = gps.map(r => ({
        t: r.timestamp,
        speed: Math.hypot(r.vel_n_m_s, r.vel_e_m_s),
        vz: r.vel_d_m_s
      })).filter(r => Number.isFinite(r.speed));
    }
  }

  return { batRows, speedRows };
}
