import { useEffect, useRef, useState } from 'react'
import PolaroidCamera from './PolaroidCamera.jsx'
import ReceiptPrinter from './ReceiptPrinter.jsx'

export default function App() {
  const cam = useRef(null)
  const printer = useRef(null)
  const [sound, setSound] = useState(true)

  // handy handle for QA / frame grabs
  useEffect(() => { window.__cam = cam.current; window.__printer = printer.current }, [])

  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">React + GSAP</p>
        <h1>Polaroid capture</h1>
        <p className="lede">
          One component, one import. Flash, shutter sound, recoil and both prints
          run off a single GSAP timeline.
        </p>

        <div className="camera-slot">
          <PolaroidCamera ref={cam} sound={sound} playOnView />
        </div>

        <div className="controls">
          <button className="btn" onClick={() => cam.current?.play()}>Take the photo</button>
          <label className="snd">
            <input type="checkbox" checked={sound} onChange={(e) => setSound(e.target.checked)} />
            sound
          </label>
        </div>
      </section>

      <section className="hero">
        <p className="eyebrow">React + GSAP</p>
        <h1>Invoice printer</h1>
        <p className="lede">
          Ejects upward, in discrete line steps rather than a smooth glide.
          The paper travels; the heading leads because it is the top of the job.
        </p>

        <div className="camera-slot">
          <ReceiptPrinter ref={printer} sound={sound} playOnView />
        </div>

        <div className="controls">
          <button className="btn" onClick={() => printer.current?.play()}>Print the invoice</button>
        </div>
      </section>
    </main>
  )
}
