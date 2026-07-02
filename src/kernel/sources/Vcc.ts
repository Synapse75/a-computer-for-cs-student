import type { Pin, Signal } from '../core/types'
import { PinImplementation } from '../core/PinImplementation'
import { BaseComponent } from '../core/BaseComponent'

export class Vcc extends BaseComponent {
    name: string = 'Vcc'
    pins: Map<string, Pin>

    constructor() {
        super()
        this.pins = new Map<string, Pin>([['out', new PinImplementation('out', 'output', 1)]])
    }

    tick(): void {
        this.pins.get('out')!.setValue(1)
    }
}