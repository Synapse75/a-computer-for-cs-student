import { mulberry32ForRouter } from './router-helpers'
import type { Prefab } from '../src/kernel/world/prefabs'

interface Point {
    col: number
    row: number
}

interface Bounds {
    minCol: number
    minRow: number
    maxCol: number
    maxRow: number
}

const key = (p: Point) => `${p.col},${p.row}`

function astar(start: Point, goal: Point, blocked: Set<string>, bounds: Bounds, rng: () => number): Point[] | null {
    if (start.col === goal.col && start.row === goal.row) return [start]
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
        if (++expansions > 40000) return null
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
                f.set(nk, ng + h(n) + rng() * 0.5)
                came.set(nk, cur)
                if (openIdx.has(nk)) open[openIdx.get(nk)!] = n
                else {
                    openIdx.set(nk, open.length)
                    open.push(n)
                }
            }
        }
    }
    return null
}

function chain(terminals: Point[], blocked: Set<string>, bounds: Bounds, rng: () => number): Point[] | null {
    const pts: Point[] = []
    for (let i = 0; i < terminals.length - 1; i++) {
        const seg = astar(terminals[i], terminals[i + 1], blocked, bounds, rng)
        if (!seg) return null
        if (i === 0) pts.push(...seg)
        else pts.push(...seg.slice(1))
    }
    return pts
}

function pathKey(path: Point[]): string {
    return path.map((p) => key(p)).join(';')
}

function conflicts(path: Point[], assigned: Array<{ name: string; path: Point[] }>): boolean {
    const own = new Set(path.map((p) => key(p)))
    for (const a of assigned) {
        const aSet = new Set(a.path.map((p) => key(p)))
        for (const p of a.path) {
            if (own.has(key(p))) return true
            for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
                if (own.has(key({ col: p.col + dc, row: p.row + dr }))) return true
            }
        }
        void aSet
    }
    return false
}

export function routeWithBacktracking(
    nets: Record<string, Point[]>,
    order: string[],
    bounds: Bounds,
    allCells: Set<string>,
    cellKinds: Map<string, 'not' | 'wire' | 'port'>,
    candidatesPerNet: number
): Map<string, Point[]> | null {
    const candidates = new Map<string, Point[][]>()
    for (const name of order) {
        const list: Point[][] = []
        const seen = new Set<string>()
        for (let seed = 0; seed < candidatesPerNet * 4 && list.length < candidatesPerNet; seed++) {
            const blocked = new Set<string>(allCells)
            const own = new Set(nets[name].map((t) => key(t)))
            for (const t of allCells) {
                if (own.has(t)) continue
                const [c, r] = t.split(',').map(Number)
                if (cellKinds.get(t) === 'not') {
                    blocked.add(key({ col: c - 1, row: r }))
                    blocked.add(key({ col: c + 1, row: r }))
                } else {
                    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
                        blocked.add(key({ col: c + dc, row: r + dr }))
                    }
                }
            }
            const rng = mulberry32ForRouter(seed * 7919 + 13)
            const path = chain(nets[name], blocked, bounds, rng)
            if (path) {
                const pk = pathKey(path)
                if (!seen.has(pk)) {
                    seen.add(pk)
                    list.push(path)
                }
            }
        }
        if (list.length === 0) return null
        candidates.set(name, list)
    }

    const assigned: Array<{ name: string; path: Point[] }> = []
    const result = new Map<string, Point[]>()
    const search = (depth: number): boolean => {
        if (depth === order.length) return true
        const name = order[depth]
        for (const path of candidates.get(name)!) {
            if (!conflicts(path, assigned)) {
                assigned.push({ name, path })
                result.set(name, path)
                if (search(depth + 1)) return true
                assigned.pop()
                result.delete(name)
            }
        }
        return false
    }
    return search(0) ? result : null
}

export function prefabFromRouting(
    parts: Array<{ prefab: Prefab; ox: number; oy: number; rotation?: 0 | 1 | 2 | 3 }>,
    nets: Record<string, Point[]>,
    routed: Map<string, Point[]>
): Prefab {
    const cells: Array<{ col: number; row: number; kind: 'not' | 'wire' | 'port'; rotation?: 0 | 1 | 2 | 3 }> = []
    for (const part of parts) {
        const prefab = part.rotation ? rotate(part.prefab, part.rotation) : part.prefab
        for (const cell of prefab.cells) {
            cells.push({ ...cell, col: cell.col + part.ox, row: cell.row + part.oy })
        }
    }
    const terminals = new Set<string>()
    for (const t of Object.values(nets).flat()) terminals.add(key(t))
    for (const path of routed.values()) {
        for (const p of path) {
            if (!terminals.has(key(p))) cells.push({ col: p.col, row: p.row, kind: 'wire' })
        }
    }
    return { name: 'Composite', cells, inputs: [], outputs: [] } as Prefab
}

function rotate(prefab: Prefab, rotation: 0 | 1 | 2 | 3): Prefab {
    const w = Math.max(...prefab.cells.map((c) => c.col)) + 1
    const h = Math.max(...prefab.cells.map((c) => c.row)) + 1
    const rp = (col: number, row: number, rot: 0 | 1 | 2 | 3) => {
        switch (rot) {
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
    return {
        name: prefab.name,
        cells: prefab.cells.map((c) => ({
            ...rp(c.col, c.row, rotation),
            kind: c.kind,
            rotation: c.kind === 'not' ? (((c.rotation ?? 0) + rotation) % 4) as 0 | 1 | 2 | 3 : undefined,
        })),
        inputs: prefab.inputs.map((t) => rp(t.col, t.row, rotation)),
        outputs: prefab.outputs.map((t) => rp(t.col, t.row, rotation)),
    }
}
