export interface PrefabCell {
    col: number
    row: number
    kind: 'not' | 'wire' | 'port'
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

function astar(
    start: Point,
    goal: Point,
    blocked: Set<string>,
    minCol: number,
    minRow: number,
    maxCol: number,
    maxRow: number
): Point[] | null {
    if (start.col === goal.col && start.row === goal.row) return [start]
    const key = (p: Point) => cellKey(p.col, p.row)
    const h = (p: Point) => Math.abs(p.col - goal.col) + Math.abs(p.row - goal.row)
    const open = new Map<string, Point>()
    const g = new Map<string, number>()
    const f = new Map<string, number>()
    const came = new Map<string, Point>()
    const closed = new Set<string>()
    open.set(key(start), start)
    g.set(key(start), 0)
    f.set(key(start), h(start))
    while (open.size > 0) {
        let bestKey: string | null = null
        let bestF = Infinity
        for (const k of open.keys()) {
            const fv = f.get(k) ?? Infinity
            if (fv < bestF) {
                bestF = fv
                bestKey = k
            }
        }
        if (bestKey === null) return null
        const cur = open.get(bestKey)!
        if (key(cur) === key(goal)) {
            const path: Point[] = []
            let c: Point | undefined = cur
            while (c) {
                path.push(c)
                c = came.get(key(c))
            }
            return path.reverse()
        }
        open.delete(bestKey)
        closed.add(bestKey)
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
            const n: Point = { col: cur.col + dc, row: cur.row + dr }
            if (n.col < minCol || n.row < minRow || n.col > maxCol || n.row > maxRow) continue
            const nk = key(n)
            if (closed.has(nk)) continue
            if (blocked.has(nk) && nk !== key(goal)) continue
            const ng = (g.get(bestKey) ?? 0) + 1
            if (!g.has(nk) || ng < g.get(nk)!) {
                g.set(nk, ng)
                f.set(nk, ng + h(n))
                came.set(nk, cur)
                open.set(nk, n)
            }
        }
    }
    return null
}

function routeNet(
    terminals: Point[],
    blocked: Set<string>,
    minCol: number,
    minRow: number,
    maxCol: number,
    maxRow: number
): Point[] | null {
    const points: Point[] = []
    for (let i = 0; i < terminals.length - 1; i++) {
        const seg = astar(terminals[i], terminals[i + 1], blocked, minCol, minRow, maxCol, maxRow)
        if (!seg) return null
        if (i === 0) points.push(...seg)
        else points.push(...seg.slice(1))
    }
    return points
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

// XOR = NAND(NAND(a, NAND(a,b)), NAND(b, NAND(a,b))) — 4 verified NAND prefabs
// composed together; an A* router wires the 6 short inter-prefab nets with >=1
// empty cell clearance (adjacent wire cells merge, so nets must never touch).
function placePrefab(cells: PrefabCell[], prefab: Prefab, ox: number, oy: number): void {
    for (const cell of prefab.cells) {
        cells.push({ col: cell.col + ox, row: cell.row + oy, kind: cell.kind })
    }
}

function buildXorVariant(ox2: number, oy2: number, ox3: number, oy3: number, ox4: number, oy4: number, order: string[]): Prefab {
    const cells: PrefabCell[] = []
    const add = (col: number, row: number, kind: PrefabCell['kind']) => cells.push({ col, row, kind })

    const o1 = { x: 0, y: 0 }
    const o2 = { x: ox2, y: oy2 }
    const o3 = { x: ox3, y: oy3 }
    const o4 = { x: ox4, y: oy4 }
    placePrefab(cells, NAND_PREFAB, o1.x, o1.y)
    placePrefab(cells, NAND_PREFAB, o2.x, o2.y)
    placePrefab(cells, NAND_PREFAB, o3.x, o3.y)
    placePrefab(cells, NAND_PREFAB, o4.x, o4.y)
    const outCol = Math.max(o1.x, o2.x, o3.x, o4.x) + 10
    const outRow = 1
    add(outCol, outRow, 'port')

    const pt = (o: { x: number; y: number }, col: number, row: number): Point => ({
        col: o.x + col,
        row: o.y + row,
    })

    const nets: Record<string, Point[]> = {
        a: [pt(o1, 0, 0), pt(o2, 0, 0)],
        b: [pt(o1, 0, 2), pt(o3, 0, 0)],
        X: [pt(o1, 3, 1), pt(o2, 0, 2), pt(o3, 0, 2)],
        Y1: [pt(o2, 3, 1), pt(o4, 0, 0)],
        Y2: [pt(o3, 3, 1), pt(o4, 0, 2)],
        OUT: [pt(o4, 3, 1), { col: outCol, row: outRow }],
    }

    const allTerminalAndComp = new Set<string>()
    for (const cell of cells) allTerminalAndComp.add(cellKey(cell.col, cell.row))
    for (const net of Object.values(nets)) for (const t of net) allTerminalAndComp.add(cellKey(t.col, t.row))

    const routedCells = new Set<string>()
    for (const name of order) {
        const net = nets[name]
        const thisNetTerminals = new Set<string>(net.map((t) => cellKey(t.col, t.row)))
        const blocked = new Set<string>(allTerminalAndComp)
        for (const k of routedCells) {
            blocked.add(k)
            const [c, r] = k.split(',').map(Number)
            for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
                blocked.add(cellKey(c + dc, r + dr))
            }
        }
        for (const t of allTerminalAndComp) {
            if (thisNetTerminals.has(t)) continue
            const [c, r] = t.split(',').map(Number)
            for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
                blocked.add(cellKey(c + dc, r + dr))
            }
        }
        const path = routeNet(net, blocked, -30, -30, outCol + 20, 30)
        if (!path) throw new Error(`XOR route failed for net ${name}`)
        for (const p of path) {
            const k = cellKey(p.col, p.row)
            if (!allTerminalAndComp.has(k)) {
                add(p.col, p.row, 'wire')
                routedCells.add(k)
            }
        }
    }

    return {
        name: 'Xor',
        cells,
        inputs: [pt(o1, 0, 0), pt(o1, 0, 2)],
        outputs: [{ col: outCol, row: outRow }],
    }
}

const XOR_VARIANTS: Array<{ ox2: number; oy2: number; ox3: number; oy3: number; ox4: number; oy4: number }> = [
    { ox2: -24, oy2: 0, ox3: 20, oy3: 4, ox4: 0, oy4: 20 },
    { ox2: 10, oy2: 4, ox3: 20, oy3: 0, ox4: 30, oy4: 4 },
    { ox2: 10, oy2: 0, ox3: 20, oy3: 4, ox4: 30, oy4: 0 },
    { ox2: 10, oy2: 4, ox3: 20, oy3: 4, ox4: 30, oy4: 0 },
    { ox2: 10, oy2: 0, ox3: 20, oy3: 0, ox4: 30, oy4: 4 },
    { ox2: 20, oy2: 8, ox3: 40, oy3: 0, ox4: 60, oy4: 8 },
    { ox2: 30, oy2: 12, ox3: 60, oy3: 0, ox4: 90, oy4: 12 },
]

const XOR_ORDERS: string[][] = [
    ['a', 'b', 'X', 'Y1', 'Y2', 'OUT'],
    ['b', 'a', 'X', 'Y1', 'Y2', 'OUT'],
    ['X', 'a', 'b', 'Y1', 'Y2', 'OUT'],
    ['Y1', 'Y2', 'OUT', 'a', 'b', 'X'],
    ['a', 'X', 'b', 'Y1', 'OUT', 'Y2'],
    ['b', 'a', 'X', 'Y2', 'Y1', 'OUT'],
]

export function tryBuildXor(): Prefab | null {
    let lastError: unknown = null
    for (const v of XOR_VARIANTS) {
        for (const order of XOR_ORDERS) {
            try {
                return buildXorVariant(v.ox2, v.oy2, v.ox3, v.oy3, v.ox4, v.oy4, order)
            } catch (e) {
                lastError = e
            }
        }
    }
    void lastError
    return null
}

export const PREFABS: Record<string, Prefab> = {
    Nand: NAND_PREFAB,
    And: AND_PREFAB,
    Or: OR_PREFAB,
}
