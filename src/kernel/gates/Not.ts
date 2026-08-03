import type { Edge, Pin } from '../core/types'
import { PinImplementation } from '../core/PinImplementation'
import { BaseComponent } from '../core/BaseComponent'

export class Not extends BaseComponent {
    name = 'Not'
    pins: Map<string, Pin>
    pinEdges: Record<string, Edge> = { in: 'left', out: 'right' }

    constructor() {
        super()
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
