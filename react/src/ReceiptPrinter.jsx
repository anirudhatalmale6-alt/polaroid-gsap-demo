import { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import './receipt-printer.css'

/* ------------------------------------------------------------------ *
 * The paper is EJECTED UPWARD, and that is the whole trick.
 *
 * Feed a receipt down out of a front slot and you get a choice of two
 * wrong things: either the strip slides down as a finished sheet, in which
 * case the bottom of the invoice leads and the heading arrives last, or you
 * pin it and grow it downward, which reads as the paper being dragged down
 * rather than pushed out.
 *
 * A real thermal printer ejects upward out of the top. Do that and the
 * problem disappears: the paper genuinely travels, the heading leads because
 * it is the top of the document, and when it finishes it reads top to bottom
 * the right way round. It is also a plain transform, so it stays on the
 * compositor and survives being scrubbed.
 * ------------------------------------------------------------------ */
const PAPER_IN = 100     // still inside the machine, below the slot line
const PAPER_OUT = 0      // fully ejected, bottom edge still in the rollers

const FEED_SECONDS = 3.6 // deliberately slow - a receipt printer is not a photo eject
const FEED_STEPS = 36    // discrete line feeds rather than a smooth glide
const CURL = -1.6        // degrees the paper leans as it rises clear of the slot

const DEFAULT_RECEIPT = {
  heading: 'INVOICE',
  meta: ['No. 0000', 'Date --/--/----'],
  lines: [
    { label: 'Item one', value: '00.00' },
    { label: 'Item two', value: '00.00' },
    { label: 'Item three', value: '00.00' },
    { label: 'Item four', value: '00.00' },
  ],
  subtotal: { label: 'Subtotal', value: '00.00' },
  total: { label: 'TOTAL', value: '00.00' },
  footer: 'thank you ♡',
}

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
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    return buf
  }

  return {
    unlock: ac,

    /* stepper motor: a buzzy tone chopped at the line-feed rate, which is
       what actually makes a thermal printer sound like one */
    feed(dur, steps) {
      const c = ac(); if (!c) return
      const t = c.currentTime
      const rate = steps / dur

      const o = c.createOscillator()
      o.type = 'square'
      o.frequency.setValueAtTime(196, t)
      o.frequency.linearRampToValueAtTime(208, t + dur)

      const bp = c.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = 1500
      bp.Q.value = 0.7

      const g = c.createGain()
      g.gain.value = 0

      // chop the tone once per line feed
      const chop = c.createOscillator()
      chop.type = 'square'
      chop.frequency.value = rate
      const chopDepth = c.createGain()
      chopDepth.gain.value = 0.028
      chop.connect(chopDepth); chopDepth.connect(g.gain)

      const env = c.createGain()
      env.gain.setValueAtTime(0.0001, t)
      env.gain.linearRampToValueAtTime(1, t + 0.08)
      env.gain.setValueAtTime(1, t + dur - 0.12)
      env.gain.linearRampToValueAtTime(0.0001, t + dur)

      o.connect(bp); bp.connect(g); g.connect(env); env.connect(c.destination)
      o.start(t); o.stop(t + dur + 0.02)
      chop.start(t); chop.stop(t + dur + 0.02)

      // paper dragging over the tear bar
      const s = c.createBufferSource()
      s.buffer = noise(c, dur)
      const hp = c.createBiquadFilter()
      hp.type = 'highpass'
      hp.frequency.value = 4200
      const sg = c.createGain()
      sg.gain.setValueAtTime(0.0001, t)
      sg.gain.linearRampToValueAtTime(0.035, t + 0.15)
      sg.gain.setValueAtTime(0.035, t + dur - 0.15)
      sg.gain.linearRampToValueAtTime(0.0001, t + dur)
      s.connect(hp); hp.connect(sg); sg.connect(c.destination)
      s.start(t); s.stop(t + dur)
    },

    /* short confirmation beep once the job is done */
    beep() {
      const c = ac(); if (!c) return
      const t = c.currentTime
      ;[0, 0.14].forEach((off, i) => {
        const o = c.createOscillator()
        const g = c.createGain()
        o.type = 'square'
        o.frequency.value = i ? 1180 : 880
        g.gain.setValueAtTime(0.0001, t + off)
        g.gain.linearRampToValueAtTime(0.07, t + off + 0.012)
        g.gain.exponentialRampToValueAtTime(0.0001, t + off + 0.1)
        o.connect(g); g.connect(c.destination)
        o.start(t + off); o.stop(t + off + 0.11)
      })
    },
  }
}

const ReceiptPrinter = forwardRef(function ReceiptPrinter(
  {
    receipt = DEFAULT_RECEIPT,
    paperSrc = null,      // an exported image of the receipt, instead of the markup
    printerSrc = null,    // an exported image of the printer body
    sound = true,
    autoPlay = false,
    playOnView = true,
    onComplete,
    className = '',
  },
  ref
) {
  const root = useRef(null)
  const bodyRef = useRef(null)
  const paperRef = useRef(null)
  const buttonRef = useRef(null)
  const ledRef = useRef(null)
  const ledGlowRef = useRef(null)

  const tl = useRef(null)
  const audio = useRef(null)
  const soundOn = useRef(sound)
  useEffect(() => { soundOn.current = sound }, [sound])

  const uid = useId().replace(/:/g, '')
  const id = (n) => `${n}-${uid}`
  const url = (n) => `url(#${id(n)})`

  const playFeed = useCallback(() => {
    if (!soundOn.current) return
    audio.current?.feed(FEED_SECONDS, FEED_STEPS)
  }, [])

  const playBeep = useCallback(() => {
    if (!soundOn.current) return
    audio.current?.beep()
  }, [])

  useLayoutEffect(() => {
    audio.current = createAudio()

    const ctx = gsap.context(() => {
      const body = bodyRef.current
      const paper = paperRef.current

      const reset = () => {
        gsap.set(body, { x: 0, y: 0, rotation: 0 })
        gsap.set(paper, { yPercent: PAPER_IN, rotation: 0 })
        gsap.set(buttonRef.current, { y: 0, scale: 1, transformOrigin: '111px 214px' })
        gsap.set(ledRef.current, { opacity: 0.35 })
        gsap.set(ledGlowRef.current, { opacity: 0.12 })
      }
      reset()

      const t = gsap.timeline({
        paused: true,
        defaults: { ease: 'power2.out' },
        onComplete: () => onComplete?.(),
      })

      /* 1. press, printer wakes up */
      t.to(buttonRef.current, { scale: 0.9, y: 3, duration: 0.07, ease: 'power3.in' }, 0)
       .to(buttonRef.current, { scale: 1, y: 0, duration: 0.2, ease: 'back.out(2.4)' }, 0.07)
       .to(ledRef.current, { opacity: 1, duration: 0.12 }, 0.05)
       .to(ledGlowRef.current, { opacity: 0.5, duration: 0.12 }, 0.05)

      /* 2. the feed - the paper actually travels, in discrete line steps */
      t.add('feed', 0.34)
       .call(playFeed, null, 'feed')
       .to(paper, {
         yPercent: PAPER_OUT,
         duration: FEED_SECONDS,
         ease: `steps(${FEED_STEPS})`,
       }, 'feed')
       // it leans over as more of it stands clear of the slot
       .to(paper, { rotation: CURL, duration: FEED_SECONDS, ease: 'power2.in' }, 'feed')
       // body buzzes for as long as the motor runs
       .to(body, {
         x: 0.9, y: -0.6,
         duration: 0.055,
         repeat: Math.round(FEED_SECONDS / 0.055),
         yoyo: true,
         ease: 'none',
       }, 'feed')

      /* 3. motor stops, paper settles, done beep */
      t.add('done', `feed+=${FEED_SECONDS}`)
       .set(body, { x: 0, y: 0 }, 'done')
       .call(playBeep, null, 'done')
       .to(paper, { rotation: CURL * 0.55, duration: 0.55, ease: 'power2.out' }, 'done')
       .to(ledRef.current, { opacity: 0.35, duration: 0.4 }, 'done+=0.3')
       .to(ledGlowRef.current, { opacity: 0.12, duration: 0.4 }, 'done+=0.3')

      tl.current = t
      tl.current.__reset = reset
    }, root)

    return () => { ctx.revert(); tl.current = null }
  }, [onComplete, playFeed, playBeep])

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
      entries.forEach((e) => { if (e.isIntersecting) { play(); io.disconnect() } })
    }, { threshold: 0.35 })
    io.observe(el)
    return () => io.disconnect()
  }, [playOnView, autoPlay, play])

  return (
    <div className={`rp-stage ${className}`} ref={root} onClick={play}>

      {/* paper sits behind the machine and is clipped at the slot line */}
      <div className="rp-paper-stage">
        <div className="rp-paper" ref={paperRef}>
          {paperSrc ? (
            <img src={paperSrc} alt="" draggable="false" />
          ) : (
            <div className="rp-receipt">
              <div className="rp-head">{receipt.heading}</div>
              {receipt.meta?.map((m, i) => <div className="rp-meta" key={i}>{m}</div>)}
              <div className="rp-rule" />
              {receipt.lines?.map((l, i) => (
                <div className="rp-row" key={i}>
                  <span>{l.label}</span><span>{l.value}</span>
                </div>
              ))}
              <div className="rp-rule" />
              {receipt.subtotal ? (
                <div className="rp-row"><span>{receipt.subtotal.label}</span><span>{receipt.subtotal.value}</span></div>
              ) : null}
              {receipt.total ? (
                <div className="rp-row rp-total"><span>{receipt.total.label}</span><span>{receipt.total.value}</span></div>
              ) : null}
              <div className="rp-barcode" aria-hidden="true">
                {Array.from({ length: 34 }, (_, i) => (
                  <i key={i} style={{ width: `${(i * 7) % 3 + 1}px` }} />
                ))}
              </div>
              <div className="rp-foot">{receipt.footer}</div>
            </div>
          )}
        </div>
      </div>

      {printerSrc ? (
        <img className="rp-body" src={printerSrc} alt="" ref={bodyRef} draggable="false" />
      ) : (
        <svg className="rp-body" ref={bodyRef} viewBox="0 0 600 330" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <defs>
            <linearGradient id={id('shell')} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#F6EFE4" /><stop offset="1" stopColor="#E4D8C7" />
            </linearGradient>
            <linearGradient id={id('deck')} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#EFE6D8" /><stop offset="1" stopColor="#DDD0BD" />
            </linearGradient>
            <linearGradient id={id('base')} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#8FB6DA" /><stop offset="1" stopColor="#6E97C2" />
            </linearGradient>
            <linearGradient id={id('slot')} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#33465d" /><stop offset="1" stopColor="#151f2c" />
            </linearGradient>
            <filter id={id('soft')} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="6" />
            </filter>
          </defs>

          <ellipse cx="300" cy="316" rx="222" ry="12" fill="#000" opacity="0.13" filter={url('soft')} />

          {/* blue foot, behind everything on the front */}
          <rect x="76" y="238" width="448" height="72" rx="26" fill={url('base')} />
          <rect x="76" y="238" width="448" height="12" rx="6" fill="#A8C8E4" opacity="0.5" />

          {/* main body */}
          <rect x="52" y="96" width="496" height="166" rx="28" fill={url('shell')} />

          {/* top deck the paper comes up through */}
          <rect x="40" y="52" width="520" height="60" rx="24" fill={url('deck')} />
          <rect x="58" y="60" width="484" height="12" rx="6" fill="#FFFBF4" opacity="0.6" />

          {/* the slot itself, drawn over the paper so the paper rises out of it */}
          <rect x="150" y="56" width="300" height="20" rx="7" fill={url('slot')} />
          <rect x="150" y="70" width="300" height="6" rx="3" fill="#0c1219" opacity="0.55" />
          {/* tear bar along the front lip of the slot */}
          <rect x="146" y="76" width="308" height="9" rx="4.5" fill="#CBBCA6" />
          {/* rollers either side */}
          <rect x="122" y="56" width="26" height="22" rx="7" fill="#C3B39C" />
          <rect x="452" y="56" width="26" height="22" rx="7" fill="#C3B39C" />

          {/* feed button */}
          <g ref={buttonRef}>
            <circle cx="111" cy="218" r="27" fill="#C9B9A6" />
            <circle cx="111" cy="214" r="25" fill="#E9A9B2" />
            <circle cx="111" cy="209" r="21" fill="#F0B8C0" />
          </g>

          {/* status lamp */}
          <g>
            <rect x="452" y="196" width="62" height="24" rx="12" fill="#C8B49A" />
            <rect x="455" y="199" width="56" height="18" rx="9" fill="#2b2118" />
            <circle ref={ledGlowRef} cx="483" cy="208" r="17" fill="#5FBF7A" opacity="0.12" filter={url('soft')} />
            <circle ref={ledRef} cx="483" cy="208" r="7" fill="#5FBF7A" opacity="0.35" />
          </g>

          {/* vent grille */}
          <g fill="#D8C9B4">
            <rect x="168" y="150" width="170" height="8" rx="4" />
            <rect x="168" y="172" width="170" height="8" rx="4" />
            <rect x="168" y="194" width="124" height="8" rx="4" />
          </g>
        </svg>
      )}
    </div>
  )
})

export default ReceiptPrinter
