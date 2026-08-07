import type { Edge, Pin, Rotation, Signal } from '../core/types'
import { PinImplementation } from '../core/PinImplementation'
import { BaseComponent, rotateEdge } from '../core/BaseComponent'

/**
 * Edge-triggered D flip-flop. On the rising edge of `clk`, q latches d.
 * Base orientation: d from the left, clk from the top, q out to the right.
 */
export class Dff extends BaseComponent {
    name = 'Dff'
    pins: Map<string, Pin>
    pinEdges: Record<string, Edge> = { d: 'left', clk: 'top', q: 'right' }
    private prevClk: Signal = 0

    constructor(rotation: Rotation = 0) {
        super()
        this.rotation = rotation
        this.pinEdges = {
            d: rotateEdge('left', rotation),
            clk: rotateEdge('top', rotation),
            q: rotateEdge('right', rotation),
        }
        this.pins = new Map<string, Pin>([
            ['d', new PinImplementation('d', 'input', 0)],
            ['clk', new PinImplementation('clk', 'input', 0)],
            ['q', new PinImplementation('q', 'output', 0)],
        ])
    }

    tick(): void {
        const clk = this.pins.get('clk')!.value
        if (this.prevClk === 0 && clk === 1) {
            const d = this.pins.get('d')!.value
            this.pins.get('q')!.setValue(d)
        }
        this.prevClk = clk
    }
}
