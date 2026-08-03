import type { FC } from 'react'
import { CSS } from '../../render/theme'

const componentTypes = [
    { type: 'Not', label: 'NOT' },
    { type: 'Vcc', label: 'Vcc (1)' },
    { type: 'Gnd', label: 'Gnd (0)' },
    { type: 'Clock', label: 'Clock' },
    { type: 'Nand', label: 'NAND' },
    { type: 'And', label: 'AND' },
    { type: 'Or', label: 'OR' },
] as const

interface Props {
    wireMode: boolean
    onDragStart: (type: string) => void
    onToggleWire: () => void
}

export const ComponentPalette: FC<Props> = ({ wireMode, onDragStart, onToggleWire }) => {
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
            <div style={{ color: CSS.text, fontSize: 10, marginTop: 8, opacity: 0.7, lineHeight: 1.4 }}>
                拖出元件到画布；Wire 模式下按住左键拖动绘制导线，Esc 退出
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
