import { Container, Graphics } from 'pixi.js'
import type { Not } from '../../kernel/gates/Not'
import { GRID_SIZE } from '../utils/snap'
import { COLORS } from '../theme'
import type { ComponentView } from './types'

const SIZE = GRID_SIZE

export function createNotView(not: Not): ComponentView {
    const root = new Container()
    const body = new Graphics()
    root.addChild(body)

    const pinAnchors = new Map<string, { x: number; y: number }>()
    pinAnchors.set('in', { x: 0, y: SIZE / 2 })
    pinAnchors.set('out', { x: SIZE, y: SIZE / 2 })

    for (const [, anchor] of pinAnchors) {
        const dot = new Graphics()
        dot.circle(anchor.x, anchor.y, 2)
        dot.fill({ color: COLORS.pinDot })
        dot.eventMode = 'none'
        root.addChild(dot)
    }

    const paint = () => {
        const value = not.pins.get('out')!.value
        body.clear()
        body.rect(0, 0, SIZE, SIZE)
        body.fill({ color: value === 1 ? COLORS.on : COLORS.off })
        body.stroke({ color: COLORS.blockBorder, width: 1 })
    }
    paint()
    not.pins.get('out')!.subscribe(paint)

    return { root, kernel: not, body, pinAnchors }
}
