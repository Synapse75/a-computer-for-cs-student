
import type { Edge, Pin, Rotation } from './types'

const ROTATE_EDGE: Record<Edge, Edge> = {
    left: 'top',
    top: 'right',
    right: 'bottom',
    bottom: 'left',
}

/** Rotate an edge clockwise by `rotation` quarter turns. */
export function rotateEdge(edge: Edge, rotation: Rotation): Edge {
    let e = edge
    for (let i = 0; i < rotation; i++) e = ROTATE_EDGE[e]
    return e
}

export abstract class BaseComponent {
    rotation: Rotation = 0
    pins: Map<string, Pin> = new Map()
    /** Which grid edge each pin faces. Pins with no edge never connect to wires. */
    pinEdges: Record<string, Edge> = {}
    abstract tick(): void
}
