import { Container, Graphics, Text } from 'pixi.js'
import type { Composite } from '../../kernel/composites/Composite'
import type { Edge } from '../../kernel/core/types'
import { GRID_SIZE } from '../utils/snap'
import { COLORS } from '../theme'
import type { ComponentView } from './types'

const SIZE = GRID_SIZE

const ANCHOR_BY_EDGE: Record<Edge, { x: number; y: number }> = {
    left: { x: 0, y: SIZE / 2 },
    right: { x: SIZE, y: SIZE / 2 },
    top: { x: SIZE / 2, y: 0 },
    bottom: { x: SIZE / 2, y: SIZE },
}

export function createCompositeView(composite: Composite): ComponentView {
    const root = new Container()
    const body = new Graphics()
    root.addChild(body)

    const pinAnchors = new Map<string, { x: number; y: number }>()
    for (const [name, edge] of Object.entries(composite.pinEdges)) {
        pinAnchors.set(name, ANCHOR_BY_EDGE[edge])
    }
    for (const [, anchor] of pinAnchors) {
        const dot = new Graphics()
        dot.circle(anchor.x, anchor.y, 2)
        dot.fill({ color: COLORS.pinDot })
        dot.eventMode = 'none'
        root.addChild(dot)
    }

    const label = new Text({
        text: composite.name,
        style: { fontSize: 7, fill: 0xcccccc, fontFamily: 'monospace' },
    })
    label.anchor.set(0.5)
    label.x = SIZE / 2
    label.y = SIZE / 2
    root.addChild(label)

    const paint = () => {
        const anyOut = [...composite.pins.values()].some((p) => p.direction === 'output' && p.value === 1)
        body.clear()
        body.rect(0, 0, SIZE, SIZE)
        body.fill({ color: anyOut ? COLORS.on : COLORS.off })
        body.stroke({ color: COLORS.blockBorder, width: 1 })
    }
    paint()
    for (const pin of composite.pins.values()) {
        if (pin.direction === 'output') pin.subscribe(paint)
    }

    return { root, kernel: composite, body, pinAnchors }
}
