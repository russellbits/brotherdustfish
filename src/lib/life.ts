/**
 * Conway's Game of Life, as a scene break.
 *
 * The rules are B3/S23 on a torus: a live cell with two or three live neighbours
 * survives, a dead cell with exactly three is born, and neighbours wrap around the
 * edges. The wrap is not a detail — a grid this narrow is otherwise just a place
 * where every pattern touching an edge dies.
 *
 * Every number the ornament has lives here rather than in the component or the
 * stylesheet, so the simulation, the geometry and the timing cannot disagree about
 * them.
 */

/** One cell, in CSS pixels. */
export const CELL = 32;

/** The gap between cells, in CSS pixels. */
export const GAP = 4;

/** Cells across. */
export const COLS = 6;

/** Cells down. Greater than COLS, so the ornament is longer than it is wide. */
export const ROWS = 16;

/** Generations after the seed, after which it stops. */
export const ROUNDS = 15;

/**
 * One fade, in milliseconds. A cell fades in or out — never both — so a round costs
 * exactly this and the whole run lasts ROUNDS * FADE_MS.
 */
export const FADE_MS = 1000;

/** How much of the grid starts alive. */
export const SEED_DENSITY = 0.32;

/** Dead and alive: the colours the reader chose. */
export const DEAD = '#C3B29D';
export const ALIVE = '#6F665A';

/** The ornament's box, measured from the cell size and the gaps between cells. */
export const gridWidth = (): number => COLS * CELL + (COLS - 1) * GAP;
export const gridHeight = (): number => ROWS * CELL + (ROWS - 1) * GAP;

/** How long the whole run takes, which is one fade per round. */
export const totalMs = (): number => ROUNDS * FADE_MS;

/**
 * A fresh grid, alive wherever `random()` falls under the density. Randomness is a
 * parameter so a test can pin it; the page passes nothing and gets `Math.random`.
 */
export function randomGrid(
    random: () => number = Math.random,
    cols: number = COLS,
    rows: number = ROWS,
): Uint8Array {
    const grid = new Uint8Array(cols * rows);
    for (let i = 0; i < grid.length; i++) grid[i] = random() < SEED_DENSITY ? 1 : 0;
    return grid;
}

/** One generation. Returns a new grid, leaving the caller's alone. */
export function step(current: Uint8Array, cols: number, rows: number): Uint8Array {
    const next = new Uint8Array(current.length);

    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            let neighbours = 0;

            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (dx === 0 && dy === 0) continue;
                    // `+ cols` before the modulo, because a negative offset — dx = -1
                    // on the first column — would otherwise index backwards.
                    const nx = (x + dx + cols) % cols;
                    const ny = (y + dy + rows) % rows;
                    neighbours += current[ny * cols + nx];
                }
            }

            const index = y * cols + x;
            if (current[index] === 1) {
                // Survives on two or three; dies of loneliness or crowding.
                next[index] = neighbours === 2 || neighbours === 3 ? 1 : 0;
            } else {
                // Born on exactly three.
                next[index] = neighbours === 3 ? 1 : 0;
            }
        }
    }

    return next;
}
