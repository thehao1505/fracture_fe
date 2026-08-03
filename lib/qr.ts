/**
 * Minimal QR encoder — byte mode, error-correction level M, versions 1–10
 * (enough for any `https://host/username`). Used to render the share-sheet QR
 * as plain SVG on the server, so the feature costs the visitor no JavaScript
 * and the project no dependency.
 *
 * Follows ISO/IEC 18004. Verified module-for-module against the reference
 * `qrcode` implementation for a spread of inputs.
 */

/** Data codewords, block count and EC codewords per block, for level M. */
const VERSIONS = [
  { data: 16, blocks: 1, ec: 10 }, // v1
  { data: 28, blocks: 1, ec: 16 },
  { data: 44, blocks: 1, ec: 26 },
  { data: 64, blocks: 2, ec: 18 },
  { data: 86, blocks: 2, ec: 24 },
  { data: 108, blocks: 4, ec: 16 },
  { data: 124, blocks: 4, ec: 18 },
  { data: 154, blocks: 4, ec: 22 },
  { data: 182, blocks: 5, ec: 22 },
  { data: 216, blocks: 5, ec: 26 }, // v10
];

/** Centre coordinates of the alignment patterns, indexed by version. */
const ALIGNMENT: number[][] = [
  [], // v1 has none
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
];

/** Unused bits after the codeword stream, by version. */
function remainderBits(version: number): number {
  return version >= 2 && version <= 6 ? 7 : 0;
}

// ---------- GF(256) arithmetic (primitive polynomial 0x11d) ----------

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}

function gfMul(a: number, b: number): number {
  return a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]];
}

/** Generator polynomial for `degree` error-correction codewords. */
function generatorPoly(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array<number>(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], EXP[i]);
    }
    poly = next;
  }
  return poly;
}

function errorCorrection(data: number[], ecLength: number): number[] {
  const poly = generatorPoly(ecLength);
  const remainder = new Array<number>(ecLength).fill(0);
  for (const byte of data) {
    const factor = byte ^ remainder[0];
    remainder.shift();
    remainder.push(0);
    if (factor !== 0) {
      for (let i = 0; i < ecLength; i++) {
        remainder[i] ^= gfMul(poly[i + 1], factor);
      }
    }
  }
  return remainder;
}

// ---------- bit stream ----------

class BitBuffer {
  readonly bits: number[] = [];

  put(value: number, length: number) {
    for (let i = length - 1; i >= 0; i--) {
      this.bits.push((value >>> i) & 1);
    }
  }
}

// ---------- matrix ----------

type Grid = (boolean | null)[][];

function placeFinder(grid: Grid, row: number, col: number) {
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const y = row + r;
      const x = col + c;
      if (y < 0 || y >= grid.length || x < 0 || x >= grid.length) continue;
      const onRing = r === 0 || r === 6 || c === 0 || c === 6;
      const inCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      grid[y][x] = (r >= 0 && r <= 6 && c >= 0 && c <= 6 && (onRing || inCore)) as boolean;
    }
  }
}

function placeFunctionPatterns(grid: Grid, version: number) {
  const size = grid.length;

  placeFinder(grid, 0, 0);
  placeFinder(grid, 0, size - 7);
  placeFinder(grid, size - 7, 0);

  // Timing patterns.
  for (let i = 8; i < size - 8; i++) {
    const dark = i % 2 === 0;
    grid[6][i] = dark;
    grid[i][6] = dark;
  }

  // Alignment patterns, skipping the three finder corners.
  const centres = ALIGNMENT[version - 1];
  for (const row of centres) {
    for (const col of centres) {
      const nearFinder =
        (row === 6 && col === 6) ||
        (row === 6 && col === size - 7) ||
        (row === size - 7 && col === 6);
      if (nearFinder) continue;
      for (let r = -2; r <= 2; r++) {
        for (let c = -2; c <= 2; c++) {
          grid[row + r][col + c] =
            Math.max(Math.abs(r), Math.abs(c)) !== 1;
        }
      }
    }
  }

  // Always-dark module above the bottom-left finder.
  grid[size - 8][8] = true;

  // Reserve the format-information strips (filled in after masking).
  for (let i = 0; i < 9; i++) {
    if (grid[8][i] === null) grid[8][i] = false;
    if (grid[i][8] === null) grid[i][8] = false;
  }
  for (let i = 0; i < 8; i++) {
    if (grid[8][size - 1 - i] === null) grid[8][size - 1 - i] = false;
    if (grid[size - 1 - i][8] === null) grid[size - 1 - i][8] = false;
  }

  // Version information (v7+): 3×6 blocks by the top-right and bottom-left.
  if (version >= 7) {
    const bits = versionInfoBits(version);
    for (let i = 0; i < 18; i++) {
      const bit = ((bits >> i) & 1) === 1;
      const row = Math.floor(i / 3);
      const col = size - 11 + (i % 3);
      grid[row][col] = bit;
      grid[col][row] = bit;
    }
  }
}

function versionInfoBits(version: number): number {
  let remainder = version << 12;
  for (let i = 0; i < 12; i++) {
    if (remainder & (1 << (17 - i))) {
      remainder ^= 0x1f25 << (5 - i);
    }
  }
  return (version << 12) | remainder;
}

/** BCH(15,5)-protected format info for level M and the given mask. */
function formatInfoBits(mask: number): number {
  const data = (0b00 << 3) | mask; // level M is 00
  let remainder = data << 10;
  for (let i = 0; i < 5; i++) {
    if (remainder & (1 << (14 - i))) {
      remainder ^= 0x537 << (4 - i);
    }
  }
  return ((data << 10) | remainder) ^ 0x5412;
}

function placeFormatInfo(grid: Grid, mask: number) {
  const size = grid.length;
  const bits = formatInfoBits(mask);
  for (let i = 0; i < 15; i++) {
    const bit = ((bits >> i) & 1) === 1;
    // Copy 1 — around the top-left finder.
    if (i < 6) grid[i][8] = bit;
    else if (i === 6) grid[7][8] = bit;
    else if (i === 7) grid[8][8] = bit;
    else if (i === 8) grid[8][7] = bit;
    else grid[8][14 - i] = bit;
    // Copy 2 — split between the other two finders.
    if (i < 8) grid[8][size - 1 - i] = bit;
    else grid[size - 15 + i][8] = bit;
  }
}

function maskFor(mask: number, row: number, col: number): boolean {
  switch (mask) {
    case 0:
      return (row + col) % 2 === 0;
    case 1:
      return row % 2 === 0;
    case 2:
      return col % 3 === 0;
    case 3:
      return (row + col) % 3 === 0;
    case 4:
      return (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0;
    case 5:
      return ((row * col) % 2) + ((row * col) % 3) === 0;
    case 6:
      return (((row * col) % 2) + ((row * col) % 3)) % 2 === 0;
    default:
      return (((row + col) % 2) + ((row * col) % 3)) % 2 === 0;
  }
}

/** Zigzag placement of the codeword stream, skipping function modules. */
function placeData(grid: Grid, bits: number[]) {
  const size = grid.length;
  let index = 0;
  let upward = true;

  for (let right = size - 1; right >= 1; right -= 2) {
    // Column 6 is the vertical timing pattern — the pairs shift left past it.
    const rightCol = right <= 6 ? right - 1 : right;
    for (let step = 0; step < size; step++) {
      const row = upward ? size - 1 - step : step;
      for (const col of [rightCol, rightCol - 1]) {
        if (grid[row][col] !== null) continue;
        grid[row][col] = index < bits.length && bits[index] === 1;
        index++;
      }
    }
    upward = !upward;
  }
}

// ---------- mask penalties (ISO/IEC 18004 §8.8.2) ----------

function penalty(modules: boolean[][]): number {
  const size = modules.length;
  let score = 0;

  // Rule 1 — runs of five or more same-coloured modules.
  for (let i = 0; i < size; i++) {
    for (const read of [
      (j: number) => modules[i][j],
      (j: number) => modules[j][i],
    ]) {
      let run = 1;
      for (let j = 1; j < size; j++) {
        if (read(j) === read(j - 1)) {
          run++;
        } else {
          if (run >= 5) score += run - 2;
          run = 1;
        }
      }
      if (run >= 5) score += run - 2;
    }
  }

  // Rule 2 — 2×2 blocks of one colour.
  for (let row = 0; row < size - 1; row++) {
    for (let col = 0; col < size - 1; col++) {
      const value = modules[row][col];
      if (
        value === modules[row][col + 1] &&
        value === modules[row + 1][col] &&
        value === modules[row + 1][col + 1]
      ) {
        score += 3;
      }
    }
  }

  // Rule 3 — finder-like 1:1:3:1:1 patterns with four light modules beside.
  const PATTERNS = [
    [true, false, true, true, true, false, true, false, false, false, false],
    [false, false, false, false, true, false, true, true, true, false, true],
  ];
  for (let i = 0; i < size; i++) {
    for (let j = 0; j <= size - 11; j++) {
      for (const pattern of PATTERNS) {
        let rowMatch = true;
        let colMatch = true;
        for (let k = 0; k < 11; k++) {
          if (modules[i][j + k] !== pattern[k]) rowMatch = false;
          if (modules[j + k][i] !== pattern[k]) colMatch = false;
        }
        if (rowMatch) score += 40;
        if (colMatch) score += 40;
      }
    }
  }

  // Rule 4 — deviation from a 50/50 dark/light balance.
  let dark = 0;
  for (const row of modules) for (const value of row) if (value) dark++;
  const percent = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(percent - 50) / 5) * 10;

  return score;
}

export interface QrMatrix {
  size: number;
  modules: boolean[][];
}

/**
 * Encodes `text` as a QR matrix, or returns null when it is too long for
 * version 10 (~213 bytes) — the caller just skips the QR in that case.
 */
export function encodeQr(text: string): QrMatrix | null {
  const bytes = Array.from(new TextEncoder().encode(text));

  const versionIndex = VERSIONS.findIndex((spec, i) => {
    const countBits = i + 1 >= 10 ? 16 : 8;
    return spec.data * 8 - 4 - countBits >= bytes.length * 8;
  });
  if (versionIndex === -1) return null;

  const version = versionIndex + 1;
  const spec = VERSIONS[versionIndex];
  const countBits = version >= 10 ? 16 : 8;

  // Mode indicator, length, payload, terminator, byte padding, pad bytes.
  const buffer = new BitBuffer();
  buffer.put(0b0100, 4);
  buffer.put(bytes.length, countBits);
  for (const byte of bytes) buffer.put(byte, 8);

  const capacity = spec.data * 8;
  buffer.put(0, Math.min(4, capacity - buffer.bits.length));
  while (buffer.bits.length % 8 !== 0) buffer.bits.push(0);

  const codewords: number[] = [];
  for (let i = 0; i < buffer.bits.length; i += 8) {
    let byte = 0;
    for (let b = 0; b < 8; b++) byte = (byte << 1) | buffer.bits[i + b];
    codewords.push(byte);
  }
  for (let i = 0; codewords.length < spec.data; i++) {
    codewords.push(i % 2 === 0 ? 0xec : 0x11);
  }

  // Split into blocks: the longer blocks always come last.
  const shortLength = Math.floor(spec.data / spec.blocks);
  const longBlocks = spec.data % spec.blocks;
  const dataBlocks: number[][] = [];
  const ecBlocks: number[][] = [];
  let offset = 0;
  for (let i = 0; i < spec.blocks; i++) {
    const length = shortLength + (i >= spec.blocks - longBlocks ? 1 : 0);
    const block = codewords.slice(offset, offset + length);
    offset += length;
    dataBlocks.push(block);
    ecBlocks.push(errorCorrection(block, spec.ec));
  }

  // Interleave: data column-wise, then EC column-wise.
  const interleaved: number[] = [];
  for (let i = 0; i < shortLength + 1; i++) {
    for (const block of dataBlocks) if (i < block.length) interleaved.push(block[i]);
  }
  for (let i = 0; i < spec.ec; i++) {
    for (const block of ecBlocks) interleaved.push(block[i]);
  }

  const bits: number[] = [];
  for (const byte of interleaved) {
    for (let i = 7; i >= 0; i--) bits.push((byte >> i) & 1);
  }
  for (let i = 0; i < remainderBits(version); i++) bits.push(0);

  const size = version * 4 + 17;
  const template: Grid = Array.from({ length: size }, () =>
    new Array<boolean | null>(size).fill(null),
  );
  placeFunctionPatterns(template, version);

  // Function modules must not be masked — remember which ones they are.
  const reserved = template.map((row) => row.map((cell) => cell !== null));
  placeData(template, bits);

  let best: boolean[][] | null = null;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const candidate: Grid = template.map((row, r) =>
      row.map((cell, c) =>
        reserved[r][c] ? cell : (cell as boolean) !== maskFor(mask, r, c),
      ),
    );
    placeFormatInfo(candidate, mask);
    const modules = candidate as boolean[][];
    const score = penalty(modules);
    if (score < bestScore) {
      bestScore = score;
      best = modules;
    }
  }

  return { size, modules: best as boolean[][] };
}

/** SVG path data for a matrix, one `M…h1v1h-1z` per dark module. */
export function qrPath({ modules }: QrMatrix): string {
  const parts: string[] = [];
  modules.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) parts.push(`M${x} ${y}h1v1h-1z`);
    });
  });
  return parts.join("");
}
