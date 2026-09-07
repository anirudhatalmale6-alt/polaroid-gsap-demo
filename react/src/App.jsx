import { useEffect, useRef, useState } from 'react'
import PolaroidCamera from './PolaroidCamera.jsx'

export default function App() {
  const cam = useRef(null)
  const [sound, setSound] = useState(true)

  // handy handle for QA / frame grabs
  useEffect(() => { window.__cam = cam.current }, [])

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
          <PolaroidCamera
            ref={cam}
            sound={sound}
            playOnView
            onComplete={() => console.log('sequence finished')}
          />
        </div>

        <div className="controls">
          <button className="btn" onClick={() => cam.current?.play()}>Take the photo</button>
          <label className="snd">
            <input type="checkbox" checked={sound} onChange={(e) => setSound(e.target.checked)} />
            sound
          </label>
        </div>
      </section>
    </main>
  )
}
