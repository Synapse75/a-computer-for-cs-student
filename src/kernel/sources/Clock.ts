import type { Edge, Pin } from '../core/types'
import { PinImplementation } from '../core/PinImplementation'
import { BaseComponent } from '../core/BaseComponent'

export class Clock extends BaseComponent {
    name = 'Clock'
    pins: Map<string, Pin>
    pinEdges: Record<string, Edge> = { out: 'right' }

    constructor() {
        super()
        this.pins = new Map<string, Pin>([['out', new PinImplementation('out', 'output', 0)]])
    }

    tick(): void {
        const current = this.pins.get('out')!.value
        this.pins.get('out')!.setValue(current === 1 ? 0 : 1)
    }
}
