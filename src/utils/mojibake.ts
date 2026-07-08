let gb18030ReverseMap: Map<string, number[]> | undefined;

const getGb18030ReverseMap = () => {
  if (gb18030ReverseMap) return gb18030ReverseMap;

  const decoder = new TextDecoder("gb18030");
  const nextMap = new Map<string, number[]>();

  for (let lead = 0x81; lead <= 0xfe; lead += 1) {
    for (let trail = 0x40; trail <= 0xfe; trail += 1) {
      if (trail === 0x7f) continue;
      const decoded = decoder.decode(Uint8Array.from([lead, trail]));
      if (!decoded || decoded === "\uFFFD" || Array.from(decoded).length !== 1) {
        continue;
      }
      if (!nextMap.has(decoded)) {
        nextMap.set(decoded, [lead, trail]);
      }
    }
  }

  gb18030ReverseMap = nextMap;
  return gb18030ReverseMap;
};

export const recoverUtf8FromGbkMojibake = (value?: string) => {
  if (!value) return "";

  const reverseMap = getGb18030ReverseMap();
  const bytes: number[] = [];

  for (const char of Array.from(value)) {
    const codePoint = char.codePointAt(0);
    if (codePoint === undefined) return "";
    if (codePoint <= 0x7f) {
      bytes.push(codePoint);
      continue;
    }

    const encodedBytes = reverseMap.get(char);
    if (!encodedBytes) return "";
    bytes.push(...encodedBytes);
  }

  try {
    const recovered = new TextDecoder("utf-8", { fatal: true }).decode(
      Uint8Array.from(bytes),
    );
    return recovered !== value ? recovered : "";
  } catch {
    return "";
  }
};

export const normalizeMojibakeString = (value?: string) =>
  recoverUtf8FromGbkMojibake(value) || value || "";
