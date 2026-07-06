// 최소 기능 ArduPilot DataFlash(.bin) 파서
// 메시지 헤더 0xA3 0x95 + msgId. FMT(0x80) 메시지가 나머지 메시지 구조를 정의하는
// 자기서술형 포맷이라, 필요한 메시지(BAT, GPS)만 컬럼 이름으로 골라 읽는다.

const HEAD0 = 0xa3;
const HEAD1 = 0x95;
const FMT_ID = 0x80;
const FMT_LEN = 89; // 헤더 3 + type 1 + length 1 + name 4 + format 16 + columns 64

const CODE_SIZES = {
  a: 64, b: 1, B: 1, h: 2, H: 2, i: 4, I: 4, f: 4, d: 8,
  n: 4, N: 16, Z: 64, c: 2, C: 2, e: 4, E: 4, L: 4, M: 1, q: 8, Q: 8
};

// 읽을 메시지와 컬럼 (인스턴스 컬럼은 0번만 통과시키기 위해 포함)
const WANTED_MESSAGES = {
  BAT: ["TimeUS", "Inst", "Instance", "Volt", "Curr", "CurrTot"],
  GPS: ["TimeUS", "I", "Spd", "VZ"]
};

function readField(view, o, code) {
  switch (code) {
    case "b": return view.getInt8(o);
    case "B": case "M": return view.getUint8(o);
    case "h": return view.getInt16(o, true);
    case "H": return view.getUint16(o, true);
    case "i": return view.getInt32(o, true);
    case "I": return view.getUint32(o, true);
    case "f": return view.getFloat32(o, true);
    case "d": return view.getFloat64(o, true);
    case "c": return view.getInt16(o, true) / 100;
    case "C": return view.getUint16(o, true) / 100;
    case "e": return view.getInt32(o, true) / 100;
    case "E": return view.getUint32(o, true) / 100;
    case "L": return view.getInt32(o, true) / 1e7;
    case "q": return Number(view.getBigInt64(o, true));
    case "Q": return Number(view.getBigUint64(o, true));
    default: return null; // 문자열/배열(n, N, Z, a)은 사용 안 함
  }
}

function cString(bytes, start, len) {
  let end = start;
  const max = start + len;
  while (end < max && bytes[end] !== 0) end++;
  return String.fromCharCode(...bytes.subarray(start, end)).trim();
}

export function parseDataflash(buffer) {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const end = buffer.byteLength;
  if (end < 3 || bytes[0] !== HEAD0 || bytes[1] !== HEAD1) {
    throw new Error("ArduPilot DataFlash(.bin) 파일이 아닙니다.");
  }

  const defs = {}; // msgId -> { name, length, picks: [{name, code, offset}] }
  const rows = { BAT: [], GPS: [] };
  let offset = 0;

  while (offset + 3 <= end) {
    if (bytes[offset] !== HEAD0 || bytes[offset + 1] !== HEAD1) {
      offset++; // 손상 구간 재동기화
      continue;
    }
    const msgId = bytes[offset + 2];
    const p = offset + 3;

    if (msgId === FMT_ID) {
      if (p + FMT_LEN - 3 > end) break;
      const type = bytes[p];
      const length = bytes[p + 1];
      const name = cString(bytes, p + 2, 4);
      const format = cString(bytes, p + 6, 16);
      const columns = cString(bytes, p + 22, 64).split(",");
      if (length >= 3) {
        // 모든 메시지의 길이를 기억해야 데이터 구간을 빠르게 건너뛸 수 있다
        const picks = [];
        const wanted = WANTED_MESSAGES[name];
        if (wanted) {
          let fieldOffset = 0;
          for (let i = 0; i < format.length; i++) {
            const code = format[i];
            const size = CODE_SIZES[code];
            if (size == null) { picks.length = 0; break; } // 모르는 코드 → 디코딩 포기(스킵은 유지)
            const col = columns[i];
            if (col && wanted.includes(col)) picks.push({ name: col, code, offset: fieldOffset });
            fieldOffset += size;
          }
        }
        defs[type] = { name, length, picks };
      }
      offset += FMT_LEN;
      continue;
    }

    const def = defs[msgId];
    if (!def) {
      // 정의를 모르는 메시지는 길이를 알 수 없음 → 다음 헤더까지 스캔
      offset++;
      continue;
    }
    if (offset + def.length > end) break;
    if (def.picks.length) {
      const row = {};
      for (const f of def.picks) row[f.name] = readField(view, p + f.offset, f.code);
      rows[def.name].push(row);
    }
    offset += def.length;
  }

  return rows;
}

export function extractDataflashRows(buffer) {
  const parsed = parseDataflash(buffer);
  const bat = parsed.BAT.filter(r => (r.Inst ?? r.Instance ?? 0) === 0);
  if (bat.length < 2) throw new Error("로그에서 BAT(배터리) 데이터를 찾지 못했습니다.");

  const batRows = bat.map(r => ({
    t: r.TimeUS,
    volt: Number.isFinite(r.Volt) ? r.Volt : 0,
    amp: Number.isFinite(r.Curr) && r.Curr > 0 ? r.Curr : 0,
    mah: r.CurrTot // ArduPilot CurrTot: 누적 소모 mAh
  }));

  const speedRows = parsed.GPS
    .filter(r => (r.I ?? 0) === 0 && Number.isFinite(r.Spd))
    .map(r => ({
      t: r.TimeUS,
      speed: r.Spd,
      vz: Number.isFinite(r.VZ) ? r.VZ : 0
    }));

  return { batRows, speedRows };
}
