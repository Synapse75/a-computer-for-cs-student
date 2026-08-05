import { WIDE_NAND_PREFAB, XOR_VARIANTS, buildXorVariantWide } from '../src/kernel/world/prefabs'

// Test each net alone: place 4 wide NANDs, route only the given net.
const v = XOR_VARIANTS[0]
const nand = WIDE_NAND_PREFAB

const o1 = { x: 0, y: 0 }
const o2 = { x: v.ox2, y: v.oy2 }
const o3 = { x: v.ox3, y: v.oy3 }
const o4 = { x: v.ox4, y: v.oy4 }
const pt = (o: { x: number; y: number }, col: number, row: number) => ({ col: o.x + col, row: o.y + row })

const nets: Record<string, { col: number; row: number }[]> = {
    a: [pt(o1, 0, 0), pt(o2, 0, 0)],
    b: [pt(o1, 0, 4), pt(o3, 0, 0)],
    X: [pt(o1, 3, 1), pt(o2, 0, 4), pt(o3, 0, 4)],
    Y1: [pt(o2, 3, 1), pt(o4, 0, 0)],
    Y2: [pt(o3, 3, 1), pt(o4, 0, 4)],
    OUT: [pt(o4, 3, 1), { col: 70, row: 2 }],
}

// Reuse the real builder per net by building once and checking each net alone
// is impossible via the builder API, so instead we try building with all nets
// but only inspect which nets the error names (single-net diagnostics below).
for (const name of Object.keys(nets)) {
    try {
        const p = buildXorVariantWide(v.ox2, v.oy2, v.ox3, v.oy3, v.ox4, v.oy4, [name], 1)
        console.log(`${name}: OK (${p.cells.length} cells)`)
    } catch (e) {
        console.log(`${name}: FAIL ${e instanceof Error ? e.stack : String(e)}`)
    }
}
