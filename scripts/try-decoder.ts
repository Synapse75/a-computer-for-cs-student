import { composePrefab, AND_PREFAB, WIDE_AND_PREFAB, NOT_PREFAB, rotatePrefab } from '../src/kernel/world/prefabs'
import type { Prefab } from '../src/kernel/world/prefabs'
import { World } from '../src/kernel/world/World'
import { Not } from '../src/kernel/gates/Not'
import { Vcc } from '../src/kernel/sources/Vcc'
import { Gnd } from '../src/kernel/sources/Gnd'

function buildDecoder(seed: number): Prefab {
    const wide = seed % 2 === 0
    const and = wide ? WIDE_AND_PREFAB : AND_PREFAB
    // For the wide AND, inputs are (0,0)/(0,4), output (4,2); rows shift by 2.
    const spacing = wide ? 28 : 24
    const rotations: Array<0 | 1 | 2 | 3> = [
        (seed % 4) as 0 | 1 | 2 | 3,
        ((seed >> 2) % 4) as 0 | 1 | 2 | 3,
        ((seed >> 4) % 4) as 0 | 1 | 2 | 3,
        ((seed >> 6) % 4) as 0 | 1 | 2 | 3,
    ]
    const rows = (i: number) => 20 + spacing * i
    const prefab = composePrefab(
        [
            { prefab: NOT_PREFAB, ox: 0, oy: 0 },
            { prefab: NOT_PREFAB, ox: 0, oy: 2 },
            { prefab: and, ox: 0, oy: 20, rotation: rotations[0] },
            { prefab: and, ox: 0, oy: 20 + spacing, rotation: rotations[1] },
            { prefab: and, ox: 0, oy: 20 + spacing * 2, rotation: rotations[2] },
            { prefab: and, ox: 0, oy: 20 + spacing * 3, rotation: rotations[3] },
        ],
        decoderNets(and, spacing, rotations),
        ['!a', '!b', 'a', 'b'],
        seed
    )
    prefab.inputs = [
        { col: 0, row: 0 },
        { col: 0, row: 2 },
    ]
    prefab.outputs = rotations.map((r, i) => {
        const o = rotatePrefab(and, r).outputs[0]
        return { col: o.col, row: rows(i) + o.row }
    })
    return prefab
}

function decoderNets(
    and: Prefab,
    spacing: number,
    rotations: Array<0 | 1 | 2 | 3>
): Record<string, { col: number; row: number }[]> {
    const rows = [20, 20 + spacing, 20 + spacing * 2, 20 + spacing * 3]
    const rot = rotations.map((r) => rotatePrefab(and, r))
    const in1 = rot.map((p) => p.inputs[0])
    const in2 = rot.map((p) => p.inputs[1])
    const p = (row: number, cell: { col: number; row: number }) => ({ col: cell.col, row: row + cell.row })
    // AND1 (o00) = !a·!b, AND2 (o01) = !a·b, AND3 (o10) = a·!b, AND4 (o11) = a·b
    return {
        a: [
            { col: 0, row: 0 },
            p(rows[2], in1[2]),
            p(rows[3], in1[3]),
        ],
        b: [
            { col: 0, row: 2 },
            p(rows[1], in2[1]),
            p(rows[3], in2[3]),
        ],
        '!a': [
            { col: 2, row: 0 },
            p(rows[0], in1[0]),
            p(rows[1], in1[1]),
        ],
        '!b': [
            { col: 2, row: 2 },
            p(rows[0], in2[0]),
            p(rows[2], in2[2]),
        ],
    }
}

const OX = 40
const OY = 40
function verify(prefab: Prefab, wide: boolean, spacing: number): boolean {
    void wide
    void spacing
    const OUTPUTS = prefab.outputs
    let ok = true
    for (const a of [0, 1] as const) {
        for (const b of [0, 1] as const) {
            const world = new World()
            for (const cell of prefab.cells) {
                const c = OX + cell.col
                const r = OY + cell.row
                if (cell.kind === 'not') world.setComponent(c, r, new Not(cell.rotation ?? 0))
                else world.setWire(c, r)
            }
            world.setComponent(OX - 1, OY, a === 1 ? new Vcc() : new Gnd())
            world.setComponent(OX - 1, OY + 2, b === 1 ? new Vcc() : new Gnd())
            world.step()
            const got = OUTPUTS.map((o) => world.getCellValue(World.cellId(OX + o.col, OY + o.row)))
            const want = [!a && !b ? 1 : 0, !a && b ? 1 : 0, a && !b ? 1 : 0, a && b ? 1 : 0].map(Number)
            const pass = got.every((v, i) => v === want[i])
            if (!pass) ok = false
            console.log(`  a=${a} b=${b} -> out=[${got.join(',')}] want=[${want.join(',')}] ${pass ? 'OK' : 'FAIL'}`)
        }
    }
    return ok
}

let found = false
for (let seed = 0; seed < 50 && !found; seed++) {
    try {
        const prefab = buildDecoder(seed)
        const wide = seed % 2 === 0
        const spacing = wide ? 28 : 24
        console.log(`seed ${seed}: ROUTED (${prefab.cells.length} cells)`)
        if (verify(prefab, wide, spacing)) {
            console.log(`SEED ${seed} WORKS`)
            found = true
        } else {
            console.log(`seed ${seed}: WRONG LOGIC`)
        }
    } catch (e) {
        if (seed < 8) console.log(`seed ${seed}: FAIL ${e instanceof Error ? e.message : String(e)}`)
        else if (seed % 5 === 0) process.stdout.write('.')
    }
}
if (!found) console.log('\nNO SEED WORKED')
