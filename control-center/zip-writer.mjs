import { deflateRawSync, inflateRawSync } from "node:zlib";

const ZIP_LOCAL = 0x04034b50;
const ZIP_CENTRAL = 0x02014b50;
const ZIP_END = 0x06054b50;
const UTF8_FLAG = 0x0800;
const MAX_ZIP_BYTES = 32 * 1024 * 1024;
const MAX_EXPANDED_BYTES = 64 * 1024 * 1024;
const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;

const CRC_TABLE = new Uint32Array(256);
for (let value = 0; value < 256; value += 1) {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  CRC_TABLE[value] = crc >>> 0;
}

export function crc32(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

function fail(message) {
  throw new Error(`ZIP validation failed: ${message}`);
}

function dosTimestamp(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) fail("timestamp is invalid");
  const year = Math.min(2107, Math.max(1980, date.getUTCFullYear()));
  return {
    date: ((year - 1980) << 9) | ((date.getUTCMonth() + 1) << 5) | date.getUTCDate(),
    time: (date.getUTCHours() << 11) | (date.getUTCMinutes() << 5) | Math.floor(date.getUTCSeconds() / 2),
  };
}

function checkedEntries(entries) {
  if (!Array.isArray(entries) || entries.length < 1 || entries.length > 8) fail("entry count is outside 1..8");
  const seen = new Set();
  return entries.map((entry) => {
    if (!entry || typeof entry !== "object" || !SAFE_NAME.test(entry.name) || seen.has(entry.name)) {
      fail("entry name is unsafe or repeated");
    }
    seen.add(entry.name);
    const data = Buffer.isBuffer(entry.bytes) ? entry.bytes : Buffer.from(entry.bytes ?? []);
    if (data.length < 1 || data.length > 64 * 1024 * 1024) fail(`${entry.name} has an invalid size`);
    return { name: entry.name, data };
  });
}

export function createZip(entries, { timestamp = new Date() } = {}) {
  const normalized = checkedEntries(entries);
  const stamp = dosTimestamp(timestamp);
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of normalized) {
    const name = Buffer.from(entry.name, "utf8");
    const deflated = deflateRawSync(entry.data, { level: 9 });
    const compressed = deflated.length < entry.data.length ? deflated : entry.data;
    const method = compressed === deflated ? 8 : 0;
    const crc = crc32(entry.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(ZIP_LOCAL, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(UTF8_FLAG, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(stamp.time, 10);
    local.writeUInt16LE(stamp.date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(ZIP_CENTRAL, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(UTF8_FLAG, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(stamp.time, 12);
    central.writeUInt16LE(stamp.date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(ZIP_END, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(normalized.length, 8);
  end.writeUInt16LE(normalized.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  const archive = Buffer.concat([...localParts, centralDirectory, end]);
  if (archive.length > MAX_ZIP_BYTES) fail("archive exceeds the 32 MiB import limit");
  readZipEntries(archive);
  return archive;
}

function findEnd(bytes) {
  const minimum = Math.max(0, bytes.length - 65_557);
  for (let offset = bytes.length - 22; offset >= minimum; offset -= 1) {
    if (bytes.readUInt32LE(offset) === ZIP_END) return offset;
  }
  fail("end-of-central-directory record is missing");
}

export function readZipEntries(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);
  if (bytes.length < 22 || bytes.length > MAX_ZIP_BYTES) fail("archive size is invalid");
  const endOffset = findEnd(bytes);
  const disk = bytes.readUInt16LE(endOffset + 4);
  const centralDisk = bytes.readUInt16LE(endOffset + 6);
  const count = bytes.readUInt16LE(endOffset + 10);
  const centralSize = bytes.readUInt32LE(endOffset + 12);
  const centralOffset = bytes.readUInt32LE(endOffset + 16);
  const commentLength = bytes.readUInt16LE(endOffset + 20);
  if (disk !== 0 || centralDisk !== 0 || count < 1 || count > 8 || commentLength !== 0) fail("unsupported archive structure");
  if (centralOffset + centralSize !== endOffset) fail("central directory bounds are inconsistent");
  const result = new Map();
  const localRanges = [];
  let expandedBytes = 0;
  let cursor = centralOffset;
  for (let index = 0; index < count; index += 1) {
    if (cursor + 46 > endOffset || bytes.readUInt32LE(cursor) !== ZIP_CENTRAL) fail("central entry is truncated");
    const flags = bytes.readUInt16LE(cursor + 8);
    const method = bytes.readUInt16LE(cursor + 10);
    const crc = bytes.readUInt32LE(cursor + 16);
    const compressedSize = bytes.readUInt32LE(cursor + 20);
    const size = bytes.readUInt32LE(cursor + 24);
    const nameLength = bytes.readUInt16LE(cursor + 28);
    const extraLength = bytes.readUInt16LE(cursor + 30);
    const entryCommentLength = bytes.readUInt16LE(cursor + 32);
    const localOffset = bytes.readUInt32LE(cursor + 42);
    const nameStart = cursor + 46;
    const next = nameStart + nameLength + extraLength + entryCommentLength;
    if (next > endOffset || flags !== UTF8_FLAG || !new Set([0, 8]).has(method)) fail("central entry uses unsupported features");
    const name = bytes.subarray(nameStart, nameStart + nameLength).toString("utf8");
    if (!SAFE_NAME.test(name) || result.has(name)) fail("entry name is unsafe or repeated");
    if (localOffset + 30 > centralOffset || bytes.readUInt32LE(localOffset) !== ZIP_LOCAL) fail("local entry is invalid");
    if (bytes.readUInt16LE(localOffset + 6) !== flags || bytes.readUInt16LE(localOffset + 8) !== method) {
      fail("local and central flags disagree");
    }
    const localNameLength = bytes.readUInt16LE(localOffset + 26);
    const localExtraLength = bytes.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > centralOffset || bytes.subarray(localOffset + 30, localOffset + 30 + localNameLength).toString("utf8") !== name) {
      fail("local entry bounds or name are invalid");
    }
    if (
      bytes.readUInt32LE(localOffset + 14) !== crc
      || bytes.readUInt32LE(localOffset + 18) !== compressedSize
      || bytes.readUInt32LE(localOffset + 22) !== size
    ) fail("local and central entry metadata disagree");
    expandedBytes += size;
    if (!Number.isSafeInteger(expandedBytes) || expandedBytes > MAX_EXPANDED_BYTES) {
      fail("expanded content exceeds the 64 MiB limit");
    }
    for (const range of localRanges) {
      if (localOffset < range.end && dataEnd > range.start) fail("local entry ranges overlap");
    }
    localRanges.push({ start: localOffset, end: dataEnd });
    const compressed = bytes.subarray(dataStart, dataEnd);
    let data;
    try {
      data = method === 8
        ? inflateRawSync(compressed, { maxOutputLength: Math.min(size + 1, MAX_EXPANDED_BYTES + 1) })
        : Buffer.from(compressed);
    } catch (error) {
      fail(`${name} could not be expanded within its declared size: ${error.message}`);
    }
    if (data.length !== size || crc32(data) !== crc) fail(`${name} failed size or CRC verification`);
    result.set(name, data);
    cursor = next;
  }
  if (cursor !== endOffset) fail("central directory contains trailing bytes");
  return result;
}
