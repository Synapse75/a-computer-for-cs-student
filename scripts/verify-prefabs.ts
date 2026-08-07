import { World } from '../src/kernel/world/World'
import { Not } from '../src/kernel/gates/Not'
import { Vcc } from '../src/kernel/sources/Vcc'
import { Gnd } from '../src/kernel/sources/Gnd'
import { NAND_PREFAB, AND_PREFAB, OR_PREFAB, XOR_PREFAB } from '../src/kernel/world/prefabs'
import type { Prefab } from '../src/kernel/world/prefabs'

const OX = 12
const OY = 12

function runCase(prefab: Prefab, a: 0 | 1, b: 0 | 1): { out: 0 | 1; world: World; inputPins: number[] } {
    const world = new World()
    for (const cell of prefab.cells) {
        const col = OX + cell.col
        const row = OY + cell.row
        if (cell.kind === 'not') world.setComponent(col, row, new Not(cell.rotation ?? 0))
        else world.setWire(col, row)
    }
    const [ia, ib] = prefab.inputs
    world.setComponent(OX + ia.col - 1, OY + ia.row, a === 1 ? new Vcc() : new Gnd())
    world.setComponent(OX + ib.col - 1, OY + ib.row, b === 1 ? new Vcc() : new Gnd())
    world.step()
    const out = prefab.outputs[0]
    const inputPins: number[] = []
    for (const cell of prefab.cells) {
        if (cell.kind !== 'not') continue
        const kernel = world.get(OX + cell.col, OY + cell.row)
        if (kernel && kernel.kind === 'component') {
            inputPins.push(kernel.component.pins.get('in')!.value)
        }
    }
    return {
        out: world.getCellValue(World.cellId(OX + out.col, OY + out.row)),
        world,
        inputPins,
    }
}

function verify(prefab: Prefab, expected: (a: 0 | 1, b: 0 | 1) => 0 | 1, notInputs: (a: 0 | 1, b: 0 | 1) => (0 | 1)[]): boolean {
    let ok = true
    for (const a of [0, 1] as const) {
        for (const b of [0, 1] as const) {
            const { out, inputPins } = runCase(prefab, a, b)
            const want = expected(a, b)
            const status = out === want ? 'OK ' : 'FAIL'
            if (out !== want) ok = false
            console.log(
                `  ${prefab.name} a=${a} b=${b} -> out=${out} want=${want} ${status}  notInputs=[${inputPins.join(',')}] want=[${notInputs(a, b).join(',')}]`
            )
        }
    }
    return ok
}

let allOk = true

console.log('--- NAND ---')
allOk = verify(NAND_PREFAB, (a, b) => (!(a && b) ? 1 : 0), (a) => [a, a, 0, 0, 0, 0, 0, 0])

console.log('--- AND ---')
allOk = verify(AND_PREFAB, (a, b) => (a && b ? 1 : 0), (a) => [a, a, 0, 0, 0, 0, 0, 0])

console.log('--- OR ---')
allOk = verify(OR_PREFAB, (a, b) => (a || b ? 1 : 0), (a) => [a, a, 0, 0, 0, 0, 0, 0]) && allOk

console.log('--- XOR ---')
allOk = verify(XOR_PREFAB, (a, b) => (a !== b ? 1 : 0), (a) => [a, a, 0, 0, 0, 0, 0, 0]) && allOk

console.log(allOk ? 'ALL PASS' : 'FAILURES FOUND')
process.exit(allOk ? 0 : 1)
