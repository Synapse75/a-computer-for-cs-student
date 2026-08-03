import { Container, Graphics } from 'pixi.js'
import { GRID_SIZE } from '../utils/snap'
import { COLORS } from '../theme'
import type { Edge } from '../../kernel/core/types'

const SIZE = GRID_SIZE

export interface WireViewEntry {
    root: Container
    hit: Graphics
    graphics: Graphics
}

export function createWireView(): WireViewEntry {
    const root = new Container()

    const hit = new Graphics()
    hit.rect(0, 0, SIZE, SIZE)
    hit.fill({ color: 0xffffff, alpha: 0 })
    root.addChild(hit)

    const graphics = new Graphics()
    graphics.eventMode = 'none'
    root.addChild(graphics)

    return { root, hit, graphics }
}

export function paintWire(graphics: Graphics, connections: Edge[], value: 0 | 1): void {
    graphics.clear()
    const color = value === 1 ? COLORS.wireOn : COLORS.wireOff
    const cx = SIZE / 2
    const cy = SIZE / 2

    for (const edge of connections) {
        graphics.moveTo(cx, cy)
        if (edge === 'left') graphics.lineTo(0, cy)
        else if (edge === 'right') graphics.lineTo(SIZE, cy)
        else if (edge === 'top') graphics.lineTo(cx, 0)
        else graphics.lineTo(cx, SIZE)
    }
    if (connections.length > 0) graphics.stroke({ width: 2, color })

    // junction dot: T / cross always; elbow (two perpendicular) too; isolated wire shows a dot
    const n = connections.length
    const twoStraight = n === 2 && (
        (connections.includes('left') && connections.includes('right')) ||
        (connections.includes('top') && connections.includes('bottom'))
    )
    if (n === 0 || n >= 3 || (n === 2 && !twoStraight)) {
        graphics.circle(cx, cy, n === 0 ? 2 : n >= 3 ? 3 : 2)
        graphics.fill({ color })
    }
}
