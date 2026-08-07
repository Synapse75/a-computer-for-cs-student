import { composePrefab, AND_PREFAB, NOT_PREFAB } from '../src/kernel/world/prefabs'
import type { Prefab } from '../src/kernel/world/prefabs'
import { World } from '../src/kernel/world/World'
import { Not } from '../src/kernel/gates/Not'
import { Vcc } from '../src/kernel/sources/Vcc'
import { Gnd } from '../src/kernel/sources/Gnd'

function buildDecoder(seed: number): Prefab {
    return composePrefab(
        [
            { prefab: NOT_PREFAB, ox: 0, oy: 0 },
            { prefab: NOT_PREFAB, ox: 0, oy: 2 },
            { prefab: AND_PREFAB, ox: 0, oy: 20 },
            { prefab: AND_PREFAB, ox: 0, oy: 44 },
            { prefab: AND_PREFAB, ox: 0, oy: 68 },
            { prefab: AND_PREFAB, ox: 0, oy: 92 },
        ],
        {
            a: [
                { col: 0, row: 0 },
                { col: 0, row: 68 },
                { col: 0, row: 92 },
            ],
            b: [
                { col: 0, row: 2 },
                { col: 0, row: 46 },
                { col: 0, row: 94 },
            ],
            '!a': [
                { col: 2, row: 0 },
                { col: 0, row: 20 },
                { col: 0, row: 44 },
            ],
            '!b': [
                { col: 2, row: 2 },
                { col: 0, row: 22 },
                { col: 0, row: 70 },
            ],
        },
        ['!a', '!b', 'a', 'b'],
        seed
    )
}

const OX = 40
const OY = 40
const OUTPUTS: Array<{ col: number; row: number }> = [
    { col: 4, row: 21 },
    { col: 4, row: 45 },
    { col: 4, row: 69 },
    { col: 4, row: 93 },
]

function verify(prefab: Prefab): boolean {
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
        console.log(`seed ${seed}: ROUTED (${prefab.cells.length} cells)`)
        if (verify(prefab)) {
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
