import type { FC } from 'react'
import { CSS } from '../../render/theme'

const componentTypes = [
    { type: 'Not', label: 'NOT' },
    { type: 'Vcc', label: 'Vcc (1)' },
    { type: 'Gnd', label: 'Gnd (0)' },
    { type: 'Clock', label: 'Clock' },
    { type: 'Dff', label: 'DFF' },
    { type: 'Nand', label: 'NAND' },
    { type: 'And', label: 'AND' },
    { type: 'Or', label: 'OR' },
    { type: 'Xor', label: 'XOR' },
    { type: 'HalfAdder', label: 'Half Adder' },
    { type: 'FullAdder', label: 'Full Adder' },
    { type: 'Decoder2x4', label: 'Decoder 2×4' },
    { type: 'Mux', label: 'MUX' },
    { type: 'Dmux', label: 'DMUX' },
] as const

interface Props {
    wireMode: boolean
    collapseMode: boolean
    collapsedPlacement: boolean
    onDragStart: (type: string) => void
    onToggleWire: () => void
    onToggleCollapse: () => void
    onToggleCollapsedPlacement: () => void
}

export const ComponentPalette: FC<Props> = ({
    wireMode,
    collapseMode,
    collapsedPlacement,
    onDragStart,
    onToggleWire,
    onToggleCollapse,
    onToggleCollapsedPlacement,
}) => {
    return (
        <div style={{
            width: 150,
            background: CSS.panel,
            padding: 8,
            overflowY: 'auto',
            borderRight: `1px solid ${CSS.panelBorder}`,
            userSelect: 'none'
        }}>
            <div style={{ color: CSS.text, fontSize: 12, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
                Blocks
            </div>
            {componentTypes.map(({ type, label }) => (
                <button
                    key={type}
                    onMouseDown={() => onDragStart(type)}
                    style={btnStyle}
                >
                    <span style={{
                        display: 'inline-block',
                        width: 12,
                        height: 12,
                        marginRight: 8,
                        background: CSS.signal1,
                        border: `1px solid ${CSS.blockBorder}`,
                        verticalAlign: 'middle'
                    }} />
                    {label}
                </button>
            ))}
            <button
                onClick={onToggleWire}
                style={{
                    ...btnStyle,
                    background: wireMode ? '#4a4a4a' : CSS.button,
                    border: `1px solid ${wireMode ? '#9a9a9a' : CSS.buttonBorder}`
                }}
            >
                <span style={{
                    display: 'inline-block',
                    width: 12,
                    height: 2,
                    marginRight: 8,
                    background: CSS.signal1,
                    verticalAlign: 'middle'
                }} />
                Wire
            </button>
            <button
                onClick={onToggleCollapse}
                style={{
                    ...btnStyle,
                    background: collapseMode ? '#4a4a4a' : CSS.button,
                    border: `1px solid ${collapseMode ? '#9a9a9a' : CSS.buttonBorder}`
                }}
            >
                <span style={{
                    display: 'inline-block',
                    width: 12,
                    height: 12,
                    marginRight: 8,
                    background: CSS.signal1,
                    border: `1px solid ${CSS.blockBorder}`,
                    verticalAlign: 'middle'
                }} />
                Collapse
            </button>
            <button
                onClick={onToggleCollapsedPlacement}
                style={{
                    ...btnStyle,
                    background: collapsedPlacement ? '#4a4a4a' : CSS.button,
                    border: `1px solid ${collapsedPlacement ? '#9a9a9a' : CSS.buttonBorder}`
                }}
            >
                <span style={{
                    display: 'inline-block',
                    width: 12,
                    height: 12,
                    marginRight: 8,
                    background: CSS.signal1,
                    border: `1px solid ${CSS.blockBorder}`,
                    verticalAlign: 'middle'
                }} />
                Collapsed Place
            </button>
            <div style={{ color: CSS.text, fontSize: 10, marginTop: 8, opacity: 0.7, lineHeight: 1.4 }}>
                拖出元件到画布；Wire 画导线；Collapse 框选折叠；Collapsed Place 让预制体以单块放置（右键展开）
            </div>
        </div>
    )
}

const btnStyle: Record<string, string | number> = {
    display: 'block',
    width: '100%',
    padding: '6px 8px',
    marginBottom: 4,
    background: CSS.button,
    color: CSS.buttonText,
    border: `1px solid ${CSS.buttonBorder}`,
    borderRadius: 2,
    cursor: 'pointer',
    textAlign: 'left',
    fontSize: 12,
    fontFamily: 'monospace'
}
