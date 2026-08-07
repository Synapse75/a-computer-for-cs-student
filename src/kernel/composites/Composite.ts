import type { Edge, Pin, Rotation, Signal } from '../core/types'
import { PinImplementation } from '../core/PinImplementation'
import { BaseComponent, rotateEdge } from '../core/BaseComponent'
import { Not } from '../gates/Not'
import { World } from '../world/World'
import type { Prefab } from '../world/prefabs'

/** Internal controllable source for a Composite's input ports. */
class InnerSource extends BaseComponent {
    pins: Map<string, Pin>
    pinEdges: Record<string, Edge> = { out: 'right' }

    constructor() {
        super()
        this.pins = new Map<string, Pin>([['out', new PinImplementation('out', 'output', 0)]])
    }

    set(value: Signal): void {
        this.pins.get('out')!.setValue(value)
    }

    tick(): void {
        // value driven externally by Composite.tick
    }
}

/**
 * Collapsed composite block: a single cell that hides a verified prefab.
 * Supports up to 3 inputs (left/bottom/top edges) and up to 2 outputs
 * (right/top edges, top only if not taken by an input);
 * the internal cells are simulated in a mini-World. Combinational groups only
 * (stateful groups like DFF need clock pass-through, documented as TODO).
 */
export class Composite extends BaseComponent {
    name: string
    pins: Map<string, Pin>
    pinEdges: Record<string, Edge>
    prefabName: string
    private inner: World
    private innerSources: InnerSource[]
    private outputCells: Array<{ pin: Pin; col: number; row: number }>

    constructor(prefab: Prefab, rotation: Rotation = 0) {
        super()
        this.rotation = rotation
        this.name = prefab.name
        this.prefabName = prefab.name
        this.pins = new Map<string, Pin>()
        this.pinEdges = {}
        this.innerSources = []
        this.outputCells = []

        const inner = new World()
        for (const cell of prefab.cells) {
            if (cell.kind === 'not') inner.setComponent(cell.col, cell.row, new Not(cell.rotation ?? 0))
            else inner.setWire(cell.col, cell.row)
        }
        this.inner = inner

        const inputEdges: Edge[] = ['left', 'bottom']
        const outputEdges: Edge[] = ['right', 'top']
        if (prefab.inputs.length > 3 || prefab.outputs.length > 2) {
            throw new Error(`Composite ${prefab.name}: max 3 inputs / 2 outputs`)
        }
        const inputEdgesUsed = inputEdges.slice(0, prefab.inputs.length)
        let outputEdgesUsed = outputEdges.slice(0, prefab.outputs.length)
        if (outputEdgesUsed.includes('top') && inputEdgesUsed.includes('top')) {
            outputEdgesUsed = outputEdgesUsed.filter((e) => e !== 'top')
        }
        if (outputEdgesUsed.length < prefab.outputs.length) {
            throw new Error(`Composite ${prefab.name}: pin edge conflict`)
        }
        prefab.inputs.forEach((port, i) => {
            const name = `in${i}`
            this.pins.set(name, new PinImplementation(name, 'input', 0))
            this.pinEdges[name] = rotateEdge(inputEdgesUsed[i], rotation)
            const src = new InnerSource()
            inner.setComponent(port.col - 1, port.row, src)
            this.innerSources.push(src)
        })
        prefab.outputs.forEach((port, i) => {
            const name = `out${i}`
            const pin = new PinImplementation(name, 'output', 0)
            this.pins.set(name, pin)
            this.pinEdges[name] = rotateEdge(outputEdgesUsed[i], rotation)
            this.outputCells.push({ pin, col: port.col, row: port.row })
        })
    }

    tick(): void {
        this.innerSources.forEach((src, i) => src.set(this.pins.get(`in${i}`)!.value))
        this.inner.settle()
        for (const { pin, col, row } of this.outputCells) {
            pin.setValue(this.inner.getCellValue(World.cellId(col, row)))
        }
    }
}
