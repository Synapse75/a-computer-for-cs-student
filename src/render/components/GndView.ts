import { Container, Graphics } from 'pixi.js'
import type { Gnd } from '../../kernel/sources/Gnd'
import { GRID_SIZE } from '../utils/snap'
import { COLORS, COMPONENT_COLORS } from '../theme'
import type { ComponentView } from './types'

const SIZE = GRID_SIZE

export function createGndView(gnd: Gnd): ComponentView {
    const root = new Container()
    const body = new Graphics()
    body.rect(0, 0, SIZE, SIZE)
    body.fill({ color: COMPONENT_COLORS.Gnd.off }) // Gnd 恒为 0：低饱和蓝，亮度 50%
    body.stroke({ color: COLORS.blockBorder, width: 1 })
    root.addChild(body)

    const pinAnchors = new Map<string, { x: number; y: number }>()
    pinAnchors.set('out', { x: SIZE, y: SIZE / 2 })

    const dot = new Graphics()
    dot.circle(SIZE, SIZE / 2, 2)
    dot.fill({ color: COLORS.pinDot })
    dot.eventMode = 'none'
    root.addChild(dot)

    return { root, kernel: gnd, body, pinAnchors }
}
