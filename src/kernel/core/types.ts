export type Signal = 0 | 1

export interface Pin {
    name: string
    direction: 'input' | 'output'
    value: Signal
    setValue: (value: Signal) => void
    subscribe: (callback: () => void) => void
}
