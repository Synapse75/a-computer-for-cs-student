import { World } from '../src/kernel/world/World'
import { Not } from '../src/kernel/gates/Not'
import { Composite } from '../src/kernel/composites/Composite'
import { Vcc } from '../src/kernel/sources/Vcc'
import { Gnd } from '../src/kernel/sources/Gnd'
import {
    NAND_PREFAB,
    AND_PREFAB,
    OR_PREFAB,
    XOR_PREFAB,
    XOR_TAPPED_PREFAB,
    HALF_ADDER_PREFAB,
    FULL_ADDER_PREFAB,
    DECODER2X4_PREFAB,
    MUX_PREFAB,
    DMUX_PREFAB,
} from '../src/kernel/world/prefabs'
import type { Prefab } from '../src/kernel/world/prefabs'

const OX = 30
const OY = 30

const COMPOSITE_TYPES: Record<string, Prefab> = {
    HalfAdder: HALF_ADDER_PREFAB,
    Dmux: DMUX_PREFAB,
}

function runCase(prefab: Prefab, inputs: (0 | 1)[]): number[] {
    const world = new World()
    for (const cell of prefab.cells) {
        const col = OX + cell.col
        const row = OY + cell.row
        if (cell.kind === 'composite' && cell.prefab && COMPOSITE_TYPES[cell.prefab]) {
            world.setComponent(col, row, new Composite(COMPOSITE_TYPES[cell.prefab]))
        } else if (cell.kind === 'not') world.setComponent(col, row, new Not(cell.rotation ?? 0))
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
console.log('--- XOR TAPPED ---')
allOk = verify(XOR_TAPPED_PREFAB, ([a, b]) => [
    (a !== b ? 1 : 0) as number,
    (a && b ? 0 : 1) as number,
]) && allOk
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
console.log('--- FULL ADDER ---')
allOk = verify(FULL_ADDER_PREFAB, ([a, b, c]) => {
    const sum = (a ^ b ^ c) as number
    const carry = (a && b) || (c && (a !== b)) ? 1 : 0
    return [sum, carry]
}) && allOk
console.log('--- DECODER 2x4 ---')
allOk = (() => {
    let ok = true
    for (const [a, b] of enumerate(2)) {
        const got = runCase(DECODER2X4_PREFAB, [1, a, b])
        const want = [
            (a === 0 && b === 0 ? 1 : 0) as number,
            (a === 0 && b === 1 ? 1 : 0) as number,
            (a === 1 && b === 0 ? 1 : 0) as number,
            (a === 1 && b === 1 ? 1 : 0) as number,
        ]
        const status = got.every((v, i) => v === want[i]) ? 'OK' : 'FAIL'
        if (status === 'FAIL') ok = false
        console.log(`  Decoder2x4 in=[1,${a},${b}] -> out=[${got.join(',')}] want=[${want.join(',')}] ${status}`)
    }
    return ok
})() && allOk

console.log(allOk ? 'ALL PASS' : 'FAILURES FOUND')
process.exit(allOk ? 0 : 1)
