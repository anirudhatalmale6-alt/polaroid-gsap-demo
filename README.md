# Polaroid camera animation — GSAP

- Vanilla: https://anirudhatalmale6-alt.github.io/polaroid-gsap-demo/
- React: https://anirudhatalmale6-alt.github.io/polaroid-gsap-demo/react-live/

A mobile/tablet-first Polaroid capture sequence built on GSAP core only — no plugins,
no framework, no build step. Also packaged as a single React component in `react/`.

**The sequence**

1. Shutter button press, lens iris snaps shut and reopens
2. Flash — a hot burst at the flash window plus a full-frame wash, with a weaker
   secondary bounce so it doesn't fall off cleanly (real flashes never do)
3. Shutter sound fired off the same timeline label as the flash, so the two can
   never drift apart no matter how the timeline is scrubbed or replayed
4. Body recoil — a short kick, a counter-swing, then an elastic settle, plus a
   small lateral jitter riding on top
5. First print rolls out on a motor whir, stutters as the rollers release it,
   drops into place and settles with a slight natural rotation
6. Second print half-ejects and stays parked with its top edge inside the slot
7. Both prints develop — the emulsion veil fades off after they are out

**Notes**

- Camera is a single inline SVG. Prints are DOM. Everything animated is `transform`
  or `opacity`, so it stays on the compositor on mobile.
- The prints sit in a container clipped at the slot line, so anything above that
  line is genuinely still inside the camera — no masks, no overflow tricks per element.
- All resting positions are percentages of the elements themselves, so the whole
  scene scales to any container width without re-tuning.
- Total payload: GSAP core (~72 KB) + ~14 KB of markup, CSS and JS. No image
  requests, no audio file.
- `prefers-reduced-motion` jumps straight to the end state.

**Swapping in the real assets**

- The two print faces are `.img-before` / `.img-after` in `style.css` — replace the
  placeholder gradients with the PSD exports (the develop veil sits over the top and
  keeps working).
- Camera art: replace the inline `<svg id="camera">` with the PSD export. The only
  thing the JS needs from it is the ids it animates — `#flashBurst`, `#shutterIris`,
  `#shutterBtn`, `#led`, `#ledGlow`.
- For a real shutter recording, set `window.SHUTTER_SRC = 'shutter.mp3'` before
  `app.js` loads; the synthesised sound is only there so the demo ships with no
  audio asset.
- WebM: if the flash or the print texture is supplied as video, it drops into the
  same timeline via a `.call()` on the `snap` label — same sync guarantee.

---

## React

`react/src/PolaroidCamera.jsx` + `react/src/polaroid-camera.css` — that pair is the
whole component. Works in Vite, CRA and Next.js (app router). Only dependency is
`gsap`.

```jsx
import { useRef } from 'react'
import PolaroidCamera from './PolaroidCamera'

export default function Hero() {
  const cam = useRef(null)

  return (
    <>
      <PolaroidCamera
        ref={cam}
        playOnView                 // fires once when it scrolls into view
        sound
        shutterSrc="/shutter.mp3"  // omit and it synthesises the click
        photos={[
          { title: 'BEFORE', caption: 'the starting point ♡', src: '/before.png' },
          { title: 'AFTER',  caption: 'the final look ♡',     src: '/after.png'  },
        ]}
        onComplete={() => {}}
      />
      <button onClick={() => cam.current.play()}>Replay</button>
    </>
  )
}
```

**Props**

| prop | default | what it does |
| --- | --- | --- |
| `photos` | placeholders | `[first, second]` — the first ejects and settles below, the second parks in the slot. Each `{ title, caption, src, alt }`. |
| `playOnView` | `true` | fires once, when 40% of the component scrolls into view |
| `autoPlay` | `false` | fires on mount instead |
| `sound` | `true` | live toggle — reads through to a running timeline without rebuilding it |
| `shutterSrc` | `null` | real shutter recording; without it the click is synthesised |
| `cameraSrc` | `null` | swap the drawn SVG body for an exported image |
| `onComplete` | — | called when the sequence lands |

**Ref handle:** `play()`, `reset()`, `timeline` (the raw GSAP timeline, if you want
to scrub it or pin it to a scroll position).

**Notes for dropping it into a page**

- The component is one square-ish block that fills its parent's width and keeps its
  own aspect ratio. Give it a container width — it needs nothing else.
- Type inside it is sized in `cqw`, so the titles and captions scale with the
  component rather than the viewport. A camera in a narrow column looks right
  without overrides.
- The GSAP timeline is built inside a `gsap.context()` and reverted on unmount, so
  StrictMode's double-mount in dev doesn't leave a second timeline running.
- SVG gradient ids are namespaced with `useId()`, so two cameras on one page don't
  fight over them.

---

## Invoice / receipt printer

`react/src/ReceiptPrinter.jsx` + `react/src/receipt-printer.css`. Same shape as the
camera — one import, `gsap` the only dependency, `playOnView` by default, and a ref
with `play()` / `reset()` / `timeline`.

```jsx
<ReceiptPrinter
  playOnView
  receipt={{
    heading: 'INVOICE',
    meta: ['No. 0000', 'Date --/--/----'],
    lines: [{ label: 'Item one', value: '00.00' }],
    subtotal: { label: 'Subtotal', value: '00.00' },
    total: { label: 'TOTAL', value: '00.00' },
    footer: 'thank you',
  }}
/>
```

Pass `paperSrc` / `printerSrc` instead to use exported artwork rather than the
built-in markup and SVG.

**The paper ejects upward, and that is the whole trick**

Feeding a receipt *down* out of a front slot gives you a choice of two wrong
things. Slide the strip down as a finished sheet and the bottom of the invoice
leads, so the heading arrives last. Pin it and grow it downward instead and it
reads as the paper being dragged down rather than pushed out.

A real thermal printer ejects upward out of the top, and doing that makes the
problem disappear: the paper genuinely travels, the heading leads because it is
the top of the job, and the finished receipt still reads top to bottom the right
way round. It is also a plain `yPercent`, so it stays on the compositor and
survives being scrubbed.

**The feed is stepped, not eased.** `steps(36)` over 3.6s gives discrete line
feeds. A smooth glide reads as a sliding image; the steps are what make it
mechanical. The motor sound is chopped at the same rate so the buzz and the paper
advance line up.

The leading edge stays straight, because paper still on the roll has a straight
edge — a torn zigzag only makes sense after a tear-off, which isn't in there yet.
