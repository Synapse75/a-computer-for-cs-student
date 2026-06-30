export type Signal = 0 | 1

export interface Pin {
  name: string
  direction: 'input' | 'output'
  value: Signal
  setValue: (value: Signal) => void
  subscribe: (callback: () => void) => void
}

export class PinImplementation implements Pin {
  private _callbacks: Array<() => void>
  name: string
  direction: 'input' | 'output'
  value: Signal

  constructor(name: string, direction: 'input' | 'output', initialValue: Signal) {
    this.name = name
    this.direction = direction
    this.value = initialValue
    this._callbacks = []
  }

  setValue(value: Signal): void {
    this.value = value
    this._callbacks.forEach(callback => callback())
  }

  subscribe(callback: () => void): void {
    this._callbacks.push(callback)
  }
}