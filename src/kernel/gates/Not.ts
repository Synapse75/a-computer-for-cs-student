import type { Edge, Pin, Rotation } from '../core/types'
import { PinImplementation } from '../core/PinImplementation'
import { BaseComponent, rotateEdge } from '../core/BaseComponent'

export class Not extends BaseComponent {
    name = 'Not'
    pins: Map<string, Pin>
    pinEdges: Record<string, Edge> = { in: 'left', out: 'right' }

    constructor(rotation: Rotation = 0) {
        super()
        this.rotation = rotation
        this.pinEdges = { in: rotateEdge('left', rotation), out: rotateEdge('right', rotation) }
        this.pins = new Map<string, Pin>([
            ['in', new PinImplementation('in', 'input', 0)],
            ['out', new PinImplementation('out', 'output', 0)]
        ])
    }

    tick(): void {
        const input = this.pins.get('in')!.value
        this.pins.get('out')!.setValue(input === 1 ? 0 : 1)
    }
}
