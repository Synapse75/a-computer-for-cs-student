import type { BaseComponent } from '../core/BaseComponent'
import type { Edge, Pin, Signal } from '../core/types'

export type CellId = string

export interface ComponentCell {
    kind: 'component'
    component: BaseComponent
}

export interface WireCell {
    kind: 'wire'
}

export type Cell = ComponentCell | WireCell

const EDGES: Edge[] = ['left', 'right', 'top', 'bottom']

const DELTA: Record<Edge, { dc: number; dr: number; opposite: Edge }> = {
    left: { dc: -1, dr: 0, opposite: 'right' },
    right: { dc: 1, dr: 0, opposite: 'left' },
    top: { dc: 0, dr: -1, opposite: 'bottom' },
    bottom: { dc: 0, dr: 1, opposite: 'top' },
}

function parseId(id: CellId): { col: number; row: number } {
    const [c, r] = id.split(',')
    return { col: Number(c), row: Number(r) }
}

function wireNode(col: number, row: number): string {
    return `w:${col},${row}`
}

function pinNode(col: number, row: number, pinName: string): string {
    return `p:${col},${row}:${pinName}`
}

/**
 * Grid world: components and wire blocks occupy cells. Adjacent cells connect
 * through shared edges (wire↔wire, wire↔component pin, component output↔input).
 * Components are boundaries: their input side and output side never join the
 * same wire network. Every connected group of nodes is one wire network whose
 * value is the OR of all attached output pins; every attached input pin
 * receives that value.
 */
export class World {
    private cells = new Map<CellId, Cell>()
    private valueByCell = new Map<CellId, Signal>()
    private connectionsByCell = new Map<CellId, Edge[]>()

    static cellId(col: number, row: number): CellId {
        return `${col},${row}`
    }

    has(col: number, row: number): boolean {
        return this.cells.has(World.cellId(col, row))
    }

    get(col: number, row: number): Cell | undefined {
        return this.cells.get(World.cellId(col, row))
    }

    setComponent(col: number, row: number, component: BaseComponent): void {
        this.cells.set(World.cellId(col, row), { kind: 'component', component })
    }

    setWire(col: number, row: number): void {
        this.cells.set(World.cellId(col, row), { kind: 'wire' })
    }

    remove(col: number, row: number): void {
        const id = World.cellId(col, row)
        this.cells.delete(id)
        this.valueByCell.delete(id)
        this.connectionsByCell.delete(id)
    }

    clear(): void {
        this.cells.clear()
        this.valueByCell.clear()
        this.connectionsByCell.clear()
    }

    forEachCell(cb: (id: CellId, cell: Cell, col: number, row: number) => void): void {
        for (const [id, cell] of this.cells) {
            const { col, row } = parseId(id)
            cb(id, cell, col, row)
        }
    }

    getCellValue(id: CellId): Signal {
        return this.valueByCell.get(id) ?? 0
    }

    getCellConnections(id: CellId): Edge[] {
        return this.connectionsByCell.get(id) ?? []
    }

    /** Debug helper: all wire cells in the same network as the given cell. */
    debugNet(id: CellId): CellId[] {
        this.recompute()
        const visited = new Set<CellId>([id])
        const queue = [id]
        while (queue.length > 0) {
            const cur = queue.shift()!
            const { col, row } = parseId(cur)
            const cell = this.cells.get(cur)
            if (!cell) continue
            for (const edge of this.connectionsByCell.get(cur) ?? []) {
                const delta = DELTA[edge]
                const nid = World.cellId(col + delta.dc, row + delta.dr)
                const ncell = this.cells.get(nid)
                if (ncell?.kind === 'wire' && !visited.has(nid)) {
                    visited.add(nid)
                    queue.push(nid)
                }
            }
        }
        return [...visited]
    }

    tickAll(): void {
        for (const cell of this.cells.values()) {
            if (cell.kind === 'component') cell.component.tick()
        }
    }

    /** Rebuild wire networks, pushing OR values into connected inputs. Returns true if any input changed. */
    recompute(): boolean {
        const edges = new Map<string, string[]>()
        const addEdge = (a: string, b: string) => {
            if (a === b) return
            const la = edges.get(a) ?? []
            if (!la.includes(b)) {
                la.push(b)
                edges.set(a, la)
            }
            const lb = edges.get(b) ?? []
            if (!lb.includes(a)) {
                lb.push(a)
                edges.set(b, lb)
            }
        }

        const connectionsByCell = new Map<CellId, Edge[]>()
        const addWireConnection = (col: number, row: number, edge: Edge) => {
            const id = World.cellId(col, row)
            const list = connectionsByCell.get(id) ?? []
            if (!list.includes(edge)) list.push(edge)
            connectionsByCell.set(id, list)
        }

        for (const [id, cell] of this.cells) {
            const { col, row } = parseId(id)
            if (cell.kind === 'wire') {
                for (const edge of EDGES) {
                    const delta = DELTA[edge]
                    const nc = col + delta.dc
                    const nr = row + delta.dr
                    const neighbor = this.cells.get(World.cellId(nc, nr))
                    if (!neighbor) continue
                    if (neighbor.kind === 'wire') {
                        addEdge(wireNode(col, row), wireNode(nc, nr))
                        addWireConnection(col, row, edge)
                    } else {
                        const pinName = this.pinOnEdge(neighbor.component, delta.opposite)
                        if (pinName) {
                            addEdge(wireNode(col, row), pinNode(nc, nr, pinName))
                            addWireConnection(col, row, edge)
                        }
                    }
                }
            } else {
                for (const [pinName, pin] of cell.component.pins) {
                    const edge = cell.component.pinEdges[pinName]
                    if (!edge) continue
                    const delta = DELTA[edge]
                    const nc = col + delta.dc
                    const nr = row + delta.dr
                    const neighbor = this.cells.get(World.cellId(nc, nr))
                    if (!neighbor) continue
                    if (neighbor.kind === 'wire') {
                        addEdge(pinNode(col, row, pinName), wireNode(nc, nr))
                    } else {
                        const opposite = delta.opposite
                        const wanted = pin.direction === 'output' ? 'input' : 'output'
                        const nbPin = this.pinOnEdge(neighbor.component, opposite, wanted)
                        if (nbPin) {
                            addEdge(pinNode(col, row, pinName), pinNode(nc, nr, nbPin))
                        }
                    }
                }
            }
        }

        const visited = new Set<string>()
        const valueByCell = new Map<CellId, Signal>()
        const inputAssignments = new Map<Pin, Signal>()

        for (const start of edges.keys()) {
            if (visited.has(start)) continue

            const group: string[] = []
            const queue = [start]
            visited.add(start)
            while (queue.length > 0) {
                const cur = queue.shift()!
                group.push(cur)
                for (const nb of edges.get(cur) ?? []) {
                    if (!visited.has(nb)) {
                        visited.add(nb)
                        queue.push(nb)
                    }
                }
            }

            let value: Signal = 0
            for (const node of group) {
                const pin = this.pinFromNode(node)
                if (pin && pin.direction === 'output') value = (value | pin.value) as Signal
            }

            for (const node of group) {
                if (node.startsWith('w:')) {
                    const [, coords] = node.split(':')
                    const [wc, wr] = coords.split(',').map(Number)
                    valueByCell.set(World.cellId(wc, wr), value)
                } else {
                    const pin = this.pinFromNode(node)
                    if (pin && pin.direction === 'input') inputAssignments.set(pin, value)
                }
            }
        }

        let changed = false
        for (const cell of this.cells.values()) {
            if (cell.kind !== 'component') continue
            for (const pin of cell.component.pins.values()) {
                if (pin.direction !== 'input') continue
                const desired = inputAssignments.get(pin) ?? 0
                if (pin.value !== desired) {
                    pin.setValue(desired)
                    changed = true
                }
            }
        }

        this.valueByCell = valueByCell
        this.connectionsByCell = connectionsByCell
        return changed
    }

    /** One simulation step: tick all components, then settle wire networks until stable. */
    step(): void {
        // Phase 1: settle combinational logic with the clock held, so data is
        // stable before the clock edge (edge-triggered registers latch settled d).
        for (let i = 0; i < 50; i++) {
            if (!this.recompute()) break
            this.tickGates()
        }
        // Phase 2: clock edge (Clock toggles; Dff latches d on the rising edge).
        this.tickAll()
        // Phase 3: settle the post-edge state.
        for (let i = 0; i < 50; i++) {
            if (!this.recompute()) break
            this.tickGates()
        }
    }

    /** Settle combinational logic only (no clock edge): used by Composite internals. */
    settle(): void {
        for (let i = 0; i < 50; i++) {
            if (!this.recompute()) break
            this.tickGates()
        }
    }

    /** Re-tick only components that have input pins (sources like Clock must not re-toggle). */
    private tickGates(): void {
        for (const cell of this.cells.values()) {
            if (cell.kind !== 'component') continue
            let hasInput = false
            for (const pin of cell.component.pins.values()) {
                if (pin.direction === 'input') {
                    hasInput = true
                    break
                }
            }
            if (hasInput) cell.component.tick()
        }
    }

    private pinOnEdge(
        component: BaseComponent,
        edge: Edge,
        direction?: 'input' | 'output'
    ): string | null {
        for (const [name, pin] of component.pins) {
            if (component.pinEdges[name] !== edge) continue
            if (direction && pin.direction !== direction) continue
            return name
        }
        return null
    }

    private pinFromNode(node: string): Pin | null {
        if (!node.startsWith('p:')) return null
        const [, coords, pinName] = node.split(':')
        const [col, row] = coords.split(',').map(Number)
        const cell = this.cells.get(World.cellId(col, row))
        if (!cell || cell.kind !== 'component') return null
        return cell.component.pins.get(pinName) ?? null
    }
}
