import { useEffect, useRef, useState, useCallback } from 'react'
import { Application, Container, Graphics } from 'pixi.js'
import { Vcc } from './kernel/sources/Vcc'
import { Gnd } from './kernel/sources/Gnd'
import { Clock } from './kernel/sources/Clock'
import { Not } from './kernel/gates/Not'
import { Dff } from './kernel/gates/Dff'
import { Composite } from './kernel/composites/Composite'
import { World } from './kernel/world/World'
import { PREFABS } from './kernel/world/prefabs'
import { NAND_PREFAB, AND_PREFAB, OR_PREFAB, XOR_PREFAB, HALF_ADDER_PREFAB, MUX_PREFAB, DMUX_PREFAB } from './kernel/world/prefabs'
import type { Prefab } from './kernel/world/prefabs'
import { createVccView } from './render/components/VccView'
import { createGndView } from './render/components/GndView'
import { createClockView } from './render/components/ClockView'
import { createNotView } from './render/components/NotView'
import { createDffView } from './render/components/DffView'
import { createCompositeView } from './render/components/CompositeView'
import { createGridBackground } from './render/components/GridBackground'
import { createWireView, paintWire } from './render/components/WireView'
import { GRID_SIZE } from './render/utils/snap'
import { COLORS, CSS } from './render/theme'
import { ComponentPalette } from './app/components/ComponentPalette'
import { ControlPanel } from './app/components/ControlPanel'
import type { ComponentView } from './render/components/types'
import type { CellId } from './kernel/world/World'

const VIEW_FACTORIES: Record<string, (kernel: any) => ComponentView> = {
    Vcc: (k) => createVccView(k),
    Gnd: (k) => createGndView(k),
    Clock: (k) => createClockView(k),
    Not: (k) => createNotView(k),
    Dff: (k) => createDffView(k),
    Composite: (k) => createCompositeView(k),
}

const KERNEL_FACTORIES: Record<string, () => any> = {
    Vcc: () => new Vcc(),
    Gnd: () => new Gnd(),
    Clock: () => new Clock(),
    Not: () => new Not(),
    Dff: () => new Dff(),
}

const COLLAPSIBLE: Array<{ type: string; prefab: Prefab }> = [
    { type: 'Nand', prefab: NAND_PREFAB },
    { type: 'And', prefab: AND_PREFAB },
    { type: 'Or', prefab: OR_PREFAB },
    { type: 'Xor', prefab: XOR_PREFAB },
    { type: 'HalfAdder', prefab: HALF_ADDER_PREFAB },
    { type: 'Mux', prefab: MUX_PREFAB },
    { type: 'Dmux', prefab: DMUX_PREFAB },
]

function cellFromWorld(wx: number, wy: number): { col: number; row: number; id: CellId } {
    const col = Math.floor(wx / GRID_SIZE)
    const row = Math.floor(wy / GRID_SIZE)
    return { col, row, id: World.cellId(col, row) }
}

function App() {
    const containerRef = useRef<HTMLDivElement>(null)
    const worldRef = useRef<World | null>(null)
    const worldContainerRef = useRef<Container | null>(null)
    const componentViewsRef = useRef<Map<CellId, ComponentView>>(new Map())
    const wireViewsRef = useRef<Map<CellId, ReturnType<typeof createWireView>>>(new Map())
    const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const hoverOutlineRef = useRef<Graphics | null>(null)
    const wireDrawingRef = useRef({ active: false, col: 0, row: 0 })
    const dragStateRef = useRef({
        dragged: null as ComponentView | null,
        dragCellId: null as CellId | null,
        dragOffset: { x: 0, y: 0 },
        panning: false,
        panStart: { x: 0, y: 0 },
    })

    const [running, setRunning] = useState(false)
    const [speed, setSpeed] = useState(1)
    const [placingType, setPlacingType] = useState<string | null>(null)
    const [wireMode, setWireMode] = useState(false)
    const [collapseMode, setCollapseMode] = useState(false)
    const [ghostPos, setGhostPos] = useState({ x: 0, y: 0, occupied: false })

    const wireModeRef = useRef(false)
    useEffect(() => {
        wireModeRef.current = wireMode
    }, [wireMode])
    const collapseModeRef = useRef(false)
    useEffect(() => {
        collapseModeRef.current = collapseMode
    }, [collapseMode])

    if (!worldRef.current) worldRef.current = new World()

    const refreshWires = useCallback(() => {
        const world = worldRef.current!
        for (const [id, entry] of wireViewsRef.current) {
            paintWire(entry.graphics, world.getCellConnections(id), world.getCellValue(id))
        }
    }, [])

    const removeAt = useCallback((col: number, row: number) => {
        const world = worldRef.current!
        const id = World.cellId(col, row)
        if (!world.has(col, row)) return

        const cell = world.get(col, row)!
        if (cell.kind === 'component') {
            const view = componentViewsRef.current.get(id)
            if (view) {
                view.root.destroy({ children: true })
                componentViewsRef.current.delete(id)
            }
        } else {
            const entry = wireViewsRef.current.get(id)
            if (entry) {
                entry.root.destroy({ children: true })
                wireViewsRef.current.delete(id)
            }
        }
        world.remove(col, row)
        world.recompute()
        refreshWires()
    }, [refreshWires])

    const showOutlineAt = useCallback((col: number, row: number) => {
        const g = hoverOutlineRef.current
        if (!g) return
        g.clear()
        g.rect(col * GRID_SIZE, row * GRID_SIZE, GRID_SIZE, GRID_SIZE)
        g.fill({ color: 0xffffff, alpha: 0.12 })
        g.stroke({ color: COLORS.grid, width: 1 })
    }, [])

    const hideOutline = useCallback(() => {
        hoverOutlineRef.current?.clear()
    }, [])

    const placeWireCell = useCallback((col: number, row: number) => {
        const world = worldRef.current!
        const worldContainer = worldContainerRef.current
        if (!worldContainer || world.has(col, row)) return

        const id = World.cellId(col, row)
        world.setWire(col, row)

        const entry = createWireView()
        entry.root.x = col * GRID_SIZE
        entry.root.y = row * GRID_SIZE
        entry.hit.eventMode = 'static'
        entry.hit.cursor = 'pointer'
        worldContainer.addChild(entry.root)
        wireViewsRef.current.set(id, entry)
    }, [])

    const eraseAt = useCallback((col: number, row: number) => {
        const cell = worldRef.current!.get(col, row)
        if (cell?.kind === 'wire') removeAt(col, row)
    }, [removeAt])

    const eraseLine = useCallback((c0: number, r0: number, c1: number, r1: number) => {
        let c = c0
        let r = r0
        const dc = Math.abs(c1 - c0)
        const dr = Math.abs(r1 - r0)
        const sc = c0 < c1 ? 1 : -1
        const sr = r0 < r1 ? 1 : -1
        let err = dc - dr
        let guard = 0
        for (;;) {
            if (++guard > 2000) break
            eraseAt(c, r)
            if (c === c1 && r === r1) break
            const e2 = 2 * err
            if (e2 > -dr) {
                err -= dr
                c += sc
            }
            if (e2 < dc) {
                err += dc
                r += sr
            }
        }
    }, [eraseAt])

    const paintWireLine = useCallback((c0: number, r0: number, c1: number, r1: number) => {
        const world = worldRef.current!
        let c = c0
        let r = r0
        const dc = Math.abs(c1 - c0)
        const dr = Math.abs(r1 - r0)
        const sc = c0 < c1 ? 1 : -1
        const sr = r0 < r1 ? 1 : -1
        let err = dc - dr
        let guard = 0
        for (;;) {
            if (++guard > 2000) break
            if (!world.has(c, r)) placeWireCell(c, r)
            if (c === c1 && r === r1) break
            const e2 = 2 * err
            if (e2 > -dr) {
                err -= dr
                c += sc
            }
            if (e2 < dc) {
                err += dc
                r += sr
            }
        }
    }, [placeWireCell])

    const addComponentAt = useCallback((type: string, col: number, row: number) => {
        const world = worldRef.current!
        const worldContainer = worldContainerRef.current
        if (!worldContainer || world.has(col, row)) return

        const kernel = KERNEL_FACTORIES[type]()
        const view = VIEW_FACTORIES[type](kernel)
        const id = World.cellId(col, row)

        view.root.x = col * GRID_SIZE
        view.root.y = row * GRID_SIZE
        worldContainer.addChild(view.root)
        componentViewsRef.current.set(id, view)
        world.setComponent(col, row, kernel)

        view.body.eventMode = 'static'
        view.body.cursor = 'pointer'
        view.body.on('pointerdown', (event) => {
            if (event.button !== 0) return
            if (wireModeRef.current) return
            const ds = dragStateRef.current
            const w = worldContainerRef.current
            if (!w) return
            view.root.alpha = 0.55
            showOutlineAt(col, row)
            ds.dragged = view
            ds.dragCellId = id
            ds.dragOffset.x = view.root.x - (event.global.x - w.x) / w.scale.x
            ds.dragOffset.y = view.root.y - (event.global.y - w.y) / w.scale.y
            event.stopPropagation()
        })
        view.body.on('rightdown', () => removeAt(col, row))

        world.recompute()
        refreshWires()
    }, [refreshWires, removeAt, showOutlineAt])

    const attachComponent = useCallback((kernel: any, view: ComponentView, col: number, row: number) => {
        const worldContainer = worldContainerRef.current
        if (!worldContainer) return
        const id = World.cellId(col, row)
        view.root.x = col * GRID_SIZE
        view.root.y = row * GRID_SIZE
        worldContainer.addChild(view.root)
        componentViewsRef.current.set(id, view)
        worldRef.current!.setComponent(col, row, kernel)

        view.body.eventMode = 'static'
        view.body.cursor = 'pointer'
        view.body.on('pointerdown', (event) => {
            if (event.button !== 0) return
            if (wireModeRef.current) return
            const ds = dragStateRef.current
            const w = worldContainerRef.current
            if (!w) return
            view.root.alpha = 0.55
            showOutlineAt(col, row)
            ds.dragged = view
            ds.dragCellId = id
            ds.dragOffset.x = view.root.x - (event.global.x - w.x) / w.scale.x
            ds.dragOffset.y = view.root.y - (event.global.y - w.y) / w.scale.y
            event.stopPropagation()
        })
        view.body.on('rightdown', () => removeAt(col, row))
    }, [removeAt, showOutlineAt])

    const addPrefabAt = useCallback((type: string, col: number, row: number) => {
        const prefab = PREFABS[type]
        const world = worldRef.current!
        if (!prefab) return
        for (const cell of prefab.cells) {
            if (world.has(col + cell.col, row + cell.row)) return
        }
        for (const cell of prefab.cells) {
            const c = col + cell.col
            const r = row + cell.row
            if (cell.kind === 'not') {
                const kernel = new Not(cell.rotation ?? 0)
                const view = createNotView(kernel)
                attachComponent(kernel, view, c, r)
            } else {
                placeWireCell(c, r)
            }
        }
        world.recompute()
        refreshWires()
    }, [attachComponent, placeWireCell, refreshWires])

    const expandComposite = useCallback(
        (col: number, row: number) => {
            const world = worldRef.current!
            const worldContainer = worldContainerRef.current
            const cell = world.get(col, row)
            if (!worldContainer || !cell || cell.kind !== 'component' || !(cell.component instanceof Composite)) return
            const type = cell.component.prefabName
            if (!PREFABS[type]) return
            const view = componentViewsRef.current.get(World.cellId(col, row))
            if (view) {
                view.root.destroy({ children: true })
                componentViewsRef.current.delete(World.cellId(col, row))
            }
            world.remove(col, row)
            addPrefabAt(type, col, row)
        },
        [addPrefabAt]
    )

    const matchPrefab = useCallback(
        (cells: Array<{ col: number; row: number; kind: 'not' | 'wire'; rotation?: number }>) => {
            const minC = Math.min(...cells.map((c) => c.col))
            const minR = Math.min(...cells.map((c) => c.row))
            const norm = new Map<string, { kind: string; rotation?: number }>()
            for (const c of cells) norm.set(`${c.col - minC},${c.row - minR}`, { kind: c.kind, rotation: c.rotation })
            for (const entry of COLLAPSIBLE) {
                const prefab = entry.prefab
                let ok = true
                if (prefab.cells.length !== cells.length) continue
                for (const pc of prefab.cells) {
                    const found = norm.get(`${pc.col},${pc.row}`)
                    if (!found) {
                        ok = false
                        break
                    }
                    if (pc.kind === 'not') {
                        if (found.kind !== 'not' || (found.rotation ?? 0) !== (pc.rotation ?? 0)) {
                            ok = false
                            break
                        }
                    } else if (found.kind !== 'wire') {
                        ok = false
                        break
                    }
                }
                if (ok) return { type: entry.type, prefab, minC, minR }
            }
            return null
        },
        []
    )

    const collapseRegion = useCallback(
        (c0: number, r0: number, c1: number, r1: number) => {
            const world = worldRef.current!
            const worldContainer = worldContainerRef.current
            if (!worldContainer) return
            const loC = Math.min(c0, c1)
            const hiC = Math.max(c0, c1)
            const loR = Math.min(r0, r1)
            const hiR = Math.max(r0, r1)
            const cells: Array<{ col: number; row: number; kind: 'not' | 'wire'; rotation?: number }> = []
            const ids: CellId[] = []
            world.forEachCell((id, cell, col, row) => {
                if (col < loC || col > hiC || row < loR || row > hiR) return
                ids.push(id)
                if (cell.kind === 'component') {
                    cells.push({ col, row, kind: 'not', rotation: cell.component.rotation })
                } else {
                    cells.push({ col, row, kind: 'wire' })
                }
            })
            if (cells.length === 0) return
            const match = matchPrefab(cells)
            if (!match) {
                alert('选区需完整对应一个已知预制体（NAND/AND/OR/XOR/HalfAdder/MUX/DMUX）')
                return
            }
            for (const id of ids) {
                const view = componentViewsRef.current.get(id)
                if (view) {
                    view.root.destroy({ children: true })
                    componentViewsRef.current.delete(id)
                }
                const wire = wireViewsRef.current.get(id)
                if (wire) {
                    wire.root.destroy({ children: true })
                    wireViewsRef.current.delete(id)
                }
                const [cc, rr] = id.split(',').map(Number)
                world.remove(cc, rr)
            }
            const kernel = new Composite({ ...match.prefab, name: match.type })
            const view = createCompositeView(kernel)
            const col = match.minC
            const row = match.minR
            view.root.x = col * GRID_SIZE
            view.root.y = row * GRID_SIZE
            worldContainer.addChild(view.root)
            componentViewsRef.current.set(World.cellId(col, row), view)
            world.setComponent(col, row, kernel)
            view.body.eventMode = 'static'
            view.body.cursor = 'pointer'
            view.body.on('pointerdown', (event) => {
                if (event.button !== 2) return
                expandComposite(col, row)
            })
            world.recompute()
            refreshWires()
        },
        [matchPrefab, expandComposite, refreshWires]
    )

    // Default demo: a static Vcc->NOT->NOT->(Gnd) reference row plus a
    // Clock-driven NOT chain (blinks at the clock's pace), both ending at Gnd.
    const buildDefaultDemo = useCallback(() => {
        const world = worldRef.current!
        let occupied = false
        world.forEachCell(() => {
            occupied = true
        })
        if (occupied) return

        // static reference row: Vcc -> NOT -> NOT -> (Gnd merged at tail)
        addComponentAt('Vcc', 2, 2)
        placeWireCell(3, 2)
        addComponentAt('Not', 4, 2)
        placeWireCell(5, 2)
        addComponentAt('Not', 6, 2)
        placeWireCell(7, 2)
        addComponentAt('Gnd', 7, 3)
        placeWireCell(8, 3)
        placeWireCell(8, 2)

        // clock-driven chain: Clock -> NOT x4 -> (Gnd merged at tail)
        addComponentAt('Clock', 2, 6)
        placeWireCell(3, 6)
        addComponentAt('Not', 4, 6)
        placeWireCell(5, 6)
        addComponentAt('Not', 6, 6)
        placeWireCell(7, 6)
        addComponentAt('Not', 8, 6)
        placeWireCell(9, 6)
        addComponentAt('Not', 10, 6)
        placeWireCell(11, 6)
        addComponentAt('Gnd', 11, 7)
        placeWireCell(12, 7)
        placeWireCell(12, 6)

        // DFF demo row: Vcc -> d, Clock -> clk, q -> NOT (blinks on clock edges)
        addComponentAt('Clock', 2, 10)
        placeWireCell(3, 10)
        placeWireCell(4, 10)
        placeWireCell(4, 9)
        placeWireCell(5, 9)
        addComponentAt('Vcc', 3, 11)
        placeWireCell(4, 11)
        addComponentAt('Dff', 5, 10)
        placeWireCell(6, 10)
        placeWireCell(7, 10)
        addComponentAt('Not', 8, 10)
        placeWireCell(9, 10)
        addComponentAt('Gnd', 9, 11)
        placeWireCell(10, 11)
        placeWireCell(10, 10)

        world.recompute()
        refreshWires()
        setRunning(true)
        setSpeed(2)
    }, [addComponentAt, placeWireCell, refreshWires])

    // --- palette drag-to-place (snapped ghost + translucent drop preview) ---
    useEffect(() => {
        if (!placingType) return

        const onMouseMove = (e: MouseEvent) => {
            const canvas = containerRef.current?.querySelector('canvas')
            const w = worldContainerRef.current
            if (!canvas || !w) return
            const rect = canvas.getBoundingClientRect()
            const wx = (e.clientX - rect.left - w.x) / w.scale.x
            const wy = (e.clientY - rect.top - w.y) / w.scale.y
            const { col, row } = cellFromWorld(wx, wy)
            const sx = rect.left + w.x + col * GRID_SIZE * w.scale.x
            const sy = rect.top + w.y + row * GRID_SIZE * w.scale.y
            setGhostPos({ x: sx, y: sy, occupied: worldRef.current!.has(col, row) })
        }
        const onMouseUp = (e: MouseEvent) => {
            const canvas = containerRef.current?.querySelector('canvas')
            const w = worldContainerRef.current
            if (canvas && w) {
                const rect = canvas.getBoundingClientRect()
                const cx = e.clientX - rect.left
                const cy = e.clientY - rect.top
                if (cx >= 0 && cx <= rect.width && cy >= 0 && cy <= rect.height) {
                    const wx = (cx - w.x) / w.scale.x
                    const wy = (cy - w.y) / w.scale.y
                    const { col, row } = cellFromWorld(wx, wy)
                    if (PREFABS[placingType]) addPrefabAt(placingType, col, row)
                    else addComponentAt(placingType, col, row)
                }
            }
            setPlacingType(null)
        }

        document.addEventListener('mousemove', onMouseMove)
        document.addEventListener('mouseup', onMouseUp)
        return () => {
            document.removeEventListener('mousemove', onMouseMove)
            document.removeEventListener('mouseup', onMouseUp)
        }
    }, [placingType, addComponentAt, addPrefabAt])

    // --- wire drawing mode: hold left button and drag to paint a continuous run ---
    useEffect(() => {
        if (!wireMode) return
        const canvas = containerRef.current?.querySelector('canvas')
        if (!canvas) return

        const toCell = (e: MouseEvent) => {
            const w = worldContainerRef.current
            if (!w) return null
            const rect = canvas.getBoundingClientRect()
            const wx = (e.clientX - rect.left - w.x) / w.scale.x
            const wy = (e.clientY - rect.top - w.y) / w.scale.y
            return cellFromWorld(wx, wy)
        }

        const onPointerDown = (e: PointerEvent) => {
            if (e.button !== 0) return
            const cell = toCell(e)
            if (!cell) return
            wireDrawingRef.current = { active: true, col: cell.col, row: cell.row }
            placeWireCell(cell.col, cell.row)
            worldRef.current!.recompute()
            refreshWires()
            try {
                canvas.setPointerCapture(e.pointerId)
            } catch {
                // pointer capture is optional
            }
        }

        const onPointerMove = (e: PointerEvent) => {
            const cell = toCell(e)
            if (!cell) return
            showOutlineAt(cell.col, cell.row)
            const d = wireDrawingRef.current
            if (!d.active) return
            if (d.col === cell.col && d.row === cell.row) return
            paintWireLine(d.col, d.row, cell.col, cell.row)
            d.col = cell.col
            d.row = cell.row
            worldRef.current!.recompute()
            refreshWires()
        }

        const onPointerUp = () => {
            wireDrawingRef.current.active = false
        }

        const onPointerLeave = () => {
            if (!wireDrawingRef.current.active) hideOutline()
        }

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setWireMode(false)
        }

        canvas.addEventListener('pointerdown', onPointerDown)
        canvas.addEventListener('pointermove', onPointerMove)
        canvas.addEventListener('pointerup', onPointerUp)
        canvas.addEventListener('pointerleave', onPointerLeave)
        document.addEventListener('keydown', onKeyDown)
        return () => {
            canvas.removeEventListener('pointerdown', onPointerDown)
            canvas.removeEventListener('pointermove', onPointerMove)
            canvas.removeEventListener('pointerup', onPointerUp)
            canvas.removeEventListener('pointerleave', onPointerLeave)
            document.removeEventListener('keydown', onKeyDown)
            hideOutline()
        }
    }, [wireMode, placeWireCell, paintWireLine, showOutlineAt, hideOutline, refreshWires])

    const doStep = useCallback(() => {
        worldRef.current!.step()
        refreshWires()
    }, [refreshWires])

    const toggleRun = useCallback(() => {
        setRunning((r) => !r)
    }, [])

    const resetAll = useCallback(() => {
        worldRef.current!.clear()
        for (const view of componentViewsRef.current.values()) view.root.destroy({ children: true })
        for (const entry of wireViewsRef.current.values()) entry.root.destroy({ children: true })
        componentViewsRef.current.clear()
        wireViewsRef.current.clear()
        hideOutline()
        refreshWires()
    }, [refreshWires, hideOutline])

    // --- tick timer ---
    useEffect(() => {
        if (running) {
            const intervalMs = Math.max(50, 1000 / speed)
            tickTimerRef.current = setInterval(doStep, intervalMs)
        } else {
            if (tickTimerRef.current) {
                clearInterval(tickTimerRef.current)
                tickTimerRef.current = null
            }
        }
        return () => {
            if (tickTimerRef.current) clearInterval(tickTimerRef.current)
        }
    }, [running, speed, doStep])

    // --- PixiJS init ---
    useEffect(() => {
        worldRef.current = new World()
        componentViewsRef.current.clear()
        wireViewsRef.current.clear()
        const application = new Application()

        application.init({ resizeTo: containerRef.current!, background: COLORS.background }).then(() => {
            containerRef.current!.appendChild(application.canvas)

            const w = new Container()
            application.stage.addChild(w)
            worldContainerRef.current = w

            const grid = createGridBackground()
            w.addChild(grid)

            const hoverOutline = new Graphics()
            w.addChild(hoverOutline)
            hoverOutlineRef.current = hoverOutline

            application.stage.eventMode = 'static'
            application.stage.hitArea = { contains: () => true }

            application.canvas.addEventListener('contextmenu', (e) => e.preventDefault())

            application.stage.on('pointerdown', (event) => {
                if (event.button !== 0) return
                if (wireModeRef.current) return
                if (collapseModeRef.current) return
                if (event.target !== application.stage) return
                const ds = dragStateRef.current
                ds.panning = true
                ds.panStart.x = event.global.x - w.x
                ds.panStart.y = event.global.y - w.y
            })

            application.stage.on('pointermove', (event) => {
                const ds = dragStateRef.current
                if (ds.dragged) {
                    const sw = w.scale.x
                    const rawX = (event.global.x - w.x) / sw + ds.dragOffset.x
                    const rawY = (event.global.y - w.y) / sw + ds.dragOffset.y
                    const { col, row } = cellFromWorld(rawX, rawY)
                    ds.dragged.root.x = col * GRID_SIZE
                    ds.dragged.root.y = row * GRID_SIZE
                    showOutlineAt(col, row)
                } else if (ds.panning) {
                    w.x = event.global.x - ds.panStart.x
                    w.y = event.global.y - ds.panStart.y
                }
            })

            application.stage.on('pointerup', () => {
                const ds = dragStateRef.current
                if (ds.dragged && ds.dragCellId) {
                    const world = worldRef.current!
                    const old = ds.dragCellId
                    const { col, row } = cellFromWorld(ds.dragged.root.x, ds.dragged.root.y)
                    const newId = World.cellId(col, row)
                    if (newId !== old && world.has(col, row)) {
                        // target occupied: revert to previous cell
                        const oldPos = parseCellId(old)
                        ds.dragged.root.x = oldPos.col * GRID_SIZE
                        ds.dragged.root.y = oldPos.row * GRID_SIZE
                    } else if (newId !== old) {
                        // move component in the world grid
                        const view = ds.dragged
                        world.remove(parseCellId(old).col, parseCellId(old).row)
                        world.setComponent(col, row, view.kernel)
                        componentViewsRef.current.delete(old)
                        componentViewsRef.current.set(newId, view)
                        world.recompute()
                        refreshWires()
                    }
                }
                if (ds.dragged) ds.dragged.root.alpha = 1
                hideOutline()
                ds.dragged = null
                ds.dragCellId = null
                ds.panning = false
            })

            application.canvas.addEventListener(
                'wheel',
                (event) => {
                    event.preventDefault()
                    const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1
                    const minZoom = 0.2
                    const maxZoom = 5.0
                    const oldScale = w.scale.x
                    const newScale = Math.max(minZoom, Math.min(maxZoom, oldScale * zoomFactor))
                    const rect = application.canvas.getBoundingClientRect()
                    const mouseX = event.clientX - rect.left
                    const mouseY = event.clientY - rect.top
                    const worldX = (mouseX - w.x) / oldScale
                    const worldY = (mouseY - w.y) / oldScale
                    w.scale.set(newScale)
                    w.x = mouseX - worldX * newScale
                    w.y = mouseY - worldY * newScale
                },
                { passive: false }
            )

            buildDefaultDemo()

            // continuous right-drag eraser: deletes every wire cell along the path
            const eraseState = { active: false, col: 0, row: 0 }
            const toCellE = (e: PointerEvent) => {
                const rect = application.canvas.getBoundingClientRect()
                const wx = (e.clientX - rect.left - w.x) / w.scale.x
                const wy = (e.clientY - rect.top - w.y) / w.scale.y
                return cellFromWorld(wx, wy)
            }
            const onEraseDown = (e: PointerEvent) => {
                if (e.button !== 2) return
                const cell = toCellE(e)
                if (!cell) return
                eraseState.active = true
                eraseState.col = cell.col
                eraseState.row = cell.row
                eraseAt(cell.col, cell.row)
                try {
                    application.canvas.setPointerCapture(e.pointerId)
                } catch {
                    // optional
                }
            }
            const onEraseMove = (e: PointerEvent) => {
                if (!eraseState.active) return
                const cell = toCellE(e)
                if (!cell) return
                if (cell.col === eraseState.col && cell.row === eraseState.row) return
                eraseLine(eraseState.col, eraseState.row, cell.col, cell.row)
                eraseState.col = cell.col
                eraseState.row = cell.row
            }
            const onEraseUp = () => {
                eraseState.active = false
            }
            application.canvas.addEventListener('pointerdown', onEraseDown)
            application.canvas.addEventListener('pointermove', onEraseMove)
            application.canvas.addEventListener('pointerup', onEraseUp)

            // collapse mode: drag to select a region; on release collapse it
            const collapseState = { active: false, startCol: 0, startRow: 0, curCol: 0, curRow: 0 }
            const collapseRect = new Graphics()
            w.addChild(collapseRect)
            const toCellCl = (e: PointerEvent) => {
                const rect = application.canvas.getBoundingClientRect()
                const wx = (e.clientX - rect.left - w.x) / w.scale.x
                const wy = (e.clientY - rect.top - w.y) / w.scale.y
                return cellFromWorld(wx, wy)
            }
            const paintCollapseRect = () => {
                const s = collapseState
                collapseRect.clear()
                const x = Math.min(s.startCol, s.curCol) * GRID_SIZE
                const y = Math.min(s.startRow, s.curRow) * GRID_SIZE
                const wpx = (Math.abs(s.curCol - s.startCol) + 1) * GRID_SIZE
                const hpx = (Math.abs(s.curRow - s.startRow) + 1) * GRID_SIZE
                collapseRect.rect(x, y, wpx, hpx)
                collapseRect.stroke({ color: 0xaaaaaa, width: 1 })
                collapseRect.fill({ color: 0xffffff, alpha: 0.08 })
            }
            const onCollapseDown = (e: PointerEvent) => {
                if (e.button !== 0 || !collapseModeRef.current) return
                const cell = toCellCl(e)
                if (!cell) return
                collapseState.active = true
                collapseState.startCol = collapseState.curCol = cell.col
                collapseState.startRow = collapseState.curRow = cell.row
                paintCollapseRect()
            }
            const onCollapseMove = (e: PointerEvent) => {
                if (!collapseState.active || !collapseModeRef.current) return
                const cell = toCellCl(e)
                if (!cell) return
                collapseState.curCol = cell.col
                collapseState.curRow = cell.row
                paintCollapseRect()
            }
            const onCollapseUp = () => {
                if (!collapseState.active) return
                collapseState.active = false
                collapseRect.clear()
                collapseRegion(collapseState.startCol, collapseState.startRow, collapseState.curCol, collapseState.curRow)
            }
            application.canvas.addEventListener('pointerdown', onCollapseDown)
            application.canvas.addEventListener('pointermove', onCollapseMove)
            application.canvas.addEventListener('pointerup', onCollapseUp)
        })

        return () => {
            hoverOutlineRef.current = null
            application.destroy(true)
        }
    }, [refreshWires, showOutlineAt, hideOutline, buildDefaultDemo, eraseAt, eraseLine, collapseRegion])

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
                height: '100%',
                position: 'relative',
            }}
        >
            {placingType && (
                <div
                    style={{
                        position: 'fixed',
                        left: ghostPos.x,
                        top: ghostPos.y,
                        width: 20,
                        height: 20,
                        background: CSS.ghostFill,
                        border: `2px solid ${CSS.ghostBorder}`,
                        borderRadius: 2,
                        pointerEvents: 'none',
                        zIndex: 1000,
                        opacity: ghostPos.occupied ? 0.3 : 0.75,
                    }}
                />
            )}
            <ControlPanel
                running={running}
                speed={speed}
                wireMode={wireMode}
                onToggleRun={toggleRun}
                onStep={doStep}
                onSpeedChange={setSpeed}
                onReset={resetAll}
            />
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                <ComponentPalette
                    wireMode={wireMode}
                    collapseMode={collapseMode}
                    onDragStart={(type) => {
                        setWireMode(false)
                        setCollapseMode(false)
                        setPlacingType(type)
                    }}
                    onToggleWire={() => {
                        setPlacingType(null)
                        setCollapseMode(false)
                        setWireMode((v) => !v)
                    }}
                    onToggleCollapse={() => {
                        setPlacingType(null)
                        setWireMode(false)
                        setCollapseMode((v) => !v)
                    }}
                />
                <div ref={containerRef} style={{ flex: 1 }} />
            </div>
        </div>
    )
}

function parseCellId(id: CellId): { col: number; row: number } {
    const [c, r] = id.split(',')
    return { col: Number(c), row: Number(r) }
}

export default App
