import { World } from '../src/kernel/world/World'
import { Dff } from '../src/kernel/gates/Dff'
import { Clock } from '../src/kernel/sources/Clock'
import { Vcc } from '../src/kernel/sources/Vcc'
import { Gnd } from '../src/kernel/sources/Gnd'

function build(dValue: 0 | 1): { world: World; qId: string } {
    const world = new World()
    // Clock at (4,4) -> wire (5,4) -> DFF.clk (top); DFF at (5,5);
    // d source at (3,5) -> DFF.d (left); DFF.q (right) at (6,5) -> wire.
    world.setComponent(4, 4, new Clock())
    world.setWire(5, 4)
    world.setComponent(5, 5, new Dff())
    world.setComponent(3, 5, dValue === 1 ? new Vcc() : new Gnd())
    world.setWire(4, 5)
    world.setWire(6, 5)
    return { world, qId: World.cellId(6, 5) }
}

let ok = true
const check = (label: string, got: number, want: number) => {
    const pass = got === want
    if (!pass) ok = false
    console.log(`${label}: q=${got} want=${want} ${pass ? 'OK' : 'FAIL'}`)
}

// d=1: latches 1 on the first rising edge (step 1), stays 1.
{
    const { world, qId } = build(1)
    check('d=1 step0', world.getCellValue(qId), 0)
    world.step()
    check('d=1 step1', world.getCellValue(qId), 1)
    const cell = world.get(5, 5)!
    if (cell.kind === 'component') {
        const dff = cell.component as Dff
        console.log(
            `DEBUG d=${dff.pins.get('d')!.value} clk=${dff.pins.get('clk')!.value} q=${dff.pins.get('q')!.value}`
        )
    }
    console.log(`DEBUG wire(5,4)=${world.getCellValue(World.cellId(5, 4))} wire(6,5)=${world.getCellValue(qId)}`)
    world.step()
    check('d=1 step2', world.getCellValue(qId), 1)
}

// d=0: stays 0.
{
    const { world, qId } = build(0)
    check('d=0 step0', world.getCellValue(qId), 0)
    world.step()
    check('d=0 step1', world.getCellValue(qId), 0)
}

// Data change: latch 1, then switch d to 0; q follows on the next rising edge.
{
    const { world, qId } = build(1)
    world.step()
    check('change step1 (q=1)', world.getCellValue(qId), 1)
    world.remove(3, 5)
    world.setComponent(3, 5, new Gnd())
    world.step() // clk falls (no edge)
    check('change step2 (still 1)', world.getCellValue(qId), 1)
    world.step() // clk rises -> latch d=0
    check('change step3 (q=0)', world.getCellValue(qId), 0)
}

console.log(ok ? 'ALL PASS' : 'FAILURES FOUND')
process.exit(ok ? 0 : 1)
