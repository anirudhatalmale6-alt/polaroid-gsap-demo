# Asset spec

Exact export specs for the Polaroid camera and the invoice printer.

Every number below was measured off the built components, not estimated. The
components are laid out on a 600-unit grid; these canvases are that grid at ×3,
which is why they all come out as whole pixels. ×3 also covers the largest phone
at full device pixel ratio, so nothing is ever upscaled.

---

## Global rules

These three are what actually cause problems, so they matter more than the
dimensions:

1. **Every layer is exported at the full canvas size**, not cropped to its own
   content. If the shutter button is exported as a 90×90 crop, I have to be told
   where it sat, and any error shows up as the button drifting when it presses.
   Full-size layers stack with zero offset maths.
2. **The body must touch the left and right canvas edges.** Both assets are
   device width — the point is that it feels like you are holding the thing — so
   any transparent margin baked into the export becomes a permanent gutter down
   both sides of the phone that no amount of CSS can remove.
3. **PNG-24 with alpha, not PNG-8.** PNG-8 bands badly on the soft shadows under
   the camera and the print.

SVG is better than PNG if the artwork is vector — it stays sharp at any size and
is usually smaller. If it is vector, send SVG and ignore the pixel sizes.

---

## 1. Camera

### Body canvas — 1800 × 1491

| layer | what it does |
| --- | --- |
| `body` | everything that does not move independently, flattened |
| `shutter` | the button — it presses in |
| `flash` | the flash window / lamp — it lights |
| `lens` | iris or lens ring — the iris snaps shut and reopens |
| `led` | status light — it blinks |

Only those five move. Anything else can be flattened into `body`.

The **film slot** sits at **y = 1123** from the top of the canvas. The prints
emerge from there, so the slot in the artwork needs to be at that height — or
tell me where it is in your art and I move the number instead. Either way it has
to match, or prints appear out of the wrong place.

### Card frames — 1392 × 1539, two of them (BEFORE and AFTER)

The photo area is a **1197 × 1197 square hole**, centred left to right (97 in
from each side) and 162 down from the top.

**The hole must be genuinely transparent** — alpha zero, not white, not a grey
placeholder, not a smart object with a photo still in it. The user's uploaded
photo is placed behind the frame and shows through. I read the hole's position
straight out of the alpha channel, so you do not send me any coordinates; but if
it is filled with white instead of being cut out, there is nothing to read and
the photo will be hidden behind it.

Square because the uploads are Instagram-style nail photos. A wide window
centre-crops the fingertips off, which on a nails brand removes the subject.

**Title and caption are typed by the user, so leave them off the PNG entirely.**
They are rendered as live text on top of the frame. That means the frame needs
blank space for them: **162px clear above the hole and 180px clear below.** Put
artwork in either band and the user's own words land on top of it.

Both are pinned to a single line, and overlong input ends in an ellipsis rather
than wrapping. That is deliberate: every resting position in the animation is a
percentage *of the card*, so if a long caption could wrap to two lines the card
would grow, the settled print would move, and this frame's proportions would no
longer match. At the card's real size roughly **28 characters of title** and
**44 of caption** fit before it truncates. If your form lets people type more
than that, cap the field at those lengths and nobody ever sees an ellipsis.

Send the font (or its name) if you want the live text in your brand face —
otherwise it renders in the closest web-safe match.

---

## 2. Invoice printer

### Body canvas — 1800 × 1143

| layer | what it does |
| --- | --- |
| `body` | everything else, flattened |
| `button` | the feed / print button |
| `lamp` | status light |

**Export it exactly the way the camera was exported the second time** — that
set was right. Every layer on one 1800 × 1143 canvas, each part left where it
belongs, nothing trimmed and nothing resized. In Photoshop: File > Export >
Layers To Files with *Trim Layers* unchecked.

Real transparent holes in the body where the button and lamp sit are fine —
that is what the camera did and it is the better way. I put a plate behind the
stack so nothing shows through when a part moves.

**The slot moved to the bottom (9 Sep).** The invoice now feeds *downward* as
the reader scrolls, so the slot belongs on the front lip near the base — at
about **y = 983** of the 1143, not y = 249 — that is the slot mouth; the paper
clears the front lip at **y = 1070**. A slot on the top deck with paper
coming out downward reads as the paper going back *into* the machine.

As with the camera, if the slot in your artwork sits somewhere else, leave it
where it looks right and tell me — I move my number to your art, not the other
way round.

### Paper — 1024 × 1591, optional

Only needed if you want a printed letterhead or a paper texture behind the text.
Leave it out and I draw the stock.

**No invoice artwork is needed.** The receipt content comes from your form
fields and is rendered as live text, so it stays sharp at any size and changes
with the form.

Long item names **wrap onto a second line** (your call, 7 Sep) instead of
truncating. The price stays on the first line, right-aligned, which is how a
printed invoice reads. A single unbroken 40-character word still cannot push
past the edge of the paper.

The field list is still a guess on my side — heading, number, date, line items,
subtotal, total, footer. Send the real one whenever it is ready and I match the
layout to it.

---

## 3. Audio

One shutter click for the camera. WAV or MP3, either is fine.

You have said exact sync is not critical, so this is no longer a blocker — but
if the file is easy to trim, **trim it to the first transient**. Leading silence
delays the click by however long it is, and I cannot remove that at my end
without guessing. The click and the flash fire off the same point in the
timeline, so with a trimmed file they stay together however often it replays.

A motor whir for the print ejecting and one for the paper feed are nice to have.
Without any audio files at all the demo still works — the sounds are currently
synthesised in the browser, which is why the live demo has sound with no audio
assets. Real recordings are better; they are just not blocking.

---

## What I still do not have

- The **camera body** and **card frame** exports, and the **printer body**
  export, per the specs above. These are what actually block finishing.
- The **form field list** for the invoice — not blocking, the layout works on
  placeholders until it arrives.
- The **shutter recording** — not blocking either, the sound is synthesised in
  the browser meanwhile.

Settled and no longer open: title and caption are live text (leave them off the
frame), long item names wrap, the shutter does not have to be frame-accurate,
and the WebM files are set aside.
