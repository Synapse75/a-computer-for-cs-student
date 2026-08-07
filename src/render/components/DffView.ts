import { Container, Graphics } from 'pixi.js'
import type { Dff } from '../../kernel/gates/Dff'
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

export function createDffView(dff: Dff): ComponentView {
    const root = new Container()
    const body = new Graphics()
    root.addChild(body)

    const pinAnchors = new Map<string, { x: number; y: number }>()
    pinAnchors.set('d', ANCHOR_BY_EDGE[dff.pinEdges.d])
    pinAnchors.set('clk', ANCHOR_BY_EDGE[dff.pinEdges.clk])
    pinAnchors.set('q', ANCHOR_BY_EDGE[dff.pinEdges.q])

    for (const [, anchor] of pinAnchors) {
        const dot = new Graphics()
        dot.circle(anchor.x, anchor.y, 2)
        dot.fill({ color: COLORS.pinDot })
        dot.eventMode = 'none'
        root.addChild(dot)
    }

    const paint = () => {
        const value = dff.pins.get('q')!.value
        body.clear()
        body.rect(0, 0, SIZE, SIZE)
        body.fill({ color: value === 1 ? COLORS.on : COLORS.off })
        body.stroke({ color: COLORS.blockBorder, width: 1 })
    }
    paint()
    dff.pins.get('q')!.subscribe(paint)

    return { root, kernel: dff, body, pinAnchors }
}
