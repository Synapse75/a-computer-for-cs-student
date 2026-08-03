import type { Container, Graphics } from 'pixi.js'
import type { BaseComponent } from '../../kernel/core/BaseComponent'

export interface ComponentView {
    root: Container
    kernel: BaseComponent
    body: Graphics
    pinAnchors: Map<string, { x: number; y: number }>
}
