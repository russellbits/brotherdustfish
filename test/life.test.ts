import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALIVE,
  CELL,
  COLS,
  DEAD,
  FADE_MS,
  GAP,
  ROWS,
  ROUNDS,
  gridHeight,
  gridWidth,
  randomGrid,
  step,
  totalMs,
} from '../src/lib/life.ts';

// Patterns are easier to read as rows of characters than as a flat array; `#` is
// alive and `.` is dead.
const fromRows = (rows: string[]): Uint8Array => {
  const cols = rows[0].length;
  const grid = new Uint8Array(rows.length * cols);
  rows.forEach((row, y) => {
    for (let x = 0; x < cols; x++) grid[y * cols + x] = row[x] === '#' ? 1 : 0;
  });
  return grid;
};

const toRows = (grid: Uint8Array, cols: number): string[] => {
  const rows: string[] = [];
  for (let y = 0; y < grid.length / cols; y++) {
    let row = '';
    for (let x = 0; x < cols; x++) row += grid[y * cols + x] ? '#' : '.';
    rows.push(row);
  }
  return rows;
};

// A blinker is the shortest pattern that pins B3/S23: its ends each have one
// neighbour and must die, its middle has two and must survive, and the cells above
// and below that middle have three and must be born. A rule that got any of those
// three counts wrong fails here.
test('a blinker oscillates, which is B3/S23 in one pattern', () => {
  const start = fromRows(['.....', '..#..', '..#..', '..#..', '.....']);

  const once = step(start, 5, 5);
  assert.deepEqual(toRows(once, 5), ['.....', '.....', '.###.', '.....', '.....']);

  const twice = step(once, 5, 5);
  assert.deepEqual(toRows(twice, 5), toRows(start, 5));
});

test('a block is a still life', () => {
  const start = fromRows(['....', '.##.', '.##.', '....']);
  assert.deepEqual(toRows(step(start, 4, 4), 4), toRows(start, 4));
});

test('a lone cell dies of loneliness and a three-neighbour dead cell is born', () => {
  assert.deepEqual(toRows(step(fromRows(['...', '.#.', '...']), 3, 3), 3), ['...', '...', '...']);

  // Exactly three neighbours: the dead centre of a three-cell corner is born.
  const born = step(fromRows(['##.', '#..', '...']), 3, 3);
  assert.equal(born[1 * 3 + 1], 1, 'the dead cell with three neighbours stayed dead');
});

// The wrap is the whole reason a strip this narrow can be interesting: without it
// every pattern touching an edge dies against it. This blinker straddles the
// horizontal seam — cells at x=3, x=0 and x=1 — so it only oscillates if x=3 and
// x=0 count as neighbours, and the middle cell (x=0) only has the two neighbours
// it needs because of the wrap.
test('the grid wraps, so a pattern across the seam still oscillates', () => {
  const start = fromRows(['....', '##.#', '....', '....']);

  // The vertical blinker is the whole assertion: without the wrap, x=0 has a single
  // neighbour and dies, and the pattern goes out entirely.
  assert.deepEqual(toRows(step(start, 4, 4), 4), ['#...', '#...', '#...', '....']);
});

test('randomGrid fills every cell and takes its randomness from the caller', () => {
  const halves = () => 0.5;
  const grid = randomGrid(halves, 4, 4);

  assert.equal(grid.length, 16);
  for (const cell of grid) assert.ok(cell === 0 || cell === 1, `cell was ${cell}`);

  // The default density is below a half, so an RNG pinned just above it must come
  // back empty and one just below it must come back full — which proves the
  // threshold is the density and not a coin flip.
  assert.equal([...randomGrid(() => 0.99, 4, 4)].every((c) => c === 0), true);
  assert.equal([...randomGrid(() => 0.01, 4, 4)].every((c) => c === 1), true);
});

test('a generation is computed from the grid it is given, not in place', () => {
  const start = fromRows(['...', '.#.', '...']);
  const before = [...start];
  step(start, 3, 3);
  assert.deepEqual([...start], before, 'step mutated its input');
});

// ── the shape the reader asked for ───────────────────────────────────────────

test('the grid is taller than it is wide', () => {
  assert.ok(ROWS > COLS, `ROWS ${ROWS} is not greater than COLS ${COLS}`);
});

test('the grid is measured from the cell size, at 32px with a 4px gap', () => {
  assert.equal(CELL, 32);
  assert.equal(GAP, 4);

  assert.equal(gridWidth(), COLS * 32 + (COLS - 1) * 4);
  assert.equal(gridHeight(), ROWS * 32 + (ROWS - 1) * 4);
});

// One fade per round — a cell fades in or out, never both — so the run is
// ROUNDS * FADE_MS. This is the assertion that keeps the total honest if either
// number is touched: 15 rounds of a 1s fade is 15 seconds, not 20.
test('the run lasts one fade per round, and then stops', () => {
  assert.equal(ROUNDS, 15);
  assert.equal(FADE_MS, 1000);
  assert.equal(totalMs(), 15_000);
});

test('the two cell colours are the ones the reader chose', () => {
  assert.equal(DEAD, '#C3B29D');
  assert.equal(ALIVE, '#6F665A');
});
