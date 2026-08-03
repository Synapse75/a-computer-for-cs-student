
import type { Edge, Pin } from './types'

export abstract class BaseComponent {
    pins: Map<string, Pin> = new Map()
    /** Which grid edge each pin faces. Pins with no edge never connect to wires. */
    pinEdges: Record<string, Edge> = {}
    abstract tick(): void
}
