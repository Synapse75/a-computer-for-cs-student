export type Signal = 0 | 1
export type Edge = 'left' | 'right' | 'top' | 'bottom'
/** Clockwise rotation in quarter turns: 0/1/2/3 = 0°/90°/180°/270°. */
export type Rotation = 0 | 1 | 2 | 3

export interface Pin {
    name: string
    direction: 'input' | 'output'
    value: Signal
    setValue: (value: Signal) => void
    subscribe: (callback: () => void) => void
    unsubscribe: (callback: () => void) => void
}
