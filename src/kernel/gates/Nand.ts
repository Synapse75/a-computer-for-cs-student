import type { Pin, Signal } from '../core/types'
import { PinImplementation } from '../core/PinImplementation'
import { BaseComponent } from '../core/BaseComponent'

export class Nand extends BaseComponent {
    name: string = 'Nand'
    pins: Map<string, Pin>

    constructor() {
        super()
        this.pins = new Map<string, Pin>([
            ['in1', new PinImplementation('in1', 'input', 0)],
            ['in2', new PinImplementation('in2', 'input', 0)],
            ['out', new PinImplementation('out', 'output', 0)]
        ])
    }

    tick(): void {
        const in1 = this.pins.get('in1')!.value
        const in2 = this.pins.get('in2')!.value
        const out = !(in1 && in2) ? 1 : 0
        this.pins.get('out')!.setValue(out)
    }
}