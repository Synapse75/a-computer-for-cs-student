import type { FC } from 'react'
import { CSS } from '../../render/theme'

interface Props {
    running: boolean
    speed: number
    wireMode: boolean
    onToggleRun: () => void
    onStep: () => void
    onSpeedChange: (speed: number) => void
    onReset: () => void
}

export const ControlPanel: FC<Props> = ({ running, speed, wireMode, onToggleRun, onStep, onSpeedChange, onReset }) => {
    return (
        <div style={{
            display: 'flex',
            gap: 8,
            padding: '6px 12px',
            background: CSS.panel,
            borderBottom: `1px solid ${CSS.panelBorder}`,
            alignItems: 'center'
        }}>
            <button onClick={onToggleRun} style={btnStyle}>
                {running ? 'Pause' : 'Run'}
            </button>
            <button onClick={onStep} style={btnStyle}>Step</button>
            <button onClick={onReset} style={btnStyle}>Reset</button>

            <div style={{ color: CSS.text, fontSize: 12, marginLeft: 12 }}>Speed:</div>
            <input
                type="range"
                min={1}
                max={10}
                value={speed}
                onChange={e => onSpeedChange(Number(e.target.value))}
                style={{ width: 80 }}
            />
            <div style={{ color: CSS.text, fontSize: 11, fontFamily: 'monospace' }}>{speed}x</div>
            {wireMode && (
                <div style={{ color: CSS.text, fontSize: 11, marginLeft: 12, opacity: 0.8 }}>
                    Wire mode：按住左键在画布上拖动绘制，Esc 退出
                </div>
            )}
        </div>
    )
}

const btnStyle: Record<string, string | number> = {
    padding: '4px 10px',
    background: CSS.button,
    color: CSS.buttonText,
    border: `1px solid ${CSS.buttonBorder}`,
    borderRadius: 2,
    cursor: 'pointer',
    fontSize: 12,
    fontFamily: 'monospace'
}
