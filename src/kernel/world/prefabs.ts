export interface PrefabCell {
    col: number
    row: number
    kind: 'not' | 'wire' | 'port'
    /** Component facing (quarter turns clockwise); applies to 'not' cells. */
    rotation?: 0 | 1 | 2 | 3
}

export interface Prefab {
    name: string
    cells: PrefabCell[]
    inputs: { col: number; row: number }[]
    outputs: { col: number; row: number }[]
}

interface Point {
    col: number
    row: number
}

function cellKey(col: number, row: number): string {
    return `${col},${row}`
}

/** Deterministic PRNG (mulberry32) so prefab routing is reproducible per seed. */
function mulberry32(seed: number): () => number {
    let a = seed >>> 0
    return () => {
        a = (a + 0x6d2b79f5) | 0
        let t = Math.imul(a ^ (a >>> 15), 1 | a)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

interface Bounds {
    minCol: number
    minRow: number
    maxCol: number
    maxRow: number
}

function astarRand(
    start: Point,
    goal: Point,
    blocked: Set<string>,
    bounds: Bounds,
    rng: () => number,
    maxExpansions: number
): Point[] | null {
    if (start.col === goal.col && start.row === goal.row) return [start]
    const key = (p: Point) => cellKey(p.col, p.row)
    const h = (p: Point) => Math.abs(p.col - goal.col) + Math.abs(p.row - goal.row)
    const open: Point[] = [start]
    const openIdx = new Map<string, number>()
    const g = new Map<string, number>()
    const f = new Map<string, number>()
    const came = new Map<string, Point>()
    const closed = new Set<string>()
    openIdx.set(key(start), 0)
    g.set(key(start), 0)
    f.set(key(start), h(start))
    let expansions = 0
    while (open.length > 0) {
        if (++expansions > maxExpansions) return null
        let bestIdx = 0
        for (let i = 1; i < open.length; i++) {
            if ((f.get(key(open[i])) ?? Infinity) < (f.get(key(open[bestIdx])) ?? Infinity)) bestIdx = i
        }
        const cur = open[bestIdx]
        if (key(cur) === key(goal)) {
            const path: Point[] = []
            let c: Point | undefined = cur
            while (c) {
                path.push(c)
                c = came.get(key(c))
            }
            return path.reverse()
        }
        const last = open.pop()!
        if (bestIdx < open.length) {
            open[bestIdx] = last
            openIdx.set(key(last), bestIdx)
        }
        openIdx.delete(key(cur))
        closed.add(key(cur))
        const dirs = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).slice()
        for (let i = dirs.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1))
            ;[dirs[i], dirs[j]] = [dirs[j], dirs[i]]
        }
        for (const [dc, dr] of dirs) {
            const n: Point = { col: cur.col + dc, row: cur.row + dr }
            if (n.col < bounds.minCol || n.row < bounds.minRow || n.col > bounds.maxCol || n.row > bounds.maxRow) continue
            const nk = key(n)
            if (closed.has(nk)) continue
            if (blocked.has(nk) && nk !== key(goal)) continue
            const ng = (g.get(key(cur)) ?? 0) + 1
            if (!g.has(nk) || ng < g.get(nk)!) {
                g.set(nk, ng)
                f.set(nk, ng + h(n) + rng() * 0.04)
                came.set(nk, cur)
                if (openIdx.has(nk)) {
                    open[openIdx.get(nk)!] = n
                } else {
                    openIdx.set(nk, open.length)
                    open.push(n)
                }
            }
        }
    }
    return null
}

function routeChain(
    terminals: Point[],
    blocked: Set<string>,
    bounds: Bounds,
    rng: () => number,
    maxExpansions: number
): Point[] | null {
    const points: Point[] = []
    for (let i = 0; i < terminals.length - 1; i++) {
        const seg = astarRand(terminals[i], terminals[i + 1], blocked, bounds, rng, maxExpansions)
        if (!seg) return null
        if (i === 0) points.push(...seg)
        else points.push(...seg.slice(1))
    }
    return points
}

/**
 * Sequential maze routing with rip-up-and-reroute: when a net cannot be routed,
 * the most overlapping already-routed net is removed, the current net is routed,
 * and the removed net is re-routed later. A per-seed iteration cap plus random
 * A* jitter lets the search escape deadlocks across seeds.
 */
function routeNetlist(
    netDefs: Record<string, Point[]>,
    order: string[],
    bounds: Bounds,
    allCells: Set<string>,
    cellKinds: Map<string, PrefabCell['kind']>,
    rng: () => number,
    maxIterations: number
): Map<string, Point[]> | null {
    const routed = new Map<string, Point[]>()
    const pending: string[] = [...order].sort(() => rng() - 0.5)
    let iterations = 0

    const computeBlocked = (name: string, terminals: Point[]): Set<string> => {
        const blocked = new Set<string>(allCells)
        const own = new Set<string>(terminals.map((t) => cellKey(t.col, t.row)))
        for (const t of allCells) {
            if (own.has(t)) continue
            const [c, r] = t.split(',').map(Number)
            if (cellKinds.get(t) === 'not') {
                // Components only connect through pin edges (NOT: left/right).
                blocked.add(cellKey(c - 1, r))
                blocked.add(cellKey(c + 1, r))
            } else {
                for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
                    blocked.add(cellKey(c + dc, r + dr))
                }
            }
        }
        for (const [name2, path] of routed) {
            if (name2 === name) continue
            for (const p of path) {
                blocked.add(cellKey(p.col, p.row))
                for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
                    blocked.add(cellKey(p.col + dc, p.row + dr))
                }
            }
        }
        return blocked
    }

    const tryRoute = (name: string): Point[] | null => {
        const terminals = netDefs[name]
        const blocked = computeBlocked(name, terminals)
        return routeChain(terminals, blocked, bounds, rng, 12000)
    }

    const bboxOf = (pts: Point[]): Bounds => ({
        minCol: Math.min(...pts.map((p) => p.col)),
        maxCol: Math.max(...pts.map((p) => p.col)),
        minRow: Math.min(...pts.map((p) => p.row)),
        maxRow: Math.max(...pts.map((p) => p.row)),
    })
    const overlap = (a: Bounds, b: Bounds): number =>
        Math.max(0, Math.min(a.maxCol, b.maxCol) - Math.max(a.minCol, b.minCol) + 1) *
        Math.max(0, Math.min(a.maxRow, b.maxRow) - Math.max(a.minRow, b.minRow) + 1)

    while (pending.length > 0) {
        if (++iterations > maxIterations) return null
        const name = pending.shift()!
        let path = tryRoute(name)
        if (path) {
            routed.set(name, path)
            continue
        }
        const currentBBox = bboxOf(netDefs[name])
        const candidates = [...routed.keys()].sort(
            (x, y) =>
                overlap(bboxOf(netDefs[y]), currentBBox) - overlap(bboxOf(netDefs[x]), currentBBox) ||
                x.localeCompare(y)
        )
        let ripped = false
        for (const other of candidates.slice(0, 3)) {
            const otherPath = routed.get(other)!
            routed.delete(other)
            path = tryRoute(name)
            if (path) {
                routed.set(name, path)
                pending.unshift(other)
                ripped = true
                break
            }
            routed.set(other, otherPath)
        }
        if (!ripped && candidates.length >= 2) {
            for (let i = 0; i < candidates.length && !ripped; i++) {
                for (let j = i + 1; j < candidates.length && !ripped; j++) {
                    const a = candidates[i]
                    const b = candidates[j]
                    const pa = routed.get(a)!
                    const pb = routed.get(b)!
                    routed.delete(a)
                    routed.delete(b)
                    path = tryRoute(name)
                    if (path) {
                        routed.set(name, path)
                        pending.unshift(a, b)
                        ripped = true
                    } else {
                        routed.set(a, pa)
                        routed.set(b, pb)
                    }
                }
            }
        }
        if (!ripped) throw new Error(`XOR route failed for net ${name}`)
    }
    return routed
}

/**
 * Parse an ASCII map into a prefab.
 * 'N' = NOT block, 'W' = wire, 'I' = input port (wire), 'O' = output port (wire), '.' or ' ' = empty.
 */
function fromAscii(rows: string[]): Prefab {
    const cells: PrefabCell[] = []
    const inputs: { col: number; row: number }[] = []
    const outputs: { col: number; row: number }[] = []
    rows.forEach((line, row) => {
        for (let col = 0; col < line.length; col++) {
            const ch = line[col]
            if (ch === ' ') continue
            if (ch === 'N') {
                cells.push({ col, row, kind: 'not' })
            } else if (ch === 'W') {
                cells.push({ col, row, kind: 'wire' })
            } else if (ch === 'I') {
                cells.push({ col, row, kind: 'port' })
                inputs.push({ col, row })
            } else if (ch === 'O') {
                cells.push({ col, row, kind: 'port' })
                outputs.push({ col, row })
            }
        }
    })
    return { name: '', cells, inputs, outputs }
}

export const NAND_PREFAB: Prefab = fromAscii([
    'INW.',
    '..WO',
    'INW.',
])

/** Single NOT as a prefab: input port (0,0), NOT (1,0), output port (2,0). */
export const NOT_PREFAB: Prefab = fromAscii(['INO'])

export const AND_PREFAB: Prefab = fromAscii([
    'INW..',
    '..WNO',
    'INW..',
])

export const OR_PREFAB: Prefab = fromAscii([
    'INNW.',
    '...WO',
    'INNW.',
])

// Wide NAND (square 5x5): inputs 4 rows apart so each port has its own exit
// lane (top port exits up, bottom port exits down). Square so 90-degree
// rotation preserves 4-connectivity of the internal merge column.
export const WIDE_NAND_PREFAB: Prefab = fromAscii([
    'INW..',
    '..W..',
    '..WO.',
    '..W..',
    'INW..',
])

function rotatePoint(col: number, row: number, w: number, h: number, rotation: 0 | 1 | 2 | 3): { col: number; row: number } {
    switch (rotation) {
        case 1:
            return { col: h - 1 - row, row: col }
        case 2:
            return { col: w - 1 - col, row: h - 1 - row }
        case 3:
            return { col: row, row: w - 1 - col }
        default:
            return { col, row }
    }
}

/** Rotate a prefab 90° CW `rotation` times; NOTs rotate with it. */
export function rotatePrefab(prefab: Prefab, rotation: 0 | 1 | 2 | 3): Prefab {
    if (rotation === 0) return prefab
    const width = Math.max(...prefab.cells.map((c) => c.col)) + 1
    const height = Math.max(...prefab.cells.map((c) => c.row)) + 1
    const cells: PrefabCell[] = prefab.cells.map((cell) => {
        const p = rotatePoint(cell.col, cell.row, width, height, rotation)
        return {
            col: p.col,
            row: p.row,
            kind: cell.kind,
            rotation: cell.kind === 'not' ? (((cell.rotation ?? 0) + rotation) % 4) as 0 | 1 | 2 | 3 : undefined,
        }
    })
    const inputs = prefab.inputs.map((t) => rotatePoint(t.col, t.row, width, height, rotation))
    const outputs = prefab.outputs.map((t) => rotatePoint(t.col, t.row, width, height, rotation))
    return { name: prefab.name, cells, inputs, outputs }
}

// XOR = NAND(NAND(a, NAND(a,b)), NAND(b, NAND(a,b))) — 4 verified NAND prefabs
// composed together; an A* router wires the 6 short inter-prefab nets with >=1
// empty cell clearance (adjacent wire cells merge, so nets must never touch).
function placePrefab(cells: PrefabCell[], prefab: Prefab, ox: number, oy: number): void {
    for (const cell of prefab.cells) {
        cells.push({
            col: cell.col + ox,
            row: cell.row + oy,
            kind: cell.kind,
            rotation: cell.rotation,
        })
    }
}

interface NandPlacement {
    ox: number
    oy: number
    rotation: 0 | 1 | 2 | 3
}

function buildXorWithPlacements(
    nand: Prefab,
    placements: NandPlacement[],
    order: string[],
    rng: () => number
): Prefab {
    const cells: PrefabCell[] = []
    const add = (col: number, row: number, kind: PrefabCell['kind']) => cells.push({ col, row, kind })

    const placed = placements.map((p) => ({
        ...p,
        prefab: rotatePrefab(nand, p.rotation),
    }))
    const [p1, p2, p3, p4] = placed
    for (const p of placed) placePrefab(cells, p.prefab, p.ox, p.oy)

    const pt = (p: NandPlacement & { prefab: Prefab }, cell: { col: number; row: number }): Point => ({
        col: p.ox + cell.col,
        row: p.oy + cell.row,
    })
    const in0 = (p: NandPlacement & { prefab: Prefab }) => pt(p, p.prefab.inputs[0])
    const in1 = (p: NandPlacement & { prefab: Prefab }) => pt(p, p.prefab.inputs[1])
    const out0 = (p: NandPlacement & { prefab: Prefab }) => pt(p, p.prefab.outputs[0])

    const outPort = { col: Math.max(...placements.map((p) => p.ox)) + 20, row: 1 }
    add(outPort.col, outPort.row, 'port')

    const nets: Record<string, Point[]> = {
        a: [in0(p1), in0(p2)],
        b: [in1(p1), in0(p3)],
        X: [out0(p1), in1(p2), in1(p3)],
        Y1: [out0(p2), in0(p4)],
        Y2: [out0(p3), in1(p4)],
        OUT: [out0(p4), outPort],
    }

    const allTerminalAndComp = new Set<string>()
    const cellKinds = new Map<string, PrefabCell['kind']>()
    for (const cell of cells) allTerminalAndComp.add(cellKey(cell.col, cell.row))
    for (const cell of cells) cellKinds.set(cellKey(cell.col, cell.row), cell.kind)
    for (const net of Object.values(nets)) {
        for (const t of net) {
            const k = cellKey(t.col, t.row)
            allTerminalAndComp.add(k)
            if (!cellKinds.has(k)) cellKinds.set(k, 'port')
        }
    }

    const allTerminals = Object.values(nets).flat()
    const bounds: Bounds = {
        minCol: Math.min(...allTerminals.map((t) => t.col)) - 8,
        maxCol: Math.max(...allTerminals.map((t) => t.col), outPort.col) + 8,
        minRow: Math.min(...allTerminals.map((t) => t.row)) - 8,
        maxRow: Math.max(...allTerminals.map((t) => t.row)) + 8,
    }
    const routed = routeNetlist(nets, order, bounds, allTerminalAndComp, cellKinds, rng, 80)
    if (!routed) throw new Error('XOR route failed')
    for (const path of routed.values()) {
        for (const p of path) {
            const k = cellKey(p.col, p.row)
            if (!allTerminalAndComp.has(k)) add(p.col, p.row, 'wire')
        }
    }

    return {
        name: 'Xor',
        cells,
        inputs: [in0(p1), in1(p1)],
        outputs: [outPort],
    }
}

export function buildXorVariant(ox2: number, oy2: number, ox3: number, oy3: number, ox4: number, oy4: number, order: string[], seed = 0): Prefab {
    return buildXorWithPlacements(
        NAND_PREFAB,
        [
            { ox: 0, oy: 0, rotation: 0 },
            { ox: ox2, oy: oy2, rotation: 0 },
            { ox: ox3, oy: oy3, rotation: 0 },
            { ox: ox4, oy: oy4, rotation: 0 },
        ],
        order,
        mulberry32(seed)
    )
}

export function buildXorVariantWide(ox2: number, oy2: number, ox3: number, oy3: number, ox4: number, oy4: number, order: string[], seed = 0): Prefab {
    return buildXorWithPlacements(
        WIDE_NAND_PREFAB,
        [
            { ox: 0, oy: 0, rotation: 0 },
            { ox: ox2, oy: oy2, rotation: 0 },
            { ox: ox3, oy: oy3, rotation: 0 },
            { ox: ox4, oy: oy4, rotation: 0 },
        ],
        order,
        mulberry32(seed)
    )
}

export function buildXorRotated(placements: NandPlacement[], order: string[], seed = 0): Prefab {
    return buildXorWithPlacements(WIDE_NAND_PREFAB, placements, order, mulberry32(seed))
}

interface PlacedPart {
    prefab: Prefab
    ox: number
    oy: number
    rotation?: 0 | 1 | 2 | 3
}

/**
 * Generic prefab composer: place verified prefabs at offsets, then route the
 * given nets with the seeded A* + rip-up router.
 */
export function composePrefab(
    parts: PlacedPart[],
    nets: Record<string, Point[]>,
    order: string[],
    seed: number
): Prefab {
    const cells: PrefabCell[] = []
    const add = (col: number, row: number, kind: PrefabCell['kind']) => cells.push({ col, row, kind })
    const placed = parts.map((p) => ({ ...p, prefab: rotatePrefab(p.prefab, p.rotation ?? 0) }))
    for (const p of placed) placePrefab(cells, p.prefab, p.ox, p.oy)

    const allTerminalAndComp = new Set<string>()
    const cellKinds = new Map<string, PrefabCell['kind']>()
    for (const cell of cells) allTerminalAndComp.add(cellKey(cell.col, cell.row))
    for (const cell of cells) cellKinds.set(cellKey(cell.col, cell.row), cell.kind)
    for (const net of Object.values(nets)) {
        for (const t of net) {
            const k = cellKey(t.col, t.row)
            allTerminalAndComp.add(k)
            if (!cellKinds.has(k)) cellKinds.set(k, 'port')
        }
    }

    const allTerminals = Object.values(nets).flat()
    const bounds: Bounds = {
        minCol: Math.min(...allTerminals.map((t) => t.col)) - 8,
        maxCol: Math.max(...allTerminals.map((t) => t.col)) + 8,
        minRow: Math.min(...allTerminals.map((t) => t.row)) - 8,
        maxRow: Math.max(...allTerminals.map((t) => t.row)) + 8,
    }
    const routed = routeNetlist(nets, order, bounds, allTerminalAndComp, cellKinds, mulberry32(seed), 300)
    if (!routed) throw new Error('composePrefab: routing failed')
    for (const path of routed.values()) {
        for (const p of path) {
            const k = cellKey(p.col, p.row)
            if (!allTerminalAndComp.has(k)) add(p.col, p.row, 'wire')
        }
    }
    return { name: 'Composite', cells, inputs: [], outputs: [] }
}

/**
 * Hand-routed XOR (4 square wide NANDs, channel layout, no crossings):
 *
 *   N1 rot3 at (10,30): a/b enter from below, X exits upward.
 *   N2 rot1 at (10,0) and N3 rot1 at (10,60) stacked above/below;
 *   N4 rot0 at (10,90).
 *
 * Channels (each net owns its lanes):
 *   a:  col 6 up, row -8 east, col 14 down        -> N2.in0
 *   b:  col 14 straight down                       -> N3.in0
 *   X:  col 12 up -> row -6 west -> col 10 down   -> N2.in1
 *       col 12 down                               -> N3.in1
 *   Y1: row 3 east, col 16 down, row 88 west      -> N4.in0
 *   Y2: row 63 east, col 18 down, col 17 down,
 *       row 96 west, col 9 up                     -> N4.in1
 *   OUT: N4.out (13,92) -> port (14,92)
 */
export const XOR_PREFAB: Prefab = (() => {
    const cells: PrefabCell[] = []
    const w = (col: number, row: number) => cells.push({ col, row, kind: 'wire' })
    const p = (col: number, row: number) => cells.push({ col, row, kind: 'port' })
    const n = (col: number, row: number, rotation: 0 | 1 | 2 | 3) =>
        cells.push({ col, row, kind: 'not', rotation })

    // --- N1 rot3 at (10,30) ---
    p(10, 34)
    n(10, 33, 3)
    w(10, 32)
    w(11, 32)
    w(12, 32)
    p(12, 31)
    w(13, 32)
    w(14, 32)
    p(14, 34)
    n(14, 33, 3)

    // --- N2 rot1 at (10,0): in0 (14,0), in1 (10,0), out (12,3) ---
    p(14, 0)
    p(10, 0)
    n(14, 1, 1)
    n(10, 1, 1)
    w(14, 2)
    w(13, 2)
    w(12, 2)
    w(11, 2)
    w(10, 2)
    p(12, 3)

    // --- N3 rot1 at (10,60): in0 (14,60), in1 (10,60), out (12,63) ---
    p(14, 60)
    p(10, 60)
    n(14, 61, 1)
    n(10, 61, 1)
    w(14, 62)
    w(13, 62)
    w(12, 62)
    w(11, 62)
    w(10, 62)
    p(12, 63)

    // --- N4 rot0 at (10,90): in0 (10,90), in1 (10,94), out (13,92) ---
    p(10, 90)
    n(11, 90, 0)
    w(12, 90)
    w(12, 91)
    p(13, 92)
    w(12, 92)
    w(12, 93)
    p(10, 94)
    n(11, 94, 0)
    w(12, 94)

    // --- net a ---
    w(10, 35)
    w(9, 35)
    w(8, 35)
    w(8, 34)
    w(7, 34)
    w(6, 34)
    for (let r = 33; r >= -8; r--) w(6, r)
    for (let c = 7; c <= 19; c++) w(c, -8)
    for (let r = -7; r <= 0; r++) w(19, r)
    for (let c = 18; c >= 14; c--) w(c, 0)

    // --- net b ---
    for (let r = 35; r <= 59; r++) w(14, r)

    // --- net X ---
    w(12, 30)
    w(11, 30)
    w(10, 30)
    for (let r = 29; r >= 4; r--) w(10, r)
    w(9, 4)
    w(8, 4)
    for (let r = 3; r >= -2; r--) w(8, r)
    w(9, -2)
    w(10, -2)
    w(10, -1)
    for (let r = 32; r <= 60; r++) w(12, r)
    w(11, 60)

    // --- net Y1 ---
    w(13, 3)
    w(14, 3)
    w(15, 3)
    w(16, 3)
    for (let r = 4; r <= 88; r++) w(16, r)
    for (let c = 15; c >= 10; c--) w(c, 88)
    w(10, 89)

    // --- net Y2 ---
    for (let r = 64; r <= 86; r++) w(12, r)
    w(11, 86)
    w(10, 86)
    w(9, 86)
    w(9, 85)
    w(8, 85)
    for (let r = 86; r <= 94; r++) w(8, r)
    w(9, 94)

    // --- net OUT ---
    p(14, 92)

    return {
        name: 'Xor',
        cells,
        inputs: [
            { col: 10, row: 34 },
            { col: 14, row: 34 },
        ],
        outputs: [{ col: 14, row: 92 }],
    }
})()

/**
 * Half adder: SUM = a XOR b, CARRY = a AND b.
 * Reuses the XOR prefab: X = NAND(a,b) is tapped inside, one extra NOT
 * computes CARRY = NOT(X) = a AND b.
 */
export const HALF_ADDER_PREFAB: Prefab = (() => {
    const cells: PrefabCell[] = XOR_PREFAB.cells.map((cell) => ({ ...cell }))
    // CARRY = NOT(X): rotated NOT at (9,-3) reads X's wire (9,-2) from below,
    // outputs upward, then east along row -4 to port (17,-4).
    cells.push({ col: 9, row: -3, kind: 'not', rotation: 3 })
    cells.push({ col: 9, row: -4, kind: 'wire' })
    for (let c = 10; c <= 17; c++) cells.push({ col: c, row: -4, kind: 'wire' })
    cells.push({ col: 17, row: -4, kind: 'port' })
    return {
        name: 'HalfAdder',
        cells,
        inputs: XOR_PREFAB.inputs,
        outputs: [
            { col: 14, row: 92 }, // SUM
            { col: 17, row: -4 }, // CARRY
        ],
    }
})()

/**
 * 2-to-1 MUX: out = NAND(NAND(a, !sel), NAND(b, sel)).
 * Three wide NANDs (N1/N2 stacked left, N3 right) + NOTsel.
 * Channels: sel col 0 stub, !sel outer ring (col 15 / row 20 / col -2),
 * t1 stub row 2, t2 stub row 10 + col 12, out row 2.
 */
export const MUX_PREFAB: Prefab = (() => {
    const cells: PrefabCell[] = []
    const w = (col: number, row: number) => cells.push({ col, row, kind: 'wire' })
    const p = (col: number, row: number) => cells.push({ col, row, kind: 'port' })
    const n = (col: number, row: number) => cells.push({ col, row, kind: 'not', rotation: 0 })

    // --- NAND1 (wide) at (0,0): a (0,0), !sel (0,4), out t1 (3,2) ---
    p(0, 0)
    p(0, 4)
    n(1, 0)
    n(1, 4)
    for (let r = 0; r <= 4; r++) w(2, r)
    p(3, 2)

    // --- NAND2 (wide) at (0,8): b (0,8), sel (0,12), out t2 (3,10) ---
    p(0, 8)
    p(0, 12)
    n(1, 8)
    n(1, 12)
    for (let r = 8; r <= 12; r++) w(2, r)
    p(3, 10)

    // --- NAND3 (wide) at (12,0): t1 (12,0), t2 (12,4), out (15,2) ---
    p(12, 0)
    p(12, 4)
    n(13, 0)
    n(13, 4)
    for (let r = 0; r <= 4; r++) w(14, r)
    p(15, 2)

    // --- NOTsel at (1,14): sel-port (0,14), !sel out (2,14) ---
    p(0, 14)
    n(1, 14)
    w(0, 13)
    w(2, 14)

    // --- !sel ring ---
    for (let c = 3; c <= 15; c++) w(c, 14)
    for (let r = 13; r >= 5; r--) w(15, r)
    for (let r = 6; r <= 20; r++) w(15, r)
    for (let c = 14; c >= -2; c--) w(c, 20)
    for (let r = 19; r >= 5; r--) w(-2, r)
    w(-1, 5)
    w(0, 5)

    // --- t1: (3,2) -> (12,0) ---
    for (let c = 4; c <= 12; c++) w(c, 2)
    w(12, 1)

    // --- t2: (3,10) -> (12,4) ---
    for (let c = 4; c <= 12; c++) w(c, 10)
    for (let r = 9; r >= 5; r--) w(12, r)

    // --- out: (15,2) -> port (20,2) ---
    for (let c = 16; c <= 20; c++) w(c, 2)
    p(20, 2)

    return {
        name: 'Mux',
        cells,
        inputs: [
            { col: 0, row: 0 }, // a
            { col: 0, row: 8 }, // b
            { col: 0, row: 14 }, // sel
        ],
        outputs: [{ col: 20, row: 2 }],
    }
})()

export const XOR_VARIANTS: Array<{ ox2: number; oy2: number; ox3: number; oy3: number; ox4: number; oy4: number }> = [
    { ox2: -24, oy2: 0, ox3: 20, oy3: 4, ox4: 0, oy4: 20 },
    { ox2: 10, oy2: 4, ox3: 20, oy3: 0, ox4: 30, oy4: 4 },
    { ox2: 10, oy2: 0, ox3: 20, oy3: 4, ox4: 30, oy4: 0 },
    { ox2: 10, oy2: 4, ox3: 20, oy3: 4, ox4: 30, oy4: 0 },
    { ox2: 10, oy2: 0, ox3: 20, oy3: 0, ox4: 30, oy4: 4 },
    { ox2: 20, oy2: 8, ox3: 40, oy3: 0, ox4: 60, oy4: 8 },
    { ox2: 30, oy2: 12, ox3: 60, oy3: 0, ox4: 90, oy4: 12 },
    { ox2: 0, oy2: 40, ox3: 40, oy3: 0, ox4: 40, oy4: 40 },
    { ox2: 0, oy2: 60, ox3: 60, oy3: 0, ox4: 60, oy4: 60 },
]

export const XOR_ORDERS: string[][] = [
    ['a', 'b', 'X', 'Y1', 'Y2', 'OUT'],
    ['b', 'a', 'X', 'Y1', 'Y2', 'OUT'],
    ['X', 'a', 'b', 'Y1', 'Y2', 'OUT'],
    ['Y1', 'Y2', 'OUT', 'a', 'b', 'X'],
    ['a', 'X', 'b', 'Y1', 'OUT', 'Y2'],
    ['b', 'a', 'X', 'Y2', 'Y1', 'OUT'],
]

export function tryBuildXor(): Prefab | null {
    for (const v of XOR_VARIANTS) {
        for (const order of XOR_ORDERS) {
            for (let seed = 0; seed < 60; seed++) {
                try {
                    return buildXorVariant(v.ox2, v.oy2, v.ox3, v.oy3, v.ox4, v.oy4, order, seed)
                } catch {
                    // next seed / variant
                }
            }
        }
    }
    return null
}

export const PREFABS: Record<string, Prefab> = {
    Nand: NAND_PREFAB,
    And: AND_PREFAB,
    Or: OR_PREFAB,
    Xor: XOR_PREFAB,
    HalfAdder: HALF_ADDER_PREFAB,
    Mux: MUX_PREFAB,
}
