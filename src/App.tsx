import { useEffect, useRef } from 'react'
import { Application, Graphics } from 'pixi.js'

function App() {
    const containerReference = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const application = new Application()
        application.init({ width: 800, height: 600, background: 0x1a1a1a }).then(() => {
            containerReference.current!.appendChild(application.canvas)

            const box = new Graphics()
            box.rect(0, 0, 100, 100)
            box.fill({ color: 'green' })
            box.eventMode = 'static'
            box.cursor = 'pointer'

            application.stage.eventMode = 'static'
            application.stage.hitArea = application.screen

            let dragging = false
            let offset = { x: 0, y: 0 }

            box.on('pointerdown', (event) => {
                dragging = true
                offset.x = box.x - event.global.x
                offset.y = box.y - event.global.y
            })

            application.stage.on('pointermove', (event) => {
                if (!dragging) return
                box.x = event.global.x + offset.x
                box.y = event.global.y + offset.y
            })

            application.stage.on('pointerup', () => {
                dragging = false
            })

            application.stage.addChild(box)
        })
    }, [])

    return <div ref={containerReference} style={{ width: '100vw', height: '100vh' }} />
}

export default App