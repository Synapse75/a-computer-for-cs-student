import { Container, Graphics } from 'pixi.js'
import type { Vcc } from '../../kernel/sources/Vcc'
import { GRID_SIZE } from '../utils/snap'
import { COLORS, COMPONENT_COLORS } from '../theme'
import type { ComponentView } from './types'

const SIZE = GRID_SIZE

export function createVccView(vcc: Vcc): ComponentView {
    const root = new Container()
    const body = new Graphics()
    body.rect(0, 0, SIZE, SIZE)
    body.fill({ color: COMPONENT_COLORS.Vcc.on }) // Vcc 恒为 1：低饱和绿，亮度 75%
    body.stroke({ color: COLORS.blockBorder, width: 1 })
    root.addChild(body)

    const pinAnchors = new Map<string, { x: number; y: number }>()
    pinAnchors.set('out', { x: SIZE, y: SIZE / 2 })

    const dot = new Graphics()
    dot.circle(SIZE, SIZE / 2, 2)
    dot.fill({ color: COLORS.pinDot })
    dot.eventMode = 'none'
    root.addChild(dot)

    return { root, kernel: vcc, body, pinAnchors }
}
