import { Graphics } from 'pixi.js'
import { GRID_SIZE } from '../utils/snap'
import { COLORS } from '../theme'

const RANGE = 2000

export function createGridBackground(): Graphics {
    const grid = new Graphics()

    for (let x = -RANGE; x <= RANGE; x += GRID_SIZE) {
        for (let y = -RANGE; y <= RANGE; y += GRID_SIZE) {
            grid.circle(x, y, 1)
        }
    }
    grid.fill({ color: COLORS.grid })

    return grid
}
