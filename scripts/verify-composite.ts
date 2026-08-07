import { World } from '../src/kernel/world/World'
import { Composite } from '../src/kernel/composites/Composite'
import { XOR_PREFAB, HALF_ADDER_PREFAB } from '../src/kernel/world/prefabs'
import type { Prefab } from '../src/kernel/world/prefabs'
import { Vcc } from '../src/kernel/sources/Vcc'
import { Gnd } from '../src/kernel/sources/Gnd'

function run(prefab: Prefab, ins: (0 | 1)[]): number[] {
    const world = new World()
    const comp = new Composite(prefab)
    world.setComponent(10, 10, comp)
    // in0 via left edge (9,10); in1 via bottom edge (10,11)
    world.setWire(9, 10)
    world.setComponent(8, 10, ins[0] === 1 ? new Vcc() : new Gnd())
    world.setWire(10, 11)
    world.setComponent(9, 11, ins[1] === 1 ? new Vcc() : new Gnd())
    if (prefab.outputs.length === 1) world.setWire(11, 10)
    else {
        world.setWire(11, 10)
        world.setWire(10, 9)
    }
    world.step()
    const outs = prefab.outputs.map((_, i) => world.getCellValue(World.cellId(10 + (i === 0 ? 1 : 0), 10 - i)))
    return outs
}

let ok = true
const check = (label: string, got: number[], want: number[]) => {
    const pass = got.every((v, i) => v === want[i])
    if (!pass) ok = false
    console.log(`${label}: out=[${got.join(',')}] want=[${want.join(',')}] ${pass ? 'OK' : 'FAIL'}`)
}

for (const a of [0, 1] as const) {
    for (const b of [0, 1] as const) {
        check(`XOR a=${a} b=${b}`, run(XOR_PREFAB, [a, b]), [(a !== b ? 1 : 0) as number])
    }
}
for (const a of [0, 1] as const) {
    for (const b of [0, 1] as const) {
        check(
            `HA a=${a} b=${b}`,
            run(HALF_ADDER_PREFAB, [a, b]),
            [(a !== b ? 1 : 0) as number, (a && b ? 1 : 0) as number]
        )
    }
}

console.log(ok ? 'ALL PASS' : 'FAILURES FOUND')
process.exit(ok ? 0 : 1)
