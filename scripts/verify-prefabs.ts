import { World } from '../src/kernel/world/World'
import { Not } from '../src/kernel/gates/Not'
import { Vcc } from '../src/kernel/sources/Vcc'
import { Gnd } from '../src/kernel/sources/Gnd'
import { NAND_PREFAB, AND_PREFAB, OR_PREFAB, XOR_PREFAB, HALF_ADDER_PREFAB, MUX_PREFAB, DMUX_PREFAB } from '../src/kernel/world/prefabs'
import type { Prefab } from '../src/kernel/world/prefabs'

const OX = 30
const OY = 30

function runCase(prefab: Prefab, inputs: (0 | 1)[]): number[] {
    const world = new World()
    for (const cell of prefab.cells) {
        const col = OX + cell.col
        const row = OY + cell.row
        if (cell.kind === 'not') world.setComponent(col, row, new Not(cell.rotation ?? 0))
        else world.setWire(col, row)
    }
    prefab.inputs.forEach((port, i) => {
        world.setComponent(OX + port.col - 1, OY + port.row, inputs[i] === 1 ? new Vcc() : new Gnd())
    })
    world.step()
    return prefab.outputs.map((o) => world.getCellValue(World.cellId(OX + o.col, OY + o.row)))
}

function enumerate(n: number): (0 | 1)[][] {
    const out: (0 | 1)[][] = []
    for (let mask = 0; mask < 1 << n; mask++) {
        const row: (0 | 1)[] = []
        for (let i = 0; i < n; i++) row.push(((mask >> i) & 1) as 0 | 1)
        out.push(row)
    }
    return out
}

function verify(prefab: Prefab, expected: (ins: (0 | 1)[]) => number[]): boolean {
    let ok = true
    for (const ins of enumerate(prefab.inputs.length)) {
        const got = runCase(prefab, ins)
        const want = expected(ins)
        const status = got.every((v, i) => v === want[i]) ? 'OK' : 'FAIL'
        if (status === 'FAIL') ok = false
        console.log(
            `  ${prefab.name} in=[${ins.join(',')}] -> out=[${got.join(',')}] want=[${want.join(',')}] ${status}`
        )
    }
    return ok
}

let allOk = true

console.log('--- NAND ---')
allOk = verify(NAND_PREFAB, ([a, b]) => [(a && b ? 0 : 1) as number]) && allOk
console.log('--- AND ---')
allOk = verify(AND_PREFAB, ([a, b]) => [(a && b ? 1 : 0) as number]) && allOk
console.log('--- OR ---')
allOk = verify(OR_PREFAB, ([a, b]) => [(a || b ? 1 : 0) as number]) && allOk
console.log('--- XOR ---')
allOk = verify(XOR_PREFAB, ([a, b]) => [(a !== b ? 1 : 0) as number]) && allOk
console.log('--- HALF ADDER ---')
allOk = verify(HALF_ADDER_PREFAB, ([a, b]) => [
    (a !== b ? 1 : 0) as number,
    (a && b ? 1 : 0) as number,
]) && allOk
console.log('--- MUX ---')
allOk = verify(MUX_PREFAB, ([a, b, sel]) => [(sel ? b : a) as number]) && allOk
console.log('--- DMUX ---')
allOk = verify(DMUX_PREFAB, ([input, sel]) => [
    (input && !sel ? 1 : 0) as number,
    (input && sel ? 1 : 0) as number,
]) && allOk

console.log(allOk ? 'ALL PASS' : 'FAILURES FOUND')
process.exit(allOk ? 0 : 1)
