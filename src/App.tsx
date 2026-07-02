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
      application.stage.addChild(box)
    })
  }, [])

  return <div ref={containerReference} style={{ width: '100vw', height: '100vh' }} />
}

export default App