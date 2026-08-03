import type { Edge, Pin } from '../core/types'
import { PinImplementation } from '../core/PinImplementation'
import { BaseComponent } from '../core/BaseComponent'

export class Gnd extends BaseComponent {
    name: string = 'Gnd'
    pins: Map<string, Pin>
    pinEdges: Record<string, Edge> = { out: 'right' }

    constructor() {
        super()
        this.pins = new Map<string, Pin>([['out', new PinImplementation('out', 'output', 0)]])
    }

    tick(): void {
        this.pins.get('out')!.setValue(0)
    }
}
