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

**Title and caption** ("BEFORE" / "the starting point"): bake them into the PNG
if you want your exact brand font, or leave them off and I render them as live
text. Live text is sharper and editable; baked is a guaranteed font match. Your
call — I just need to know which, because a baked title in the PNG plus a
rendered one on top would double up.

---

## 2. Invoice printer

### Body canvas — 1800 × 1143

| layer | what it does |
| --- | --- |
| `body` | everything else, flattened |
| `button` | the feed / print button |
| `lamp` | status light |

The **paper slot** is at **y = 249** from the top of the canvas. The invoice
rises up out of it.

### Paper — 1023 × 1593, optional

Only needed if you want a printed letterhead or a paper texture behind the text.
Leave it out and I draw the stock.

**No invoice artwork is needed.** The receipt content comes from your form
fields and is rendered as live text, so it stays sharp at any size and changes
with the form. I do need the actual field list to match the layout — mine is
currently a guess (heading, number, date, line items, subtotal, total, footer) —
and a decision on whether a long item name should truncate with an ellipsis
(what it does now) or wrap onto a second line.

---

## 3. Audio

One shutter click for the camera. WAV or MP3, either is fine.

**Trim it hard to the first transient.** If there is 40ms of silence before the
click, the click lands 40ms after the flash and reads as out of sync. That is
not fixable at my end without guessing the offset, and guessing it is worse than
you trimming it.

A motor whir for the print ejecting and one for the paper feed are nice to have.
Without any audio files at all the demo still works — the sounds are currently
synthesised in the browser, which is why the live demo has sound with no audio
assets. Real recordings are better; they are just not blocking.

---

## What I still do not have

- The **WebM files** mentioned in the original brief — I have asked twice what is
  in them. If they are a flash or a print-develop texture they drop straight into
  the timeline; if they are reference recordings of the animation you want, they
  are useful in a completely different way. Either is fine, I just need to know.
- The **form field list** for the invoice.
- Whether the card **title/caption is baked or live**.
