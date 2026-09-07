import { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import './polaroid-camera.css'

/* ------------------------------------------------------------------ *
 * Resting positions. Percentages of each print, so the whole scene
 * scales to any container width without retuning a single number.
 * ------------------------------------------------------------------ */
const OFF = -122      // fully swallowed by the camera
const A_LIP = 6       // first print just clear of the rollers
const A_REST = 101.8  // first print settled below the camera
const B_REST = -2.5   // second print parked with its top edge in the slot
                      // (a fixed tuck - as a % of the taller square card it ate the title)

const DEFAULT_PHOTOS = [
  { title: 'BEFORE', caption: 'the starting point ♡', tone: 'before' },
  { title: 'AFTER', caption: 'the final look ♡', tone: 'after' },
]

/* ------------------------------------------------------------------ *
 * Sound. Synthesised so the component ships with no audio asset.
 * Pass shutterSrc and the real recording is used instead - either way
 * it fires off the same timeline label as the flash, so the two can
 * never drift apart however the timeline is replayed or scrubbed.
 * ------------------------------------------------------------------ */
function createAudio() {
  let ctx = null

  const ac = () => {
    if (typeof window === 'undefined') return null
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext
      if (!AC) return null
      ctx = new AC()
    }
    if (ctx.state === 'suspended') ctx.resume()
    return ctx
  }

  const noise = (c, secs) => {
    const len = Math.floor(c.sampleRate * secs)
    const buf = c.createBuffer(1, len, c.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len)
    return buf
  }

  return {
    unlock: ac,
    shutter() {
      const c = ac(); if (!c) return
      const t = c.currentTime

      // mirror slap then blade close: two short filtered transients
      ;[0, 0.055].forEach((off, i) => {
        const s = c.createBufferSource()
        s.buffer = noise(c, 0.09)
        const bp = c.createBiquadFilter()
        bp.type = 'bandpass'
        bp.frequency.value = i ? 2600 : 1700
        bp.Q.value = 1.1
        const g = c.createGain()
        g.gain.setValueAtTime(i ? 0.42 : 0.6, t + off)
        g.gain.exponentialRampToValueAtTime(0.0008, t + off + 0.085)
        s.connect(bp); bp.connect(g); g.connect(c.destination)
        s.start(t + off); s.stop(t + off + 0.1)
      })

      // low body thunk
      const o = c.createOscillator()
      const og = c.createGain()
      o.type = 'triangle'
      o.frequency.setValueAtTime(180, t)
      o.frequency.exponentialRampToValueAtTime(70, t + 0.09)
      og.gain.setValueAtTime(0.28, t)
      og.gain.exponentialRampToValueAtTime(0.001, t + 0.12)
      o.connect(og); og.connect(c.destination)
      o.start(t); o.stop(t + 0.13)
    },
    whir(dur) {
      const c = ac(); if (!c) return
      const t = c.currentTime

      const o = c.createOscillator()
      o.type = 'sawtooth'
      o.frequency.setValueAtTime(84, t)
      o.frequency.linearRampToValueAtTime(96, t + dur)
      const lp = c.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 900
      const g = c.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.linearRampToValueAtTime(0.09, t + 0.07)
      g.gain.setValueAtTime(0.09, t + dur - 0.1)
      g.gain.linearRampToValueAtTime(0.0001, t + dur)
      o.connect(lp); lp.connect(g); g.connect(c.destination)
      o.start(t); o.stop(t + dur + 0.02)

      // paper hiss riding on the motor
      const s = c.createBufferSource()
      s.buffer = noise(c, dur)
      const hp = c.createBiquadFilter()
      hp.type = 'highpass'
      hp.frequency.value = 3200
      const sg = c.createGain()
      sg.gain.value = 0.05
      s.connect(hp); hp.connect(sg); sg.connect(c.destination)
      s.start(t); s.stop(t + dur)
    },
  }
}

const PolaroidCamera = forwardRef(function PolaroidCamera(
  {
    photos = DEFAULT_PHOTOS,
    sound = true,
    shutterSrc = null,
    cameraSrc = null,
    autoPlay = false,
    playOnView = true,
    onComplete,
    className = '',
  },
  ref
) {
  const root = useRef(null)
  const cameraRef = useRef(null)
  const burstRef = useRef(null)
  const overlayRef = useRef(null)
  const irisRef = useRef(null)
  const buttonRef = useRef(null)
  const ledRef = useRef(null)
  const ledGlowRef = useRef(null)
  const photoARef = useRef(null)
  const photoBRef = useRef(null)
  const veilARef = useRef(null)
  const veilBRef = useRef(null)

  const tl = useRef(null)
  const audio = useRef(null)
  const shutterEl = useRef(null)
  const soundOn = useRef(sound)

  // read the live prop from inside the timeline callbacks without rebuilding it
  useEffect(() => { soundOn.current = sound }, [sound])

  // unique ids so several cameras on one page never share gradients
  const uid = useId().replace(/:/g, '')
  const id = (n) => `${n}-${uid}`
  const url = (n) => `url(#${id(n)})`

  useEffect(() => {
    if (!shutterSrc) { shutterEl.current = null; return }
    const el = new Audio(shutterSrc)
    el.preload = 'auto'
    shutterEl.current = el
    return () => { shutterEl.current = null }
  }, [shutterSrc])

  const playShutter = useCallback(() => {
    if (!soundOn.current) return
    if (shutterEl.current) {
      shutterEl.current.currentTime = 0
      shutterEl.current.play().catch(() => {})
      return
    }
    audio.current?.shutter()
  }, [])

  const playWhir = useCallback((dur) => {
    if (!soundOn.current) return
    audio.current?.whir(dur)
  }, [])

  useLayoutEffect(() => {
    audio.current = createAudio()

    const ctx = gsap.context(() => {
      const camera = cameraRef.current
      const photoA = photoARef.current
      const photoB = photoBRef.current

      const reset = () => {
        gsap.set(camera, { y: 0, x: 0, rotation: 0, scale: 1 })
        gsap.set([photoA, photoB], { yPercent: OFF, rotation: 0, x: 0 })
        gsap.set([veilARef.current, veilBRef.current], { opacity: 1 })
        gsap.set([burstRef.current, overlayRef.current], { opacity: 0 })
        gsap.set(irisRef.current, { attr: { r: 0 } })
        gsap.set(buttonRef.current, { y: 0, scale: 1, transformOrigin: '130px 192px' })
        gsap.set([ledRef.current, ledGlowRef.current], { opacity: 1 })
      }
      reset()

      const t = gsap.timeline({
        paused: true,
        defaults: { ease: 'power2.out' },
        onComplete: () => onComplete?.(),
      })

      /* 1. shutter press */
      t.to(buttonRef.current, { scale: 0.9, y: 3, duration: 0.07, ease: 'power3.in' }, 0)
       .to(buttonRef.current, { scale: 1, y: 0, duration: 0.22, ease: 'back.out(2.4)' }, 0.07)

      /* 2. flash and shutter sound, locked to one label */
      t.add('snap', 0.09)
       .call(playShutter, null, 'snap')
       .to(irisRef.current, { attr: { r: 64 }, duration: 0.05, ease: 'power4.in' }, 'snap')
       .to(irisRef.current, { attr: { r: 0 }, duration: 0.14, ease: 'power2.out' }, 'snap+=0.07')
       .fromTo(burstRef.current,
         { opacity: 0, scale: 0.55, transformOrigin: '126px 99px' },
         { opacity: 1, scale: 1.15, duration: 0.045, ease: 'none' }, 'snap')
       .to(burstRef.current, { opacity: 0, scale: 1.4, duration: 0.30, ease: 'power2.out' }, 'snap+=0.05')
       .fromTo(overlayRef.current, { opacity: 0 }, { opacity: 0.92, duration: 0.04, ease: 'none' }, 'snap')
       .to(overlayRef.current, { opacity: 0, duration: 0.34, ease: 'power2.out' }, 'snap+=0.05')
       // weaker second bounce of light - real flashes never fall off clean
       .to(burstRef.current, { opacity: 0.35, duration: 0.03 }, 'snap+=0.10')
       .to(burstRef.current, { opacity: 0, duration: 0.22 }, 'snap+=0.13')
       .to([ledRef.current, ledGlowRef.current], { opacity: 0.15, duration: 0.05 }, 'snap')
       .to([ledRef.current, ledGlowRef.current], { opacity: 1, duration: 0.5 }, 'snap+=0.45')

      /* 3. recoil */
      t.to(camera, { y: -9, rotation: -0.9, scale: 1.012, duration: 0.09, ease: 'power3.out' }, 'snap')
       .to(camera, { y: 4, rotation: 0.5, scale: 0.997, duration: 0.11, ease: 'power1.inOut' }, 'snap+=0.09')
       .to(camera, { y: 0, rotation: 0, scale: 1, duration: 0.85, ease: 'elastic.out(1, 0.34)' }, 'snap+=0.20')
       .to(camera, { x: 3, duration: 0.06, ease: 'power1.inOut', yoyo: true, repeat: 3 }, 'snap+=0.05')

      /* 4. first print rolls out */
      t.add('ejectA', 0.62)
       .call(playWhir, [0.95], 'ejectA')
       .to(photoA, { yPercent: A_LIP, rotation: 1.4, duration: 0.95, ease: 'power2.out' }, 'ejectA')
       .to(photoA, { rotation: 0.4, duration: 0.12, ease: 'power1.inOut' }, 'ejectA+=0.86')

      /* 5. and drops into its resting place */
      t.add('settleA', 'ejectA+=0.98')
       .to(photoA, { yPercent: A_REST, duration: 0.72, ease: 'power2.inOut' }, 'settleA')
       .to(photoA, { rotation: -3.4, duration: 0.9, ease: 'power2.out' }, 'settleA')
       .to(photoA, { x: '-2.5%', duration: 0.9, ease: 'power2.out' }, 'settleA')
       .to(photoA, { yPercent: A_REST - 1.1, duration: 0.16, ease: 'power2.out' }, 'settleA+=0.72')
       .to(photoA, { yPercent: A_REST, duration: 0.32, ease: 'power1.inOut' }, 'settleA+=0.88')
       .to(veilARef.current, { opacity: 0, duration: 1.5, ease: 'power1.inOut' }, 'settleA+=0.05')

      /* 6. second print half-ejects and stays in the camera */
      t.add('ejectB', 'settleA+=0.55')
       .call(playWhir, [0.85], 'ejectB')
       .to(photoB, { yPercent: B_REST, rotation: 1.7, duration: 0.9, ease: 'power2.out' }, 'ejectB')
       .to(photoB, { rotation: 1.1, duration: 0.5, ease: 'power1.out' }, 'ejectB+=0.82')
       .to(veilBRef.current, { opacity: 0, duration: 1.5, ease: 'power1.inOut' }, 'ejectB+=0.35')

      tl.current = t
      tl.current.__reset = reset
    }, root)

    return () => { ctx.revert(); tl.current = null }
  }, [onComplete, playShutter, playWhir])

  const play = useCallback(() => {
    const t = tl.current
    if (!t) return
    audio.current?.unlock()
    t.__reset?.()
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      t.progress(1)
      return
    }
    t.restart()
  }, [])

  useImperativeHandle(ref, () => ({
    play,
    reset: () => { tl.current?.pause(0); tl.current?.__reset?.() },
    get timeline() { return tl.current },
  }), [play])

  useEffect(() => { if (autoPlay) play() }, [autoPlay, play])

  useEffect(() => {
    if (!playOnView || autoPlay || !root.current) return
    const el = root.current
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { play(); io.disconnect() }
      })
    }, { threshold: 0.4 })
    io.observe(el)
    return () => io.disconnect()
  }, [playOnView, autoPlay, play])

  const print = (photo, kind, elRef, veilRef) => (
    <div className={`pc-photo pc-photo-${kind}`} ref={elRef}>
      <div className="pc-photo-inner">
        {photo.title ? <div className="pc-photo-title">{photo.title}</div> : null}
        <div className={`pc-photo-img${photo.src ? '' : ` pc-img-${photo.tone || 'before'}`}`}>
          {photo.src ? <img src={photo.src} alt={photo.alt || ''} draggable="false" /> : null}
          <span className="pc-dev-veil" ref={veilRef} />
        </div>
        {photo.caption ? <div className="pc-photo-caption">{photo.caption}</div> : null}
      </div>
    </div>
  )

  return (
    <div className={`pc-stage ${className}`} ref={root} onClick={play}>
      {cameraSrc ? (
        <img className="pc-camera" src={cameraSrc} alt="" ref={cameraRef} draggable="false" />
      ) : (
        <svg className="pc-camera" ref={cameraRef} viewBox="0 0 600 497" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <defs>
            <linearGradient id={id('shell')} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#F6EFE4" /><stop offset="1" stopColor="#E6DACA" />
            </linearGradient>
            <linearGradient id={id('shoulder')} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#EFE6D8" /><stop offset="1" stopColor="#DCCFBC" />
            </linearGradient>
            <linearGradient id={id('base')} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#8FB6DA" /><stop offset="1" stopColor="#6E97C2" />
            </linearGradient>
            <radialGradient id={id('lens')} cx="0.42" cy="0.36" r="0.75">
              <stop offset="0" stopColor="#4a3c56" /><stop offset="0.45" stopColor="#241d2c" /><stop offset="1" stopColor="#07060a" />
            </radialGradient>
            <radialGradient id={id('flash')} cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="#ffffff" /><stop offset="0.55" stopColor="#f2f4f8" /><stop offset="1" stopColor="#cfd6de" />
            </radialGradient>
            <radialGradient id={id('burst')} cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="#ffffff" stopOpacity="1" />
              <stop offset="0.35" stopColor="#ffffff" stopOpacity="0.85" />
              <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
            </radialGradient>
            <linearGradient id={id('slot')} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#16202e" /><stop offset="1" stopColor="#2c3d52" />
            </linearGradient>
            <filter id={id('soft')} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="6" />
            </filter>
          </defs>

          {/* the body is drawn 556 units wide; scale it out so it reaches both
              edges of the component - the client wants it device width, as if
              the camera were being held */}
          <g transform="translate(-23.741, 0) scale(1.07914)">
          <ellipse cx="300" cy="432" rx="250" ry="16" fill="#000" opacity="0.13" filter={url('soft')} />

          <rect x="34" y="318" width="532" height="112" rx="26" fill={url('base')} />
          <rect x="34" y="318" width="532" height="14" rx="7" fill="#A8C8E4" opacity="0.55" />

          <rect x="104" y="337" width="392" height="19" rx="7" fill={url('slot')} />
          <rect x="104" y="337" width="392" height="6" rx="3" fill="#0d141d" opacity="0.75" />
          <rect x="76" y="336" width="26" height="21" rx="6" fill="#5C82AC" />
          <rect x="498" y="336" width="26" height="21" rx="6" fill="#5C82AC" />

          <rect x="22" y="222" width="556" height="112" rx="26" fill={url('shoulder')} />
          <g>
            <rect x="256" y="222" width="22" height="112" fill="#E4A0AB" />
            <rect x="278" y="222" width="22" height="112" fill="#EADFCB" />
            <rect x="300" y="222" width="22" height="112" fill="#C3CAD2" />
            <rect x="322" y="222" width="22" height="112" fill="#7FA9D0" />
          </g>

          <rect x="44" y="14" width="512" height="224" rx="36" fill={url('shell')} />
          <rect x="60" y="24" width="480" height="16" rx="8" fill="#FFFBF4" opacity="0.7" />

          <g>
            <rect x="72" y="52" width="108" height="94" rx="14" fill="#5a5f66" />
            <rect x="78" y="58" width="96" height="82" rx="10" fill={url('flash')} />
            <g stroke="#c8ced6" strokeWidth="1.6" opacity="0.9">
              <path d="M78 79h96M78 100h96M78 121h96M102 58v82M126 58v82M150 58v82" />
            </g>
            <circle ref={burstRef} cx="126" cy="99" r="120" fill={url('burst')} opacity="0" />
          </g>

          <g ref={buttonRef}>
            <circle cx="130" cy="196" r="42" fill="#C9B9A6" />
            <circle cx="130" cy="192" r="40" fill="#E9A9B2" />
            <circle cx="130" cy="186" r="34" fill="#F0B8C0" />
            <circle cx="130" cy="192" r="5" fill="#D4939D" />
          </g>

          <g>
            <circle cx="300" cy="126" r="104" fill="#E8DECE" />
            <circle cx="300" cy="126" r="104" fill="none" stroke="#D2C4B0" strokeWidth="2" />
            <circle cx="300" cy="126" r="88" fill="#E9A9B2" />
            <circle cx="300" cy="126" r="88" fill="none" stroke="#D9939E" strokeWidth="2" />
            <circle cx="300" cy="126" r="72" fill="#141118" />
            <circle cx="300" cy="126" r="62" fill={url('lens')} />
            <circle cx="300" cy="126" r="30" fill="#0b0910" />
            <circle cx="300" cy="126" r="16" fill="#1b1426" />
            <ellipse cx="278" cy="104" rx="17" ry="11" fill="#ffffff" opacity="0.5" transform="rotate(-32 278 104)" />
            <ellipse cx="330" cy="152" rx="9" ry="6" fill="#8f7fc0" opacity="0.45" />
            <circle ref={irisRef} cx="300" cy="126" r="0" fill="#05040a" opacity="0.92" />
          </g>

          <g>
            <rect x="424" y="54" width="120" height="96" rx="18" fill="#2a2b30" />
            <rect x="436" y="66" width="96" height="72" rx="12" fill="#0d0d11" />
            <circle cx="484" cy="102" r="26" fill="#15131c" />
            <circle cx="484" cy="102" r="12" fill="#241f33" />
            <ellipse cx="474" cy="92" rx="8" ry="5" fill="#fff" opacity="0.35" transform="rotate(-30 474 92)" />
          </g>

          <g>
            <rect x="468" y="172" width="74" height="28" rx="14" fill="#C8B49A" />
            <rect x="471" y="175" width="68" height="22" rx="11" fill="#2b2118" />
            <circle ref={ledRef} cx="505" cy="186" r="9" fill="#F0A227" />
            <circle ref={ledGlowRef} cx="505" cy="186" r="20" fill="#F0A227" opacity="0.35" filter={url('soft')} />
          </g>
          </g>
        </svg>
      )}

      <div className="pc-photo-stage">
        {print(photos[0] || DEFAULT_PHOTOS[0], 'a', photoARef, veilARef)}
        {print(photos[1] || DEFAULT_PHOTOS[1], 'b', photoBRef, veilBRef)}
        <div className="pc-slot-lip" />
      </div>

      <div className="pc-flash-overlay" ref={overlayRef} />
    </div>
  )
})

export default PolaroidCamera
