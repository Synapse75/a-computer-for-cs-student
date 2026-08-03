import { Container, Graphics } from 'pixi.js'
import type { Clock } from '../../kernel/sources/Clock'
import { GRID_SIZE } from '../utils/snap'
import { COLORS, COMPONENT_COLORS } from '../theme'
import type { ComponentView } from './types'

const SIZE = GRID_SIZE

export function createClockView(clock: Clock): ComponentView {
    const root = new Container()
    const body = new Graphics()
    root.addChild(body)

    const pinAnchors = new Map<string, { x: number; y: number }>()
    pinAnchors.set('out', { x: SIZE, y: SIZE / 2 })

    const dot = new Graphics()
    dot.circle(SIZE, SIZE / 2, 2)
    dot.fill({ color: COLORS.pinDot })
    dot.eventMode = 'none'
    root.addChild(dot)

    const paint = () => {
        const value = clock.pins.get('out')!.value
        body.clear()
        body.rect(0, 0, SIZE, SIZE)
        body.fill({ color: value === 1 ? COMPONENT_COLORS.Clock.on : COMPONENT_COLORS.Clock.off })
        body.stroke({ color: COLORS.blockBorder, width: 1 })
    }
    paint()
    clock.pins.get('out')!.subscribe(paint)

    return { root, kernel: clock, body, pinAnchors }
}
